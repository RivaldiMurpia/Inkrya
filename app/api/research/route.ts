import {userDatabase} from '@/lib/server-auth';
import {prepareModel} from '@/lib/ai/provider';
import {configurationErrorMessage} from '@/lib/ai/models';
import {runResearch} from '@/lib/research';
import {researchConfig,researchCreditBudget} from '@/lib/research-budget';
export const maxDuration=60;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

const quotaError=(message:string):string=>{
 if(message.includes('AI_DAILY_LIMIT'))return 'Batas 20 permintaan AI dalam 24 jam tercapai.';
 if(message.includes('AI_RATE_LIMIT'))return 'Tunggu 10 detik sebelum permintaan AI berikutnya.';
 return 'Riwayat AI gagal disiapkan.';
};

// One research run = one ai_generations row = one LLM slot, and a separate Tavily credit
// meter (token_usage.tavily_credits, summed by research_credit_usage). Research output
// lives only in this row's result — no code path from here to any canon table.
export async function POST(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 let body;try{const raw=await req.text();if(raw.length>8000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Permintaan tidak valid.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {projectId,topic}=body;
 if(typeof projectId!=='string'||!uuid.test(projectId)||typeof topic!=='string'||topic.trim().length<3||topic.length>300)return Response.json({error:'Topik harus 3–300 karakter.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();
 if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 let config;
 try{config=researchConfig()}catch(e){return Response.json({error:'Riset web belum dikonfigurasi. Hubungi pemilik aplikasi.'},{status:503})}
 let prepared;try{prepared=await prepareModel('memory')}catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 // Credit check before the LLM quota slot: refusing here burns nothing. Not atomic — two
 // simultaneous runs can both pass, bounded by MAX_RUN_CREDITS (3) of overshoot.
 const {data:usage,error:usageError}=await db.rpc('research_credit_usage',{p_project_id:projectId});
 if(usageError)return Response.json({error:'Meter kredit riset gagal dibaca.'},{status:503});
 const decision=researchCreditBudget({userUsed:Number(usage?.user_credits_24h??0),globalUsed:Number(usage?.global_credits_month??0),config});
 if(!decision.allowed)return Response.json({error:decision.reason==='USER_LIMIT'
  ?`Kuota riset web kamu tersisa ${decision.userRemaining} kredit dari ${decision.runCost} yang dibutuhkan satu riset. Coba lagi besok.`
  :`Kuota riset web global sedang penuh (sisa ${decision.globalRemaining} kredit). Coba lagi nanti.`},{status:429});
 const {data:run,error}=await db.from('ai_generations').insert({project_id:projectId,action:'research',model:prepared.config.provider+':'+prepared.config.id,prompt:`[Riset Web] ${topic.trim().slice(0,300)}`}).select('id').single();
 if(error)return Response.json({error:quotaError(error.message)},{status:429});
 try{
  // Credits merge into token_usage as they are spent, so a mid-run failure still meters
  // what was used; the final update adds the model's token counts without clobbering them.
  let recorded=0;
  const recordCredits=async(credits:number)=>{
   recorded+=credits;
   const {error:mergeError}=await db.from('ai_generations').update({token_usage:{tavily_credits:recorded}}).eq('id',run.id);
   if(mergeError)console.error('research','CREDIT_METER_UPDATE_FAILED');
  };
  const result=await runResearch({topic:topic.trim(),prepared,config,generationId:run.id,projectId,userId:db.authenticatedUserId,recordCredits,signal:req.signal});
  const {error:history}=await db.from('ai_generations').update({
   result:JSON.stringify({topic:result.topic,queries:result.queries,sources:result.sources,notes:result.notes,dropStats:result.dropStats,credits:result.credits,steps:result.steps}),
   status:'complete',
   token_usage:{input_tokens:result.tokenUsage.inputTokens,output_tokens:result.tokenUsage.outputTokens,tavily_credits:result.credits,provider:prepared.config.provider},
  }).eq('id',run.id);
  return Response.json({
   topic:result.topic,queries:result.queries,sources:result.sources,notes:result.notes,dropStats:result.dropStats,
   credits:result.credits,creditsRemaining:Math.max(0,decision.userRemaining-result.credits),steps:result.steps,
   warning:history?'Catatan riset tersimpan; riwayat AI belum diperbarui.':null,
  });
 }catch(e){
  const code=(e as Error).message||'RESEARCH_FAILED';
  // Codes only in logs — never topic text, queries, URLs, or notes.
  console.error('research',code);
  await db.from('ai_generations').update({status:'error'}).eq('id',run.id);
  if(code==='INVALID_RESEARCH_PLAN'||code==='INVALID_RESEARCH_NOTES'||code.startsWith('TAVILY_'))return Response.json({error:'Pencarian web gagal atau tidak dapat divalidasi. Tidak ada catatan yang dibuat. Coba lagi.'},{status:503});
  if(code==='REQUEST_ABORTED')return Response.json({error:'Riset dihentikan.'},{status:499});
  return Response.json({error:'Riset belum dapat diselesaikan. Coba lagi.'},{status:503});
 }
}
