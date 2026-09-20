import assert from 'node:assert/strict';
import {safeTraceMetadata} from '../lib/langsmith/tracing.ts';

// Read-only verification of the four synthetic runs from commit 349d9a0.
// No inference, manuscript access, trace writes, retries, or raw response logs.
const runs=[
 ['f989b12b-6e56-4eb7-b088-d4bd42b58fdc','writer',0,2113,82,164],
 ['33596004-74c9-4ccb-a29d-e780d8b22b79','qa',1,1123,373,100],
 ['0890b3c4-c9ec-4c77-b6a7-31e85a6829b2','qa',1,755,369,7],
 ['343029d4-7662-4325-b59c-317a1cdfbb4c','memory',1,1366,296,194],
];
let stage='configuration';
try {
 const endpoint=(process.env.LANGSMITH_ENDPOINT||'https://api.smith.langchain.com').replace(/\/$/,'');
 assert.ok(['https://api.smith.langchain.com','https://eu.api.smith.langchain.com'].includes(endpoint));
 assert.ok(process.env.LANGSMITH_API_KEY);
 for(const [id,task,sourceCount,latencyMs,inputTokens,outputTokens] of runs){
  stage='read:'+id;
  const response=await fetch(endpoint+'/runs/'+id,{headers:{'x-api-key':process.env.LANGSMITH_API_KEY,...(process.env.LANGSMITH_WORKSPACE_ID?{'x-tenant-id':process.env.LANGSMITH_WORKSPACE_ID}:{})},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('TRACE_HTTP_'+response.status);
  const run=await response.json();
  stage='validate:'+id;
  assert.equal(run.id,id);
  assert.deepEqual(Object.keys(run.inputs).sort(),['input_characters']);
  assert.ok(run.inputs.input_characters>0);
  assert.deepEqual(Object.keys(run.outputs).sort(),['latency_ms','output_characters','success','usage']);
  assert.equal(run.outputs.success,true);
  assert.equal(run.outputs.latency_ms,latencyMs);
  assert.ok(run.outputs.output_characters>0);
  assert.deepEqual(run.outputs.usage,{input_tokens:inputTokens,output_tokens:outputTokens,total_tokens:inputTokens+outputTokens});
  const expected=safeTraceMetadata({generationId:id,projectId:'inkrya-public-synthetic-activation',sourceCount,workflow:'provider-smoke'},{provider:'nebius',id:'nvidia/nemotron-3-super-120b-a12b',task});
  for(const [key,value] of Object.entries(expected))assert.equal(run.extra?.metadata?.[key],value);
  assert.ok(!/Mira|kuningan|Stasiun Aruna/.test(JSON.stringify(run)));
  console.log('PHASE1_TRACE',JSON.stringify({id,pass:true,contentLogging:false,readback:true}));
 }
 console.log('PHASE1_READBACK',JSON.stringify({pass:true,runs:runs.length,inferenceRequests:0}));
} catch(error) {
 const reason=/^TRACE_HTTP_\d{3}$/.test(error?.message||'')?error.message:error?.name==='TimeoutError'?'TRACE_TIMEOUT':'TRACE_CHECK_FAILED';
 console.error('PHASE1_READBACK',JSON.stringify({pass:false,stage,reason,inferenceRequests:0}));
 process.exitCode=1;
}
