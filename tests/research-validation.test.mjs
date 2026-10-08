import test from 'node:test';
import assert from 'node:assert/strict';

const {validateResearchQueries,dedupeSources,validateResearchNotes,MAX_QUERIES}=await import('../lib/research-validation.ts');
const {TAVILY_COST_PER_SEARCH}=await import('../lib/tavily.ts');

const source=(over={})=>({index:1,title:'Sumber A',url:'https://example.com/a',content:'Isi sumber A.',...over});
const sources=(...rows)=>rows;

test('constants: three queries per run max — the Tavily bill bound',()=>{
 assert.equal(MAX_QUERIES,3);
 assert.equal(TAVILY_COST_PER_SEARCH,1);
});

test('a good plan passes: queries returned in order with trimmed text',()=>{
 const out=validateResearchQueries({queries:[
  {query:'  transportasi Bandung 2010  ',reason:'latar'},
  {query:'cuaca Bandung Ramadan',reason:'atmosfer'},
 ]},'Adegan di Bandung tahun 2010');
 assert.deepEqual(out.map(q=>q.query),['transportasi Bandung 2010','cuaca Bandung Ramadan']);
 assert.deepEqual(out.map(q=>q.reason),['latar','atmosfer']);
});

test('more than three proposals are capped, not rejected',()=>{
 const flood=Array.from({length:7},(_,i)=>({query:`query nomor ${i}`,reason:'r'}));
 const out=validateResearchQueries({queries:flood},'topik');
 assert.equal(out.length,MAX_QUERIES);
});

test('a malformed plan body throws INVALID_RESEARCH_PLAN',()=>{
 assert.throws(()=>validateResearchQueries(null,'t'),/INVALID_RESEARCH_PLAN/);
 assert.throws(()=>validateResearchQueries({queries:'banyak'},'t'),/INVALID_RESEARCH_PLAN/);
});

test('a query that merely restates the topic, a blank one, or an overlong one is dropped; empty survives',()=>{
 const topic='Ramadan di Bandung 2010';
 const out=validateResearchQueries({queries:[
  {query:topic,reason:'sama dengan topik'},
  {query:'   ',reason:'kosong'},
  {query:'x'.repeat(201),reason:'kepanjangan'},
  {query:'jadwal imsak Bandung 2010',reason:'bagus'},
 ]},topic);
 assert.deepEqual(out.map(q=>q.query),['jadwal imsak Bandung 2010']);
 assert.deepEqual(validateResearchQueries({queries:[{query:topic,reason:'r'}]},topic),[]);
});

test('dedupeSources collapses the same URL across batches, first-seen order, numbered from 1',()=>{
 const batches=[
  [{title:'A',url:'https://e.com/1',content:'a',score:0.9},{title:'B',url:'https://e.com/2',content:'b',score:0.8}],
  [{title:'A (lagi)',url:'https://e.com/1',content:'a duplikat',score:0.7},{title:'C',url:'https://e.com/3',content:'c',score:0.6}],
 ];
 const out=dedupeSources(batches);
 assert.deepEqual(out.map(s=>s.index),[1,2,3]);
 assert.deepEqual(out.map(s=>s.title),['A','B','C']);
});

test('a source whose URL is not http/https never survives — javascript: and data: are dropped',()=>{
 const batches=[[
  {title:'Baik',url:'https://e.com/ok',content:'x',score:0.9},
  {title:'Jail',url:'javascript:alert(1)',content:'x',score:0.8},
  {title:'Data',url:'data:text/html,x',content:'x',score:0.7},
  {title:'Rusak',url:'not a url',content:'x',score:0.6},
 ]];
 const out=dedupeSources(batches);
 assert.deepEqual(out.map(s=>s.url),['https://e.com/ok']);
});

test('a note citing a real index keeps it; an unresolvable citation is stripped; a note left with none is dropped',()=>{
 const stats={notesProposed:0,notesKept:0,badShape:0,badText:0,noCitation:0,badUrl:0};
 const src=[source({index:1}),source({index:2,title:'Sumber B',url:'https://e.com/b'})];
 const out=validateResearchNotes({summary:'S.',notes:[
  {heading:'Baik',body:'Fakta dari sumber.',citations:[1]},
  {heading:'Campur',body:'Satu nyata satu tidak.',citations:[2,9]},
  {heading:'Jelek',body:'Semua sitasi palsu.',citations:[7]},
 ],unanswered:[]},src,stats);
 assert.deepEqual(out.notes.map(n=>n.heading),['Baik','Campur']);
 assert.deepEqual(out.notes[1].citations,[2]);
 assert.equal(stats.noCitation,1);
 assert.equal(stats.notesProposed,3);
 assert.equal(stats.notesKept,2);
});

test('malformed notes are dropped or capped and every bucket is counted',()=>{
 const stats={notesProposed:0,notesKept:0,badShape:0,badText:0,noCitation:0,badUrl:0};
 const src=[source()];
 const raw=Array.from({length:8},(_,i)=>({heading:`Note ${i}`,body:'Fakta.',citations:[1]}));
 const out=validateResearchNotes({summary:'S.',notes:raw,unanswered:[]},src,stats);
 assert.equal(out.notes.length,6);
 assert.equal(stats.notesProposed,8);
 assert.equal(stats.notesKept,6);
 const broken=validateResearchNotes({summary:'S.',notes:[
  {body:'tanpa heading',citations:[1]},
  {heading:'body kepanjangan',body:'x'.repeat(701),citations:[1]},
  {heading:'body kosong',body:'  ',citations:[1]},
 ],unanswered:[]},src,stats);
 assert.equal(broken.notes.length,0);
 assert.equal(stats.badShape,2);
 assert.equal(stats.badText,1);
});

test('unanswered is capped at five and non-strings are dropped',()=>{
 const src=[source()];
 const out=validateResearchNotes({summary:'S.',notes:[{heading:'H',body:'B.',citations:[1]}],unanswered:Array.from({length:8},(_,i)=>`butuh ${i}`)},src);
 assert.equal(out.unanswered.length,5);
});

test('an empty-by-design answer is valid and returns zero notes without throwing',()=>{
 const src=[source()];
 const out=validateResearchNotes({summary:'Sumber tidak memuat informasi yang relevan.',notes:[],unanswered:['iklim']},src);
 assert.equal(out.notes.length,0);
 assert.deepEqual(out.unanswered,['iklim']);
});

test('a malformed notes body throws INVALID_RESEARCH_NOTES',()=>{
 const src=[source()];
 assert.throws(()=>validateResearchNotes(null,src),/INVALID_RESEARCH_NOTES/);
 assert.throws(()=>validateResearchNotes({summary:'S',notes:'banyak'},src),/INVALID_RESEARCH_NOTES/);
});
