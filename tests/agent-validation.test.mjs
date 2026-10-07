import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,validateGuardianIssues,validateCritic} from '../lib/agent-validation.ts';
import {parseModelJSON} from '../lib/memory-validation.ts';

const context={
 question:'uji',evidence:[{id:'chunk-1',chapter_id:'c1',title:'Bab 1',story_time:'2048-03-11',source_revision:1,chunk_index:0,content:'Mira menemukan sinyal.',score:1}],
 canon:[{id:'fact-1',claim:'Vale mati',subject:null,predicate:null,object:null,quote:'Vale',chunk_id:'chunk-1',confidence:null}],
 timeline:[{id:'event-1',story_time:'2048-03-11',title:'Sinyal ditemukan',event_type:'discovery',chapter_id:'c1',quote:'Mira menemukan',chunk_id:'chunk-1'}],
 knowledge:[{id:'know-1',character_name:'Mira',statement:'Mira tahu Helios',knows:true,learned_at_story_time:'2048-04-17',quote:'Mira tahu',chunk_id:'chunk-1'}],
 characters:[{name:'Mira',aliases:['Si Mira'],role:'protagonist'}],
 hasEmbedding:false,
};
const plan={goal:'Mira mengonfrontasi Vale.',characters:['Mira'],requiredEvents:['Konfrontasi'],activePlotThreads:['Sinyal Helios'],constraints:['Vale sudah mati'],scenePlan:['Pembuka','Konfrontasi'],continuityRisks:['Status hidup Vale'],suggestedStoryTime:'2048-04-18'};

test('validatePlan accepts a valid plan with a cast name',()=>{
 const out=validatePlan(plan,context);
 assert.equal(out.goal,plan.goal);
 assert.deepEqual(out.characters,['Mira']);
 assert.equal(out.suggestedStoryTime,'2048-04-18');
});
test('validatePlan resolves alias and drops unknown characters',()=>{
 const alias=validatePlan({...plan,characters:['Si Mira','Zed']},context);
 assert.deepEqual(alias.characters,['Si Mira']);
 assert.throws(()=>validatePlan({...plan,characters:['Zed']},context),/INVALID_PLAN/);
});
test('validatePlan fails closed on an extra key, bad goal or missing key',()=>{
 assert.throws(()=>validatePlan({...plan,score:8},context),/INVALID_PLAN/);
 assert.throws(()=>validatePlan({...plan,goal:''},context),/INVALID_PLAN/);
 const {suggestedStoryTime:_drop,...without}=plan;
 assert.throws(()=>validatePlan(without,context),/INVALID_PLAN/);
});
test('validatePlan slices oversized arrays and drops overlong items',()=>{
 const big={...plan,scenePlan:Array.from({length:12},(_,i)=>`Adegan ${i}`)};
 assert.equal(validatePlan(big,context).scenePlan.length,8);
 const long={...plan,requiredEvents:['x'.repeat(301)]};
 assert.deepEqual(validatePlan(long,context).requiredEvents,[]);
});
test('validateGuardianIssues keeps real evidence ids and drops fabricated ones',()=>{
 const issues=validateGuardianIssues({issues:[
  {type:'knowledge_leak',severity:'high',claim:'Mira menyebut Helios',evidence_ids:['know-1'],explanation:'Belum diketahui',repair_hint:'Hapus penyebutan'},
  {type:'alive_dead_conflict',severity:'critical',claim:'Vale hidup',evidence_ids:['fact_123'],explanation:'Karakter mati',repair_hint:'Revisi'},
  {type:'timeline_contradiction',severity:'high',claim:'Tanpa bukti',evidence_ids:[],explanation:'-',repair_hint:'-'},
 ]},context);
 assert.equal(issues.length,1);
 assert.deepEqual(issues[0].evidence_ids,['know-1']);
});
test('validateGuardianIssues rejects unknown type or severity and oversized input',()=>{
 assert.throws(()=>validateGuardianIssues({issues:Array.from({length:9},()=>({type:'knowledge_leak',severity:'low',claim:'x',evidence_ids:['know-1'],explanation:'y',repair_hint:'z'}))},context),/INVALID_GUARDIAN/);
 const bad=validateGuardianIssues({issues:[{type:'plot_hole',severity:'high',claim:'x',evidence_ids:['know-1'],explanation:'y',repair_hint:'z'},{type:'knowledge_leak',severity:'extreme',claim:'x',evidence_ids:['know-1'],explanation:'y',repair_hint:'z'},{type:'knowledge_leak',severity:'low',claim:'',evidence_ids:['know-1'],explanation:'y',repair_hint:'z'}]},context);
 assert.deepEqual(bad,[]);
});
test('validateCritic accepts a report and fails closed on any score key',()=>{
 const out=validateCritic({strengths:['Pacing rapat'],improvements:['Kurangi dialog']});
 assert.deepEqual(out,{strengths:['Pacing rapat'],improvements:['Kurangi dialog']});
 assert.throws(()=>validateCritic({strengths:[],improvements:[],score:8}),/INVALID_CRITIC/);
 assert.throws(()=>validateCritic({strengths:'banyak'}),/INVALID_CRITIC/);
});
test('parseModelJSON still strips json fences for agent outputs',()=>{
 assert.deepEqual(parseModelJSON('```json\n{"issues":[]}\n```'),{issues:[]});
});
