// SERVER-AGNOSTIC — deterministic evaluation grader (Phase 8). No LLM judge: every rubric
// key is a pure function of the observation the runner recorded. `ran:false` with all-null
// checks means the case never measured anything (an HTTP error, a timeout); it must never
// be conflated with `false`, which means the pipeline actually failed the check.
import type {GuardianIssue} from './agent-validation.ts';

export type AskObservation={kind:'ask';status:string;citations:{chapter_id:string;title:string}[];answer:string;error?:string};
// repairAttempts is null for an arm that has NO repair loop (the baseline): the key then
// scores null rather than a trivially-true pass, because a budget check that cannot fail
// measures nothing. The baseline's unresolved count IS real (the guardian flagged its draft
// and nothing repaired it), so continuity_pass still reflects the baseline honestly.
export type WriteObservation={kind:'write';findings:GuardianIssue[];repairAttempts:number|null;unresolved:number;draft:string;error?:string};
export type Observation=AskObservation|WriteObservation;
export type Rubric={ran:boolean;checks:Record<string,boolean|null>;passed:number;applicable:number};

type Expected={
 status?:string;chapters?:string[];mustMention?:string[];answerMustNotContain?:string[];
 issue_types?:string[];forbidden_issue_types?:string[];max_repair_attempts?:number;
};

// Chapter names are matched by title substring: the dataset names chapters by their seeded
// title and the API returns ids + titles; id-set equality would make the dataset brittle.
const chapterMatched=(citations:{chapter_id:string;title:string}[],wanted:string):boolean=>
 citations.some(c=>c.title.includes(wanted)||wanted.includes(c.title));

export function gradeCase(expected:Expected,observation:Observation):Rubric{
 const graded=buildChecks(expected,observation);
 // An errored observation still reports WHICH checks the case would have applied — with
 // every value null, so a reader can see the case ran zero measurements, not a failure.
 const checks=observation.error?Object.fromEntries(Object.keys(graded).map(k=>[k,null])):graded;
 const values=Object.values(checks).filter((v):v is boolean=>v!==null);
 return {ran:!observation.error,checks,passed:values.filter(Boolean).length,applicable:values.length};
}

function buildChecks(expected:Expected,observation:Observation):Record<string,boolean|null>{
 const checks:Record<string,boolean|null>={};
 const isWrite=observation.kind==='write';
 const findings=isWrite?observation.findings:[];
 const status=isWrite?'':observation.status;
 const citations=isWrite?[]:observation.citations;
 const answer=isWrite?'':observation.answer;
 if(expected.status!==undefined)checks.status_match=status===expected.status;
 if(expected.chapters?.length){
  // Two independent rubric keys: recall (≥1 expected chapter cited) and correctness (the
  // FIRST expected chapter is cited — a wrong-chapter citation must not pass on recall).
  checks.evidence_recall=expected.chapters.some(ch=>chapterMatched(citations,ch));
  checks.citation_correct=chapterMatched(citations,expected.chapters[0]);
 }
 if(expected.mustMention?.length)checks.must_mention=expected.mustMention.every(m=>answer.includes(m));
 if(expected.answerMustNotContain?.length){
  // Cross-kind guard: this key checks the ask ANSWER text; a write observation has none, so
  // the key cannot apply and scores null instead of a trivially-true pass.
  checks.answer_must_not_contain=isWrite?null:!expected.answerMustNotContain.some(m=>answer.includes(m));
 }
 if(expected.issue_types?.length){
  const types:string[]=findings.map(f=>f.type);
  // Cross-kind guard, same rule: an ask observation has no guardian, so issue keys are null.
  checks.issue_detected=isWrite?types.length>0:null;
  // At least one planted type must be reported; flagging for unrelated reasons does not pass.
  checks.issue_type_match=isWrite?expected.issue_types.some(t=>types.includes(t)):null;
 }
 if(expected.forbidden_issue_types?.length){
  // Cross-kind guard: a false-positive expectation against an ask observation (which has no
  // guardian) would otherwise fail open — trivially true forever, corrupting the count while
  // looking like earned restraint. A check that CANNOT apply to this kind scores null.
  const types:string[]=findings.map(f=>f.type);
  checks.false_positive_avoided=isWrite?!expected.forbidden_issue_types.some(t=>types.includes(t)):null;
 }
 if(expected.max_repair_attempts!==undefined){
  // repairAttempts null = the arm has no repair loop, so a budget pass would be unearned;
  // report null (excluded from applicable) rather than true-by-construction.
  const repairAttempts=isWrite?observation.repairAttempts:null;
  const unresolved=isWrite?observation.unresolved:null;
  checks.repair_bounded=repairAttempts===null?null:repairAttempts<=expected.max_repair_attempts;
  checks.continuity_pass=unresolved===0;
 }
 return checks;
}
