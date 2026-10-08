// Story Doctor output validation (Phase 6). Same fail-closed contract as the guardian/
// canon validators: structure, enums and caps are enforced in code, and every finding must
// cite at least one evidence id that resolves inside the doctor package (chapter, summary
// chunk, fact, event or knowledge row) — fabricated ids drop the finding silently, so
// "evidence-backed" stays true in the UI.
import type {DoctorPackage} from './doctor.ts';

export type DoctorKind='plot_hole'|'forgotten_character'|'timeline_conflict'|'knowledge_error'|'relationship_drift'|'world_rule_violation'|'pov_problem'|'unresolved_thread';
export type DoctorFinding={
 kind:DoctorKind;severity:'critical'|'high'|'medium'|'low';claim:string;explanation:string;
 evidence_ids:string[];chapter_id:string|null;
 resolvedEvidence:{id:string;label:string}[];
};
export type DoctorReport={
 engine:'ai'|'code';
 kind:DoctorKind;severity:DoctorFinding['severity'];claim:string;explanation:string;
 evidence_ids:string[];chapter_id:string|null;resolvedEvidence:DoctorFinding['resolvedEvidence'];
};

const KINDS=['plot_hole','forgotten_character','timeline_conflict','knowledge_error','relationship_drift','world_rule_violation','pov_problem','unresolved_thread'] as const;
const SEVERITIES=['critical','high','medium','low'] as const;
const text=(value:unknown,max:number):string|null=>typeof value==='string'&&value.trim()&&value.length<=max?value.trim():null;

// Human-readable evidence labels so the panel can show what supports a finding without a
// second query. Built from the same package the model saw — no new reads.
export function evidenceLabels(pack:DoctorPackage):Map<string,string>{
 const labels=new Map<string,string>();
 for(const chapter of pack.chapters)labels.set(chapter.id,`Bab: ${chapter.title}`);
 for(const summary of pack.summaries)labels.set(summary.chunk_id,`Ringkasan: ${summary.title} · bagian ${summary.chunk_index+1}`);
 for(const fact of pack.facts)labels.set(fact.id,`Fakta: ${fact.claim.slice(0,120)}`);
 for(const event of pack.events)labels.set(event.id,`Peristiwa: ${event.title} (${event.story_time})`);
 for(const knowledge of pack.knowledge)labels.set(knowledge.id,`Pengetahuan: ${knowledge.character_name} — ${knowledge.statement.slice(0,120)}`);
 return labels;
}

// Aggregate drop reasons — counts only, never finding text. Lets "0 temuan" be explained
// (clean manuscript vs every finding discarded for fabricated evidence) without persisting
// or logging any model prose.
export type DoctorDropStats={proposed:number;kept:number;badShape:number;badEnum:number;badText:number;noEvidence:number};

export function validateDoctorFindings(value:unknown,pack:DoctorPackage,stats?:DoctorDropStats):DoctorFinding[]{
 const x=value as {findings?:unknown}|null;
 if(!x||typeof x!=='object'||!Array.isArray(x.findings)||x.findings.length>12)throw Error('INVALID_DOCTOR');
 const labels=evidenceLabels(pack);
 if(stats){stats.proposed=x.findings.length;stats.kept=0;stats.badShape=0;stats.badEnum=0;stats.badText=0;stats.noEvidence=0;}
 const kept=x.findings.slice(0,8).flatMap(raw=>{
  const f=raw as Record<string,unknown>|null;
  if(!f||typeof f!=='object'){if(stats)stats.badShape++;return []}
  const kind=typeof f.kind==='string'&&(KINDS as readonly string[]).includes(f.kind)?f.kind as DoctorKind:null;
  const severity=typeof f.severity==='string'&&(SEVERITIES as readonly string[]).includes(f.severity)?f.severity as DoctorFinding['severity']:null;
  if(!kind||!severity){if(stats)stats.badEnum++;return []}
  const claim=text(f.claim,500);
  const explanation=text(f.explanation,800);
  if(!claim||!explanation){if(stats)stats.badText++;return []}
  const ids=Array.isArray(f.evidence_ids)?f.evidence_ids.filter((id):id is string=>typeof id==='string'&&labels.has(id)):[];
  // Anti-fabrication floor: no real evidence id, no finding.
  if(!ids.length){if(stats)stats.noEvidence++;return []}
  // chapter_id is a UI link, not evidence: an unresolvable one is nulled, the finding stays.
  const chapterId=text(f.chapter_id,100);
  const resolvedChapter=chapterId&&labels.has(chapterId)?chapterId:null;
  return [{kind,severity,claim,explanation,evidence_ids:ids,chapter_id:resolvedChapter,
   resolvedEvidence:ids.map(id=>({id,label:labels.get(id)!}))}];
 });
 if(stats)stats.kept=kept.length;
 return kept;
}
