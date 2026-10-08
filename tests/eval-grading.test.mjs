import test from 'node:test';
import assert from 'node:assert/strict';

const {gradeCase} = await import('../lib/eval-grading.ts');

const ask=(over={})=>({kind:'ask',status:'ANSWERED',citations:[{chapter_id:'c8',title:'Bab 8 — Helios Terbuka'}],answer:'Mira mengetahui di Bab 8.',...over});
const write=(over={})=>({kind:'write',findings:[],repairAttempts:0,unresolved:0,draft:'prosa',...over});
const finding=(type)=>({type,severity:'major',claim:'k',evidence_ids:['e1'],explanation:'x',repair_hint:'y'});

test('an errored observation scores null, never false',()=>{
  const r=gradeCase({status:'ANSWERED',chapters:['Bab 8 — Helios Terbuka']},{kind:'ask',status:'',citations:[],answer:'',error:'503'});
  assert.equal(r.ran,false);
  for(const v of Object.values(r.checks))assert.equal(v,null);
});

test('status_match compares the abstention class',()=>{
  const ok=gradeCase({status:'NOT_ESTABLISHED'},ask({status:'NOT_ESTABLISHED',citations:[]}));
  assert.equal(ok.checks.status_match,true);
  const miss=gradeCase({status:'NOT_ESTABLISHED'},ask());
  assert.equal(miss.checks.status_match,false);
});

test('citation_correct checks the chapter, not just presence',()=>{
  const ok=gradeCase({chapters:['Bab 8 — Helios Terbuka']},ask());
  assert.equal(ok.checks.citation_correct,true);
  const wrong=gradeCase({chapters:['Bab 3 — Nama di Kebisingan']},ask());
  assert.equal(wrong.checks.citation_correct,false);
});

test('evidence_recall needs at least one expected chapter cited',()=>{
  const ok=gradeCase({chapters:['Bab 8 — Helios Terbuka','Bab 3 — Nama di Kebisingan']},ask());
  assert.equal(ok.checks.evidence_recall,true);
  const miss=gradeCase({chapters:['Bab 5 — Kanal yang Mati']},ask());
  assert.equal(miss.checks.evidence_recall,false);
});

test('mustMention is checked against the answer text',()=>{
  const ok=gradeCase({mustMention:['Bab 8']},ask({answer:'tercatat pada Bab 8.'}));
  assert.equal(ok.checks.must_mention,true);
  const miss=gradeCase({mustMention:['2048-04-17']},ask({answer:'di bab delapan.'}));
  assert.equal(miss.checks.must_mention,false);
});

test('answer_must_not_contain fails when the over-claim appears',()=>{
  const ok=gradeCase({answerMustNotContain:['sudah tahu sejak awal']},ask({answer:'Mira belum tahu.'}));
  assert.equal(ok.checks.answer_must_not_contain,true);
  const miss=gradeCase({answerMustNotContain:['sudah tahu sejak awal']},ask({answer:'ia sudah tahu sejak awal cerita.'}));
  assert.equal(miss.checks.answer_must_not_contain,false);
});

test('issue_detected and issue_type_match require the planted type',()=>{
  const expected={issue_types:['knowledge_leak','alive_dead_conflict']};
  const both=gradeCase(expected,write({findings:[finding('knowledge_leak'),finding('alive_dead_conflict')]}));
  assert.equal(both.checks.issue_detected,true);
  assert.equal(both.checks.issue_type_match,true);
  const wrongType=gradeCase(expected,write({findings:[finding('behavior_inconsistency')]}));
  assert.equal(wrongType.checks.issue_detected,true);
  assert.equal(wrongType.checks.issue_type_match,false);
  const none=gradeCase(expected,write());
  assert.equal(none.checks.issue_detected,false);
});

test('false_positive_avoided fails when a forbidden type appears',()=>{
  const expected={forbidden_issue_types:['alive_dead_conflict']};
  const ok=gradeCase(expected,write({findings:[finding('knowledge_leak')]}));
  assert.equal(ok.checks.false_positive_avoided,true);
  const miss=gradeCase(expected,write({findings:[finding('alive_dead_conflict')]}));
  assert.equal(miss.checks.false_positive_avoided,false);
});

test('continuity_pass and repair_bounded for generation-repair cases',()=>{
  const expected={issue_types:['knowledge_leak'],max_repair_attempts:2};
  const fixed=gradeCase(expected,write({findings:[],repairAttempts:1,unresolved:0}));
  assert.equal(fixed.checks.continuity_pass,true);
  assert.equal(fixed.checks.repair_bounded,true);
  const unbounded=gradeCase(expected,write({findings:[],repairAttempts:3,unresolved:0}));
  assert.equal(unbounded.checks.repair_bounded,false);
});

test('a case with no expected keys reports no checks',()=>{
  const r=gradeCase({},ask());
  assert.equal(r.ran,true);
  assert.equal(r.applicable,0);
  assert.deepEqual(r.checks,{});
});

test('baseline and pipeline observations are graded by the identical rubric shape',()=>{
  const expected={issue_types:['knowledge_leak'],max_repair_attempts:2};
  const pipeline=gradeCase(expected,write({findings:[finding('knowledge_leak')],repairAttempts:0,unresolved:1}));
  const baseline=gradeCase(expected,write({findings:[],repairAttempts:0,unresolved:0}));
  assert.deepEqual(Object.keys(pipeline.checks),Object.keys(baseline.checks));
  // identical detector, different verdicts
  assert.equal(pipeline.checks.issue_type_match,true);
  assert.equal(baseline.checks.issue_type_match,false);
});
