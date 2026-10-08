import test from 'node:test';
import assert from 'node:assert/strict';

const {traceToolRun}=await import('../lib/langsmith/tracing.ts');

const env={LANGSMITH_TRACING:'true',LANGSMITH_API_KEY:'ls-key',LANGSMITH_PROJECT:'inkrya-test'};
const context={generationId:'gen-1',projectId:'project-abc',tool:'tavily-search',queryCount:2,sourceCount:4,credits:2};

function recordingRequest(store,captured){
 return async(url,init)=>{
  // The LangSmith SDK sends Uint8Array bodies; decode for assertions.
  const raw=init?.body;
  const text=raw instanceof Uint8Array?new TextDecoder().decode(raw):typeof raw==='string'?raw:'';
  store.push({url:String(url),body:text});
  captured.push(init);
  return new Response(JSON.stringify({id:'run-1'}),{status:200,headers:{'content-type':'application/json'}});
 };
}

test('one tool run is created with counts and pseudonyms, and no content',async()=>{
 const calls=[],inits=[];
 const state=await traceToolRun(context,env,recordingRequest(calls,inits));
 assert.equal(state,'sent');
 assert.equal(calls.length,2); // create + update, both to /runs
 const body=calls.map(c=>c.url+' '+c.body).join(' ');
 assert.match(body,/tavily-search/);
 assert.match(body,/query_count/);
 assert.match(body,/source_count/);
 assert.match(body,/credits/);
 assert.match(body,/content_logging/);
 // No raw identifiers and no content may leave: topic, query text, URLs, notes.
 assert.doesNotMatch(body,/project-abc/);
 assert.doesNotMatch(body,/gen-1/);
});

test('tracing disabled resolves disabled without any fetch',async()=>{
 const calls=[];
 const state=await traceToolRun(context,{...env,LANGSMITH_TRACING:'false'},recordingRequest(calls,[]));
 assert.equal(state,'disabled');
 assert.equal(calls.length,0);
});

test('a rejecting transport resolves failed and never throws',async()=>{
 const state=await traceToolRun(context,env,async()=>{throw Error('network down')});
 assert.equal(state,'failed');
});

test('a non-ok response resolves failed and never throws',async()=>{
 const state=await traceToolRun(context,env,async()=>new Response('nope',{status:500}));
 assert.equal(state,'failed');
});
