// Server-side configuration. No API key or user-provided model ID reaches the UI.
export const MODEL_TASKS = ['router', 'memory', 'planner', 'writer', 'continuity', 'critic', 'qa'] as const;
export type ModelTask = typeof MODEL_TASKS[number];
export type Environment = Record<string, string | undefined>;
export type ModelConfig = {provider:'gateway'|'nebius'; id:string; task:ModelTask; label:string; baseURL?:string};
export const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1';
export const LEGACY_MODEL = 'inclusionai/ling-3.0-flash-vl-free';
// The two writer models the owner accepted from the 2026-10-09 few-shot prose
// experiment (docs/evidence/phase1-fewshot-2026-10-09.md): both passed the
// four-case mechanical screen on two runs each. A per-request choice is
// allowlisted to these IDs — nothing else may flow from a request to the provider.
export const WRITER_ACCEPTED_MODELS = ['openai/gpt-oss-120b','deepseek-ai/DeepSeek-V4-Flash-0731'] as const;
export const WRITER_MODEL_CHOICES:ReadonlyArray<{id:string;label:string}> = [
  {id:'openai/gpt-oss-120b',label:'GPT-OSS 120B'},
  {id:'deepseek-ai/DeepSeek-V4-Flash-0731',label:'DeepSeek V4 Flash'},
];

export function configuredProvider(env:Environment=process.env):'gateway'|'nebius' {
  const value=env.INKRYA_AI_PROVIDER?.trim()||'gateway';
  if(value!=='gateway'&&value!=='nebius') throw Error('INVALID_AI_PROVIDER');
  return value;
}

export function resolveModelConfig(task:ModelTask,env:Environment=process.env,requestWriterOverride?:string):ModelConfig {
  if(!MODEL_TASKS.includes(task)) throw Error('INVALID_MODEL_TASK');
  // A per-request choice is a user-facing trust boundary: allowlist it to the
  // two models the owner accepted before any other check or env processing.
  // Env-configured writers keep their existing format/family rules.
  if(requestWriterOverride!==undefined) {
    if(task!=='writer') throw Error('INVALID_MODEL_OVERRIDE');
    if(!WRITER_ACCEPTED_MODELS.includes(requestWriterOverride as never)) throw Error('WRITER_MODEL_NOT_ACCEPTED');
  }
  if(configuredProvider(env)==='gateway') return {provider:'gateway',id:LEGACY_MODEL,task,label:'Ling 3.0 Flash VL (Free)'};
  if(!env.NEBIUS_API_KEY?.trim()) throw Error('NEBIUS_API_KEY_MISSING');
  const baseURL=(env.NEBIUS_BASE_URL?.trim()||NEBIUS_BASE_URL).replace(/\/$/,'');
  // Do not send credentials/manuscripts to arbitrary URLs, even on configuration mistakes.
  if(baseURL!==NEBIUS_BASE_URL) throw Error('NEBIUS_BASE_URL_NOT_ALLOWED');
  // A present but blank role override is a configuration error; never fall
  // through to the shared baseline after an operator selects that role.
  const override=env[`${task.toUpperCase()}_MODEL`];
  const id=(requestWriterOverride??(override===undefined?env.NEBIUS_TEXT_MODEL||'':override)).trim();
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
  if(code.startsWith('EMBED_')) return 'Model embedding untuk Memory semantik belum siap. Hubungi pemilik aplikasi.';
  if(code==='INVALID_AI_PROVIDER') return 'Konfigurasi provider AI tidak valid.';
  return 'Model AI belum tersedia atau konfigurasi belum dapat diverifikasi. Coba lagi nanti.';
}

// Embedding config — separate from text model; no Nemotron constraint.
export function resolveEmbeddingConfig(env:Environment=process.env):{model:string;baseURL:string;apiKey:string}|null {
  if(configuredProvider(env)!=='nebius') return null;
  if(!env.NEBIUS_API_KEY?.trim()||!env.EMBEDDING_MODEL?.trim()) return null;
  const baseURL=(env.NEBIUS_BASE_URL?.trim()||NEBIUS_BASE_URL).replace(/\/$/,'');
  if(baseURL!==NEBIUS_BASE_URL) throw Error('NEBIUS_BASE_URL_NOT_ALLOWED');
  const model=env.EMBEDDING_MODEL.trim();
  if(!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(model)) throw Error('EMBED_MODEL_INVALID');
  return {model,baseURL,apiKey:env.NEBIUS_API_KEY.trim()};
}
