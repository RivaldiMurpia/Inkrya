// SERVER ONLY — Story Context Builder (Phase 3).
// Single grounding door for Ask Your Story (Phase 3) and Planner/Writer/Guardian (Phase 4+).
import {createHash} from 'node:crypto';
import type {userDatabase} from './server-auth.ts';

export type StoryDatabase=NonNullable<Awaited<ReturnType<typeof userDatabase>>>;
export type EvidenceChunk={id:string;chapter_id:string;title:string;story_time:string|null;source_revision:number;chunk_index:number;content:string;score:number};
export type CanonFact={id:string;claim:string;subject:string|null;predicate:string|null;object:string|null;quote:string;chunk_id:string;confidence:number|null};
export type TimelineEvent={id:string;story_time:string;title:string;event_type:string;chapter_id:string|null;quote:string;chunk_id:string};
export type CharacterKnowledge={id:string;character_name:string;statement:string;knows:boolean;learned_at_story_time:string|null;quote:string;chunk_id:string};
export type StoryContext={
 question:string;
 evidence:EvidenceChunk[];
 canon:CanonFact[];
 timeline:TimelineEvent[];
 knowledge:CharacterKnowledge[];
 characters:{name:string;aliases:string[];role:string}[];
 hasEmbedding:boolean;
};

type Character={id:string;name:string;aliases:string[];role:string};
const fail=(error:unknown)=>{if(error)throw Error('CONTEXT_READ_FAILED')};

// Context data comes only from revision-safe RPCs / evidence rows. RLS remains active.
export async function buildStoryContext(
 db:StoryDatabase,projectId:string,question:string,queryEmbedding:number[]|null
):Promise<StoryContext>{
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 const retrieval=queryEmbedding
  ?await db.rpc('retrieve_memory',{p_project_id:projectId,p_query:question,p_embedding:queryEmbedding})
  :await db.rpc('retrieve_memory',{p_project_id:projectId,p_query:question});
 fail(retrieval.error);
 const raw=(retrieval.data??[]) as EvidenceChunk[];
 const evidence=raw.filter((row,index,rows)=>!rows.slice(0,index).some(other=>other.chapter_id===row.chapter_id&&Math.abs(other.chunk_index-row.chunk_index)<=1)).slice(0,6);
 const chunkIds=evidence.map(e=>e.id);

 const charsResult=await db.from('characters').select('id,name,aliases,role').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).limit(100);
 fail(charsResult.error);
 const allCharacters=(charsResult.data??[]) as Character[];
 const referenceText=(question+' '+evidence.map(e=>e.content).join(' ')).toLocaleLowerCase();
 const characters=allCharacters.filter(character=>[character.name,...(character.aliases??[])].some(alias=>alias.length>1&&referenceText.includes(alias.toLocaleLowerCase())));

 const factsResult=chunkIds.length
  ?await db.from('story_facts').select('id,claim,subject,predicate,object,quote,chunk_id,confidence').eq('project_id',projectId).in('chunk_id',chunkIds).in('status',['approved','CANON']).limit(20)
  :{data:[],error:null};
 fail(factsResult.error);
 const canon=(factsResult.data??[]) as CanonFact[];

 // Database functions join chunks/chapters/jobs, excluding stale sources server-side.
 const timelineResult=await db.rpc('current_timeline_events',{p_project_id:projectId,p_preferred_chunk_ids:chunkIds});
 fail(timelineResult.error);
 const timeline=(timelineResult.data??[]) as TimelineEvent[];
 const knowledgeResult=await db.rpc('current_character_knowledge',{p_project_id:projectId,p_character_ids:characters.map(character=>character.id)});
 fail(knowledgeResult.error);
 const knowledge=(knowledgeResult.data??[]) as CharacterKnowledge[];

 const embeddingsResult=queryEmbedding
  ?await db.from('story_embeddings').select('id').eq('project_id',projectId).limit(1)
  :{data:[],error:null};
 fail(embeddingsResult.error);
 return {
  question,evidence,canon,timeline,knowledge,
  characters:characters.map(({name,aliases,role})=>({name,aliases:aliases??[],role})),
  hasEmbedding:!!queryEmbedding&&(embeddingsResult.data??[]).length>0,
 };
}

// Extract distinctive evidence terms to seed a second retrieval hop; no LLM call.
export function secondHopQuery(question:string,evidence:EvidenceChunk[]):string{
 const stopwords=new Set(['apa','siapa','kapan','dimana','mana','bagaimana','mengapa','kenapa','yang','dan','atau','dengan','untuk','dari','pada','dalam','adalah','itu','ini','pernah','tentang','the','what','where','when','does','and','was','said','did','have','this','that','they','there','their','which','about','would','could']);
 const inQuestion=new Set((question.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]));
 const extra=new Set<string>();
 for(const chunk of evidence.slice(0,3))for(const token of chunk.content.match(/[\p{L}\p{N}]{3,}/gu)??[]){
  const word=token.toLocaleLowerCase();
  if(!stopwords.has(word)&&!inQuestion.has(word)&&extra.size<10)extra.add(word);
 }
 return extra.size?`${question} ${[...extra].join(' ')}`:question;
}

// Reciprocal Rank Fusion (same k=60 as SQL retrieval). Dedupes by exact chunk id.
export function mergeEvidence(first:EvidenceChunk[],second:EvidenceChunk[],limit=6):EvidenceChunk[]{
 const found=new Map<string,{chunk:EvidenceChunk;score:number}>();
 for(const[index,chunk]of first.entries())found.set(chunk.id,{chunk,score:1/(60+index+1)});
 for(const[index,chunk]of second.entries()){
  const previous=found.get(chunk.id);
  if(previous)previous.score+=1/(60+index+1);
  else found.set(chunk.id,{chunk,score:1/(60+index+1)});
 }
 return [...found.values()].sort((a,b)=>b.score-a.score).slice(0,limit).map(value=>value.chunk);
}

// Test-only helper: current-source rule used by database RPCs.
export function sourceHash(text:string){return createHash('md5').update(text).digest('hex')}
