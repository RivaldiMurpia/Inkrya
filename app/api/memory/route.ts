import {generateKryaText} from '@/lib/ai/generate';
import {prepareModel} from '@/lib/ai/provider';
import {configurationErrorMessage} from '@/lib/ai/models';
import {MEMORY_SYSTEM,MEMORY_ASK,MEMORY_ANALYZE} from '@/lib/memory-prompts';
import {createHash} from 'node:crypto';
import {userDatabase} from '@/lib/server-auth';
import {parseModelJSON,validateAnswer,validateInsights,type MemorySource} from '@/lib/memory-validation';
export const maxDuration=60;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=(text:string)=>createHash('md5').update(text).digest('hex');
export async function GET(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 const url=new URL(req.url),projectId=url.searchParams.get('projectId')??'',sourceId=url.searchParams.get('sourceId');
 if(!uuid.test(projectId))return Response.json({error:'Proyek tidak valid.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 if(sourceId){const {data:s}=await db.from('story_chunks').select('*').eq('project_id',projectId).eq('id',sourceId).maybeSingle();if(!s)return Response.json({error:'Sumber tidak tersedia.'},{status:404});const {data:c}=await db.from('chapters').select('title,revision_number,plain_text').eq('id',s.chapter_id).single();return Response.json({source:s,title:c?.title,current:!!c&&c.revision_number===s.source_revision&&hash(c.plain_text)===s.source_hash},{headers:{'Cache-Control':'no-store'}})}
 const {data,error}=await db.rpc('memory_overview',{p_project_id:projectId});if(error)return Response.json({error:'Status Memory gagal dimuat.'},{status:503});return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 let body;try{const raw=await req.text();if(raw.length>8000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Permintaan tidak valid.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {projectId,action,question,chunkId}=body;if(typeof projectId!=='string'||!uuid.test(projectId)||!['index','ask','analyze'].includes(action))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 if(action==='index'){const {data,error}=await db.rpc('process_memory',{p_project_id:projectId,p_force:true});return Response.json(error?{error:'Indeks gagal diperbarui.'}:data,{status:error?503:200})}
 let sources:MemorySource[]=[];
 if(action==='ask'){
  if(typeof question!=='string'||question.trim().length<3||question.length>1500)return Response.json({error:'Pertanyaan harus 3–1.500 karakter.'},{status:400});
  let expanded=question;const {data:characters,error:ce}=await db.from('characters').select('name,aliases').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).limit(100);if(ce)return Response.json({error:'Konteks karakter gagal dimuat.'},{status:503});
  for(const c of characters??[])if([c.name,...c.aliases].some((a:string)=>a.length>1&&question.toLowerCase().includes(a.toLowerCase())))expanded+=' '+c.name+' '+c.aliases.join(' ');
  const {data,error}=await db.rpc('retrieve_memory',{p_project_id:projectId,p_query:expanded.slice(0,2000)});if(error)return Response.json({error:'Pencarian Memory gagal.'},{status:503});
  sources=(data??[]).filter((s:MemorySource,i:number,a:MemorySource[])=>!a.slice(0,i).some(t=>t.chapter_id===s.chapter_id&&Math.abs(t.chunk_index-s.chunk_index)<=1)).slice(0,6);
  if(!sources.length)return Response.json({answer:'Belum ditemukan bukti pada indeks terbaru. Perbarui Memory atau coba sebutkan nama karakter/kata kunci yang lebih spesifik.',citations:[],abstained:true});
 }else{
  if(typeof chunkId!=='string'||!uuid.test(chunkId))return Response.json({error:'Pilih bagian naskah.'},{status:400});
  const {data:s}=await db.from('story_chunks').select('*').eq('project_id',projectId).eq('id',chunkId).maybeSingle();if(!s)return Response.json({error:'Sumber tidak ditemukan.'},{status:404});
  const {data:c}=await db.from('chapters').select('title,plain_text,revision_number').eq('id',s.chapter_id).single();if(!c||c.revision_number!==s.source_revision||hash(c.plain_text)!==s.source_hash)return Response.json({error:'Bab telah berubah. Perbarui Memory terlebih dahulu.'},{status:409});
  const {data:existing}=await db.from('memory_insights').select('id').eq('chunk_id',chunkId).maybeSingle();if(existing)return Response.json({saved:true,existing:true});sources=[{...s,title:c.title}];
 }
 let prepared;try{prepared=await prepareModel(action==='ask'?'qa':'memory')}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 const {data:run,error}=await db.from('ai_generations').insert({project_id:projectId,action:action==='ask'?'chat':'brainstorm',model:prepared.config.provider+':'+prepared.config.id,prompt:action==='ask'?`[Ask My Story] ${question}`:`[Memory] Ringkas ${chunkId}`,context_sources:sources.map(s=>`${s.title} · v${s.source_revision} · bagian ${s.chunk_index+1} · ${s.id}`)}).select('id').single();
 if(error)return Response.json({error:error.message.includes('AI_DAILY_LIMIT')?'Batas 20 permintaan AI dalam 24 jam tercapai.':error.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum permintaan AI berikutnya.':'Riwayat AI gagal disiapkan.'},{status:429});
 try{
  const instructions=action==='ask'?MEMORY_ASK:MEMORY_ANALYZE;
  const result=await generateKryaText(prepared,{maxOutputTokens:1800,timeoutMs:35000,system:MEMORY_SYSTEM+instructions,prompt:JSON.stringify({question:action==='ask'?question:null,sources})},{generationId:run.id,projectId,userId:db.authenticatedUserId,sourceCount:sources.length,workflow:action==='ask'?'memory-ask':'memory-analyze'});
  if(action==='analyze'){
   const valid=validateInsights(parseModelJSON(result.text),sources[0].content);
   const {error:saved}=await db.rpc('save_memory_insights',{p_chunk_id:chunkId,p_generation_id:run.id,p_summary:valid.summary,p_facts:valid.facts});if(saved)throw Error('SAVE_INSIGHTS_FAILED');
   const {error:history}=await db.from('ai_generations').update({result:JSON.stringify(valid),status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
   return Response.json({saved:true,warning:history?'Analisis tersimpan; riwayat AI belum diperbarui.':result.tracing==='failed'?'Analisis tersimpan; trace observabilitas belum terkirim.':null});
  }
  const claims=validateAnswer(parseModelJSON(result.text),sources);
  const answer=claims.length?claims.map((c,i)=>`${c.text} [${i+1}]`).join('\n\n'):'Bukti yang ditemukan belum cukup untuk menjawab pertanyaan ini.';
  // Check all referenced revisions again after generation; never label stale text current.
  for(const s of sources){const {data:c}=await db.from('chapters').select('plain_text,revision_number').eq('id',s.chapter_id).single();const {data:chunk}=await db.from('story_chunks').select('source_hash').eq('id',s.id).single();if(!c||!chunk||c.revision_number!==s.source_revision||hash(c.plain_text)!==chunk.source_hash)throw Error('STALE_SOURCE')}
  const citations=claims.map((c,i)=>({number:i+1,quote:c.quote,source_id:c.source.id,chapter_id:c.source.chapter_id,title:c.source.title,revision:c.source.source_revision}));
  const output={answer,citations,abstained:!claims.length};
  const {error:saved}=await db.from('ai_generations').update({result:JSON.stringify(output),status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
  return Response.json({...output,id:run.id,warning:saved?'Jawaban belum tersimpan di riwayat. Salin sebelum menutup.':result.tracing==='failed'?'Jawaban tersimpan; trace observabilitas belum terkirim.':null});
 }catch(e){await db.from('ai_generations').update({status:'error'}).eq('id',run.id);return Response.json({error:(e as Error).message==='STALE_SOURCE'?'Bab berubah saat AI menjawab. Perbarui Memory lalu tanyakan lagi.':'Jawaban/analisis belum dapat divalidasi atau disimpan. Tidak ada fakta otomatis disetujui. Coba lagi setelah 10 detik.'},{status:503})}
}
