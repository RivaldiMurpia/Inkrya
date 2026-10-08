import {generateText} from 'ai';
import {startTrace,type TraceContext} from '../langsmith/tracing.ts';
import {WRITER_ACCEPTED_MODELS} from './models.ts';
import {WRITER_FEW_SHOT} from '../agent-prompts.ts';
import type {prepareModel} from './provider.ts';

// True when this call is the accepted writer configuration from the 2026-10-09
// prose-gate experiment: gpt-oss-120b or DeepSeek-V4-Flash on the writer task.
function isAcceptedWriter(config:{task:string;id:string}):boolean {
  return config.task==='writer'&&(WRITER_ACCEPTED_MODELS as readonly string[]).includes(config.id);
}

export async function generateKryaText(prepared:Awaited<ReturnType<typeof prepareModel>>,input:{system:string;prompt:string;maxOutputTokens:number;timeoutMs?:number;signal?:AbortSignal},context:TraceContext) {
  if(typeof window!=='undefined') throw Error('SERVER_ONLY');
  if(!context.generationId) throw Error('PERSISTED_GENERATION_REQUIRED');
  // The few-shot example is appended here so both writer callers (write graph and
  // Krya assistant) get it without either one knowing about model routing.
  const system=isAcceptedWriter(prepared.config)?input.system+WRITER_FEW_SHOT:input.system;
  if(input.prompt.length+system.length>48000||input.maxOutputTokens>2400||input.maxOutputTokens<1) throw Error('GENERATION_BUDGET_EXCEEDED');
  const finishTrace=await startTrace(context,prepared.config,input.prompt.length+system.length);
  const started=Date.now();
  try {
    // Nano/Super default to reasoning. Use their documented template switch so short
    // writing/JSON requests spend the output budget on the final response.
    // The accepted writer models also run non-thinking; their prose-gate sampling
    // (temperature 0.2, top-p 0.95) is what passed the four-case screen.
    // Do not assume other Nemotron models support this option.
    const options=prepared.config.provider==='gateway'
      ? {reasoning:'none' as const}
      : isAcceptedWriter(prepared.config)
        ? {providerOptions:{nebius:{chat_template_kwargs:{enable_thinking:false}}},temperature:0.2,topP:0.95}
        : ['nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B','nvidia/nemotron-3-super-120b-a12b'].includes(prepared.config.id)
          ? {providerOptions:{nebius:{chat_template_kwargs:{enable_thinking:false}}},...(prepared.config.id==='nvidia/nemotron-3-super-120b-a12b'?{temperature:1,topP:0.95}:{})}
          : {};
    // External signal (request abort) combines with the internal per-call timeout.
    const abortSignal=input.signal?AbortSignal.any([input.signal,AbortSignal.timeout(Math.min(input.timeoutMs??35000,45000))]):AbortSignal.timeout(Math.min(input.timeoutMs??35000,45000));
    const result=await generateText({model:prepared.model,system,prompt:input.prompt,maxOutputTokens:input.maxOutputTokens,maxRetries:0,abortSignal,...options});
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
