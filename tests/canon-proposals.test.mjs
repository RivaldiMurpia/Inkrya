import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCanonProposals} from '../lib/agent-validation.ts';

const context={
 question:'uji',evidence:[{id:'chunk-1',chapter_id:'c1',title:'Bab 1',story_time:'2048-03-11',source_revision:1,chunk_index:0,content:'Mira menemukan sinyal.',score:1}],
 canon:[{id:'fact-1',claim:'Vale mati',subject:null,predicate:null,object:null,quote:'Vale',chunk_id:'chunk-1',confidence:null}],
 timeline:[{id:'event-1',story_time:'2048-03-11',title:'Sinyal ditemukan',event_type:'discovery',chapter_id:'c1',quote:'Mira menemukan',chunk_id:'chunk-1'}],
 knowledge:[{id:'know-1',character_name:'Mira',statement:'Mira tahu Helios',knows:true,learned_at_story_time:'2048-04-17',quote:'Mira tahu',chunk_id:'chunk-1'}],
 characters:[{name:'Mira',aliases:['Si Mira'],role:'protagonist'}],
 hasEmbedding:false,
};
const DRAFT='Mira menatap jendela. Ia masih menyimpan liontin perak pemberian ibunya. Malam itu dingin.';
const pendant={
 target_kind:'fact',
 claim:'Mira memiliki liontin perak dari ibunya',
 quote:'Ia masih menyimpan liontin perak pemberian ibunya.',
 evidence_ids:['chunk-1'],
 subject:'Mira',predicate:'memiliki',object:'liontin perak',confidence:0.8,
};
const wrap=proposals=>({proposals});

test('validateCanonProposals accepts the pendant fixture',()=>{
 const [out]=validateCanonProposals(wrap([pendant]),DRAFT,context);
 assert.equal(out.claim,'Mira memiliki liontin perak dari ibunya');
 assert.equal(out.quote,'Ia masih menyimpan liontin perak pemberian ibunya.');
 assert.deepEqual(out.evidence_ids,['chunk-1']);
});
test('an empty diff is valid — most continuations propose nothing',()=>{
 assert.deepEqual(validateCanonProposals(wrap([]),DRAFT,context),[]);
});
test('a quote not verbatim in the draft is dropped',()=>{
 const out=validateCanonProposals(wrap([{...pendant,quote:'Mira membeli liontin di pasar.'}]),DRAFT,context);
 assert.deepEqual(out,[]);
});
test('a mid-word fragment cannot serve as verbatim evidence',()=>{
 const out=validateCanonProposals(wrap([{target_kind:'fact',claim:'Naga menghancurkan desa',quote:'ndela pemberi',evidence_ids:['chunk-1']}]),DRAFT,context);
 assert.deepEqual(out,[]);
});
test('a quote below the 20-char floor is dropped',()=>{
 const out=validateCanonProposals(wrap([{...pendant,quote:'liontin perak'}]),DRAFT,context);
 assert.deepEqual(out,[]);
});
test('a quote over the 320 cap is dropped — it would never match one chunk',()=>{
 const out=validateCanonProposals(wrap([{...pendant,quote:'x'.repeat(321)}]),'x'.repeat(400),context);
 assert.deepEqual(out,[]);
});
test('fabricated evidence ids drop the item silently',()=>{
 const out=validateCanonProposals(wrap([{...pendant,evidence_ids:['chunk-999']}]),DRAFT,context);
 assert.deepEqual(out,[]);
});
test('an event without story_time is dropped, never dated by guesswork',()=>{
 const out=validateCanonProposals(wrap([{target_kind:'event',claim:'Mira menutup jendela',quote:'Mira menatap jendela.',evidence_ids:['chunk-1']}]),DRAFT,context);
 assert.deepEqual(out,[]);
});
test('an event with story_time and a valid enum type is kept',()=>{
 const [out]=validateCanonProposals(wrap([{target_kind:'event',claim:'Liontin pertama disimpan',quote:'Ia masih menyimpan liontin perak pemberian ibunya.',evidence_ids:['chunk-1'],story_time:'2048-03-11',event_type:'discovery'}]),DRAFT,context);
 assert.equal(out.story_time,'2048-03-11');
 assert.equal(out.event_type,'discovery');
 assert.equal(out.title,'Liontin pertama disimpan');
});
test('knowledge for an unknown character is dropped; a known one is kept',()=>{
 const out=validateCanonProposals(wrap([{target_kind:'knowledge',claim:'Kenan tahu Helios',quote:'Ia masih menyimpan liontin perak pemberian ibunya.',evidence_ids:['chunk-1'],character:'Kenan'}]),DRAFT,context);
 assert.deepEqual(out,[]);
 const [kept]=validateCanonProposals(wrap([{target_kind:'knowledge',claim:'Mira tahu liontin',quote:'Ia masih menyimpan liontin perak pemberian ibunya.',evidence_ids:['chunk-1'],character:'Mira'}]),DRAFT,context);
 assert.equal(kept.character,'Mira');
 assert.equal(kept.knows,true);
});
test('more than five proposals are capped and malformed items dropped, not fatal',()=>{
 const junk={target_kind:'fact',claim:'x',quote:'no draft match',evidence_ids:['chunk-1']};
 const out=validateCanonProposals(wrap([pendant,pendant,pendant,pendant,pendant,pendant,junk]),DRAFT,context);
 assert.equal(out.length,5);
});
test('a broken container fails closed with INVALID_CANON',()=>{
 assert.throws(()=>validateCanonProposals({wrong:1},DRAFT,context),/INVALID_CANON/);
 assert.throws(()=>validateCanonProposals({proposals:Array.from({length:9},()=>pendant)},DRAFT,context),/INVALID_CANON/);
});
