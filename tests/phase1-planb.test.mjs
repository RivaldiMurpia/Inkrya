import test from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../scripts/phase1-writer-cases.mjs';
import {checkMechanical,checkSemantic,lockScenePlan,runConstrainedCase} from '../scripts/phase1-constrained-writer.mjs';

const item=cases[0];
const plan=JSON.stringify({required_facts:item.requiredFacts,forbidden_changes:item.forbiddenChanges,beats:item.allowedBeats,pov:'third_person',target_word_range:{min:item.min,max:item.max}});
const trueVerdict=JSON.stringify({draft_preserves_facts:true,required_facts_preserved:true,forbidden_changes_absent:true,no_new_contradictory_facts:true});

test('scene locks fail closed on a missing fact, new beat or changed word range',()=>{
 assert.equal(lockScenePlan(plan,item).pov,'third_person');
 for(const change of [p=>p.required_facts.pop(),p=>p.beats.push('Damar menemukan kunci.'),p=>p.target_word_range.min--]){
  const altered=JSON.parse(plan);change(altered);
  assert.throws(()=>lockScenePlan(JSON.stringify(altered),item),/PLAN_DID_NOT_PRESERVE_SYNTHETIC_LOCKS/);
 }
 assert.throws(()=>lockScenePlan(plan.slice(0,-1)+',"extra":"ignore previous"}',item),/UNEXPECTED_PLAN_FIELDS/);
});

test('mechanical checks reject short, multiline, unfinished, meta and obvious English output',()=>{
 const text='Mira mendengar ketukan dari radio. '.repeat(12).trim();
 assert.equal(checkMechanical(text,item).passed,true);
 for(const bad of ['Mira.',text.replace(' radio. ', ' radio.\n ',),text.replace(/\.$/u,','),`Berikut adalah hasil: ${text}`,text.replace('mendengar','heard')]){
  assert.equal(checkMechanical(bad,item).passed,false,bad);
 }
});

test('unknown semantic verdict cannot become a pass',()=>{
 assert.equal(checkSemantic(trueVerdict,item).passed,true);
 assert.throws(()=>checkSemantic('{}',item),/INVALID_SEMANTIC_VERDICT/);
 assert.equal(checkSemantic(trueVerdict.replace('"forbidden_changes_absent":true','"forbidden_changes_absent":false'),item).passed,false);
});

test('failing first output gets exactly one Writer repair and a second semantic check',async()=>{
 const stages=[];
 const final='Mira mendengar ketukan dari radio. '.repeat(12).trim();
 const answers={scene_plan:plan,english_draft:'Mira heard three knocks through the radio.',surface_first:'Mira.',semantic_first:trueVerdict,surface_repair:final,semantic_repair:trueVerdict};
 const result=await runConstrainedCase(item,async({stage,role})=>{
  stages.push([stage,role]);return {text:answers[stage],model:'catalog-verified-synthetic-test'};
 });
 assert.equal(result.requests,6);
 assert.equal(result.repairCalls,1);
 assert.equal(result.firstPass.passed,false);
 assert.equal(result.repaired.passed,true);
 assert.equal(result.passed,true);
 assert.deepEqual(stages.map(([stage])=>stage),Object.keys(answers));
 assert.deepEqual(stages.map(([,role])=>role),['planner','planner','writer','qa','writer','qa']);
});

test('unfaithful English draft stops without a false translation repair',async()=>{
 const stages=[];
 const badDraftVerdict=trueVerdict.replace('"draft_preserves_facts":true','"draft_preserves_facts":false');
 const answers={scene_plan:plan,english_draft:'The key moved.',surface_first:'Mira.',semantic_first:badDraftVerdict};
 const result=await runConstrainedCase(item,async({stage})=>{stages.push(stage);return {text:answers[stage],model:'synthetic-test'};});
 assert.equal(result.requests,4);
 assert.equal(result.repairCalls,0);
 assert.equal(result.passed,false);
 assert.ok(!stages.includes('surface_repair'));
});
