import {createClient} from '@supabase/supabase-js';
import {generateKryaText} from '@/lib/ai/generate';
import {prepareModel,aiConfigurationStatus} from '@/lib/ai/provider';
import {taskForAction} from '@/lib/ai/router';
import {configurationErrorMessage} from '@/lib/ai/models';
import {systemForAction} from '@/lib/ai/writing-prompts';
import {boundContext,type Source} from '@/lib/ai-context';
export const maxDuration=60;
export async function GET(){return Response.json(await aiConfigurationStatus(),{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token)return Response.json({error:'Silakan login kembali.'},{status:401});
 const db=createClient('https://ecurjotykfqiejrpczdm.supabase.co','sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX',{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return Response.json({error:'Sesi berakhir. Login kembali.'},{status:401});
 if(!(await aiConfigurationStatus()).configured)return Response.json({error:'Krya AI menunggu konfigurasi provider oleh pemilik aplikasi.'},{status:503});
 let body;
 try{const raw=await req.text();if(raw.length>16000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Permintaan tidak valid.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {projectId,chapterId,action,instruction,selection='',context={}}=body;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(typeof projectId!=='string'||!uuid.test(projectId)||!['chat','rewrite','continue','brainstorm'].includes(action)||typeof instruction!=='string'||!instruction.trim()||instruction.length>2000||typeof selection!=='string'||selection.length>4000||!context||typeof context!=='object'||(chapterId&&!uuid.test(chapterId))||(action==='rewrite'&&!selection.trim()))return Response.json({error:'Periksa instruksi dan teks pilihan (maksimal 4.000 karakter).'},{status:400});
 const {data:project,error:projectError}=await db.from('projects').select('id,title').eq('id',projectId).single();
 if(projectError||!project)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 const sources:Source[]=[];
 try{
  if(context.chapter===true&&chapterId){const {data,error}=await db.from('chapters').select('title,plain_text,revision_number').eq('project_id',projectId).eq('id',chapterId).single();if(error)throw error;sources.push({label:`Bab: ${data.title} (versi ${data.revision_number})`,text:action==='continue'?data.plain_text.slice(-12000):data.plain_text})}
  if(action==='continue'&&!sources.length)return Response.json({error:'Pilih konteks bab aktif untuk melanjutkan cerita.'},{status:400});
  if(context.bible===true){const {data,error}=await db.from('story_bibles').select('premise,synopsis,themes,tone,style_instructions,world_rules').eq('project_id',projectId).maybeSingle();if(error)throw error;if(data)sources.push({label:'Story Bible',text:JSON.stringify(data)})}
  if(context.characters===true){const {data,error}=await db.from('characters').select('name,aliases,role,description,attributes').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).order('created_at').limit(20);if(error)throw error;for(const c of data??[])sources.push({label:`Karakter: ${c.name}`,text:JSON.stringify(c)})}
  if(context.notes===true){const {data,error}=await db.from('notes').select('title,plain_text').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).order('created_at').limit(10);if(error)throw error;for(const n of data??[])sources.push({label:`Catatan: ${n.title}`,text:n.plain_text})}
 }catch{return Response.json({error:'Konteks gagal dimuat. Tidak ada permintaan dikirim ke model.'},{status:503})}
 const bounded=boundContext(sources);let prepared;
 try{prepared=await prepareModel(taskForAction(action))}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 const model=prepared.config.provider+':'+prepared.config.id;
 const prompt=instruction+'\n'+selection;
 const {data:run,error:reserveError}=await db.from('ai_generations').insert({project_id:projectId,action,prompt,model,context_sources:bounded.sources.map(s=>s.label)}).select('id').single();
 if(reserveError)return Response.json({error:reserveError.message.includes('AI_DAILY_LIMIT')?'Batas alpha: 20 permintaan dalam 24 jam.':reserveError.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum mencoba lagi.':'Riwayat tidak dapat disiapkan. Coba lagi.'},{status:429});
 try{
  const result=await generateKryaText(prepared,{maxOutputTokens:1400,timeoutMs:35000,system:systemForAction(action),prompt:JSON.stringify({action,instruction,selected_text:selection,context:bounded.sources,context_truncated:bounded.truncated})},{generationId:run.id,projectId,userId:auth.user.id,sourceCount:bounded.sources.length,workflow:'krya-assistant'});
  const {error}=await db.from('ai_generations').update({result:result.text,status:'complete',token_usage:{...result.usage,provider:result.provider,latency_ms:result.latencyMs,trace_status:result.tracing}}).eq('id',run.id);
  return Response.json({id:run.id,text:result.text,sources:bounded.sources.map(s=>s.label),truncated:bounded.truncated,warning:error?'Hasil belum tersimpan di riwayat. Salin hasil sebelum menutup.':result.tracing==='failed'?'Hasil tersimpan; trace observabilitas belum terkirim.':null});
 }catch{await db.from('ai_generations').update({status:'error'}).eq('id',run.id);return Response.json({error:'Model belum tersedia atau permintaan gagal. Periksa konfigurasi/kredit AI. Percobaan ini tetap dihitung dalam batas harian.'},{status:503})}
}
