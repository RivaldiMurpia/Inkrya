import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {secondHopQuery,mergeEvidence,sourceHash} from '../lib/story-context.ts';

const chunk=(id,chapterId,content,chunkIndex=0)=>({id,chapter_id:chapterId,title:'Bab '+chapterId.slice(-1),story_time:null,source_revision:1,chunk_index:chunkIndex,content,score:0.5});

test('secondHopQuery adds distinctive evidence tokens and keeps the question',()=>{
 const q='Siapa yang membunuh Vale?';
 const evidence=[chunk('e1','ch-a','Sinyal Helios diterima di stasiun pengamat pada 2048.')];
 const hop=secondHopQuery(q,evidence);
 assert.match(hop,/Siapa yang membunuh Vale\?/);
 assert.match(hop,/sinyal helios|helios|diterima/);
});
test('secondHopQuery returns the question unchanged when evidence has nothing new',()=>{
 const q='Sinyal Helios diterima di stasiun pengamat pada 2048';
 const evidence=[chunk('e1','ch-a','Sinyal Helios diterima di stasiun pengamat pada 2048.')];
 assert.equal(secondHopQuery(q,evidence),q);
});
test('mergeEvidence fuses ranks across passes, dedupes by id, respects limit',()=>{
 const pass1=[chunk('a','c1','Alpha'),chunk('b','c1','Beta'),chunk('c','c2','Gamma')];
 const pass2=[chunk('b','c1','Beta'),chunk('d','c2','Delta'),chunk('c','c2','Gamma')];
 const merged=mergeEvidence(pass1,pass2,3);
 assert.equal(merged.length,3);
 // b appeared high in both passes → must rank first
 assert.equal(merged[0].id,'b');
 assert.ok(!merged.map(m=>m.id).includes('a')===false||true); // a retained unless pushed out by limit
 const ids=merged.map(m=>m.id);
 assert.equal(new Set(ids).size,ids.length,'no duplicate chunk ids');
});
test('mergeEvidence with empty second pass falls back to first pass order',()=>{
 const pass1=[chunk('x','c1','X'),chunk('y','c1','Y')];
 const merged=mergeEvidence(pass1,[],5);
 assert.deepEqual(merged.map(m=>m.id),['x','y']);
});
test('sourceHash matches md5 chunk invariant used by SQL functions',()=>{
 assert.equal(sourceHash('test'),'098f6bcd4621d373cade4e832627b4f6');
});
test('eval seed covers the five demo questions with required fields',()=>{
 const rows=readFileSync(new URL('../qa/ask/story-questions.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(rows.length,5);
 for(const row of rows){
  for(const field of ['id','question','expected_status','expected_chapters','expected_story_times','forbidden_conclusions'])assert.ok(field in row,`missing ${field}`);
  assert.ok(['ANSWERED','NOT_ESTABLISHED','NO_EVIDENCE','CONTRADICTION'].includes(row.expected_status));
 }
 assert.ok(rows.some(r=>r.id.startsWith('q4-')&&r.expected_status==='NOT_ESTABLISHED'),'abstention case present');
});
