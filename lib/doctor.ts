// SERVER ONLY — Story Doctor (Phase 6). Builds a whole-manuscript state package from the
// revision-safe memory tables, runs deterministic (no-AI) checks over it, and resolves AI
// findings' evidence ids to human-readable labels. No health scores anywhere: the report
// carries issue counts and measured coverage only (HACKATHON_IMPLEMENTATION.md:72).
import {createHash} from 'node:crypto';
import type {StoryDatabase} from './story-context.ts';

export type DoctorChapter={id:string;title:string;position:number;story_time:string|null;ready:boolean;summarized:boolean;seenCharacters:string[]};
// Per-chunk AI summary of a CURRENT chunk. This is the AI engine's prose basis — without it
// the model can only see titles and canon rows and has nothing narrative to cite.
export type DoctorSummary={chunk_id:string;chapter_id:string;title:string;chunk_index:number;summary:string};
export type DoctorPackage={
 chapters:DoctorChapter[];
 summaries:DoctorSummary[];
 facts:{id:string;claim:string}[];
 events:{id:string;title:string;story_time:string}[];
 knowledge:{id:string;character_name:string;statement:string}[];
 characters:{name:string;aliases:string[];role:string}[];
 worldRules:string|null;
};
export type CodeFinding={
 kind:'forgotten_character';severity:'low';claim:string;explanation:string;
 evidence_ids:string[];chapter_id:string|null;
};
export type Coverage={
 chaptersTotal:number;chaptersReady:number;chaptersSummarized:number;chaptersWithStoryTime:number;
 canonFacts:number;canonEvents:number;canonKnowledge:number;charactersTracked:number;
 worldRulesProvided:boolean;skipped:string[];
};

// Chapters in reading order with index status. `ready` mirrors the retrieval gates (current
// revision + hash + memory job ready); `summarized` marks an AI chunk summary existing for
// any current chunk of the chapter. Reading the project's rows directly is fine: the run is
// owner-RLS-scoped and the corpus stays demo-sized (≤10 chapters).
export async function buildDoctorPackage(db:StoryDatabase,projectId:string):Promise<DoctorPackage>{
 const [chaptersResult,charsResult,bibleResult]=await Promise.all([
  db.from('chapters').select('id,title,position,story_time,plain_text').eq('project_id',projectId).order('position'),
  db.from('characters').select('id,name,aliases,role').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).limit(100),
  db.from('story_bibles').select('world_rules').eq('project_id',projectId).maybeSingle(),
 ]);
 if(chaptersResult.error||charsResult.error||bibleResult.error)throw Error('CONTEXT_READ_FAILED');
 const chapters=(chaptersResult.data??[]) as {id:string;title:string;position:number;story_time:string|null;plain_text:string}[];

 // Retrieval-safe + analyzed flags per chapter, exactly the gates the QA path trusts:
 // ready = chunks exist for the CURRENT revision+hash AND the memory job is ready.
 const [readyResult,jobResult]=await Promise.all([
  db.from('story_chunks').select('chapter_id,source_revision,source_hash').eq('project_id',projectId),
  db.from('memory_jobs').select('chapter_id,status').eq('project_id',projectId),
 ]);
 if(readyResult.error||jobResult.error)throw Error('CONTEXT_READ_FAILED');
 const readyJobs=new Set((jobResult.data??[]).filter((j:{status:string})=>j.status==='ready').map((j:{chapter_id:string})=>j.chapter_id));
 const {data:chapterHashes,error:chapterHashError}=await db.from('chapters').select('id,revision_number,plain_text').eq('project_id',projectId);
 if(chapterHashError)throw Error('CONTEXT_READ_FAILED');
 const hashOf=new Map((chapterHashes??[]).map((c:{id:string;revision_number:number;plain_text:string})=>[c.id,{rev:c.revision_number,hash:createHash('md5').update(c.plain_text).digest('hex')}]));
 const currentChunks=(readyResult.data??[]).filter((s:{chapter_id:string;source_revision:number;source_hash:string})=>{
  const meta=hashOf.get(s.chapter_id);return !!meta&&meta.rev===s.source_revision&&meta.hash===s.source_hash;
 });
 const readyIds=new Set(currentChunks.map((s:{chapter_id:string})=>s.chapter_id).filter(id=>readyJobs.has(id)));

 // AI summaries joined to their CURRENT chunks only — stale summaries never reach the model.
 const insResult=await db.from('memory_insights').select('chunk_id,summary').eq('project_id',projectId);
 if(insResult.error)throw Error('CONTEXT_READ_FAILED');
 const {data:chunkRows,error:chunkRowError}=await db.from('story_chunks').select('id,chapter_id,source_revision,source_hash,chunk_index').eq('project_id',projectId);
 if(chunkRowError)throw Error('CONTEXT_READ_FAILED');
 const currentChunkRows=(chunkRows??[]).filter((s:{chapter_id:string;source_revision:number;source_hash:string})=>{
  const meta=hashOf.get(s.chapter_id);return !!meta&&meta.rev===s.source_revision&&meta.hash===s.source_hash;
 });
 const chunkMeta=new Map(currentChunkRows.map((s:{id:string;chapter_id:string;chunk_index:number})=>[s.id,{chapter_id:s.chapter_id,chunk_index:s.chunk_index}]));
 const chapterTitle=new Map(chapters.map(c=>[c.id,c.title]));
 const summaries:DoctorSummary[]=(insResult.data??[]).flatMap((i:{chunk_id:string;summary:string})=>{
  const meta=chunkMeta.get(i.chunk_id);
  if(!meta)return [];
  return [{chunk_id:i.chunk_id,chapter_id:meta.chapter_id,title:chapterTitle.get(meta.chapter_id)??'',chunk_index:meta.chunk_index,summary:i.summary}];
 });
 // Canonical canon rows only (status gates mirror current_timeline_events/current_character_knowledge).
 // current_character_knowledge returns nothing without character ids, so the tracked cast ids pass in.
 const castRows=(charsResult.data??[]) as {id:string;name:string;aliases:string[];role:string}[];
 const [factsResult,eventsResult,knowledgeResult]=await Promise.all([
  db.from('story_facts').select('id,claim').eq('project_id',projectId).in('status',['approved','CANON']).limit(200),
  db.rpc('current_timeline_events',{p_project_id:projectId,p_preferred_chunk_ids:[]}),
  db.rpc('current_character_knowledge',{p_project_id:projectId,p_character_ids:castRows.map(c=>c.id)}),
 ]);
 if(factsResult.error||eventsResult.error||knowledgeResult.error)throw Error('CONTEXT_READ_FAILED');

 // Deterministic last-seen scan: the reading-order position of the last chapter whose
 // plain_text mentions the character's name or an alias (case-insensitive).
 const cast=castRows;
 const doctorChapters:DoctorChapter[]=chapters.map((chapter,index)=>{
  const lower=chapter.plain_text.toLocaleLowerCase();
  const seenCharacters=cast
   .filter(character=>[character.name,...(character.aliases??[])]
    .some(alias=>alias.toLocaleLowerCase().length>1&&lower.includes(alias.toLocaleLowerCase())))
   .map(character=>character.name);
  return {
   id:chapter.id,title:chapter.title,position:index,story_time:chapter.story_time,
   ready:readyIds.has(chapter.id),summarized:summaries.some(s=>s.chapter_id===chapter.id),seenCharacters,
  };
 });

 return {
  chapters:doctorChapters,
  summaries,
  facts:(factsResult.data??[]).map((f:{id:string;claim:string})=>({id:f.id,claim:f.claim})),
  events:(eventsResult.data??[]).map((e:{id:string;title:string;story_time:string})=>({id:e.id,title:e.title,story_time:e.story_time})),
  knowledge:(knowledgeResult.data??[]).map((k:{id:string;character_name:string;statement:string})=>({id:k.id,character_name:k.character_name,statement:k.statement})),
  characters:cast.map(({name,aliases,role})=>({name,aliases:aliases??[],role})),  worldRules:bibleResult.data?.world_rules?.trim()||null,
 };
}

