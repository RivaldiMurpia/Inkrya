'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '@/lib/supabase';
import {WRITER_MODEL_CHOICES} from '@/lib/ai/models';
import type {Chapter} from './studio';

type AgentStage='context'|'plan'|'draft'|'guardian'|'recheck'|'repair'|'critic'|'canon';
type AgentStep={stage:AgentStage;detail:string;atIndex?:number;issueCount?:number};
type GuardianIssue={type:string;severity:string;claim:string;evidence_ids:string[];explanation:string;repair_hint:string};
type CanonProposal={
 id:string;target_kind:'fact'|'event'|'knowledge';payload:Record<string,string|null>;quote:string;
 status:'proposed'|'accepted'|'rejected';revision:number;chapter_id:string|null;title:string|null;current:boolean;
};
type ProposalDraft={target_kind:CanonProposal['target_kind'];claim:string;quote:string;evidence_ids:string[];subject?:string|null;predicate?:string|null;object?:string|null;confidence?:number|null;story_time?:string|null;title?:string|null;description?:string|null;event_type?:string|null;character?:string|null;fact_key?:string|null;knows?:boolean|null};
type WriteResult={
 draft:string;plan:{goal:string;scenePlan:string[];suggestedStoryTime:string|null};issues:GuardianIssue[];findings?:GuardianIssue[];
 resolved:boolean;repairAttempts:number;critic:{strengths:string[];improvements:string[]}|null;
 proposals?:ProposalDraft[];generationId?:string;steps:AgentStep[];warning:string|null;
};
const STAGE_LABELS:Record<AgentStage,string>={
 context:'Memahami cerita',plan:'Rencana bab dibuat',draft:'Draf dibuat',
 guardian:'Pemeriksaan kontinuitas',recheck:'Pemeriksaan ulang',repair:'Perbaikan dicoba',critic:'Kritik selesai',
 canon:'Usulan kanon diperiksa',
};
const KIND_LABELS:Record<CanonProposal['target_kind'],string>={
 fact:'Fakta',event:'Peristiwa',knowledge:'Pengetahuan karakter',
};
const DECISION_ERRORS=Object.entries({
 STALE_SOURCE:'Bab berubah sejak draf diterapkan. Perbarui Memory lalu tinjau ulang.',
 QUOTE_NOT_IN_CHAPTER:'Kutipan usulan tidak ditemukan di bab. Terapkan draf sebagai bab dulu.',
 REVISION_CONFLICT:'Usulan berubah di tempat lain. Muat ulang daftar.',
 PROPOSAL_NOT_ATTACHED:'Terapkan draf sebagai bab baru dulu sebelum menyetujui usulan ini.',
 CHARACTER_NOT_FOUND:'Karakter pada usulan ini tidak ada di daftar karakter proyek.',
} as Record<string,string>);
const decisionError=(message:string)=>{
 for(const [code,text] of DECISION_ERRORS)if(message.includes(code))return text;
 return 'Usulan kanon gagal disimpan. Muat ulang daftar.';
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
 const [decided,setDecided]=useState<Record<string,CanonProposal['status']>>({}),[busy,setBusy]=useState(false);
 const [proposals,setProposals]=useState<CanonProposal[]>([]);
 const [attached,setAttached]=useState(false);
 // Writer model choice: the two owner-accepted prose-gate models. Empty value = the
 // server default (env WRITER_MODEL); the server allowlists the ID either way.
 const [writerModel,setWriterModel]=useState('');
 const active=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort()}},[projectId]);
 async function loadProposals(){
  const {data,error:rpcError}=await db.rpc('memory_overview',{p_project_id:projectId});
  if(rpcError||!data)return;
  const rows=(data.proposals??[]) as Record<string,unknown>[];
  if(active.current)setProposals(rows.filter(row=>row.status==='proposed').map(row=>({
   id:String(row.id),target_kind:row.target_kind as CanonProposal['target_kind'],
   payload:(row.payload??{}) as Record<string,string|null>,quote:String(row.quote??''),
   status:row.status as CanonProposal['status'],revision:Number(row.revision??0),
   chapter_id:(row.chapter_id as string|null)??null,title:(row.title as string|null)??null,
   current:Boolean(row.current),
  })));
 }
 useEffect(()=>{if(projectId)void loadProposals()},[projectId]);
 async function decide(row:CanonProposal,decision:'accepted'|'rejected',claim?:string){
  if(busy)return;setBusy(true);setError('');
  try{
   const {error:rpcError}=await db.rpc('decide_canon_proposals',{
    p_decisions:[{id:row.id,revision:row.revision,decision}],
    p_edits:claim?{[row.id]:claim}:null,
   });
   if(rpcError)throw Error(decisionError(rpcError.message));
   if(active.current)setDecided(old=>({...old,[row.id]:decision}));
   await loadProposals();
  }catch(e){if(active.current)setError((e as Error).message)}
  finally{if(active.current)setBusy(false)}
 }
 async function submit(){
  if(running||instruction.trim().length<3)return;
  setRunning(true);setError('');setStages([]);setResult(null);setApplied(false);
  const ctl=new AbortController();controller.current=ctl;
  try{
   const {data}=await db.auth.getSession();
   if(!data.session)throw Error('Login diperlukan.');
   const res=await fetch('/api/write',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({projectId,instruction:instruction.trim(),writerModel:writerModel||undefined}),signal:ctl.signal});
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
  if(!result||applying||attached)return;setApplying(true);setError('');
  try{
   // A retry after a failed attach must not insert a second chapter: chapter creation
   // happens only when this generation has no attached chapter yet.
   if(result.generationId){
    const {data:existing}=await db.from('canon_proposals').select('chapter_id').eq('generation_id',result.generationId).not('chapter_id','is',null).limit(1);
    const boundChapter=existing?.[0]?.chapter_id as string|undefined;
    if(boundChapter){setAttached(true);setApplied(true);return}
   }
   const doc=draftToDoc(result.draft);
   const plain=result.draft;
   const title=`Bab ${chapters.length+1}`;
   const position=chapters.length?Math.max(...chapters.map(c=>c.position))+1:0;
   const {data:row,error:insErr}=await db.from('chapters').insert({project_id:projectId,title,position,content_json:doc,plain_text:plain}).select().single();
   if(insErr)throw insErr;
   // Persist through save_chapter so revision bookkeeping matches writer.tsx.
   const {error:rpcErr}=await db.rpc('save_chapter',{p_chapter_id:row.id,p_base_revision:row.revision_number,p_title:title,p_content:doc,p_plain_text:plain});
   if(rpcErr)throw rpcErr;
   // Canon derives from the manuscript the author explicitly accepted (arch §6): only now
   // do this generation's proposals become decidable. A failed attach is surfaced, and the
   // apply button stays enabled (retry re-runs only the attach, no second chapter) —
   // otherwise the cards would stay stuck on "apply the draft first" with no way forward.
   if(result.generationId){
    const {error:attachErr}=await db.rpc('attach_canon_proposals',{p_generation_id:result.generationId,p_chapter_id:row.id});
    if(attachErr)throw Error('Bab tersimpan, tetapi usulan kanon belum terhubung. Coba "Pakai sebagai bab baru" sekali lagi untuk menghubungkan usulan.');
    setAttached(true);
   }
   if(active.current){setApplied(true);onChapterCreated(row as Chapter);await loadProposals()}
  }catch(e){if(active.current)setError((e as Error).message||'Gagal menyimpan bab baru.')}
  finally{if(active.current)setApplying(false)}
 }
 const unresolved=result&&!result.resolved;
 return <section className="planning memory-panel"><span className="eyebrow">TULIS DENGAN KRYA · ALPHA</span><h1>Menulis bab, dipandu ceritamu.</h1><p>Krya menyusun rencana, menulis draf, memeriksa kontinuitas terhadap bukti cerita, memperbaiki bila perlu, lalu memberi kritik. Semua tahap yang dijalankan ditampilkan.</p>
  {error&&<div className="notice" role="status">{error}</div>}
  <form className="memory-question" onSubmit={e=>{e.preventDefault();void submit()}}>
   <h2>Instruksi bab</h2>
   <label>Instruksi penulis<textarea required minLength={3} maxLength={2000} value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Lanjutkan adegan saat ini. Mira mengonfrontasi Dr. Vale soal Project Helios, dan Arka mengeluarkan pistoler untuk memaksa dia menjawab."/></label>
   <label>Model penulis
    <select value={writerModel} onChange={e=>setWriterModel(e.target.value)}>
     <option value="">Bawaan server</option>
     {WRITER_MODEL_CHOICES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
    </select>
   </label>
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
   {(result.findings?.length??0)>0&&<section aria-label="Temuan pemeriksaan kontinuitas"><h3>Temuan pemeriksaan kontinuitas</h3><p className="muted">{result.resolved?'Semua temuan di bawah sudah diperbaiki pada draf akhir.':'Temuan yang belum teratasi tetap ada pada draf.'}</p>
    {(result.findings??result.issues).map((issue,i)=><article className="memory-card" key={i}><span className="eyebrow">{ISSUE_LABELS[issue.type]??issue.type} · {SEVERITY_LABELS[issue.severity]??issue.severity}</span><h4>{issue.claim}</h4><p>{issue.explanation}</p><p className="muted">Saran perbaikan: {issue.repair_hint}</p><p className="muted">Bukti: {issue.evidence_ids.join(', ')}</p></article>)}
   </section>}
   {result.critic&&(result.critic.strengths.length>0||result.critic.improvements.length>0)&&<section aria-label="Kritik Krya"><h3>Kritik Krya</h3>
    {result.critic.strengths.map((s,i)=><p key={`s${i}`}>✓ {s}</p>)}
    {result.critic.improvements.map((s,i)=><p key={`i${i}`}>→ {s}</p>)}
   </section>}
   <div className="row">
    <button className="primary" disabled={applying||running||applied} onClick={()=>void apply()}>{applying?'Menyimpan…':applied?'Sudah dipakai':'Pakai sebagai bab baru'}</button>
    {applied&&<span className="muted">Bab baru dibuat. Tinjau usulan kanon di bawah, atau buka bab lewat daftar manuskrip.</span>}
   </div>
  </article>}
  {proposals.length>0&&<section aria-label="Usulan kanon"><h2>Usulan kanon ({proposals.length})</h2>
   <p>Krya mengusulkan fakta/peristiwa/pengetahuan baru dari draf. Tidak ada yang menjadi kanon sebelum kamu menyetujuinya. Setujui hanya setelah draf dipakai sebagai bab.</p>
   {proposals.map(row=><article className="memory-card" key={row.id}>
    <span className="eyebrow">{KIND_LABELS[row.target_kind]} · {decided[row.id]==='accepted'?'Disetujui':decided[row.id]==='rejected'?'Ditolak':'Menunggu keputusan'}{row.title?` · ${row.title}`:''}</span>
    <h3>+ {row.payload.claim??''}</h3>
    {row.payload.subject&&row.payload.predicate&&row.payload.object&&<p className="muted">{row.payload.subject} · {row.payload.predicate} · {row.payload.object}</p>}
    {row.target_kind==='knowledge'&&<p className="muted">{row.payload.character} {String(row.payload.knows)==='false'?'tidak tahu':'tahu'} · {row.payload.story_time??'waktu belum diketahui'}</p>}
    {row.target_kind==='event'&&<p className="muted">{row.payload.story_time} · {row.payload.event_type}</p>}
    <blockquote>{row.quote}</blockquote>
    <p className="muted">{!row.chapter_id?'Draf belum dipakai sebagai bab — terapkan dulu untuk bisa menyetujui.':row.current?'Sumber terkini.':'Sumber berubah sejak draf diterapkan.'}</p>
    <div className="row">
     <button className="secondary" disabled={busy||!row.chapter_id||!row.current} onClick={()=>void decide(row,'accepted')}>Setujui</button>
     <button className="secondary" disabled={busy||!row.chapter_id||!row.current} onClick={()=>{const claim=prompt('Edit klaim kanon (kutipan bukti tetap dipertahankan)',row.payload.claim??'');if(claim?.trim()&&claim.trim()!==row.payload.claim)void decide(row,'accepted',claim.trim())}}>Edit</button>
     <button className="secondary" disabled={busy||!row.chapter_id} onClick={()=>void decide(row,'rejected')}>Tolak</button>
    </div>
   </article>)}
  </section>}
 </section>;
}
