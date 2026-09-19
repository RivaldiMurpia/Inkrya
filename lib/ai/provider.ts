import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {getVercelOidcToken} from '@vercel/oidc';
import {createHash} from 'node:crypto';
import {verifyFreeModel} from '../krya-model.ts';
import {configuredProvider,resolveModelConfig,type Environment,type ModelConfig,type ModelTask} from './models.ts';

type CatalogCache={key:string;until:number;ids:Set<string>};
let catalogCache:CatalogCache|undefined;
export async function verifyNebiusModel(config:ModelConfig,apiKey:string,request:typeof fetch=fetch) {
  const key=createHash('sha256').update(apiKey+'|'+config.baseURL).digest('hex');
  if(!catalogCache||catalogCache.key!==key||catalogCache.until<Date.now()) {
    const response=await request(`${config.baseURL}/models`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000)});
    if(!response.ok) throw Error('NEBIUS_CATALOG_UNAVAILABLE');
    const data=await response.json();
    if(!Array.isArray(data.data)) throw Error('NEBIUS_CATALOG_INVALID');
    catalogCache={key,until:Date.now()+60000,ids:new Set(data.data.filter((m:{id?:unknown})=>typeof m?.id==='string').map((m:{id:string})=>m.id))};
  }
  if(!catalogCache.ids.has(config.id)) throw Error('NEBIUS_MODEL_UNAVAILABLE');
}

export function createNebiusModel(config:ModelConfig,apiKey:string,request:typeof fetch=fetch) {
  if(typeof window!=='undefined') throw Error('SERVER_ONLY');
  // Redirects must not leak credentials or manuscript contents to another host.
  return createOpenAICompatible({name:'nebius',apiKey,baseURL:config.baseURL!,fetch:(url,init)=>request(url,{...init,redirect:'error'})}).chatModel(config.id);
}

export async function aiConfigurationStatus(env:Environment=process.env) {
  try {
    const config=resolveModelConfig('writer',env);
    let configured=Boolean(env.NEBIUS_API_KEY);
    if(config.provider==='gateway') {
      configured=Boolean(env.AI_GATEWAY_API_KEY);
      if(!configured)try{configured=Boolean(await getVercelOidcToken())}catch{configured=false}
    }
    return {configured,provider:config.provider,model:config.id,label:config.label,verification:'configuration-only',tracing:env.LANGSMITH_TRACING==='true'&&!!env.LANGSMITH_API_KEY};
  } catch {
    let provider='invalid';try{provider=configuredProvider(env)}catch{}
    return {configured:false,provider,model:null,label:'Konfigurasi AI belum siap',verification:'configuration-only',tracing:false};
  }
}

export async function prepareModel(task:ModelTask,env:Environment=process.env) {
  const config=resolveModelConfig(task,env);
  if(config.provider==='gateway') {
    await verifyFreeModel();
    return {config,model:config.id};
  }
  const apiKey=env.NEBIUS_API_KEY!.trim();
  await verifyNebiusModel(config,apiKey);
  return {config,model:createNebiusModel(config,apiKey)};
}
