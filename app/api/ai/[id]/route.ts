import {createClient} from '@supabase/supabase-js';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token)return Response.json({error:'Login diperlukan.'},{status:401});
 const db=createClient('https://ecurjotykfqiejrpczdm.supabase.co','sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX',{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return Response.json({error:'Sesi tidak valid.'},{status:401});
 const {id}=await params;const result=await db.from('ai_generations').select('*').eq('id',id).maybeSingle();
 if(result.error||!result.data)return Response.json({error:'Hasil tidak ditemukan.'},{status:404});
 return Response.json(result.data,{headers:{'Cache-Control':'no-store'}});
}
