import test from 'node:test';
import assert from 'node:assert/strict';
import {runWriteGraph} from '../lib/agent-graph.ts';

// Fixture mirrors the demo corpus: Vale dies 2048-03, Mira learns Helios 2048-04. The graph
// never touches the DB beyond the Phase 3 context builder — the stub dispatches the same
// rpc/table reads with fixture rows. Embedding config stays unset in tests, so retrieval
// runs the lexical path (2-arg retrieve_memory).
const evidenceRow={id:'chunk-1',chapter_id:'c1',title:'Bab 1',story_time:'2048-03-11',source_revision:1,chunk_index:0,content:'Mira menemukan sinyal Helios.',score:1};
const characterRow={id:'char-1',name:'Mira',aliases:[],role:'protagonist'};
const factRow={id:'fact-1',claim:'Dr. Vale meninggal pada 2048-03-11',subject:'Vale',predicate:'meninggal',object:'2048-03-11',quote:'Vale meninggal',chunk_id:'chunk-1',confidence:0.9};
const eventRow={id:'event-1',story_time:'2048-03-11',title:'Kematian Vale',event_type:'death',chapter_id:'c1',quote:'Vale meninggal',chunk_id:'chunk-1'};
const knowRow={id:'know-1',character_id:'char-1',character_name:'Mira',statement:'Mira mengetahui Project Helios',knows:true,learned_at_story_time:'2048-04-17',quote:'Mira mengetahui',chunk_id:'chunk-1'};

function makeDb(evidence){
 const tables={
  characters:[characterRow],
  story_facts:evidence.length?[factRow]:[],
  story_embeddings:[],
 };
 return {
  from(table){
   const chain={select:()=>chain,eq:()=>chain,is:()=>chain,in:()=>chain,limit:()=>Promise.resolve({data:tables[table]??[],error:null}),maybeSingle:()=>Promise.resolve({data:null,error:null}),single:()=>Promise.resolve({data:null,error:null})};
   return chain;
  },
  rpc(name){
   if(name==='retrieve_memory')return Promise.resolve({data:evidence,error:null});
   if(name==='current_timeline_events')return Promise.resolve({data:evidence.length?[eventRow]:[],error:null});
   if(name==='current_character_knowledge')return Promise.resolve({data:evidence.length?[knowRow]:[],error:null});
   return Promise.resolve({data:[],error:null});
  },
 };
}
const prepared={planner:{},writer:{},continuity:{},critic:{}};
const planJson=JSON.stringify({goal:'Konfrontasi Vale.',characters:['Mira'],requiredEvents:['Konfrontasi'],activePlotThreads:['Helios'],constraints:['Vale sudah meninggal'],scenePlan:['Pembuka','Konfrontasi'],continuityRisks:['Status hidup Vale'],suggestedStoryTime:null});
const draft='Mira menatap Vale. Arka mengangkat pistol.';

function fakeCall(answers){
 const calls=[];
 return {calls,call:async(role,system,prompt)=>{
  calls.push({role,system,prompt});
  const answer=answers[calls.length-1];
  if(typeof answer==='string')return {text:answer,usage:{inputTokens:10,outputTokens:5}};
  throw answer;
 }};
}

