import test from 'node:test';
import assert from 'node:assert/strict';

const {runResearch}=await import('../lib/research.ts');
const {MAX_QUERIES}=await import('../lib/research-validation.ts');
const {traceToolRun}=await import('../lib/langsmith/tracing.ts');

assert.equal(typeof traceToolRun,'function');

const config={apiKey:'tvly-k',dailyCreditsPerUser:24,monthlyCredits:500};

// Two fake seams: the model call and the Tavily search. The model's first call answers the
// query plan; the second (if reached) answers the notes.
function fakeModel(plan,notes){
 const calls=[];
 const call=async(system,prompt,maxOutputTokens)=>{
  // The plan and notes prompts share the same keys, so the system prompt is the
  // discriminator: only the plan prompt asks for a query list.
  const wantsPlan=system.includes('Tavily');
  calls.push({system:system.slice(0,40),prompt,maxOutputTokens,wantsPlan});
  if(wantsPlan)return {text:JSON.stringify(plan),usage:{inputTokens:100,outputTokens:30}};
  return {text:JSON.stringify(notes),usage:{inputTokens:220,outputTokens:80}};
 };
 return {call,calls};
}

function fakeSearch(pages){
 const calls=[];
 const search=async(query)=>{
  calls.push(query);
  const page=pages[calls.length-1];
  if(page instanceof Error)throw page;
  return page;
 };
 return {search,calls};
}

const plan={queries:[{query:'transportasi Bandung 2010',reason:'latar'},{query:'cuaca Bandung Ramadan',reason:'atmosfer'}]};
const notes={summary:'Ringkasan sumber.',notes:[{heading:'Transportasi',body:'Angkot dominan.',citations:[1]},{heading:'Cuaca',body:'Mendung sore.',citations:[2]}],unanswered:[]};

test('the happy path: two queries, two sources, credits recorded per search as they are spent',async()=>{
 const model=fakeModel(plan,notes);
 const creditLog=[];
 const search=fakeSearch([
  [{title:'A',url:'https://e.com/a',content:'a',score:0.9}],
  [{title:'B',url:'https://e.com/b',content:'b',score:0.8}],
 ]);
 const result=await runResearch({topic:'Bandung 2010',prepared:{config:{provider:'nebius',id:'nvidia/x',task:'memory'}},config,generationId:'g1',projectId:'p1',userId:'u1',recordCredits:async c=>creditLog.push(c),search:search.search,call:model.call});
 assert.equal(result.queries.length,2);
 assert.deepEqual(result.sources.map(s=>s.index),[1,2]);
 assert.deepEqual(result.sources.map(s=>s.title),['A','B']);
 assert.equal(result.credits,2);
 assert.deepEqual(creditLog,[1,1]);
 assert.equal(result.notes.notes.length,2);
 assert.equal(result.tokenUsage.inputTokens,320);
 assert.equal(result.tokenUsage.outputTokens,110);
 assert.equal(result.warning,null);
 assert.equal(result.steps.length>=3,true);
});

test('every query returns zero results: no notes call, credits still metered, honest warning',async()=>{
 const model=fakeModel(plan,notes);
 const search=fakeSearch([[],[]]);
 const creditLog=[];
 const result=await runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g2',projectId:'p',userId:'u',recordCredits:async c=>creditLog.push(c),search:search.search,call:model.call});
 assert.deepEqual(result.sources,[]);
 // Tavily bills a credit for a search that returns nothing, so the meter must count the
 // two searches that ran — reporting 0 would understate what was spent.
 assert.equal(result.credits,2);
 assert.deepEqual(creditLog,[1,1]);
 assert.equal(model.calls.length,1); // plan call only
 assert.match(result.warning,/tidak ditemukan|tidak ada sumber|Tidak ada sumber/);
});

test('an empty plan means zero searches, zero credits, no crash',async()=>{
 const model=fakeModel({queries:[]},notes);
 const search=fakeSearch([]);
 const result=await runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g3',projectId:'p',userId:'u',recordCredits:async()=>{},search:search.search,call:model.call});
 assert.deepEqual(result.sources,[]);
 assert.equal(result.credits,0);
 assert.equal(search.calls.length,0);
 assert.match(result.warning,/tidak ditemukan|tidak ada sumber|Tidak ada sumber/);
});

test('a Tavily failure on the second query rejects the run but the first credit stays counted',async()=>{
 const model=fakeModel(plan,notes);
 const creditLog=[];
 const search=fakeSearch([
  [{title:'A',url:'https://e.com/a',content:'a',score:0.9}],
  Error('TAVILY_UNAVAILABLE'),
 ]);
 await assert.rejects(()=>runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g4',projectId:'p',userId:'u',recordCredits:async c=>creditLog.push(c),search:search.search,call:model.call}),/TAVILY_UNAVAILABLE/);
 assert.deepEqual(creditLog,[1]);
});

test('a note citing a nonexistent index is dropped with a counter',async()=>{
 const model=fakeModel(plan,{summary:'S.',notes:[{heading:'Baik',body:'x',citations:[1]},{heading:'Jelek',body:'y',citations:[9]}],unanswered:[]});
 const search=fakeSearch([
  [{title:'A',url:'https://e.com/a',content:'a',score:0.9}],
  [{title:'B',url:'https://e.com/b',content:'b',score:0.8}],
 ]);
 const result=await runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g5',projectId:'p',userId:'u',recordCredits:async()=>{},search:search.search,call:model.call});
 assert.equal(result.notes.notes.length,1);
 assert.equal(result.dropStats.noCitation,1);
});

test('a flood plan is capped at MAX_QUERIES searches',async()=>{
 const flood={queries:Array.from({length:6},(_,i)=>({query:`q${i}`,reason:'r'}))};
 const model=fakeModel(flood,{summary:'S.',notes:[],unanswered:[]});
 const search=fakeSearch(Array.from({length:6},()=>[]));
 const result=await runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g6',projectId:'p',userId:'u',recordCredits:async()=>{},search:search.search,call:model.call});
 assert.equal(search.calls.length,MAX_QUERIES);
 assert.equal(result.credits,MAX_QUERIES); // three searches ran, three credits billed
});

test('prompts stay under the 48k ceiling and the notes prompt carries the source list',async()=>{
 const model=fakeModel(plan,notes);
 const search=fakeSearch([
  [{title:'A',url:'https://e.com/a',content:'x'.repeat(1500),score:0.9}],
  [{title:'B',url:'https://e.com/b',content:'y',score:0.8}],
 ]);
 await runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g7',projectId:'p',userId:'u',recordCredits:async()=>{},search:search.search,call:model.call});
 for(const c of model.calls){
  assert.equal(c.system.length+c.prompt.length<48000,true);
  assert.equal(c.maxOutputTokens<=2400,true);
 }
 const notesCall=model.calls.find(c=>!c.wantsPlan);
 assert.match(notesCall.prompt,/e\.com\/a/);
});

test('a malformed plan answer aborts with INVALID_RESEARCH_PLAN before any search',async()=>{
 const model=fakeModel({queries:'banyak'},notes);
 const search=fakeSearch([]);
 await assert.rejects(()=>runResearch({topic:'t',prepared:{config:{provider:'nebius',id:'x',task:'memory'}},config,generationId:'g8',projectId:'p',userId:'u',recordCredits:async()=>{},search:search.search,call:model.call}),/INVALID_RESEARCH_PLAN/);
 assert.equal(search.calls.length,0);
});
