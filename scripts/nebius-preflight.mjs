import {MODEL_TASKS,resolveModelConfig,NEBIUS_BASE_URL} from '../lib/ai/models.ts';

// Run with Node --env-file=.env.local. This script never performs inference.
if(!process.env.NEBIUS_API_KEY?.trim()) {
  console.error('NEBIUS_API_KEY belum dikonfigurasi. Simpan melalui environment variables, bukan chat.');
  process.exitCode=2;
} else if(process.argv.includes('--list-models')||process.argv.includes('--list-writer-candidates')) {
  try {
    if(process.env.NEBIUS_BASE_URL&&process.env.NEBIUS_BASE_URL.replace(/\/$/,'')!==NEBIUS_BASE_URL)throw Error();
    const response=await fetch(NEBIUS_BASE_URL+'/models',{headers:{Authorization:`Bearer ${process.env.NEBIUS_API_KEY.trim()}`},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error();
    const data=await response.json();
    if(!Array.isArray(data.data))throw Error();
    if(process.argv.includes('--list-writer-candidates')) {
      // Read-only account-scoped catalog; output model IDs only. No secrets,
      // request bodies, manuscript, or inference are involved.
      const ids=data.data.filter(m=>typeof m?.id==='string'&&/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(m.id)).map(m=>m.id).sort();
      console.log('PHASE1_WRITER_CATALOG',JSON.stringify({modelIds:ids,inferenceRequests:0}));
    } else console.log(JSON.stringify({nemotronModels:data.data.filter(m=>/^nvidia\//i.test(m.id)&&/nemotron/i.test(m.id)).map(m=>m.id),inferenceRequests:0},null,2));
  } catch {console.error('Katalog Nebius belum dapat diverifikasi. Periksa key, izin, dan jaringan.');process.exitCode=1}
} else {
  const routes=MODEL_TASKS.map(task=>{try{return resolveModelConfig(task,{...process.env,INKRYA_AI_PROVIDER:'nebius'})}catch(e){return {task,error:e.message}}});
  console.log(JSON.stringify({routes,inferenceRequests:0,notice:'Konfigurasi saja; jalankan --list-models untuk memeriksa katalog.'},null,2));
  if(routes.some(r=>r.error))process.exitCode=1;
}