test('happy path: one issue found, one repair, clean recheck, critic runs',async()=>{
 const stages=[];
 const leak=JSON.stringify({issues:[{type:'knowledge_leak',severity:'high',claim:'Mira menyebut Helios',evidence_ids:['know-1'],explanation:'Belum saatnya',repair_hint:'Hapus'}]});
 const clean=JSON.stringify({issues:[]});
 const {calls,call}=fakeCall([planJson,draft,leak,draft+' Diperbaiki.',clean,JSON.stringify({strengths:['Rapat'],improvements:['Perjelas']})]);
 const result=await runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan adegan.',userId:'u1',generationId:'g1',prepared,call,emit:s=>stages.push(s.stage)});
 assert.deepEqual(stages,['context','plan','draft','guardian','repair','recheck','critic']);
 assert.equal(calls.length,6);
 assert.equal(result.repairAttempts,1);
 assert.equal(result.resolved,true);
 assert.ok(result.draft.endsWith('Diperbaiki.'));
 assert.deepEqual(result.tokenUsage,{inputTokens:60,outputTokens:30});
 assert.deepEqual(result.issues,[]);
});
test('guardian budget: two repairs exhausted keeps issues and stays honest',async()=>{
 const stages=[];
 const leak=JSON.stringify({issues:[{type:'alive_dead_conflict',severity:'critical',claim:'Vale hidup setelah kematiannya',evidence_ids:['fact-1'],explanation:'Karakter mati',repair_hint:'Revisi adegan'}]});
 const {calls,call}=fakeCall([planJson,draft,leak,draft,leak,draft,leak,JSON.stringify({strengths:[],improvements:['Selesaikan konflik']})]);
 const result=await runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan adegan.',userId:'u1',generationId:'g1',prepared,call,emit:s=>stages.push(s.stage)});
 assert.deepEqual(stages,['context','plan','draft','guardian','repair','recheck','repair','recheck','critic']);
 assert.equal(calls.filter(c=>c.role==='continuity').length,3);
 assert.equal(calls.filter(c=>c.role==='writer').length,3);
 assert.equal(result.repairAttempts,2);
 assert.equal(result.resolved,false);
 assert.equal(result.issues.length,1);
});
test('clean guardian skips repair entirely',async()=>{
 const stages=[];
 const {calls,call}=fakeCall([planJson,draft,JSON.stringify({issues:[]}),JSON.stringify({strengths:[],improvements:[]})]);
 const result=await runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan adegan.',userId:'u1',generationId:'g1',prepared,call,emit:s=>stages.push(s.stage)});
 assert.deepEqual(stages,['context','plan','draft','guardian','critic']);
 assert.equal(calls.length,4);
 assert.equal(result.resolved,true);
});
test('fabricated guardian evidence ids drop issues, so no repair loop runs',async()=>{
 const stages=[];
 const fake=JSON.stringify({issues:[{type:'knowledge_leak',severity:'high',claim:'Halusinasi',evidence_ids:['fact_123'],explanation:'-',repair_hint:'-'}]});
 const {calls,call}=fakeCall([planJson,draft,fake,JSON.stringify({strengths:[],improvements:[]})]);
 const result=await runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan.',userId:'u1',generationId:'g1',prepared,call,emit:s=>stages.push(s.stage)});
 assert.equal(result.resolved,true);
 assert.deepEqual(stages,['context','plan','draft','guardian','critic']);
});
test('model failure propagates without a partial result',async()=>{
 const err=new Error('AI_GENERATION_FAILED');
 const {call}=fakeCall([planJson,err]);
 await assert.rejects(()=>runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan.',userId:'u1',generationId:'g1',prepared,call}),/AI_GENERATION_FAILED/);
});
test('no evidence aborts before any agent call',async()=>{
 const {calls,call}=fakeCall([]);
 await assert.rejects(()=>runWriteGraph({db:makeDb([]),projectId:'p1',instruction:'Lanjutkan.',userId:'u1',generationId:'g1',prepared,call}),/NO_EVIDENCE/);
 assert.equal(calls.length,0);
});
test('guardian prompt carries evidence ids and story_time for restraint rules',async()=>{
 const {calls,call}=fakeCall([planJson,draft,JSON.stringify({issues:[]}),JSON.stringify({strengths:[],improvements:[]})]);
 await runWriteGraph({db:makeDb([evidenceRow]),projectId:'p1',instruction:'Lanjutkan.',userId:'u1',generationId:'g1',prepared,call});
 const guardian=calls.find(c=>c.role==='continuity');
 assert.ok(guardian.prompt.includes('know-1')&&guardian.prompt.includes('2048-03-11')&&guardian.prompt.includes('learned_at_story_time'));
});
