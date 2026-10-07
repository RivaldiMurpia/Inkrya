'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '@/lib/supabase';
import type {Chapter} from './studio';

type AgentStage='context'|'plan'|'draft'|'guardian'|'recheck'|'repair'|'critic';
type AgentStep={stage:AgentStage;detail:string;atIndex?:number;issueCount?:number};
type GuardianIssue={type:string;severity:string;claim:string;evidence_ids:string[];explanation:string;repair_hint:string};
type WriteResult={
 draft:string;plan:{goal:string;scenePlan:string[];suggestedStoryTime:string|null};issues:GuardianIssue[];
 resolved:boolean;repairAttempts:number;critic:{strengths:string[];improvements:string[]}|null;
 steps:AgentStep[];warning:string|null;
};
const STAGE_LABELS:Record<AgentStage,string>={
 context:'Memahami cerita',plan:'Rencana bab dibuat',draft:'Draf dibuat',
 guardian:'Pemeriksaan kontinuitas',recheck:'Pemeriksaan ulang',repair:'Perbaikan dicoba',critic:'Kritik selesai',
};
const ISSUE_LABELS:Record<string,string>={
 canon_contradiction:'Kontradiksi fakta kanon',timeline_contradiction:'Kontradiksi lini masa',
 knowledge_leak:'Kebocoran pengetahuan karakter',location_impossible:'Lokasi tidak mungkin',
 alive_dead_conflict:'Konflik status hidup/mati',relationship_inconsistency:'Inkonsistensi relasi',
 world_rule_violation:'Pelanggaran aturan dunia',behavior_inconsistency:'Inkonsistensi perilaku',
};
const SEVERITY_LABELS:Record<string,string>={
 critical:'Kritis',high:'Tinggi',medium:'Sedang',low:'Rendah',
};
// Draft application is client-side: the server never writes to the manuscript or canon.
function draftToDoc(draft:string){return {type:'doc',content:draft.split(/\n{2,}/u).filter(Boolean).map(p=>({type:'paragraph',content:[{type:'text',text:p}]}))}}

