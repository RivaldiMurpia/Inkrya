// Agentic Writing output validation (Phase 4). Code enforces structure, enums, caps and
// evidence existence; semantic restraint (flashback / unknown knowledge / belief) lives in
// GUARDIAN_SYSTEM and the demo checks. parseModelJSON is reused from memory-validation.
import {parseModelJSON} from './memory-validation.ts';
import type {StoryContext} from './story-context.ts';

export type ChapterPlan={
 goal:string;
 characters:string[];
 requiredEvents:string[];
 activePlotThreads:string[];
 constraints:string[];
 scenePlan:string[];
 continuityRisks:string[];
 suggestedStoryTime:string|null;
};
export type GuardianIssue={
 type:'canon_contradiction'|'timeline_contradiction'|'knowledge_leak'|'location_impossible'|'alive_dead_conflict'|'relationship_inconsistency'|'world_rule_violation'|'behavior_inconsistency';
 severity:'critical'|'high'|'medium'|'low';
 claim:string;
 evidence_ids:string[];
 explanation:string;
 repair_hint:string;
};
export type CriticReport={strengths:string[];improvements:string[]};
// Phase 5 — a proposed canon item. `quote` must be a verbatim substring of the DRAFT
// (new-info grounding); `evidence_ids` must resolve to real context ids (anti-fabrication).
export type CanonProposal={
 target_kind:'fact'|'event'|'knowledge';
 claim:string;
 quote:string;
 evidence_ids:string[];
 subject:string|null;
 predicate:string|null;
 object:string|null;
 confidence:number|null;
 story_time:string|null;
 title:string|null;
 description:string|null;
 event_type:string|null;
 character:string|null;
 fact_key:string|null;
 knows:boolean|null;
};
export {parseModelJSON};

const PLAN_KEYS=['goal','characters','requiredEvents','activePlotThreads','constraints','scenePlan','continuityRisks','suggestedStoryTime'] as const;
const ISSUE_TYPES=['canon_contradiction','timeline_contradiction','knowledge_leak','location_impossible','alive_dead_conflict','relationship_inconsistency','world_rule_violation','behavior_inconsistency'] as const;
const SEVERITIES=['critical','high','medium','low'] as const;
const EVENT_TYPES=['event','birth','death','discovery','meeting','conflict','reveal','other'] as const;
const stringList=(value:unknown,label:string,maxItems:number,maxLength:number):string[]=>{
 if(!Array.isArray(value))throw Error(`INVALID_${label}`);
 return value.slice(0,maxItems).filter(item=>typeof item==='string'&&item.trim().length>0&&item.length<=maxLength).map(item=>(item as string).trim());
};

 // Exact key set — an extra key (e.g. invented scores) fails closed (INVALID_PLAN).
 // suggestedStoryTime is required but may be null when no evidence supports a date.
export function validatePlan(value:unknown,context:Pick<StoryContext,'characters'>):ChapterPlan{
 const x=value as Record<string,unknown>|null;
 if(!x||typeof x!=='object')throw Error('INVALID_PLAN');
 for(const key of PLAN_KEYS)if(!(key in x))throw Error('INVALID_PLAN');
 for(const key of Object.keys(x))if(!(PLAN_KEYS as readonly string[]).includes(key))throw Error('INVALID_PLAN');
 if(typeof x.goal!=='string'||!x.goal.trim()||x.goal.length>600)throw Error('INVALID_PLAN');
 const names=new Set(context.characters.flatMap(c=>[c.name,...c.aliases]).map(n=>n.toLocaleLowerCase()));
 const proposed=stringList(x.characters,'PLAN',8,300);
 // Cast grounding is best-effort: filter to configured characters when the project has any.
 // A project without a character list (or one whose cast is not yet configured) must not
 // block planning — the Guardian, not the plan validator, is the semantic check.
 const cast=names.size?proposed.filter(name=>names.has(name.toLocaleLowerCase())):proposed;
 if(names.size&&!cast.length)throw Error('INVALID_PLAN');
 const suggested=typeof x.suggestedStoryTime==='string'&&x.suggestedStoryTime.trim()&&x.suggestedStoryTime.length<=100?x.suggestedStoryTime.trim():null;
 return {
  goal:x.goal.trim(),
  characters:cast,
  requiredEvents:stringList(x.requiredEvents,'PLAN',8,300),
  activePlotThreads:stringList(x.activePlotThreads,'PLAN',8,300),
  constraints:stringList(x.constraints,'PLAN',8,300),
  scenePlan:stringList(x.scenePlan,'PLAN',8,300),
  continuityRisks:stringList(x.continuityRisks,'PLAN',8,300),
  suggestedStoryTime:suggested,
 };
}

