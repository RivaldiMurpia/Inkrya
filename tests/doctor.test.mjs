import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDoctorPackage,doctorCoverage,checkForgottenCharacters} from '../lib/doctor.ts';
import {validateDoctorFindings} from '../lib/doctor-validation.ts';

// In-memory supabase-style stub covering exactly the reads buildDoctorPackage makes.
// chapters carry plain_text; story_chunks/memory_insights carry ids; RPCs answer canon rows.
function makeDbFixture(over={},rpcRows){
 const tables={
  chapters:[
   {id:'ch-1',title:'Bab 1',position:0,story_time:'2048-03-01',plain_text:'Mira dan Vale menemukan sinyal Helios.'},
   {id:'ch-2',title:'Bab 2',position:1,story_time:null,plain_text:'Mira menyusuri stasiun.'},
   {id:'ch-3',title:'Bab 3',position:2,story_time:'2048-03-11',plain_text:'Vale meninggal. Mira menangis.'},
   {id:'ch-4',title:'Bab 4',position:3,story_time:'2048-04-17',plain_text:'Arka muncul membawa kunci.'},
  ],
  characters:[
   {name:'Mira',aliases:[],role:'protagonist'},
   {name:'Vale',aliases:['Dr. Vale'],role:'supporting'},
   {name:'Arka',aliases:[],role:'protagonist'},
   {name:'Leni',aliases:[],role:'supporting'},
  ],
  story_bibles:[{world_rules:'  Sinyal tidak melewati air.  '}],
  story_chunks:[
   {id:'sc-1',chapter_id:'ch-1'},{id:'sc-2',chapter_id:'ch-2'},{id:'sc-3',chapter_id:'ch-3'},{id:'sc-4',chapter_id:'ch-4'},
  ],
  memory_insights:[{chunk_id:'sc-1'},{chunk_id:'sc-3'},{chunk_id:'sc-4'}],
  ...over,
 };
 // The chain is thenable: every builder returns itself, and `await chain` resolves to the
 // table's rows. rpcRows (optional) replaces the two canon RPC answers.
 const events=rpcRows?rpcRows.events:[{id:'ev-1',title:'Kematian Vale',story_time:'2048-03-11'}];
 const knowledge=rpcRows?rpcRows.knowledge:[{id:'kn-1',character_name:'Mira',statement:'Mira mengetahui Helios'}];
 return {
  from(table){
   const rows=tables[table]??[];
   const single=()=>Promise.resolve({data:rows[0]??null,error:null});
   const chain={select:()=>chain,eq:()=>chain,is:()=>chain,in:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:single,
    then:(res,rej)=>Promise.resolve({data:rows,error:null}).then(res,rej),catch:rej=>Promise.resolve({data:rows,error:null}).catch(rej)};
   return chain;
  },
  rpc(name){
   if(name==='current_timeline_events')return Promise.resolve({data:events,error:null});
   if(name==='current_character_knowledge')return Promise.resolve({data:knowledge,error:null});
   return Promise.resolve({data:[],error:null});
  },
 };
}
// The canonical rows read via .from().in(...) in buildDoctorPackage.
const withFactsDb=()=>makeDbFixture({story_facts:[{id:'fact-1',claim:'Vale meninggal 2048-03-11'}]});
// A project with no canon at all: no facts, no events, no knowledge, no story bible.
const emptyFactsDb=()=>makeDbFixture({story_bibles:[],memory_insights:[]},{events:[],knowledge:[]});

