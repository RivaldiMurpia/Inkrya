import {createClient} from '@supabase/supabase-js';
export async function userDatabase(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return null;
 const db=createClient('https://ecurjotykfqiejrpczdm.supabase.co','sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX',{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token);return error||!data.user?null:Object.assign(db,{authenticatedUserId:data.user.id});
}
