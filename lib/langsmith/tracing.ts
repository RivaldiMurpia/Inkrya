import {Client} from 'langsmith';
import {createHash} from 'node:crypto';
import type {Environment,ModelConfig} from '../ai/models.ts';

export type TraceContext={generationId:string;projectId:string;userId?:string;sourceCount:number;workflow:'krya-assistant'|'memory-ask'|'memory-analyze'|'write-agent'|'story-doctor'|'research-agent'|'provider-smoke'};
type Usage={inputTokens?:number;outputTokens?:number;totalTokens?:number};
type Outcome={success:boolean;latencyMs:number;outputCharacters?:number;usage?:Usage};
export type TraceState='disabled'|'sent'|'failed';
const pseudonym=(id:string)=>createHash('sha256').update(id).digest('hex').slice(0,24);

export function safeTraceMetadata(context:TraceContext,config:ModelConfig) {
  return {project_id:pseudonym(context.projectId),...(context.userId?{user_id:pseudonym(context.userId)}:{}),workflow:context.workflow,provider:config.provider,model:config.id,task:config.task,retrieved_memory_count:context.sourceCount,content_logging:false};
}

export function createTraceClient(env:Environment=process.env,request:typeof fetch=fetch) {
  if(env.LANGSMITH_TRACING!=='true') return null;
  if(!env.LANGSMITH_API_KEY) throw Error('TRACE_CONFIGURATION_MISSING');
  const apiUrl=(env.LANGSMITH_ENDPOINT||'https://api.smith.langchain.com').replace(/\/$/,'');
  if(!['https://api.smith.langchain.com','https://eu.api.smith.langchain.com'].includes(apiUrl)) throw Error('TRACE_ENDPOINT_NOT_ALLOWED');
  return new Client({apiKey:env.LANGSMITH_API_KEY,apiUrl,workspaceId:env.LANGSMITH_WORKSPACE_ID,timeout_ms:2000,callerOptions:{maxRetries:0},autoBatchTracing:false,omitTracedRuntimeInfo:true,debug:false,fetchImplementation:async(url,init)=>{
    // SDK 0.10.4 overrides caller maxRetries. Abort-prefixed failures stop its retry loop.
    try {const response=await request(url,{...init,redirect:'error'});if(!response.ok)throw Error();return response}
    catch {throw Error('AbortError: TRACE_DELIVERY_FAILED')}
  }});
}

// An allowlist, not generic tracing around generateText: raw inputs/outputs/errors never leave here.
export async function startTrace(context:TraceContext,config:ModelConfig,inputCharacters:number,env:Environment=process.env,request:typeof fetch=fetch) {
  let client:Client|null=null,started=false;
  try {
    client=createTraceClient(env,request);
    if(client) {
      await client.createRun({id:context.generationId,name:`Krya ${context.workflow}`,run_type:'llm',project_name:env.LANGSMITH_PROJECT||'inkrya-hackathon',start_time:Date.now(),inputs:{input_characters:inputCharacters},extra:{metadata:safeTraceMetadata(context,config)}});
      started=true;
    }
  } catch { /* Observability failure must not discard a paid generation. */ }
  return async(outcome:Outcome):Promise<TraceState>=>{
    if(env.LANGSMITH_TRACING!=='true') return 'disabled';
    if(!client||!started) return 'failed';
    try {
      await client.updateRun(context.generationId,{end_time:Date.now(),outputs:{success:outcome.success,latency_ms:outcome.latencyMs,output_characters:outcome.outputCharacters??0,usage:{input_tokens:outcome.usage?.inputTokens,output_tokens:outcome.usage?.outputTokens,total_tokens:outcome.usage?.totalTokens}},...(!outcome.success?{error:'AI_GENERATION_FAILED'}:{})});
      return 'sent';
    } catch { return 'failed'; }
  };
}

// Phase 7: one metadata-only tool run per research run's Tavily searches. Counts only —
// query text, source URLs, and note text never leave the app. The run id derives from the
// generation id so a retried pipeline cannot orphan the tool run.
export type ToolTraceContext={generationId:string;projectId:string;tool:'tavily-search';queryCount:number;sourceCount:number;credits:number};
// LangSmith rejects a non-UUID run id on updateRun, and the derived id must be stable so a
// retried pipeline cannot orphan the tool run — so hash the generation id into a UUID shape.
const derivedRunId=(generationId:string,suffix:string):string=>{
 const hex=createHash('sha256').update(`${generationId}:${suffix}`).digest('hex').slice(0,32);
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
};
export async function traceToolRun(context:ToolTraceContext,env:Environment=process.env,request:typeof fetch=fetch):Promise<TraceState> {
  if(env.LANGSMITH_TRACING!=='true') return 'disabled';
  let client:Client|null=null,started=false;
  try {
    client=createTraceClient(env,request);
    if(client) {
      const toolId=derivedRunId(context.generationId,'tool-search');
      await client.createRun({id:toolId,name:`Krya ${context.tool}`,run_type:'tool',project_name:env.LANGSMITH_PROJECT||'inkrya-hackathon',start_time:Date.now(),inputs:{query_count:context.queryCount,source_count:context.sourceCount,credits:context.credits},extra:{metadata:{project_id:pseudonym(context.projectId),tool:context.tool,content_logging:false}}});
      await client.updateRun(toolId,{end_time:Date.now(),outputs:{success:true,queries:context.queryCount,sources:context.sourceCount,credits:context.credits}});
      started=true;
    }
  } catch { /* observability must never break a paid run */ }
  return started?'sent':'failed';
}