// Coverage is measured, never scored: which chapters the checks actually see, and which
// checks were skipped for lack of data. The panel renders this verbatim.
export function doctorCoverage(pack:DoctorPackage):Coverage{
 const skipped:string[]=[];
 if(!pack.facts.length)skipped.push('Fakta kanon belum ada — cek kontradiksi fakta terbatas pada peristiwa dan pengetahuan.');
 if(!pack.events.length)skipped.push('Peristiwa CANON belum ada — cek lini masa dan plot hole lewat peristiwa terbatas.');
 if(!pack.knowledge.length)skipped.push('Pengetahuan karakter belum ada — cek knowledge error/POV dilewati.');
 if(!pack.worldRules)skipped.push('Story bible kosong — cek pelanggaran aturan dunia dilewati.');
 if(!pack.summaries.length)skipped.push('Belum ada ringkasan bagian — pemeriksaan AI hanya melihat judul bab dan kanon, tanpa isi naskah.');
 return {
  chaptersTotal:pack.chapters.length,
  chaptersReady:pack.chapters.filter(c=>c.ready).length,
  chaptersSummarized:pack.chapters.filter(c=>c.summarized).length,
  chaptersWithStoryTime:pack.chapters.filter(c=>c.story_time).length,
  canonFacts:pack.facts.length,
  canonEvents:pack.events.length,
  canonKnowledge:pack.knowledge.length,
  charactersTracked:pack.characters.length,
  worldRulesProvided:!!pack.worldRules,
  skipped,
 };
}

// Deterministic check #1: a tracked character absent from the trailing ~30% of the
// manuscript (minimum 2 chapters) after appearing earlier. Severity stays low — this is an
// observation, not an accusation; the author decides whether the absence is intentional.
export function checkForgottenCharacters(pack:DoctorPackage):CodeFinding[]{
 if(pack.chapters.length<4)return [];
 const horizon=Math.max(2,Math.ceil(pack.chapters.length*0.3));
 const findings:CodeFinding[]=[];
 for(const character of pack.characters){
  const anchor=pack.chapters.filter(c=>c.seenCharacters.includes(character.name)).sort((a,b)=>b.position-a.position)[0];
  if(!anchor)continue;
  if(anchor.position<pack.chapters.length-horizon){
   const absent=pack.chapters.filter(c=>c.position>anchor.position).map(c=>c.title).join(', ');
   findings.push({
    kind:'forgotten_character',severity:'low',
    claim:`${character.name} tidak muncul lagi setelah ${anchor.title}.`,
    explanation:`${character.name} terakhir muncul di ${anchor.title}, lalu absen dari ${absent}. Periksa apakah ketidakhadiran ini disengaja atau perlu penjelasan.`,
    evidence_ids:[anchor.id],chapter_id:anchor.id,
   });
  }
 }
 return findings.slice(0,5);
}
