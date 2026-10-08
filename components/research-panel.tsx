'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '@/lib/supabase';
// Tavily research panel (Phase 7). Opt-in and standalone: the author asks a real-world
// research question, gets cited notes, and nothing here can touch story canon — the notes
// live only in this run's ai_generations.result (PRD §10: research is separated from canon).
type ResearchSource={index:number;title:string;url:string;content:string};
type ResearchNote={heading:string;body:string;citations:number[]};
type ResearchNotes={summary:string;notes:ResearchNote[];unanswered:string[]};
type ResearchDropStats={notesProposed:number;notesKept:number;badShape:number;badText:number;noCitation:number;badUrl:number};
type ResearchResponse={
 topic:string;queries:{query:string;reason:string}[];sources:ResearchSource[];notes:ResearchNotes;
 dropStats:ResearchDropStats;credits:number;creditsRemaining:number;steps:{stage:string;detail:string}[];warning?:string|null;error?:string;
};
// A source URL that is not http/https is dropped by the API validator; the panel refuses to
// render one as a link even if a response carried it, so a hostile URL is never clickable.
const safeHref=(url:string):string|null=>{
 try{const parsed=new URL(url);return parsed.protocol==='http:'||parsed.protocol==='https:'?url:null}catch{return null}
};

export default function ResearchPanel({projectId}:{projectId:string}){
 const [topic,setTopic]=useState(''),[report,setReport]=useState<ResearchResponse|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reportTime,setReportTime]=useState<string|null>(null);
 const active=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort()}},[projectId]);
 async function run(){
  if(busy||topic.trim().length<3)return;
  setBusy(true);setError('');setReport(null);
  const ctl=new AbortController();controller.current=ctl;
  try{
   const {data:session}=await db.auth.getSession();
   if(!session.session)throw Error('Login diperlukan.');
   const r=await fetch('/api/research',{method:'POST',headers:{Authorization:`Bearer ${session.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({projectId,topic:topic.trim()}),signal:ctl.signal});
   const json=await r.json();
   if(!r.ok||json.error)throw Error(json.error||'Riset gagal dijalankan.');
   if(active.current){setReport(json as ResearchResponse);setReportTime(new Date().toLocaleString('id-ID'))}
  }catch(e){
   if(active.current)setError((e as Error).name==='AbortError'?'Riset dihentikan.':(e as Error).message);
  }finally{if(active.current)setBusy(false)}
 }
 const dropped=report?.dropStats?Math.max(0,report.dropStats.notesProposed-report.dropStats.notesKept):0;
 const droppedNoCitation=report?.dropStats?.noCitation??0;
 const sourceByIndex=new Map((report?.sources??[]).map(s=>[s.index,s]));
 return <section className="planning memory-panel"><span className="eyebrow">RISET TAVILY · ALPHA</span><h1>Riset latar dari web.</h1><p>Krya mencari fakta dunia nyata untuk latar ceritamu — tempat, waktu, cuaca, teknologi, istilah, atau konteks budaya — lalu menyusun catatan bersitasi dari sumber yang benar-benar ditemukan. Catatan riset <strong>tidak masuk kanon cerita</strong>: ia hanya bahan bacaanmu, tidak pernah mengubah fakta, peristiwa, atau pengetahuan karakter.</p>
 {error&&<div className="notice" role="alert">{error}</div>}
 <form className="memory-question" onSubmit={e=>{e.preventDefault();void run()}}>
  <h2>Topik riset</h2>
  <label>Topik atau pertanyaan latar<textarea required minLength={3} maxLength={300} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Contoh: Kehidupan harian dan transportasi di Bandung tahun 2010"/></label>
  <div className="row"><button className="primary" disabled={busy||topic.trim().length<3}>{busy?'Krya meriset…':'Jalankan riset'}</button></div>
  <p className="muted">Satu riset memakai satu slot dari 20 permintaan AI per 24 jam, dan menagih meter kredit Tavily terpisah (maksimal 3 kredit per riset).</p>
 </form>
 {report&&<article className="memory-answer">
  <h2>Catatan riset</h2>
  {reportTime&&<p className="muted">Laporan {reportTime}</p>}
  {report.credits>0&&<p className="muted">Riset ini memakai {report.credits} kredit Tavily. Sisa kuota riset harianmu {report.creditsRemaining} kredit.</p>}
  {report.warning&&<div className="notice">{report.warning}</div>}
  {report.notes.summary&&<p className="krya-prose">{report.notes.summary}</p>}
  {(report.queries.length>0)&&<p className="muted">{report.queries.length} query · {report.sources.length} sumber</p>}
  {report.notes.notes.map((note,i)=><article className="memory-card" key={i}><h3>{note.heading}</h3><p>{note.body}</p><p className="muted">Sumber: {note.citations.map(c=>`[${c}] ${sourceByIndex.get(c)?.title??''}`.trim()).join(' · ')}</p></article>)}
  {report.notes.notes.length===0&&!report.warning&&<p className="muted">Tidak ada catatan yang dapat divalidasi dari sumber yang ditemukan.</p>}
  {dropped>0&&<p className="notice">{dropped} catatan usulan model dibuang validator{droppedNoCitation?` (${droppedNoCitation} tanpa sitasi yang cocok)`:''}.</p>}
  {report.notes.unanswered.length>0&&<section><h3>Belum terjawab sumber</h3><ul>{report.notes.unanswered.map((u,i)=><li key={i}>{u}</li>)}</ul></section>}
  {report.sources.length>0&&<section aria-label="Sumber"><h3>Sumber ({report.sources.length})</h3><ul>{report.sources.map(s=>{const href=safeHref(s.url);return <li key={s.index}>[{s.index}] {href?<a href={href} target="_blank" rel="noopener noreferrer">{s.title}</a>:<span>{s.title}</span>}</li>})}</ul></section>}
  {report.sources.length===0&&<p className="muted">Tidak ada sumber web yang ditemukan. Coba kata kunci lain.</p>}
 </article>}
 </section>;
}
