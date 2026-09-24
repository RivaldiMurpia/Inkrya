import {generateText} from 'ai';
import {startTrace,type TraceContext} from '../langsmith/tracing.ts';
import type {prepareModel} from './provider.ts';

export async function generateKryaText(prepared:Awaited<ReturnType<typeof prepareModel>>,input:{system:string;prompt:string;maxOutputTokens:number;timeoutMs?:number},context:TraceContext) {
  if(typeof window!=='undefined') throw Error('SERVER_ONLY');
  if(!context.generationId) throw Error('PERSISTED_GENERATION_REQUIRED');
  if(input.prompt.length+input.system.length>48000||input.maxOutputTokens>2400||input.maxOutputTokens<1) throw Error('GENERATION_BUDGET_EXCEEDED');
  const finishTrace=await startTrace(context,prepared.config,input.prompt.length+input.system.length);
  const started=Date.now();
  try {
    // Keep reasoning off for short structured QA/extraction. Super's writer
    // route uses the documented thinking mode to plan prose constraints.
    // Only final text is returned; reasoning is never persisted or traced.
    const options=prepared.config.provider==='gateway'
      ? {reasoning:'none' as const}
      : ['nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B','nvidia/nemotron-3-super-120b-a12b'].includes(prepared.config.id)
        ? {providerOptions:{nebius:{chat_template_kwargs:{enable_thinking:prepared.config.id==='nvidia/nemotron-3-super-120b-a12b'&&prepared.config.task==='writer'}}},...(prepared.config.id==='nvidia/nemotron-3-super-120b-a12b'?{temperature:1,topP:0.95}:{})}
        : {};
    const result=await generateText({model:prepared.model,system:input.system,prompt:input.prompt,maxOutputTokens:input.maxOutputTokens,maxRetries:0,abortSignal:AbortSignal.timeout(Math.min(input.timeoutMs??35000,45000)),...options});
    // Only final text is used; reasoning channels are not displayed, persisted or traced.
    if(!result.text.trim()||/<\/?think(?:ing)?>/i.test(result.text)) throw Error('INVALID_PROSE_OUTPUT');
    const latencyMs=Date.now()-started;
    const tracing=await finishTrace({success:true,latencyMs,outputCharacters:result.text.length,usage:result.usage});
    return {text:result.text,usage:result.usage,latencyMs,tracing,provider:prepared.config.provider,model:prepared.config.id};
  } catch {
    await finishTrace({success:false,latencyMs:Date.now()-started});
    // Provider errors may embed request text/keys. Never return or log their bodies.
    throw Error('AI_GENERATION_FAILED');
  }
}
