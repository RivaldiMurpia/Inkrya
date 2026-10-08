import {generateKryaText} from '@/lib/ai/generate';
import {prepareModel} from '@/lib/ai/provider';
import {configurationErrorMessage,resolveEmbeddingConfig} from '@/lib/ai/models';
import {createEmbedding,EMBEDDING_MODEL_LABEL} from '@/lib/ai/embed';
import {MEMORY_SYSTEM,MEMORY_ANALYZE} from '@/lib/memory-prompts';
import {prepareAskContext,noEvidenceAnswer,answerAsk} from '@/lib/ask';
import {createHash} from 'node:crypto';
import {userDatabase} from '@/lib/server-auth';
import {parseModelJSON,validateInsights,type MemorySource} from '@/lib/memory-validation';
import {buildDoctorPackage,doctorCoverage,checkForgottenCharacters,type DoctorPackage} from '@/lib/doctor';
import {validateDoctorFindings,evidenceLabels,dedupeFindings,type DoctorDropStats} from '@/lib/doctor-validation';
import {DOCTOR_SYSTEM} from '@/lib/agent-prompts';
export const maxDuration=60;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=(text:string)=>createHash('md5').update(text).digest('hex');
type PendingEmbedding={id:string;content:string;source_revision:number;source_hash:string};

// Best-effort backfill. Indexing succeeds even if embedding provider is unavailable.
async function embedPendingChunks(db:Awaited<ReturnType<typeof userDatabase>>,projectId:string){
 if(!db)return;
 let config;try{config=resolveEmbeddingConfig()}catch{return}
 if(!config)return;
 // Two bounded rounds prevent Vercel from terminating unawaited background work.
 for(let round=0;round<2;round++){
  const {data}=await db.rpc('memory_pending_embeddings',{p_project_id:projectId,p_model:EMBEDDING_MODEL_LABEL,p_limit:40});
  const pending=(data??[]) as PendingEmbedding[];
  if(!pending.length)break;
  for(const chunk of pending){
   try{const embedding=await createEmbedding(chunk.content,config.model,config.apiKey);await db.from('story_embeddings').upsert({project_id:projectId,chunk_id:chunk.id,source_revision:chunk.source_revision,source_hash:chunk.source_hash,model:EMBEDDING_MODEL_LABEL,embedding},{onConflict:'chunk_id,model'});}catch{return}
  }
 }
}

