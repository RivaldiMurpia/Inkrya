export async function GET(){
 try{
  const response=await fetch('https://ecurjotykfqiejrpczdm.supabase.co/auth/v1/settings',{
   headers:{apikey:'sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX'},cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error('Provider settings unavailable');
  const data=await response.json();
  return Response.json({google:data.external?.google===true,github:data.external?.github===true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Provider settings unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