// Guardian anti-fabrication floor: every issue must reference at least one real evidence id
// from the context package; fabricated ids drop the issue silently. Fake ids can never
// reach the UI, so "source evidence is inspectable" stays true.
export function validateGuardianIssues(value:unknown,context:StoryContext):GuardianIssue[]{
 const x=value as {issues?:unknown}|null;
 if(!x||typeof x!=='object'||!Array.isArray(x.issues)||x.issues.length>8)throw Error('INVALID_GUARDIAN');
 const validIds=new Set<string>([
  ...context.evidence.map(e=>e.id),...context.canon.map(f=>f.id),
  ...context.timeline.map(e=>e.id),...context.knowledge.map(k=>k.id),
 ]);
 return x.issues.slice(0,5).flatMap(raw=>{
  const i=raw as Record<string,unknown>|null;
  if(!i||typeof i!=='object')return [];
  if(typeof i.type!=='string'||!(ISSUE_TYPES as readonly string[]).includes(i.type))return [];
  if(typeof i.severity!=='string'||!(SEVERITIES as readonly string[]).includes(i.severity))return [];
  if(typeof i.claim!=='string'||!i.claim.trim()||i.claim.length>500)return [];
  if(typeof i.explanation!=='string'||!i.explanation.trim()||i.explanation.length>800)return [];
  if(typeof i.repair_hint!=='string'||i.repair_hint.length>500)return [];
  const ids=Array.isArray(i.evidence_ids)?i.evidence_ids.filter(id=>typeof id==='string'&&validIds.has(id)):[];
  if(!ids.length)return [];
  return [{type:i.type as GuardianIssue['type'],severity:i.severity as GuardianIssue['severity'],claim:i.claim.trim(),evidence_ids:ids,explanation:i.explanation.trim(),repair_hint:i.repair_hint.trim()}];
 });
}

// Exact key set — any score/rating/total key fails closed (INVALID_CRITIC).
export function validateCritic(value:unknown):CriticReport{
 const x=value as Record<string,unknown>|null;
 if(!x||typeof x!=='object')throw Error('INVALID_CRITIC');
 for(const key of Object.keys(x))if(key!=='strengths'&&key!=='improvements')throw Error('INVALID_CRITIC');
 if(!Array.isArray(x.strengths)||!Array.isArray(x.improvements))throw Error('INVALID_CRITIC');
 return {strengths:stringList(x.strengths,'CRITIC',4,500),improvements:stringList(x.improvements,'CRITIC',4,500)};
}

const text=(value:unknown,max:number):string|null=>typeof value==='string'&&value.trim()&&value.length<=max?value.trim():null;
const QUOTE_MIN=20;
// A short quote can be a fragment of an unrelated word ("ndela" inside "jendela") and every
// downstream strpos re-check would pass too, so the floor plus a word-boundary test keeps
// mid-word fragments from being accepted as verbatim evidence. Anchoring needs the full
// draft text because a quote at position 0 has no preceding character.
const quoteIsGrounded=(draft:string,quote:string):boolean=>{
 if(quote.length<QUOTE_MIN||!draft.includes(quote))return false;
 const at=draft.indexOf(quote);
 const before=at>0?draft[at-1]:'';
 const after=draft[at+quote.length]??'';
 const word=/[\p{L}\p{N}]/u;
 return !word.test(before)&&!word.test(after);
};
// Canon Diff (Phase 5). Fail-closed per item: an item whose quote is not verbatim in the
// draft, whose evidence ids are not real, or whose kind-specific requirements are missing
// is DROPPED silently — a proposal never reaches the author carrying fabricated support.
// An empty diff is valid: most continuations introduce nothing persistent.
export function validateCanonProposals(value:unknown,draft:string,context:StoryContext):CanonProposal[]{
 const x=value as {proposals?:unknown}|null;
 if(!x||typeof x!=='object'||!Array.isArray(x.proposals)||x.proposals.length>8)throw Error('INVALID_CANON');
 const validIds=new Set<string>([
  ...context.evidence.map(e=>e.id),...context.canon.map(f=>f.id),
  ...context.timeline.map(e=>e.id),...context.knowledge.map(k=>k.id),
 ]);
 const names=new Set(context.characters.map(c=>c.name.toLocaleLowerCase()));
 return x.proposals.slice(0,5).flatMap(raw=>{
  const p=raw as Record<string,unknown>|null;
  if(!p||typeof p!=='object')return [];
  const kind=typeof p.target_kind==='string'&&['fact','event','knowledge'].includes(p.target_kind)?p.target_kind as CanonProposal['target_kind']:null;
  if(!kind)return [];
  const claim=text(p.claim,500);
  // 320 cap: above the chunker's 319-char overlap a verbatim quote can straddle a split and
  // match no single story_chunk, so acceptance would fail forever (QUOTE_NOT_IN_CHAPTER).
  const quote=text(p.quote,320);
  if(!claim||!quote||!quoteIsGrounded(draft,quote))return [];
  const ids=Array.isArray(p.evidence_ids)?p.evidence_ids.filter((id):id is string=>typeof id==='string'&&validIds.has(id)):[];
  if(!ids.length)return [];
  const out:CanonProposal={
   target_kind:kind,claim,quote,evidence_ids:ids,
   subject:text(p.subject,500),predicate:text(p.predicate,200),object:text(p.object,500),
   confidence:typeof p.confidence==='number'&&p.confidence>=0&&p.confidence<=1?p.confidence:null,
   story_time:text(p.story_time,100),title:null,description:null,event_type:null,
   character:null,fact_key:null,knows:null,
  };
  if(kind==='fact')return [out];
  if(kind==='event'){
   // An event without a story time would invent a date; drop it rather than guess.
   const eventType=typeof p.event_type==='string'&&(EVENT_TYPES as readonly string[]).includes(p.event_type)?p.event_type:null;
   if(!out.story_time||!eventType)return [];
   return [{...out,title:text(p.title,300)??claim,description:text(p.description,1000),event_type:eventType}];
  }
  // Knowledge must name a character that exists in this project's cast. story_time is
  // optional here (learned_at_story_time is nullable) — an unknown learning time is not
  // a reason to invent one.
  const character=text(p.character,200);
  if(!character||(names.size&&!names.has(character.toLocaleLowerCase())))return [];
  return [{...out,character,fact_key:text(p.fact_key,200),knows:typeof p.knows==='boolean'?p.knows:true}];
 });
}
