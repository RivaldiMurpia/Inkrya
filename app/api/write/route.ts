import {prepareModel} from '@/lib/ai/provider';
import {configurationErrorMessage} from '@/lib/ai/models';
import {userDatabase} from '@/lib/server-auth';
import {runWriteGraph,type Role} from '@/lib/agent-graph';
export const maxDuration=300;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ROLES:Role[]=['planner','writer','continuity','critic'];

function friendlyError(message:string):string{
 switch(message){
  case 'NO_EVIDENCE':return 'Belum ada bukti pada indeks. Perbarui Memory terlebih dahulu.';
  case 'CONTEXT_READ_FAILED':return 'Konteks Memory gagal dimuat.';
  case 'STALE_SOURCE':return 'Bab berubah saat menulis. Perbarui Memory lalu coba lagi.';
  default:return 'Penulisan belum dapat diselesaikan. Coba lagi setelah 10 detik.';
 }
}

export async function POST(req:Request){
 const db=await userDatabase(req);if(!db)return Response.json({error:'Login diperlukan.'},{status:401});
 let body;try{const raw=await req.text();if(raw.length>8000)throw Error();body=JSON.parse(raw)}catch{return Response.json({error:'Permintaan tidak valid.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Permintaan tidak valid.'},{status:400});
 const {projectId,instruction}=body;
 if(typeof projectId!=='string'||!uuid.test(projectId)||typeof instruction!=='string'||instruction.trim().length<3||instruction.length>2000)return Response.json({error:'Instruksi harus 3–2.000 karakter.'},{status:400});
 const {data:p}=await db.from('projects').select('id').eq('id',projectId).maybeSingle();
 if(!p)return Response.json({error:'Proyek tidak ditemukan.'},{status:404});
 // Prepare all four role models before reserving quota: a broken configuration must not
 // burn one of the 20 daily slots.
 let prepared:Record<Role,Awaited<ReturnType<typeof prepareModel>>>;
 try{
  prepared={
   planner:await prepareModel('planner'),
   writer:await prepareModel('writer'),
   continuity:await prepareModel('continuity'),
   critic:await prepareModel('critic'),
  };
 }catch(e){return Response.json({error:configurationErrorMessage(e)},{status:503})}
 // One write request = one ai_generations row = one slot of the 20/24h user quota.
 const modelLabel=ROLES.map(role=>`${role}=${prepared[role].config.id}`).join(';');
 const {data:run,error}=await db.from('ai_generations').insert({
  project_id:projectId,action:'write',model:modelLabel,
  prompt:`[Write Next Chapter] ${instruction.trim().slice(0,1200)}`,
 }).select('id').single();
 if(error)return Response.json({error:error.message.includes('AI_DAILY_LIMIT')?'Batas 20 permintaan AI dalam 24 jam tercapai.':error.message.includes('AI_RATE_LIMIT')?'Tunggu 10 detik sebelum permintaan AI berikutnya.':'Riwayat AI gagal disiapkan.'},{status:429});

 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   let closed=false;
   const send=(line:object)=>{if(!closed)controller.enqueue(encoder.encode(JSON.stringify(line)+'\n'))};
   const close=()=>{if(!closed){closed=true;try{controller.close()}catch{/* already closed by abort */}}};
   const abort=()=>close();
   req.signal.addEventListener('abort',abort);
   try{
    const result=await runWriteGraph({
     db,projectId,instruction:instruction.trim(),userId:db.authenticatedUserId,generationId:run.id,
     prepared,signal:req.signal,emit:step=>send({type:'stage',...step}),
    });
    send({type:'result',...result});
    await db.from('ai_generations').update({
     result:JSON.stringify({draft:result.draft,plan:result.plan,issues:result.issues,resolved:result.resolved,repairAttempts:result.repairAttempts,critic:result.critic,steps:result.steps}),
     status:'complete',token_usage:{...result.tokenUsage,provider:prepared.writer.config.provider},
    }).eq('id',run.id);
   }catch(e){
    const aborted=(e as Error).message==='REQUEST_ABORTED'||req.signal.aborted;
    send(aborted?{type:'error',error:'Penulisan dihentikan.'}:{type:'error',error:friendlyError((e as Error).message)});
    await db.from('ai_generations').update({status:'error'}).eq('id',run.id);
   }finally{
    req.signal.removeEventListener('abort',abort);
    close();
   }
  },
 });
 return new Response(stream,{headers:{
  'Content-Type':'application/x-ndjson',
  'Cache-Control':'no-store, no-transform',
  'X-Accel-Buffering':'no',
 }});
}
