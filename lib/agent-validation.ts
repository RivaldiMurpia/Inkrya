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
export {parseModelJSON};

const PLAN_KEYS=['goal','characters','requiredEvents','activePlotThreads','constraints','scenePlan','continuityRisks'] as const;
const PLAN_KEY_SET=new Set<string>([...PLAN_KEYS,'suggestedStoryTime']);
const ISSUE_TYPES=['canon_contradiction','timeline_contradiction','knowledge_leak','location_impossible','alive_dead_conflict','relationship_inconsistency','world_rule_violation','behavior_inconsistency'] as const;
const SEVERITIES=['critical','high','medium','low'] as const;
const stringList=(value:unknown,label:string,maxItems:number,maxLength:number):string[]=>{
 if(!Array.isArray(value))throw Error(`INVALID_${label}`);
 return value.slice(0,maxItems).filter(item=>typeof item==='string'&&item.trim().length>0&&item.length<=maxLength).map(item=>(item as string).trim());
};

 // Exact key set — an extra key (e.g. invented scores) fails closed (INVALID_PLAN).
 // suggestedStoryTime is optional (models omit it when no evidence supports a date).
export function validatePlan(value:unknown,context:Pick<StoryContext,'characters'>):ChapterPlan{
 const x=value as Record<string,unknown>|null;
 if(!x||typeof x!=='object')throw Error('INVALID_PLAN');
 for(const key of PLAN_KEYS)if(!(key in x))throw Error('INVALID_PLAN');
 for(const key of Object.keys(x))if(!PLAN_KEY_SET.has(key))throw Error('INVALID_PLAN');
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
