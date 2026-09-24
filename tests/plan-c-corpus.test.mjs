import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCorpus, validateDirectory, validatePair } from '../scripts/plan-c-validate.mjs';

const load=name=>readFileSync(`qa/plan-c/${name}.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const train=load('train.records'),training=load('train.nebius');
const evalRows=load('heldout.records'),reference=load('heldout.reference');
const clone=x=>structuredClone(x);

test('fixed synthetic corpus has 120 train and 30 untouched held-out pairs',()=>{
 const stats=validateDirectory();
 assert.equal(stats.valid,true);
 assert.equal(stats.train.scene_families,40);
 assert.equal(stats.heldout.scene_families,10);
});
test('rejects duplicate training prompts and answers',()=>{
 const rows=clone(train),messages=clone(training);
 rows[1]={...clone(rows[0]),id:rows[1].id,family:rows[1].family};
 messages[1]=clone(messages[0]);
 assert.throws(()=>validateCorpus(rows,messages,evalRows,reference),/duplicate\/overlapping prompt|duplicate\/overlapping answer/);
});
test('rejects train-eval family/setting overlap',()=>{
 const rows=clone(evalRows);
 for(let i=0;i<3;i++)rows[i].family=train[0].family;
 assert.throws(()=>validateCorpus(train,training,rows,reference),/family overlap|setting leakage/);
});
test('rejects target answer leaked into its prompt',()=>{
 const message=clone(training[0]);
 message.messages[1].content+=train[0].target_id;
 assert.throws(()=>validatePair(train[0],message,'train'),/answer appears in prompt|user prompt differs/);
});
test('rejects a near-duplicate answer copied across splits',()=>{
 const rows=clone(evalRows),messages=clone(reference);
 const copied=train[0].target_id.replace('Ika','Reka');
 rows[0].target_id=copied;
 messages[0].messages[2].content=copied;
 assert.throws(()=>validateCorpus(train,training,rows,messages),/near-duplicate answer/);
});
test('rejects invalid schema and Unicode',()=>{
 const extra=clone(train[0]);extra.unexpected='value';
 assert.throws(()=>validatePair(extra,training[0],'train'),/record schema/);
 const unsafe=clone(train[0]);unsafe.target_id+='\u200b';
 assert.throws(()=>validatePair(unsafe,training[0],'train'),/unsafe Unicode/);
 const decomposed=clone(train[0]);decomposed.target_id+=' e\u0301';
 assert.throws(()=>validatePair(decomposed,training[0],'train'),/non-NFC Unicode/);
});
test('rejects word-range violation and answer mismatch',()=>{
 const short=clone(train[0]);short.target_word_range={min:60,max:65};
 assert.throws(()=>validatePair(short,training[0],'train'),/word range/);
 const mismatch=clone(training[0]);mismatch.messages[2].content='Different answer.';
 assert.throws(()=>validatePair(train[0],mismatch,'train'),/answer differs/);
});
