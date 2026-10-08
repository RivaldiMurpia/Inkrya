// Research output validation (Phase 7). Fail-closed per item, doctor-validator style:
// validate every item first while filling drop counters, then apply the caps. Citations
// must resolve to real source indices and source URLs must be http/https — a model-invented
// or script-scheme URL never reaches the UI. Canon isolation is structural: nothing here
// produces canon-shaped rows; research output lives only in ai_generations.result.
import {parseModelJSON} from './memory-validation.ts';
import type {TavilyResult} from './tavily.ts';

export const MAX_QUERIES=3;
const QUERY_MAX_LENGTH=200;
const URL_MAX_LENGTH=500;
const MAX_NOTES=6;
const HEADING_MAX=100;
const BODY_MAX=700;
const MAX_UNANSWERED=5;

export type ResearchQuery={query:string;reason:string};
export type ResearchSource={index:number;title:string;url:string;content:string};
export type ResearchNote={heading:string;body:string;citations:number[]};
export type ResearchNotes={summary:string;notes:ResearchNote[];unanswered:string[]};
export type ResearchDropStats={notesProposed:number;notesKept:number;badShape:number;badText:number;noCitation:number;badUrl:number};

const clean=(value:unknown,max:number):string|null=>typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;

const usableUrl=(url:string):boolean=>{
 try{const parsed=new URL(url);return (parsed.protocol==='http:'||parsed.protocol==='https:')&&url.length<=URL_MAX_LENGTH}catch{return false}
};

export function validateResearchQueries(value:unknown,topic:string,maxQueries:number=MAX_QUERIES):ResearchQuery[]{
 const x=value as {queries?:unknown}|null;
 if(!x||typeof x!=='object'||!Array.isArray(x.queries))throw Error('INVALID_RESEARCH_PLAN');
 const lowerTopic=topic.trim().toLocaleLowerCase();
 // Filter FIRST, cap last: a malformed entry must not consume one of the three query
 // slots (the same defect class the Phase 6 validator was fixed for).
 const valid=x.queries.flatMap((raw:unknown)=>{
  const q=raw as Record<string,unknown>|null;
  if(!q||typeof q!=='object')return [];
  const query=typeof q.query==='string'?q.query.trim():'';
  const reason=clean(q.reason,300)??'';
  if(!query||query.length>QUERY_MAX_LENGTH)return [];
  if(query.toLocaleLowerCase()===lowerTopic)return [];
  return [{query,reason}];
 });
 return valid.slice(0,maxQueries);
}

export function dedupeSources(batches:TavilyResult[][]):ResearchSource[]{
 const out:ResearchSource[]=[];
 const seen=new Set<string>();
 for(const batch of batches)for(const result of batch){
  if(!usableUrl(result.url)||seen.has(result.url))continue;
  seen.add(result.url);
  out.push({index:out.length+1,title:result.title,url:result.url,content:result.content});
 }
 return out;
}

// Notes are dropped per item, never partially repaired: a note without any resolvable
// citation cannot render its evidence, so it is dropped with a counter, and a note that
// cites an unknown index keeps only its real citations.
export function validateResearchNotes(value:unknown,sources:ResearchSource[],stats?:ResearchDropStats):ResearchNotes{
 const drop:ResearchDropStats=stats??{notesProposed:0,notesKept:0,badShape:0,badText:0,noCitation:0,badUrl:0};
 const x=value as {summary?:unknown;notes?:unknown;unanswered?:unknown}|null;
 if(!x||typeof x!=='object'||!Array.isArray(x.notes))throw Error('INVALID_RESEARCH_NOTES');
 const indices=new Set(sources.map(s=>s.index));
 // proposed counts everything the model emitted; the cap applies to kept notes only.
 drop.notesProposed+=x.notes.length;
 const notes=x.notes.slice(0,MAX_NOTES).flatMap((raw:unknown)=>{
  const n=raw as Record<string,unknown>|null;
  if(!n||typeof n!=='object')return (drop.badShape++,[]);
  // A missing/blank field is a shape defect; a present-but-overlong one is a text defect.
  const headingRaw=typeof n.heading==='string'?n.heading:'';
  const bodyRaw=typeof n.body==='string'?n.body:'';
  if(!headingRaw.trim()||!bodyRaw.trim())return (drop.badShape++,[]);
  const heading=headingRaw.trim(),body=bodyRaw.trim();
  if(heading.length>HEADING_MAX||body.length>BODY_MAX)return (drop.badText++,[]);
  if(!Array.isArray(n.citations))return (drop.noCitation++,[]);
  const citations=[...new Set(n.citations)].filter(c=>typeof c==='number'&&Number.isInteger(c)&&indices.has(c));
  if(!citations.length)return (drop.noCitation++,[]);
  drop.notesKept++;
  return [{heading,body,citations}];
 });
 return {
  summary:typeof x.summary==='string'?x.summary.slice(0,1000):'',
  notes,
  unanswered:Array.isArray(x.unanswered)?x.unanswered.filter((u):u is string=>typeof u==='string'&&u.trim().length>0).slice(0,MAX_UNANSWERED).map(u=>u.trim()):[],
 };
}
