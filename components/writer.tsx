'use client';
import {useEditor,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bold,Italic,Heading2,Quote,Undo2,Redo2,Save} from 'lucide-react';
import type {Chapter} from './studio';
import {db} from '@/lib/supabase';
import VersionHistory from './version-history';
// JSON from Postgres may have a different key order from TipTap's JSON.
function sameDocument(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
 return Object.keys(left).length===Object.keys(right).length&&Object.keys(left).every(key=>Object.hasOwn(right,key)&&sameDocument(left[key],right[key]));
}
export default function Writer({chapter,userId,onDirty,onSaved}:{chapter:Chapter;userId:string;onDirty:(v:boolean)=>void;onSaved:(c:Chapter)=>void}){
 const [history,setHistory]=useState(false);
 const [title,setTitle]=useState(chapter.title),[state,setState]=useState('Tersimpan'),[words,setWords]=useState(chapter.plain_text.trim()?chapter.plain_text.trim().split(/\s+/u).length:0),[recovery,setRecovery]=useState(false);
 const revision=useRef(chapter.revision_number),pending=useRef(false),saving=useRef(false),conflicted=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),titleRef=useRef(title),mounted=useRef(true);
 const saveRef=useRef<()=>Promise<void>>(async()=>{});const key=`inkrya:draft:${userId}:${chapter.id}`;
 const acknowledged=useRef({title:chapter.title,content:chapter.content_json});
 const editor=useEditor({extensions:[StarterKit],immediatelyRender:false,content:chapter.content_json,editorProps:{attributes:{'aria-label':'Isi bab',class:'manuscript'}},onUpdate:({editor})=>{setWords(editor.getText().trim()?editor.getText().trim().split(/\s+/u).length:0);mark(editor.getJSON())}});
 // Editability/history are UI state. TipTap emits `update` by default here,
 // which otherwise creates a phantom save (and a stale revision on remount).
 useEffect(()=>{editor?.setEditable(!history,false)},[history,editor]);
 async function restoreVersion(v:{title:string;plain_text?:string;content_json?:Record<string,unknown>}){
  if(!editor||pending.current||saving.current||conflicted.current||!v.content_json)return false;
  saving.current=true;onDirty(true);setState('Memulihkan versi…');
  try{const {data,error}=await db.rpc('save_chapter',{p_chapter_id:chapter.id,p_base_revision:revision.current,p_title:v.title,p_content:v.content_json,p_plain_text:v.plain_text??''});
   if(!mounted.current)return false;
   if(error){setState(error.message.includes('REVISION_CONFLICT')?'Bab berubah di tab lain. Muat ulang sebelum memulihkan versi.':'Pemulihan gagal. Coba lagi.');return false}
   const row=data as Chapter;revision.current=row.revision_number;acknowledged.current={title:row.title,content:row.content_json};titleRef.current=row.title;setTitle(row.title);editor.commands.setContent(row.content_json,{emitUpdate:false});setWords(row.plain_text.trim().split(/\s+/u).filter(Boolean).length);onSaved(row);setState(`Versi dipulihkan sebagai revisi ${row.revision_number}`);return true;
  }finally{saving.current=false;if(mounted.current)onDirty(false)}
 }
 function openHistory(){if(pending.current||saving.current||conflicted.current||recovery){setState('Simpan atau pulihkan draft lokal sebelum membuka riwayat.');return}setHistory(true)}
 function mark(content:Record<string,unknown>){pending.current=true;onDirty(true);try{localStorage.setItem(key,JSON.stringify({content,title:titleRef.current,baseRevision:revision.current}))}catch{setState('Penyimpanan lokal penuh — segera simpan ke server')};if(!conflicted.current)setState('Belum tersimpan');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void saveRef.current(),1500)}
 const save=useCallback(async()=>{
  if(!editor||!pending.current||saving.current||conflicted.current)return;
  if(timer.current){clearTimeout(timer.current);timer.current=null}
  const content=editor.getJSON(),text=editor.getText(),savedTitle=titleRef.current;
  const finish=()=>{pending.current=false;onDirty(false);try{localStorage.removeItem(key)}catch{};setRecovery(false);setState('Tersimpan')};
  // Repeated update notifications are not new edits. Compare to the last
  // acknowledged document, never to a newer unconfirmed server revision.
  if(savedTitle===acknowledged.current.title&&sameDocument(content,acknowledged.current.content)){finish();return}
  saving.current=true;setState('Menyimpan…');
  try{
   const {data,error}=await db.rpc('save_chapter',{p_chapter_id:chapter.id,p_base_revision:revision.current,p_title:savedTitle,p_content:content,p_plain_text:text});
   if(!mounted.current)return;
   if(error){if(error.message.includes('REVISION_CONFLICT')){conflicted.current=true;setState('Konflik versi. Salin draftmu, lalu muat ulang bab.')}else setState('Gagal menyimpan. Draft lokal tetap tersedia; coba simpan lagi.');return}
   const row=data as Chapter;revision.current=row.revision_number;
   acknowledged.current={title:row.title,content:row.content_json};onSaved(row);
   if(titleRef.current===row.title&&sameDocument(editor.getJSON(),row.content_json)){finish()}
   else{
    try{localStorage.setItem(key,JSON.stringify({content:editor.getJSON(),title:titleRef.current,baseRevision:revision.current}))}catch{}
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>void saveRef.current(),1500);
   }
  }catch{if(mounted.current)setState('Gagal menyimpan. Draft lokal tetap tersedia; coba simpan lagi.')}
  finally{saving.current=false}
 },[editor,chapter.id,key,onDirty,onSaved]);
 saveRef.current=save;
 useEffect(()=>{mounted.current=true;setRecovery(!!localStorage.getItem(key));const unload=(e:BeforeUnloadEvent)=>{if(pending.current){e.preventDefault();e.returnValue=''}};const shortcut=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();void saveRef.current()}};const online=()=>void saveRef.current();window.addEventListener('beforeunload',unload);window.addEventListener('keydown',shortcut);window.addEventListener('online',online);return ()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);window.removeEventListener('beforeunload',unload);window.removeEventListener('keydown',shortcut);window.removeEventListener('online',online)}},[key]);
 function restoreLocal(){try{const draft=JSON.parse(localStorage.getItem(key)||'null');if(!draft)return;titleRef.current=draft.title;setTitle(draft.title);editor?.commands.setContent(draft.content,{emitUpdate:false});setWords(editor?.getText().trim().split(/\s+/u).filter(Boolean).length??0);if(draft.baseRevision!==revision.current){conflicted.current=true;setState('Draft berasal dari versi lama. Salin teks untuk menggabungkan perubahan.')}mark(draft.content);setRecovery(false)}catch{setState('Draft lokal tidak dapat dibaca.')}}
 function downloadDraft(){const url=URL.createObjectURL(new Blob([titleRef.current+'\n\n'+(editor?.getText()??'')],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='inkrya-recovery.txt';a.click();URL.revokeObjectURL(url)}
 return <><div className="editor-toolbar"><div className="row"><button aria-label="Tebal" onClick={()=>editor?.chain().focus().toggleBold().run()}><Bold size={17}/></button><button aria-label="Miring" onClick={()=>editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></button><span className="divider"/><button aria-label="Subjudul" onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}><Heading2 size={19}/></button><button aria-label="Kutipan" onClick={()=>editor?.chain().focus().toggleBlockquote().run()}><Quote size={17}/></button><span className="divider"/><button aria-label="Urungkan" onClick={()=>editor?.chain().focus().undo().run()}><Undo2 size={17}/></button><button aria-label="Ulangi" onClick={()=>editor?.chain().focus().redo().run()}><Redo2 size={17}/></button></div><button className="save-button" disabled={history} onClick={openHistory}>Riwayat</button><button className="save-button" disabled={history} onClick={()=>void save()}><Save size={16}/> Simpan</button></div>{recovery&&<div className="banner">Ada draft lokal yang belum tersimpan.<button onClick={restoreLocal}>Pulihkan draft</button></div>}{conflicted.current&&<div className="banner"><button onClick={downloadDraft}>Unduh draft untuk pemulihan</button></div>}{history?<VersionHistory chapter={chapter} onClose={()=>setHistory(false)} onRestore={restoreVersion}/>:<div className="page-paper"><span className="eyebrow">MANUSKRIP · DRAFT</span><input aria-label="Judul bab" className="chapter-title" value={title} onChange={e=>{setTitle(e.target.value);titleRef.current=e.target.value;mark(editor?.getJSON()??{})}}/><div className="title-rule"/><EditorContent editor={editor}/></div>}<footer className="editor-status"><span>{words.toLocaleString('id-ID')} kata</span><span role="status">{state}</span></footer></>
}
