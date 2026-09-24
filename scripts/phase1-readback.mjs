import assert from 'node:assert/strict';
import {safeTraceMetadata} from '../lib/langsmith/tracing.ts';

// Read-only verification of persisted APPLICATION runs from the two named
// synthetic projects. DB status/usage were rechecked on 2026-09-21. These are
// intentionally not the provider-smoke/build-fixture trace IDs.
// No inference, manuscript access, trace writes, retries, or raw response logs.
const runs=[
 {id:'25aa05a9-682c-469e-8133-11d960d9fb57',projectId:'4ff67f47-b647-4880-86b7-0040809f5680',userPseudonym:'0dc5222f4987485d2c70083b',workflow:'krya-assistant',task:'writer',latencyMs:2200,inputTokens:300,outputTokens:163,outputCharacters:620},
 {id:'ef0e7bce-3d6a-4130-a691-906bb89a79d6',projectId:'4ff67f47-b647-4880-86b7-0040809f5680',userPseudonym:'0dc5222f4987485d2c70083b',workflow:'memory-ask',task:'qa',latencyMs:1114,inputTokens:375,outputTokens:99},
 {id:'b6c22dd3-1a29-4967-b54d-60709c2fc336',projectId:'4ff67f47-b647-4880-86b7-0040809f5680',userPseudonym:'0dc5222f4987485d2c70083b',workflow:'memory-ask',task:'qa',latencyMs:1062,inputTokens:371,outputTokens:7},
 {id:'389fde8a-775e-45ee-bdf9-8254da9a25b3',projectId:'ef1f34a0-6b61-40d1-8d5e-38156bc49046',userPseudonym:'c1576839504f5a9def9bc034',workflow:'memory-analyze',task:'memory',latencyMs:1434,inputTokens:568,outputTokens:194},
];
let stage='configuration';
try {
 const endpoint=(process.env.LANGSMITH_ENDPOINT||'https://api.smith.langchain.com').replace(/\/$/,'');
 assert.ok(['https://api.smith.langchain.com','https://eu.api.smith.langchain.com'].includes(endpoint));
 assert.ok(process.env.LANGSMITH_API_KEY);
 for(const {id,projectId,userPseudonym,workflow,task,latencyMs,inputTokens,outputTokens,outputCharacters} of runs){
  stage='read:'+id;
  const response=await fetch(endpoint+'/runs/'+id,{headers:{'x-api-key':process.env.LANGSMITH_API_KEY,...(process.env.LANGSMITH_WORKSPACE_ID?{'x-tenant-id':process.env.LANGSMITH_WORKSPACE_ID}:{})},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('TRACE_HTTP_'+response.status);
  const run=await response.json();
  stage='validate:'+id;
  assert.equal(run.id,id);
  assert.equal(run.name,`Krya ${workflow}`);
  assert.ok(run.end_time&&!run.error);
  assert.deepEqual(Object.keys(run.inputs).sort(),['input_characters']);
  assert.ok(run.inputs.input_characters>0);
  assert.deepEqual(Object.keys(run.outputs).sort(),['latency_ms','output_characters','success','usage']);
  assert.equal(run.outputs.success,true);
  assert.equal(run.outputs.latency_ms,latencyMs);
  assert.ok(run.outputs.output_characters>0);
  // Memory routes persist validated/transformed JSON, not the raw model string.
  // Their DB result length must not be mistaken for trace output_characters.
  if(outputCharacters!==undefined)assert.equal(run.outputs.output_characters,outputCharacters);
  assert.deepEqual(run.outputs.usage,{input_tokens:inputTokens,output_tokens:outputTokens,total_tokens:inputTokens+outputTokens});
  const expected={...safeTraceMetadata({generationId:id,projectId,sourceCount:1,workflow},{provider:'nebius',id:'nvidia/nemotron-3-super-120b-a12b',task}),user_id:userPseudonym};
  for(const [key,value] of Object.entries(expected))assert.equal(run.extra?.metadata?.[key],value);
  assert.ok(!/Mira|kuningan|Stasiun Aruna/.test(JSON.stringify(run)));
  console.log('PHASE1_TRACE',JSON.stringify({id,workflow,task,pass:true,application:true,usageMatched:true,userPseudonymMatched:true,contentLogging:false,readback:true}));
 }
 console.log('PHASE1_READBACK',JSON.stringify({pass:true,applicationRuns:runs.length,inferenceRequests:0}));
} catch(error) {
 const reason=/^TRACE_HTTP_\d{3}$/.test(error?.message||'')?error.message:error?.name==='TimeoutError'?'TRACE_TIMEOUT':'TRACE_CHECK_FAILED';
 console.error('PHASE1_READBACK',JSON.stringify({pass:false,stage,reason,inferenceRequests:0}));
 process.exitCode=1;
}
