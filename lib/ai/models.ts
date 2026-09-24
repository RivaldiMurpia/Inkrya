// Server-side configuration. No API key or user-provided model ID reaches the UI.
export const MODEL_TASKS = ['router', 'memory', 'planner', 'writer', 'continuity', 'critic', 'qa'] as const;
export type ModelTask = typeof MODEL_TASKS[number];
export type Environment = Record<string, string | undefined>;
export type ModelConfig = {provider:'gateway'|'nebius'; id:string; task:ModelTask; label:string; baseURL?:string};
export const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1';
export const LEGACY_MODEL = 'inclusionai/ling-3.0-flash-vl-free';

export function configuredProvider(env:Environment=process.env):'gateway'|'nebius' {
  const value=env.INKRYA_AI_PROVIDER?.trim()||'gateway';
  if(value!=='gateway'&&value!=='nebius') throw Error('INVALID_AI_PROVIDER');
  return value;
}

export function resolveModelConfig(task:ModelTask,env:Environment=process.env):ModelConfig {
  if(!MODEL_TASKS.includes(task)) throw Error('INVALID_MODEL_TASK');
  if(configuredProvider(env)==='gateway') return {provider:'gateway',id:LEGACY_MODEL,task,label:'Ling 3.0 Flash VL (Free)'};
  if(!env.NEBIUS_API_KEY?.trim()) throw Error('NEBIUS_API_KEY_MISSING');
  const baseURL=(env.NEBIUS_BASE_URL?.trim()||NEBIUS_BASE_URL).replace(/\/$/,'');
  // Do not send credentials/manuscripts to arbitrary URLs, even on configuration mistakes.
  if(baseURL!==NEBIUS_BASE_URL) throw Error('NEBIUS_BASE_URL_NOT_ALLOWED');
  // A present but blank role override is a configuration error; never fall
  // through to the shared baseline after an operator selects that role.
  const override=env[`${task.toUpperCase()}_MODEL`];
  const id=(override===undefined?env.NEBIUS_TEXT_MODEL||'':override).trim();
  if(!id) throw Error('NEBIUS_MODEL_MISSING');
  // The official hackathon rule requires at least one NVIDIA model on Nebius,
  // not a single family for every role. Reasoning roles stay on Nemotron;
  // Writer may use a separately verified Nebius catalog model for Indonesian.
  const nemotron=/^nvidia\/[a-z0-9._-]*nemotron[a-z0-9._-]*$/i.test(id);
  if(task==='writer') {
    if(!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(id)) throw Error('NEBIUS_WRITER_MODEL_INVALID');
  } else if(!nemotron) throw Error('NVIDIA_NEMOTRON_REQUIRED');
  return {provider:'nebius',id,task,baseURL,label:`${nemotron?'NVIDIA Nemotron':id} · Nebius (${task})`};
}

export function configurationErrorMessage(error:unknown) {
  const code=error instanceof Error?error.message:'';
  if(code.startsWith('NEBIUS_')||code==='NVIDIA_NEMOTRON_REQUIRED') return 'Konfigurasi atau akses model yang dipilih di Nebius belum siap. Hubungi pemilik aplikasi; model lain tidak dipakai otomatis.';
  if(code==='INVALID_AI_PROVIDER') return 'Konfigurasi provider AI tidak valid.';
  return 'Model AI belum tersedia atau konfigurasi belum dapat diverifikasi. Coba lagi nanti.';
}
