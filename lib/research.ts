// SERVER ONLY — Tavily research pipeline (Phase 7). Bounded and opt-in: one run plans at
// most three queries, searches each with pinned basic depth, and summarizes only the real
// sources it received. Credits are recorded as they are spent, so a mid-run failure still
// meters what was used. Nothing here touches story canon — the notes live in the caller's
// ai_generations.result and nowhere else.
import {randomUUID} from 'node:crypto';
import {searchTavily,TAVILY_COST_PER_SEARCH,MAX_RESULTS_PER_QUERY,type TavilyResult} from './tavily.ts';
import {RESEARCH_QUERY_SYSTEM,RESEARCH_NOTES_SYSTEM} from './agent-prompts.ts';
import {validateResearchQueries,dedupeSources,validateResearchNotes,MAX_QUERIES,type ResearchQuery,type ResearchSource,type ResearchNotes,type ResearchDropStats} from './research-validation.ts';
import {traceToolRun} from './langsmith/tracing.ts';
import {generateKryaText} from './ai/generate.ts';
import {parseModelJSON} from './memory-validation.ts';
import type {ResearchConfig} from './research-budget.ts';

export type ResearchStep={stage:'plan'|'search'|'notes';detail:string;queryCount?:number;sourceCount?:number};
export type ResearchResult={
 topic:string;queries:ResearchQuery[];sources:ResearchSource[];notes:ResearchNotes;
 dropStats:ResearchDropStats;credits:number;steps:ResearchStep[];
 tokenUsage:{inputTokens:number;outputTokens:number};warning:string|null;
};
export type ResearchCallFn=(system:string,prompt:string,maxOutputTokens:number)=>Promise<{text:string;usage:{inputTokens?:number;outputTokens?:number}}>;

const NO_SOURCES_WARNING='Tidak ada sumber web yang ditemukan untuk topik ini. Coba kata kunci lain.';

export async function runResearch(input:{
 topic:string;prepared:unknown;config:ResearchConfig;generationId:string;projectId:string;userId:string;
 recordCredits:(credits:number)=>Promise<void>;search?:typeof searchTavily;call?:ResearchCallFn;signal?:AbortSignal;
}):Promise<ResearchResult>{
 const steps:ResearchStep[]=[];
 const emit=(step:ResearchStep)=>steps.push(step);
 const totals={inputTokens:0,outputTokens:0};
 // The seam mirrors the write graph: tests inject `call`; production wraps generateKryaText.
 const baseCall:ResearchCallFn=input.call??(async(system,prompt,maxOutputTokens)=>{
  const result=await generateKryaText(
   input.prepared as Parameters<typeof generateKryaText>[0],
   {system,prompt,maxOutputTokens,timeoutMs:maxOutputTokens>1000?35000:25000,signal:input.signal},
   // A per-call trace UUID: reusing the run id would make the second createRun a duplicate
   // that LangSmith rejects, silently losing the notes call's trace (agent-graph does the same).
   {generationId:randomUUID(),projectId:input.projectId,userId:input.userId,sourceCount:0,workflow:'research-agent'},
  );
  return {text:result.text,usage:{inputTokens:result.usage?.inputTokens,outputTokens:result.usage?.outputTokens}};
 });
 const call:ResearchCallFn=async(system,prompt,maxOutputTokens)=>{
  const result=await baseCall(system,prompt,maxOutputTokens);
  totals.inputTokens+=result.usage?.inputTokens??0;
  totals.outputTokens+=result.usage?.outputTokens??0;
  return result;
 };
 const search=input.search??searchTavily;

 // Stage 1: plan. Validated before any network spend; a malformed plan aborts with the
 // run's slot already consumed (insert-first, same convention as every other action).
 emit({stage:'plan',detail:'Menyusun rencana pencarian'});
 const planText=await call(RESEARCH_QUERY_SYSTEM,JSON.stringify({topik_penulis:input.topic,pengingat:'Susun maksimal 3 query pencarian web untuk fakta dunia nyata yang relevan; jangan memasukkan cerita fiksi penulis.'}),700);
 const queries=validateResearchQueries(parseModelJSON(planText.text),input.topic);
 emit({stage:'plan',detail:queries.length?`Rencana pencarian siap · ${queries.length} query`:'Tidak ada query yang diperlukan',queryCount:queries.length});

 // Stage 2: search. Sequential, bounded, and each successful search is metered immediately
 // so a later failure cannot hide what was already spent.
 const batches:TavilyResult[][]=[];
 let credits=0;
 for(const query of queries.slice(0,MAX_QUERIES)){
  const results=await search(query.query,{apiKey:input.config.apiKey,maxResults:MAX_RESULTS_PER_QUERY,signal:input.signal});
  await input.recordCredits(TAVILY_COST_PER_SEARCH);
  credits+=TAVILY_COST_PER_SEARCH;
  batches.push(results);
 }
 const sources=dedupeSources(batches);
 emit({stage:'search',detail:`Pencarian web selesai · ${queries.length} query · ${sources.length} sumber · ${credits} kredit Tavily`,queryCount:queries.length,sourceCount:sources.length});
 await traceToolRun({generationId:input.generationId,projectId:input.projectId,tool:'tavily-search',queryCount:queries.length,sourceCount:sources.length,credits});

 const emptyNotes:ResearchNotes={summary:'',notes:[],unanswered:[]};
 const emptyStats:ResearchDropStats={notesProposed:0,notesKept:0,badShape:0,badText:0,noCitation:0,badUrl:0};
 if(!sources.length)return {topic:input.topic,queries,sources,notes:emptyNotes,dropStats:emptyStats,credits,steps,tokenUsage:totals,warning:NO_SOURCES_WARNING};

 // Stage 3: notes. The model sees only the sources we actually retrieved; its citations are
 // resolved against them, and an unresolvable citation is dropped with a counter.
 emit({stage:'notes',detail:'Menyusun catatan riset bersitasi'});
 const notesPrompt=JSON.stringify({
  topik_penulis:input.topic,
  sumber:sources.map(s=>({indeks:s.index,judul:s.title,url:s.url,ringkasan:s.content})),
  pengingat:'Setiap note WAJIB mengutip indeks sumber yang benar-benar ada di daftar ini; catatan tanpa sitasi yang cocok akan dibuang.',
 });
 const notesText=await call(RESEARCH_NOTES_SYSTEM,notesPrompt,1800);
 const dropStats:ResearchDropStats={notesProposed:0,notesKept:0,badShape:0,badText:0,noCitation:0,badUrl:0};
 const notes=validateResearchNotes(parseModelJSON(notesText.text),sources,dropStats);
 emit({stage:'notes',detail:notes.notes.length?`Catatan riset siap · ${notes.notes.length} catatan`:'Tidak ada catatan yang dapat divalidasi'});
 return {topic:input.topic,queries,sources,notes,dropStats,credits,steps,tokenUsage:totals,warning:null};
}
