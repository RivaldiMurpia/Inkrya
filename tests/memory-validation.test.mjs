import assert from 'node:assert/strict';
import {parseModelJSON,validateAnswer,validateInsights} from '../lib/memory-validation.ts';
const source={id:'s1',chapter_id:'c1',title:'Bab 1',source_revision:1,chunk_index:0,content:'Aurel bekerja di kantor BUMN di Duri.'};

// validateAnswer: now returns {claims, status}
const ok=validateAnswer({claims:[{text:'Aurel bekerja di Duri.',source_id:'s1',quote:'kantor BUMN di Duri'}],status:'ANSWERED'},[source]);
assert.equal(ok.claims.length,1);
assert.equal(ok.status,'ANSWERED');

// ANSWERED with no valid claims downgrades to NOT_ESTABLISHED
const empty=validateAnswer({claims:[],status:'ANSWERED'},[source]);
assert.equal(empty.status,'NOT_ESTABLISHED');
assert.equal(empty.claims.length,0);

// Explicit NOT_ESTABLISHED / NO_EVIDENCE / CONTRADICTION propagated
assert.equal(validateAnswer({claims:[],status:'NOT_ESTABLISHED'},[source]).status,'NOT_ESTABLISHED');
assert.equal(validateAnswer({claims:[],status:'NO_EVIDENCE'},[source]).status,'NO_EVIDENCE');
const contra=validateAnswer({claims:[{text:'Kontradiksi.',source_id:'s1',quote:'kantor BUMN di Duri'}],status:'CONTRADICTION'},[source]);
assert.equal(contra.status,'CONTRADICTION');

// Unknown status with no claims downgrades to NOT_ESTABLISHED (never ANSWERED)
assert.equal(validateAnswer({claims:[],status:'UNKNOWN'},[source]).status,'NOT_ESTABLISHED');

// Throws on bad source_id, bad quote (not substring), too many claims, malformed
assert.throws(()=>validateAnswer({claims:[{text:'ok',source_id:'s2',quote:'kantor BUMN di Duri'}]},[source]));
assert.throws(()=>validateAnswer({claims:[{text:'ok',source_id:'s1',quote:'kata tidak ada'}]},[source]));
assert.throws(()=>validateAnswer({claims:Array(7).fill({text:'x',source_id:'s1',quote:'Aurel'})},[source]));
assert.throws(()=>validateAnswer({claims:[{text:'No source'}]},[source]));

// parseModelJSON strips markdown fences
assert.equal(parseModelJSON('```json\n{"claims":[]}\n```').claims.length,0);

// validateInsights: facts filtered by exact quote; events must have story_time; knowledge filtered
const chunk='Laras pergi ke kafe. Dia bertemu Raka di sana. Raka tahu soal itu.';
const v=validateInsights({
 summary:'Ringkasan pendek',
 facts:[
  {claim:'Laras ke kafe',quote:'pergi ke kafe',subject:'Laras',predicate:'pergi ke',object:'kafe',confidence:0.8},
  {claim:'Quote salah',quote:'tidak ada kutipan ini'},
 ],
 events:[
  {story_time:'2048-04-17',title:'Pertemuan',event_type:'meeting',quote:'bertemu Raka di sana',description:'desc'},
  {title:'Event tanpa waktu',quote:'pergi ke kafe'},   // harus dibuang (no story_time)
 ],
 knowledge:[
  {character:'Raka',fact_key:'tahu soal itu',statement:'Raka mengetahui rahasia tersebut',knows:true,story_time:'2048-04-17',quote:'Raka tahu soal itu'},
  {character:'X',statement:'tidak ada',knows:false,quote:'tidak ada dalam chunk'},  // harus dibuang
 ],
},chunk);
assert.equal(v.facts.length,1,'fact bad quote dropped');
assert.equal(v.facts[0].subject,'Laras');
assert.equal(v.facts[0].confidence,0.8);
assert.equal(v.events.length,1,'event without story_time dropped');
assert.equal(v.events[0].story_time,'2048-04-17');
assert.equal(v.knowledge.length,1,'knowledge bad quote dropped');
assert.equal(v.knowledge[0].character,'Raka');
assert.equal(v.knowledge[0].knows,true);
assert.throws(()=>validateInsights({summary:'',facts:[]},chunk),'empty summary throws');

console.log('PASS: validateAnswer status contract, validateInsights SPO/events/knowledge filtering.');