export default function WritePanel({projectId,chapters,onChapterCreated}:{projectId:string;chapters:Chapter[];onChapterCreated:(c:Chapter)=>void}){
 const [instruction,setInstruction]=useState(''),[stages,setStages]=useState<AgentStep[]>([]),[running,setRunning]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<WriteResult|null>(null),[applying,setApplying]=useState(false),[applied,setApplied]=useState(false);
 const active=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort()}},[projectId]);
 async function submit(){
  if(running||instruction.trim().length<3)return;
  setRunning(true);setError('');setStages([]);setResult(null);setApplied(false);
  const ctl=new AbortController();controller.current=ctl;
  try{
   const {data}=await db.auth.getSession();
   if(!data.session)throw Error('Login diperlukan.');
   const res=await fetch('/api/write',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({projectId,instruction:instruction.trim()}),signal:ctl.signal});
   if(!res.ok||!res.body){const json=await res.json().catch(()=>({error:'Penulisan gagal.'}));throw Error(json.error||'Penulisan gagal.')}
   const reader=res.body.getReader(),dec=new TextDecoder();let buf='';
   for(;;){
    const {done,value}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});
    let i;while((i=buf.indexOf('\n'))>=0){
     const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;
     let evt;try{evt=JSON.parse(line)}catch{continue}
     if(!active.current)return;
     if(evt.type==='stage')setStages(old=>[...old,{stage:evt.stage,detail:evt.detail,atIndex:evt.atIndex,issueCount:evt.issueCount}]);
     else if(evt.type==='result')setResult(evt);
     else if(evt.type==='error')setError(evt.error);
    }
   }
  }catch(e){
   if(active.current)setError((e as Error).name==='AbortError'?'Penulisan dihentikan.':(e as Error).message);
  }finally{
   if(active.current)setRunning(false);
  }
 }
 async function apply(){
  if(!result||applying)return;setApplying(true);setError('');
  try{
   const doc=draftToDoc(result.draft);
   const plain=result.draft;
   const title=`Bab ${chapters.length+1}`;
   const position=chapters.length?Math.max(...chapters.map(c=>c.position))+1:0;
   const {data:row,error:insErr}=await db.from('chapters').insert({project_id:projectId,title,position,content_json:doc,plain_text:plain}).select().single();
   if(insErr)throw insErr;
   // Persist through save_chapter so revision bookkeeping matches writer.tsx.
   const {error:rpcErr}=await db.rpc('save_chapter',{p_chapter_id:row.id,p_base_revision:row.revision_number,p_title:title,p_content:doc,p_plain_text:plain});
   if(rpcErr)throw rpcErr;
   if(active.current){setApplied(true);onChapterCreated(row as Chapter)}
  }catch(e){if(active.current)setError((e as Error).message||'Gagal menyimpan bab baru.')}
  finally{if(active.current)setApplying(false)}
 }
 const unresolved=result&&!result.resolved;
 return <section className="planning memory-panel"><span className="eyebrow">TULIS DENGAN KRYA · ALPHA</span><h1>Menulis bab, dipandu ceritamu.</h1><p>Krya menyusun rencana, menulis draf, memeriksa kontinuitas terhadap bukti cerita, memperbaiki bila perlu, lalu memberi kritik. Semua tahap yang dijalankan ditampilkan.</p>
  {error&&<div className="notice" role="status">{error}</div>}
  <form className="memory-question" onSubmit={e=>{e.preventDefault();void submit()}}>
   <h2>Instruksi bab</h2>
   <label>Instruksi penulis<textarea required minLength={3} maxLength={2000} value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Lanjutkan adegan saat ini. Mira mengonfrontasi Dr. Vale soal Project Helios, dan Arka mengeluarkan pistoler untuk memaksa dia menjawab."/></label>
   <div className="row">
    <button className="primary" disabled={running||applying}>{running?'Krya menulis…':'Tulis bab dengan Krya'}</button>
    {running&&<button type="button" className="secondary" onClick={()=>controller.current?.abort()}>Hentikan</button>}
   </div>
   <p className="muted">Satu penulisan memakai 1 dari 20 permintaan AI per 24 jam dan menjalankan beberapa panggilan model di dalamnya.</p>
  </form>
  {stages.length>0&&<section aria-label="Progres Krya"><h2>Progres</h2><ul className="write-stages">{stages.map((s,i)=><li key={i}><strong>{STAGE_LABELS[s.stage]??s.stage}</strong>{s.detail&&<span> · {s.detail}</span>}</li>)}</ul></section>}
  {result&&<article className="memory-answer">
   <h2>Draf</h2>
   {unresolved&&<div className="notice">Masalah kontinuitas belum teratasi. Tinjau draf sebelum dipakai.</div>}
   <p className="krya-prose">{result.draft}</p>
   {result.plan?.suggestedStoryTime&&<p className="muted">Saran waktu cerita dari rencana: {result.plan.suggestedStoryTime} · waktu bab diatur lewat Memory.</p>}
   {result.issues.length>0&&<section aria-label="Masalah kontinuitas"><h3>Masalah kontinuitas</h3>
    {result.issues.map((issue,i)=><article className="memory-card" key={i}><span className="eyebrow">{ISSUE_LABELS[issue.type]??issue.type} · {SEVERITY_LABELS[issue.severity]??issue.severity}</span><h4>{issue.claim}</h4><p>{issue.explanation}</p><p className="muted">Saran perbaikan: {issue.repair_hint}</p><p className="muted">Bukti: {issue.evidence_ids.join(', ')}</p></article>)}
   </section>}
   {result.critic&&(result.critic.strengths.length>0||result.critic.improvements.length>0)&&<section aria-label="Kritik Krya"><h3>Kritik Krya</h3>
    {result.critic.strengths.map((s,i)=><p key={`s${i}`}>✓ {s}</p>)}
    {result.critic.improvements.map((s,i)=><p key={`i${i}`}>→ {s}</p>)}
   </section>}
   <div className="row">
    <button className="primary" disabled={applying||running} onClick={()=>void apply()}>{applying?'Menyimpan…':'Pakai sebagai bab baru'}</button>
    {applied&&<span className="muted">Bab baru dibuat. Buka daftar bab untuk menyunting.</span>}
   </div>
  </article>}
 </section>;
}