test('coverage is measured from real rows and reports skipped checks',async()=>{
 const pack=await buildDoctorPackage(withFactsDb(),'p1');
 const cov=doctorCoverage(pack);
 assert.equal(cov.chaptersTotal,4);
 assert.equal(cov.chaptersSummarized,3);
 assert.equal(cov.chaptersWithStoryTime,3);
 assert.equal(cov.canonFacts,1);
 assert.equal(cov.canonEvents,1);
 assert.equal(cov.canonKnowledge,1);
 assert.equal(cov.charactersTracked,4);
 assert.equal(cov.worldRulesProvided,true);
 assert.deepEqual(cov.skipped,[]);
});
test('an empty project marks every semantic check skipped, honestly',async()=>{
 const pack=await buildDoctorPackage(emptyFactsDb(),'p1');
 const cov=doctorCoverage(pack);
 assert.equal(cov.canonFacts,0);
 assert.equal(cov.skipped.length,5);
 assert.match(cov.skipped[0],/Fakta kanon belum ada/);
 assert.match(cov.skipped.find(s=>s.includes('Story bible')),/aturan dunia dilewati/);
});
test('world rules whitespace is trimmed',async()=>{
 const pack=await buildDoctorPackage(makeDbFixture(),'p1');
 assert.equal(pack.worldRules,'Sinyal tidak melewati air.');
});
test('deterministic last-seen scan powers the forgotten-character check',async()=>{
 const pack=await buildDoctorPackage(emptyFactsDb(),'p1');
 // last appearances: Mira ch-3, Vale ch-3, Arka ch-4. Leni never appears.
 const findings=checkForgottenCharacters(pack);
 // horizon = max(2, ceil(4*0.3)=2) = 2 → trigger only when lastPosition < 4-2 = 2
 // Mira ch-3 / Vale ch-3 / Arka ch-4 all ≥ 2 → no findings.
 assert.deepEqual(findings,[]);
});
test('a character absent from the trailing horizon is reported with evidence',async()=>{
 // 6 chapters: Mira last seen at index 1 → 1 < 6-2 = 4 → flagged.
 const chapters=[
  {id:'a1',title:'Bab 1',position:0,story_time:null,plain_text:'Mira berjalan.'},
  {id:'a2',title:'Bab 2',position:1,story_time:null,plain_text:'Mira menulis.'},
  {id:'a3',title:'Bab 3',position:2,story_time:null,plain_text:'Arka datang.'},
  {id:'a4',title:'Bab 4',position:3,story_time:null,plain_text:'Arka pergi.'},
  {id:'a5',title:'Bab 5',position:4,story_time:null,plain_text:'Arka tidur.'},
  {id:'a6',title:'Bab 6',position:5,story_time:null,plain_text:'Arka menunggu.'},
 ];
 const db2=makeDbFixture({chapters,characters:[{name:'Mira',aliases:[],role:'protagonist'}]});
 const pack=await buildDoctorPackage(db2,'p1');
 const findings=checkForgottenCharacters(pack);
 assert.equal(findings.length,1);
 assert.equal(findings[0].claim,'Mira tidak muncul lagi setelah Bab 2.');
 assert.deepEqual(findings[0].evidence_ids,['a2']);
 // The finding passes the same validator the AI findings face.
 const [validated]=validateDoctorFindings({findings},pack);
 assert.equal(validated.kind,'forgotten_character');
 assert.deepEqual(validated.resolvedEvidence.map(e=>e.label),['Bab: Bab 2']);
});
test('fewer than 4 chapters: the check stays silent — no small-sample noise',async()=>{
 const chapters=[
  {id:'b1',title:'Bab 1',position:0,story_time:null,plain_text:'Mira.'},
  {id:'b2',title:'Bab 2',position:1,story_time:null,plain_text:'Arka.'},
  {id:'b3',title:'Bab 3',position:2,story_time:null,plain_text:'Arka.'},
 ];
 const db2=makeDbFixture({chapters,characters:[{name:'Mira',aliases:[],role:'protagonist'}]});
 const pack=await buildDoctorPackage(db2,'p1');
 assert.deepEqual(checkForgottenCharacters(pack),[]);
});
test('context read failures fail closed as CONTEXT_READ_FAILED',async()=>{
 const broken={
  from(){const chain={select:()=>chain,eq:()=>chain,is:()=>chain,in:()=>chain,order:()=>chain,limit:()=>Promise.resolve({data:null,error:'boom'}),maybeSingle:()=>Promise.resolve({data:null,error:'boom'})};return chain},
  rpc:()=>Promise.resolve({data:[],error:null}),
 };
 await assert.rejects(()=>buildDoctorPackage(broken,'p1'),/CONTEXT_READ_FAILED/);
});
