'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '@/lib/supabase';
import type {Chapter} from './studio';

export type PlanningView='characters'|'story_bibles'|'outline_items'|'notes';
export const planningLabels:Record<PlanningView,string>={characters:'Characters',story_bibles:'Story Bible',outline_items:'Outline',notes:'Notes'};
type Item={id?:string;revision?:number;[key:string]:unknown};
const fields:Record<PlanningView,[string,string][]>={
 characters:[['name','Nama karakter'],['aliases','Alias (pisahkan dengan koma)'],['role','Peran dalam cerita'],['description','Deskripsi'],['appearance','Penampilan'],['personality','Kepribadian'],['background','Latar belakang'],['goals','Tujuan'],['fears','Ketakutan'],['arc','Perkembangan karakter']],
 story_bibles:[['premise','Premis'],['synopsis','Sinopsis'],['themes','Tema'],['tone','Nuansa cerita'],['style_instructions','Gaya penulisan'],['world_rules','Aturan dunia']],
 notes:[['title','Judul'],['note_type','Kategori'],['plain_text','Isi catatan']],
 outline_items:[['title','Judul'],['description','Ringkasan'],['position','Urutan'],['item_type','Jenis'],['status','Status'],['chapter_id','Bab terkait']]
};
const attributes=['appearance','personality','background','goals','fears','arc'];
function fresh(view:PlanningView):Item{return view==='characters'?{role:'supporting',include_in_ai_context:true}:view==='notes'?{note_type:'general',include_in_ai_context:false}:view==='outline_items'?{item_type:'chapter',status:'planned',position:0}:{};}
function decode(row:Item):Item{return {...row,...(row.attributes as object??{}),aliases:Array.isArray(row.aliases)?row.aliases.join(', '):''};}
export default function StoryPlanning({projectId,view,chapters,onDirty,initialId}:{initialId?:string;projectId:string;view:PlanningView;chapters:Chapter[];onDirty:(dirty:boolean)=>void}){
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const [items,setItems]=useState<Item[]>([]),[draft,setDraft]=useState<Item>(fresh(view)),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[archived,setArchived]=useState(false);
 useEffect(()=>{let active=true;db.from(view).select('*').eq('project_id',projectId).order(view==='outline_items'?'position':'created_at').then(({data,error})=>{if(!active)return;setLoading(false);if(error){setFailed(true);setMessage(error.message);return}setItems(data??[]);const target=initialId?data?.find(row=>row.id===initialId&&!row.deleted_at):view==='story_bibles'?data?.[0]:undefined;setDraft(target?decode(target):fresh(view));if(initialId&&!target)setMessage('Entri tidak lagi tersedia. Hasil pencarian mungkin sudah berubah.');});return()=>{active=false}},[projectId,view,initialId]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 function mark(value:boolean){setDirty(value);onDirty(value)}
 function choose(item:Item){if(dirty&&!confirm('Tinggalkan perubahan yang belum disimpan?'))return;setDraft(decode(item));mark(false);setMessage('')}
 function change(key:string,value:unknown){setDraft(old=>({...old,[key]:value}));mark(true);setMessage('')}
 async function save(archive?:boolean){
  if(busy||loading||failed)return;setBusy(true);setMessage('');
  const payload:Item={};
  for(const [key] of fields[view]){if(view==='characters'&&attributes.includes(key))continue;payload[key]=String(draft[key]??'').trim()}
  if(view==='characters'){payload.aliases=String(draft.aliases??'').split(',').map(s=>s.trim()).filter(Boolean);payload.attributes=Object.fromEntries(attributes.map(k=>[k,String(draft[k]??'')]));payload.include_in_ai_context=Boolean(draft.include_in_ai_context)}
  if(view==='notes')payload.include_in_ai_context=Boolean(draft.include_in_ai_context);
  if(view==='outline_items'){payload.position=Number(draft.position??0);payload.chapter_id=draft.chapter_id||null}
  if(archive!==undefined)payload.deleted_at=archive?new Date().toISOString():null;
  try{
   const result=draft.id?await db.from(view).update(payload).eq('project_id',projectId).eq('id',draft.id).eq('revision',draft.revision).select().maybeSingle():await db.from(view).insert({...payload,project_id:projectId}).select().single();
   if(!mounted.current)return;
   if(result.error)throw result.error;
   if(!result.data){setMessage('Data berubah di tab lain. Salin perubahanmu sebelum memuat ulang halaman. Data di sini belum ditimpa.');return}
   const row=result.data as Item;setItems(old=>[...old.filter(x=>x.id!==row.id),row]);setDraft(decode(row));mark(false);setMessage(archive===undefined?'Tersimpan.':archive?'Diarsipkan.':'Dipulihkan.');
  }catch(error){setMessage((error as {code?:string}).code==='23505'?'Data sudah ada atau bab sudah terhubung ke outline lain. Periksa pilihanmu.':(error as Error).message||'Gagal menyimpan. Coba lagi.')}finally{setBusy(false)}
 }
 const visible=items.filter(x=>view==='story_bibles'||Boolean(x.deleted_at)===archived).sort((a,b)=>view==='outline_items'?Number(a.position)-Number(b.position)||String(a.id).localeCompare(String(b.id)):String(a.created_at).localeCompare(String(b.created_at)));
 return <section className="planning"><span className="eyebrow">PERENCANAAN CERITA</span><h1>{planningLabels[view]}</h1><p>{view==='story_bibles'?'Pegangan utama untuk menjaga dunia dan arah ceritamu.':'Bangun detail cerita, satu ide pada satu waktu.'}</p>{message&&<div role="status" className="notice">{message}</div>}{loading?<p>Memuat…</p>:failed?<button className="secondary" onClick={()=>window.location.reload()}>Muat ulang</button>:<div className={view==='story_bibles'?'planning-layout bible-layout':'planning-layout'}>{view!=='story_bibles'&&<aside className="planning-list"><button className="primary" disabled={busy} onClick={()=>choose(fresh(view))}>+ Buat baru</button><label className="check"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Tampilkan arsip</label>{visible.length===0&&<p className="muted">Belum ada {archived?'arsip':'data'}. Buat entri pertamamu.</p>}{visible.map(item=><button disabled={busy} key={item.id} className={draft.id===item.id?'nav active':'nav'} onClick={()=>choose(item)}>{view==='outline_items'&&`${item.position}. `}{String(item.name??item.title)}</button>)}</aside>}<form className="planning-form" onSubmit={e=>{e.preventDefault();void save()}}><div className="row planning-heading"><h2>{draft.id?'Edit':'Buat'} {planningLabels[view]}</h2><span className="muted">{dirty?'Belum disimpan':'Tersimpan di proyek'}</span></div><fieldset disabled={busy||Boolean(draft.deleted_at)}>{fields[view].map(([key,label])=><label key={key}>{label}{key==='chapter_id'?<select value={String(draft[key]??'')} onChange={e=>change(key,e.target.value)}><option value="">Tanpa bab terkait</option>{chapters.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select>:key==='item_type'||key==='status'?<select value={String(draft[key]??'')} onChange={e=>change(key,e.target.value)}>{(key==='item_type'?['act','part','chapter','scene','beat','custom']:['planned','in_progress','drafted','revised','complete']).map(v=><option key={v}>{v}</option>)}</select>:['name','title','aliases','role','note_type','position'].includes(key)?<input type={key==='position'?'number':'text'} step={key==='position'?1:undefined} required={['name','title','position'].includes(key)} maxLength={key==='position'?undefined:200} value={String(draft[key]??'')} onChange={e=>change(key,e.target.value)}/>:<textarea rows={key==='plain_text'?10:4} value={String(draft[key]??'')} onChange={e=>change(key,e.target.value)}/>}</label>)}{(view==='characters'||view==='notes')&&<><label className="check"><input type="checkbox" checked={Boolean(draft.include_in_ai_context)} onChange={e=>change('include_in_ai_context',e.target.checked)}/> Izinkan sebagai konteks Krya AI</label><p className="muted">Preferensi disimpan untuk saat Krya AI tersedia. Belum ada data dikirim ke model AI.</p></>}</fieldset><div className="row"><button className="primary" disabled={busy||Boolean(draft.deleted_at)}>{busy?'Menyimpan…':'Simpan'}</button>{draft.id&&view!=='story_bibles'&&<button type="button" className="secondary" disabled={busy} onClick={()=>{if(!dirty||confirm('Simpan perubahan sekaligus mengubah status arsip?'))void save(!draft.deleted_at)}}>{draft.deleted_at?'Pulihkan':'Arsipkan'}</button>}</div></form></div>}</section>
}
