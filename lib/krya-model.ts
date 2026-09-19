// Explicit free variant verified against the Gateway catalog on 2026-09-14.
export const KRYA_MODEL='inclusionai/ling-3.0-flash-vl-free';
export const KRYA_MODEL_LABEL='Ling 3.0 Flash VL (Free)';
export async function verifyFreeModel(){
 const response=await fetch('https://ai-gateway.vercel.sh/v1/models',{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('MODEL_CATALOG_UNAVAILABLE');
 const catalog=await response.json();
 const model=catalog.data?.find((m:{id:string})=>m.id===KRYA_MODEL);
 if(!model?.pricing||!['0',0].includes(model.pricing.input)||!['0',0].includes(model.pricing.output))throw new Error('FREE_MODEL_UNAVAILABLE');
}
