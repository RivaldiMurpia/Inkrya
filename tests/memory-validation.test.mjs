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

// Structural problems still throw: a malformed body is not a partial answer.
assert.throws(()=>validateAnswer({claims:Array(7).fill({text:'x',source_id:'s1',quote:'Aurel'})},[source]));
assert.throws(()=>validateAnswer(null,[source]));
// A claim missing its quote is malformed and dropped; with nothing left the answer abstains
// (still never throws — one junk claim must not cost the whole response).
assert.equal(validateAnswer({claims:[{text:'No source'}]},[source]).status,'NOT_ESTABLISHED');

// Re-anchor must not splice: an anchored span only counts when it sits on a source sentence
// BOUNDARY (start, end, or the whole sentence), so a window from the WRONG sentence — or one
// that splices two sentences — is rejected and the claim dropped.
const twoSentences={id:'s2',chapter_id:'c1',title:'Bab 1',source_revision:1,chunk_index:0,
 content:'Aurel bekerja di kantor BUMN di Duri. Kunci itu disimpan di laci meja radio stasiun lama.'};
const spliced=validateAnswer({claims:[
 {text:'Kunci itu ada di kantor BUMN.',source_id:'s2',quote:'kunci itu disimpan di laci meja radio kantor BUMN di Duri'},
],status:'ANSWERED'},[twoSentences]);
assert.equal(spliced.claims.length,0); // the splice finds no sentence-bounded anchor → dropped
assert.equal(spliced.status,'NOT_ESTABLISHED'); // honest abstention, not a fabricated citation

// A quote that drops the source's negation must NOT re-anchor: the surviving tail contradicts
// the source, so it is dropped — the answer abstains instead of shipping a supporting-looking
// citation for the opposite claim.
const negation={id:'s3',chapter_id:'c1',title:'Bab 3',source_revision:1,chunk_index:0,
 content:'Mira yang membaca laporan itu masih belum mengetahui nama proyeknya. Ia menyimpan kuncinya di laci.'};
const flipped=validateAnswer({claims:[
 {text:'Mira mengetahui nama proyeknya.',source_id:'s3',quote:'Mira mengetahui nama proyeknya'},
],status:'ANSWERED'},[negation]);
assert.equal(flipped.claims.length,0,'a negation-dropping paraphrase must not become a citation');
assert.equal(flipped.status,'NOT_ESTABLISHED');

// Phase 8 finding: ONE paraphrased quote used to throw away the WHOLE answer, 503ing the ask
// deterministically. A quote that is not an exact substring is now re-anchored to the real
// span in its source, so the claim survives with a truthful quote; a claim whose source_id
// does not resolve is dropped instead of discarding every sibling claim.
const reanchored=validateAnswer({claims:[
 {text:'Aurel bekerja di kantor BUMN.',source_id:'s1',quote:'Aurel bekerja di kantor BUMN di Duri ini hari'},
],status:'ANSWERED'},[source]);
assert.equal(reanchored.status,'ANSWERED');
assert.equal(reanchored.claims.length,1);
assert.ok(source.content.includes(reanchored.claims[0].quote),'re-anchored quote must be a real substring');

const dropped=validateAnswer({claims:[
 {text:'Klaim tanpa sumber.',source_id:'s-nonexistent',quote:'Aurel bekerja'},
 {text:'Aurel bekerja di Duri.',source_id:'s1',quote:'kantor BUMN di Duri'},
],status:'ANSWERED'},[source]);
assert.equal(dropped.claims.length,1); // the bad claim is dropped…
assert.equal(dropped.status,'ANSWERED'); // …and the good one still answers.
// Every claim unsupported → honest abstention, never invented support.
const allBad=validateAnswer({claims:[
 {text:'x',source_id:'s1',quote:'sekali lagi tidak ada sama sekali di sumber ini'},
],status:'ANSWERED'},[source]);
assert.equal(allBad.status,'NOT_ESTABLISHED');
assert.equal(allBad.claims.length,0);

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
