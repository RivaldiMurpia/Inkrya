import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDoctorFindings,evidenceLabels} from '../lib/doctor-validation.ts';

const pack={
 chapters:[
  {id:'ch-1',title:'Bab 1',position:0,story_time:'2048-03-01',ready:true,summarized:true,seenCharacters:['Mira','Vale']},
  {id:'ch-2',title:'Bab 2',position:1,story_time:null,ready:true,summarized:true,seenCharacters:['Mira']},
 ],
 summaries:[{chunk_id:'chunk-1',chapter_id:'ch-1',title:'Bab 1',chunk_index:0,summary:'Mira menemukan sinyal.'}],
 facts:[{id:'fact-1',claim:'Vale meninggal 2048-03-11'}],
 events:[{id:'event-1',title:'Kematian Vale',story_time:'2048-03-11'}],
 knowledge:[{id:'know-1',character_name:'Mira',statement:'Mira mengetahui Helios'}],
 characters:[{name:'Mira',aliases:[],role:'protagonist'}],
 worldRules:'Sinyal tidak dapat melewati air.',
};
const finding=(over={})=>({
 kind:'knowledge_error',severity:'high',
 claim:'Mira menyebut Helios sebelum mengetahuinya',
 explanation:'Dialog bab terakhir merujuk Helios, tetapi pengetahuan tercatat 2048-04-17.',
 evidence_ids:['know-1'],chapter_id:'ch-2',...over,
});
const wrap=findings=>({findings});

test('a grounded finding passes and gains readable evidence labels',()=>{
 const [out]=validateDoctorFindings(wrap([finding()]),pack);
 assert.equal(out.kind,'knowledge_error');
 assert.deepEqual(out.resolvedEvidence,[{id:'know-1',label:'Pengetahuan: Mira — Mira mengetahui Helios'}]);
 assert.equal(out.chapter_id,'ch-2');
});
test('an empty report is valid — a clean manuscript is a real answer',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([]),pack),[]);
});
test('fabricated evidence ids drop the finding silently',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([finding({evidence_ids:['nope']})]),pack),[]);
});
test('a finding with no evidence array at all is dropped',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([finding({evidence_ids:undefined})]),pack),[]);
});
test('an unknown kind or severity drops the finding',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([finding({kind:'vibes'})]),pack),[]);
 assert.deepEqual(validateDoctorFindings(wrap([finding({severity:'extreme'})]),pack),[]);
});
test('a missing claim or explanation drops the finding',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([finding({claim:''})]),pack),[]);
 assert.deepEqual(validateDoctorFindings(wrap([finding({explanation:'   '})]),pack),[]);
});
test('a bogus chapter_id is nulled but the finding survives — it is a link, not evidence',()=>{
 const [out]=validateDoctorFindings(wrap([finding({chapter_id:'ch-999'})]),pack);
 assert.equal(out.chapter_id,null);
 assert.equal(out.evidence_ids.length,1);
});
test('overlong fields and the 8-item cap are enforced',()=>{
 assert.deepEqual(validateDoctorFindings(wrap([finding({claim:'x'.repeat(501)})]),pack),[]);
 const flood=Array.from({length:12},(_,i)=>finding({claim:`temuan ${i}`,evidence_ids:['ch-1']}));
 assert.equal(validateDoctorFindings(wrap(flood),pack).length,8);
});
test('a non-object or malformed body throws INVALID_DOCTOR',()=>{
 assert.throws(()=>validateDoctorFindings(null,pack),/INVALID_DOCTOR/);
 assert.throws(()=>validateDoctorFindings({findings:'banyak'},pack),/INVALID_DOCTOR/);
});
test('drop stats explain why a report came back empty — counts only, never text',()=>{
 const stats={proposed:0,kept:0,badShape:0,badEnum:0,badText:0,noEvidence:0};
 validateDoctorFindings(wrap([finding(),finding({evidence_ids:['nope']}),finding({kind:'vibes'}),finding({claim:''})]),pack,stats);
 assert.deepEqual(stats,{proposed:4,kept:1,badShape:0,badEnum:1,badText:1,noEvidence:1});
});
test('evidence labels cover every id type the model can cite',()=>{
 const labels=evidenceLabels(pack);
 assert.match(labels.get('ch-1'),/^Bab: Bab 1/);
 assert.match(labels.get('chunk-1'),/^Ringkasan: Bab 1 · bagian 1/);
 assert.match(labels.get('fact-1'),/^Fakta: Vale meninggal/);
 assert.match(labels.get('event-1'),/^Peristiwa: Kematian Vale/);
 assert.match(labels.get('know-1'),/^Pengetahuan: Mira/);
});