export async function GET(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 const url=new URL(req.url),projectId=url.searchParams.get('projectId')??'',sourceId=url.searchParams.get('sourceId');
 if(!uuid.test(projectId))return Response.json({error:'Proyek tidak valid.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 if(sourceId){
  const {data:s}=await db.from('story_chunks').select('*').eq('project_id',projectId).eq('id',sourceId).maybeSingle();
  if(!s)return Response.json({error:'Sumber tidak tersedia.'},{status:404});
  const {data:c}=await db.from('chapters').select('title,revision_number,plain_text').eq('id',s.chapter_id).single();
  return Response.json({source:s,title:c?.title,current:!!c&&c.revision_number===s.source_revision&&hash(c.plain_text)===s.source_hash},{headers:{'Cache-Control':'no-store'}});
 }
 const {data,error}=await db.rpc('memory_overview',{p_project_id:projectId});
 if(error)return Response.json({error:'Status Memory gagal dimuat.'},{status:503});
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 let body;try{const raw=await req.text();if(raw.length>8000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Permintaan tidak valid.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {projectId,action,question,chunkId}=body;
 if(typeof projectId!=='string'||!uuid.test(projectId)||!['index','ask','analyze','doctor'].includes(action))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 if(action==='index'){
  const {data,error}=await db.rpc('process_memory',{p_project_id:projectId,p_force:true});
  if(error)return Response.json({error:'Indeks gagal diperbarui.'},{status:503});
  await embedPendingChunks(db,projectId);
  return Response.json(data);
 }
 if(action==='ask')return ask(db,projectId,question);
 if(action==='doctor')return doctor(db,projectId);
 return analyze(db,projectId,chunkId);
}

// Story Doctor (Phase 6): whole-manuscript report. One run = one quota slot; the AI call is
// bounded, fail-closed, and evidence ids must resolve — a fabricated finding never renders.
async function doctor(db:NonNullable<Awaited<ReturnType<typeof userDatabase>>>,projectId:string){
 let pack:DoctorPackage;
 try{pack=await buildDoctorPackage(db,projectId)}catch{return Response.json({error:'Konteks Memory gagal dimuat.'},{status:503})}
 // generateKryaText hard-fails above 48000 input chars, so trim summary bodies (the least
 // dense payload) until system+prompt fit. Coverage is computed after the trim so the UI
 // never overstates the basis the checks actually saw.
 const systemLen=DOCTOR_SYSTEM.length;
 const promptSize=(p:typeof pack)=>systemLen+JSON.stringify({
  chapters:p.chapters.map(({id,title,position,story_time,ready,summarized})=>({id,title,position,story_time,ready,summarized})),
  ringkasan_bab:p.summaries.map(s=>({id:s.chunk_id,bab:s.title,bagian:s.chunk_index+1,ringkasan:s.summary})),
  facts:p.facts,events:p.events,knowledge:p.knowledge,characters:p.characters,world_rules:p.worldRules,
 }).length;
 if(promptSize(pack)>48000){
  let cut=600;
  while(cut>40){
   const trimmed={...pack,summaries:pack.summaries.map(s=>({...s,summary:s.summary.slice(0,cut)}))};
   if(promptSize(trimmed)<=48000){pack=trimmed;break}
   cut=Math.floor(cut/2);
  }
 }
 const coverage=doctorCoverage(pack);
 // Deterministic engine — free, auditable, no model involved.
 const codeFindings=checkForgottenCharacters(pack).map(f=>({
  engine:'code' as const,kind:f.kind,severity:f.severity,claim:f.claim,explanation:f.explanation,
  evidence_ids:f.evidence_ids,chapter_id:f.chapter_id,
  resolvedEvidence:f.evidence_ids.map(id=>({id,label:evidenceLabels(pack).get(id)??id})),
 }));
 let aiFindings:ReturnType<typeof validateDoctorFindings>=[];
 if(!pack.chapters.length)return Response.json({coverage,findings:codeFindings,aiAvailable:false,warning:null});
 let prepared;try{prepared=await prepareModel('memory')}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 const {data:run,error}=await db.from('ai_generations').insert({project_id:projectId,action:'doctor',model:prepared.config.provider+':'+prepared.config.id,prompt:`[Story Doctor] Analisis manuskrip`}).select('id').single();
 if(error)return Response.json({error:error.message.includes('AI_DAILY_LIMIT')?'Batas 20 permintaan AI dalam 24 jam tercapai.':error.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum permintaan AI berikutnya.':'Riwayat AI gagal disiapkan.'},{status:429});
 try{
  const result=await generateKryaText(prepared,{maxOutputTokens:1800,timeoutMs:35000,system:DOCTOR_SYSTEM,prompt:JSON.stringify({
   chapters:pack.chapters.map(({id,title,position,story_time,ready,summarized})=>({id,title,position,story_time,ready,summarized})),
   // Summaries are the AI engine's prose basis: current-chunk AI summaries in reading order,
   // citable as evidence ids just like canon rows (builder already sorts by position).
   ringkasan_bab:pack.summaries.map(s=>({id:s.chunk_id,bab:s.title,bagian:s.chunk_index+1,ringkasan:s.summary})),
   facts:pack.facts,events:pack.events,knowledge:pack.knowledge,characters:pack.characters,
   world_rules:pack.worldRules,
   pengingat:'Urutan bab TIDAK sama dengan urutan waktu. Nilai konflik pada story_time, bukan posisi bab.',
  })},{generationId:run.id,projectId,userId:db.authenticatedUserId,sourceCount:pack.chapters.length,workflow:'story-doctor'});
  const drops:DoctorDropStats={proposed:0,kept:0,badShape:0,badEnum:0,badText:0,noEvidence:0};
  aiFindings=dedupeFindings(validateDoctorFindings(parseModelJSON(result.text),pack,drops));
  // Counts only in logs — never model prose (same rule as generateKryaText).
  if(!aiFindings.length&&drops.proposed)console.error('story-doctor','FINDINGS_ALL_DROPPED',JSON.stringify(drops));
  const findings=[...aiFindings.map(f=>({...f,engine:'ai' as const})),...codeFindings];
  const {error:history}=await db.from('ai_generations').update({result:JSON.stringify({coverage,findings}),status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
  return Response.json({coverage,findings,aiAvailable:true,dropStats:drops,warning:history?'Laporan belum tersimpan di riwayat.':result.tracing==='failed'?'Laporan tersimpan; trace observabilitas belum terkirim.':null});
 }catch(e){
  // Deterministic findings still answer — the doctor degrades to engine='code', honestly.
  await db.from('ai_generations').update({status:'error'}).eq('id',run.id);
  return Response.json({coverage,findings:codeFindings,aiAvailable:false,warning:'Pemeriksaan AI gagal; hanya hasil pemeriksaan otomatis yang ditampilkan.'});
 }
}

async function ask(db:NonNullable<Awaited<ReturnType<typeof userDatabase>>>,projectId:string,question:unknown){
 if(typeof question!=='string'||question.trim().length<3||question.length>1500)return Response.json({error:'Pertanyaan harus 3–1.500 karakter.'},{status:400});
 let preparedContext;
 try{preparedContext=await prepareAskContext(db,projectId,question);}catch{return Response.json({error:'Konteks Memory gagal dimuat.'},{status:503})}
 if(!preparedContext.context.evidence.length)return Response.json(noEvidenceAnswer(preparedContext));
 let prepared;try{prepared=await prepareModel('qa')}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 const {data:run,error}=await db.from('ai_generations').insert({project_id:projectId,action:'chat',model:prepared.config.provider+':'+prepared.config.id,prompt:`[Ask My Story] ${question}`,context_sources:preparedContext.context.evidence.map(source=>`${source.title} · v${source.source_revision} · bagian ${source.chunk_index+1} · ${source.id}`)}).select('id').single();
 if(error)return Response.json({error:error.message.includes('AI_DAILY_LIMIT')?'Batas 20 permintaan AI dalam 24 jam tercapai.':error.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum permintaan AI berikutnya.':'Riwayat AI gagal disiapkan.'},{status:429});
 try{
  const output=await answerAsk(db,projectId,question,run.id,prepared,preparedContext);
  const {result,...answer}=output;
  const {error:saved}=await db.from('ai_generations').update({result:JSON.stringify(answer),status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
  return Response.json({...answer,id:run.id,warning:saved?'Jawaban belum tersimpan di riwayat. Salin sebelum menutup.':answer.warning??(result.tracing==='failed'?'Jawaban tersimpan; trace observabilitas belum terkirim.':null)});
 }catch(e){
  await db.from('ai_generations').update({status:'error'}).eq('id',run.id);
  return Response.json({error:(e as Error).message==='STALE_SOURCE'?'Bab berubah saat AI menjawab. Perbarui Memory lalu tanyakan lagi.':'Jawaban belum dapat divalidasi atau disimpan. Tidak ada fakta otomatis disetujui. Coba lagi setelah 10 detik.'},{status:503});
 }
}

async function analyze(db:NonNullable<Awaited<ReturnType<typeof userDatabase>>>,projectId:string,chunkId:unknown){ if(typeof chunkId!=='string'||!uuid.test(chunkId))return Response.json({error:'Pilih bagian naskah.'},{status:400});
 const {data:s}=await db.from('story_chunks').select('*').eq('project_id',projectId).eq('id',chunkId).maybeSingle();if(!s)return Response.json({error:'Sumber tidak ditemukan.'},{status:404});
 const {data:c}=await db.from('chapters').select('title,plain_text,revision_number,story_time').eq('id',s.chapter_id).single();if(!c||c.revision_number!==s.source_revision||hash(c.plain_text)!==s.source_hash)return Response.json({error:'Bab telah berubah. Perbarui Memory terlebih dahulu.'},{status:409});
 const {data:existing}=await db.from('memory_insights').select('id').eq('chunk_id',chunkId).maybeSingle();if(existing)return Response.json({saved:true,existing:true});
 let prepared;try{prepared=await prepareModel('memory')}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 const source:MemorySource={...s,title:c.title,story_time:c.story_time??null};
 const {data:run,error}=await db.from('ai_generations').insert({project_id:projectId,action:'brainstorm',model:prepared.config.provider+':'+prepared.config.id,prompt:`[Memory] Ringkas ${chunkId}`,context_sources:[`${source.title} · v${source.source_revision} · bagian ${source.chunk_index+1} · ${source.id}`]}).select('id').single();
 if(error)return Response.json({error:error.message.includes('AI_DAILY_LIMIT')?'Batas 20 permintaan AI dalam 24 jam tercapai.':error.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum permintaan AI berikutnya.':'Riwayat AI gagal disiapkan.'},{status:429});
 try{
  const result=await generateKryaText(prepared,{maxOutputTokens:1800,timeoutMs:35000,system:MEMORY_SYSTEM+MEMORY_ANALYZE,prompt:JSON.stringify({question:null,sources:[source]})},{generationId:run.id,projectId,userId:db.authenticatedUserId,sourceCount:1,workflow:'memory-analyze'});
  const valid=validateInsights(parseModelJSON(result.text),source.content);
  const {error:saved}=await db.rpc('save_memory_insights',{p_chunk_id:chunkId,p_generation_id:run.id,p_summary:valid.summary,p_facts:valid.facts,p_events:valid.events,p_knowledge:valid.knowledge});if(saved)throw Error('SAVE_INSIGHTS_FAILED');
  const {error:history}=await db.from('ai_generations').update({result:JSON.stringify(valid),status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
  return Response.json({saved:true,warning:history?'Analisis tersimpan; riwayat AI belum diperbarui.':result.tracing==='failed'?'Analisis tersimpan; trace observabilitas belum terkirim.':null});
 }catch{
  await db.from('ai_generations').update({status:'error'}).eq('id',run.id);
  return Response.json({error:'Analisis belum dapat divalidasi atau disimpan. Tidak ada fakta otomatis disetujui. Coba lagi setelah 10 detik.'},{status:503});
 }
}
