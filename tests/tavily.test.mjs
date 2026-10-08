import test from 'node:test';
import assert from 'node:assert/strict';

const tavily=await import('../lib/tavily.ts');
const {searchTavily,TAVILY_ENDPOINT,TAVILY_COST_PER_SEARCH,MAX_RESULTS_PER_QUERY,QUERY_MAX_LENGTH}=tavily;

const okResponse=rows=>new Response(JSON.stringify({query:'q',results:rows,images:[],response_time:0.4,answer:null}),{status:200,headers:{'content-type':'application/json'}});

test('constants match the Tavily pricing contract',()=>{
 assert.equal(TAVILY_ENDPOINT,'https://api.tavily.com/search');
 assert.equal(TAVILY_COST_PER_SEARCH,1);
 assert.equal(MAX_RESULTS_PER_QUERY,5);
 assert.equal(QUERY_MAX_LENGTH,200);
});

test('the request pins search_depth basic and max_results — an unpinned depth silently doubles the bill',async()=>{
 let captured;
 const res=await searchTavily('radio pesisir 1949',{apiKey:'tvly-test-key',request:async(url,init)=>{captured={url,init};return okResponse([])}});
 assert.deepEqual(res,[]);
 assert.equal(captured.url,TAVILY_ENDPOINT);
 assert.equal(captured.init.method,'POST');
 const body=JSON.parse(captured.init.body);
 assert.equal(body.search_depth,'basic');
 assert.equal(body.max_results,5);
 assert.equal(body.include_answer,false);
 assert.equal(body.include_raw_content,false);
});

test('the Authorization bearer header carries the api key',async()=>{
 let captured;
 await searchTavily('q',{apiKey:'tvly-secret',request:async(url,init)=>{captured=init;return okResponse([])}});
 assert.equal(captured.headers['Authorization'],'Bearer tvly-secret');
});

test('redirect:error is passed so credentials never follow a redirect',async()=>{
 let captured;
 await searchTavily('q',{apiKey:'k',request:async(url,init)=>{captured=init;return okResponse([])}});
 assert.equal(captured.redirect,'error');
});

test('a non-2xx response throws TAVILY_UNAVAILABLE',async()=>{
 await assert.rejects(()=>searchTavily('q',{apiKey:'k',request:async()=>new Response('nope',{status:500})}),/TAVILY_UNAVAILABLE/);
});

test('a body without an array results field throws TAVILY_INVALID_RESPONSE',async()=>{
 await assert.rejects(()=>searchTavily('q',{apiKey:'k',request:async()=>new Response('{"results":"banyak"}',{status:200})}),/TAVILY_INVALID_RESPONSE/);
 await assert.rejects(()=>searchTavily('q',{apiKey:'k',request:async()=>new Response('"array"',{status:200})}),/TAVILY_INVALID_RESPONSE/);
});

test('a blank or overlong query throws TAVILY_QUERY_INVALID without any fetch',async()=>{
 let calls=0;
 const request=async()=>{calls++;return okResponse([])};
 await assert.rejects(()=>searchTavily('   ',{apiKey:'k',request}),/TAVILY_QUERY_INVALID/);
 await assert.rejects(()=>searchTavily('x'.repeat(201),{apiKey:'k',request}),/TAVILY_QUERY_INVALID/);
 assert.equal(calls,0);
 assert.equal(QUERY_MAX_LENGTH,200);
});

test('malformed result rows are dropped; well-formed rows survive with content capped',async()=>{
 const rows=[
  {title:'Baik',url:'https://example.com/a',content:'x'.repeat(2500),score:0.9},
  {url:'https://example.com/b',content:'tanpa judul',score:0.8},
  {title:'Tanpa url',content:'x',score:0.7},
  {title:'Score bukan angka',url:'https://example.com/c',content:'x',score:'tinggi'},
  {title:42,url:'https://example.com/d',content:'x',score:0.5},
 ];
 const res=await searchTavily('q',{apiKey:'k',request:async()=>okResponse(rows)});
 assert.equal(res.length,1);
 assert.equal(res[0].title,'Baik');
 assert.equal(res[0].content.length,2000);
 assert.equal(res[0].score,0.9);
});

test('the result content is a trimmed string and missing content becomes empty',async()=>{
 const rows=[{title:'A',url:'https://e.com',score:0.1},{title:'B',url:'https://e.com/2',content:'  teks  ',score:0.2}];
 const res=await searchTavily('q',{apiKey:'k',request:async()=>okResponse(rows)});
 assert.equal(res[0].content,'');
 assert.equal(res[1].content,'teks');
});

test('the per-call timeout and the caller signal are combined into one signal',async()=>{
 let captured;
 const caller=AbortSignal.abort();
 await searchTavily('q',{apiKey:'k',timeoutMs:12345,signal:caller,request:async(url,init)=>{captured=init;return okResponse([])}});
 assert.equal(captured.timeout,undefined); // no non-standard field leaks into RequestInit
 assert.equal(captured.signal.aborted,true); // the combined signal inherits the caller's abort
});
