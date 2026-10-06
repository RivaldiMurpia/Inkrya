import {NEBIUS_BASE_URL} from './models.ts';

export const EMBEDDING_DIMENSIONS=4096;
export const EMBEDDING_MODEL_LABEL='nebius:Qwen/Qwen3-Embedding-8B';

// Server-only. Creates one embedding vector for the given text using Nebius.
// Body follows the documented /v1/embeddings schema exactly: model, input,
// encoding_format. No extra parameters.
// Never logs text content. Redirects rejected to prevent credential leaks.
export async function createEmbedding(text:string,model:string,apiKey:string,request:typeof fetch=fetch):Promise<number[]> {
  if(typeof window!=='undefined')throw Error('SERVER_ONLY');
  if(!text.trim()||text.length>16000)throw Error('EMBED_INPUT_INVALID');
  const response=await request(`${NEBIUS_BASE_URL}/embeddings`,{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,input:text,encoding_format:'float'}),
    cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw Error('EMBED_REQUEST_FAILED');
  const data=await response.json();
  const embedding=data?.data?.[0]?.embedding;
  if(!Array.isArray(embedding)||embedding.length!==EMBEDDING_DIMENSIONS||embedding.some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)))
    throw Error('EMBED_RESPONSE_INVALID');
  return embedding;
}
