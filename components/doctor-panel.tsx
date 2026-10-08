'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '@/lib/supabase';
// Story Doctor panel (Phase 6). Stateless: the report is fetched from /api/memory doctor,
// persisted copies render from the AI history. No health scores — issue counts and measured
// coverage only (PRD §22 requires real defined checks; HACKATHON_IMPLEMENTATION.md:72).
type ResolvedEvidence={id:string;label:string};
type Finding={engine:'ai'|'code';kind:string;severity:'critical'|'high'|'medium'|'low';claim:string;explanation:string;evidence_ids:string[];chapter_id:string|null;resolvedEvidence:ResolvedEvidence[]};
type Coverage={chaptersTotal:number;chaptersReady:number;chaptersSummarized:number;chaptersWithStoryTime:number;canonFacts:number;canonEvents:number;canonKnowledge:number;charactersTracked:number;worldRulesProvided:boolean;skipped:string[]};
type DoctorResponse={coverage:Coverage;findings:Finding[];aiAvailable:boolean;warning?:string|null;error?:string};
const KIND_LABELS:Record<string,string>={plot_hole:'Plot hole',forgotten_character:'Karakter menghilang',timeline_conflict:'Konflik lini masa',knowledge_error:'Kesalahan pengetahuan',relationship_drift:'Relasi bergeser',world_rule_violation:'Aturan dunia',pov_problem:'Masalah sudut pandang',unresolved_thread:'Utas menggantung'};
const SEVERITY_LABELS:Record<string,string>={critical:'KRITIS',high:'TINGGI',medium:'SEDANG',low:'RENDAH'};
const SEVERITY_ORDER={critical:0,high:1,medium:2,low:3} as const;
export default function DoctorPanel({projectId,onOpenChapter}:{projectId:string;onOpenChapter:(id:string)=>Promise<void>}){
 const [report,setReport]=useState<DoctorResponse|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[source,setSource]=useState<{label:string}|null>(null);
 const active=useRef(true);
 useEffect(()=>{active.current=true;void loadLatest();return()=>{active.current=false}},[projectId]);
 async function api(body:object){
  const {data:session}=await db.auth.getSession();
  if(!session.session)throw Error('Login diperlukan.');
  const r=await fetch('/api/memory',{method:'POST',headers:{Authorization:`Bearer ${session.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({projectId,...body}),signal:AbortSignal.timeout(55000)});
  const json=await r.json();
  if(!r.ok||json.error)throw Error(json.error||'Pemeriksaan gagal dimuat.');
  return json as DoctorResponse;
 }
 // The latest persisted doctor report renders on mount, so reopening the panel never
 // pretends a fresh analysis ran. Running again costs one AI slot.
 async function loadLatest(){
  try{
   const {data:session}=await db.auth.getSession();
   if(!session.session)return;
   const {data:h}=await db.from('ai_generations').select('id,result').eq('project_id',projectId).eq('action','doctor').eq('status','complete').order('created_at',{ascending:false}).limit(1);
   const saved=h?.[0];
   if(saved){try{setReport(JSON.parse(saved.result) as DoctorResponse)}catch{setReport(null)}}
  }catch{/* panel still usable; user can run the doctor */}
 }
 async function run(){
  setBusy(true);setError('');
  try{
   const result=await api({action:'doctor'});
   if(active.current)setReport(result);
  }catch(e){if(active.current)setError((e as Error).message)}finally{setBusy(false)}
 }
 const findings=[...(report?.findings??[])].sort((a,b)=>SEVERITY_ORDER[a.severity]-SEVERITY_ORDER[b.severity]);
 const counts=findings.reduce<Record<string,number>>((acc,f)=>{acc[f.severity]=(acc[f.severity]??0)+1;return acc},{});
 const summaryLine=report?(findings.length?`${findings.length} temuan`:'Tidak ada temuan pada pemeriksaan ini'):'';
 return <section className="planning memory-panel"><span className="eyebrow">INKRYA STORY DOCTOR · ALPHA</span><h1>Pemeriksaan manuskrip.</h1><p>Story Doctor memeriksa manuskrip secara menyeluruh: kontradiksi, karakter menghilang, konflik waktu, pengetahuan karakter, utas menggantung, dan aturan dunia. Setiap temuan memuat bukti yang bisa dibuka. Ini bukan penilaian kualitas — tidak ada skor kesehatan.</p>{error&&<div className="notice" role="status">{error}</div>}
 <div className="memory-status"><div><h2>Pemeriksaan</h2><p>{report?summaryLine:'Belum ada laporan. Jalankan pemeriksaan pertama.'}</p></div><div className="row"><button className="primary" disabled={busy} onClick={()=>void run()}>{busy?'Krya memeriksa…':'Jalankan pemeriksaan'}</button></div></div>
 <p className="muted">Satu pemeriksaan memakai satu slot dari 20 permintaan AI per 24 jam. Laporan tidak mengubah cerita atau kanon.</p>
 {report&&report.warning&&<div className="notice">{report.warning}</div>}
 {report&&<section className="memory-analysis"><h2>Cakupan pemeriksaan</h2><p>{report.coverage.chaptersReady}/{report.coverage.chaptersTotal} bab siap diperiksa · {report.coverage.chaptersSummarized} bab punya ringkasan · {report.coverage.chaptersWithStoryTime} bab punya waktu cerita</p><p>{report.coverage.canonFacts} fakta kanon · {report.coverage.canonEvents} peristiwa · {report.coverage.canonKnowledge} pengetahuan · {report.coverage.charactersTracked} karakter dipantau · aturan dunia {report.coverage.worldRulesProvided?'tersedia':'kosong'}</p>{report.coverage.skipped.length>0&&<details><summary>Cek yang dilewati ({report.coverage.skipped.length})</summary>{report.coverage.skipped.map((s,i)=><p className="muted" key={i}>{s}</p>)}</details>}{!report.aiAvailable&&<p className="notice">Pemeriksaan AI tidak berjalan pada laporan ini; hanya pemeriksaan otomatis yang tampil.</p>}</section>}
 {report&&findings.length>0&&<section><h2>Temuan ({findings.length})</h2>{(['critical','high','medium','low'] as const).filter(severity=>counts[severity]).map(severity=>(<div key={severity}>{findings.filter(f=>f.severity===severity).map(f=><article className="memory-card" key={f.claim}><span className="eyebrow">{SEVERITY_LABELS[f.severity]} · {KIND_LABELS[f.kind]??f.kind} · {f.engine==='code'?'pemeriksaan otomatis':'pemeriksaan AI'}</span><h3>{f.claim}</h3><p>{f.explanation}</p><div className="row">{f.resolvedEvidence.map(ev=><button key={ev.id} className="secondary" onClick={()=>setSource(ev)}>{ev.label}</button>)}{f.chapter_id&&<button className="secondary" onClick={()=>{const id=f.chapter_id;if(id)void onOpenChapter(id)}}>Buka bab</button>}</div></article>)}</div>))}</section>}
 {report&&findings.length===0&&!busy&&<section><h2>Temuan</h2><p className="muted">Tidak ada temuan. Cakupan pemeriksaan di atas menunjukkan basis yang dipakai.</p></section>}
 {source&&<section className="memory-source" aria-label="Detail bukti"><div className="row"><h2>{source.label}</h2><button className="secondary" onClick={()=>setSource(null)}>Tutup</button></div></section>}
 </section>;
}
