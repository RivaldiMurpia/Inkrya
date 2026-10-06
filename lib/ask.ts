// SERVER ONLY — Ask Your Story orchestration (Phase 3).
// Two-hop retrieval, one answer call. Phase 4 can reuse StoryContext without changing retrieval rules.
import {createHash} from 'node:crypto';
import {createEmbedding} from './ai/embed.ts';
import {resolveEmbeddingConfig} from './ai/models.ts';
import {generateKryaText} from './ai/generate.ts';
import type {prepareModel} from './ai/provider.ts';
import {MEMORY_SYSTEM,MEMORY_ASK} from './memory-prompts.ts';
import {parseModelJSON,validateAnswer,type AnswerStatus,type MemorySource} from './memory-validation.ts';
import {buildStoryContext,secondHopQuery,mergeEvidence,type StoryContext,type StoryDatabase} from './story-context.ts';

export type AskCitation={number:number;quote:string;source_id:string;chapter_id:string;title:string;story_time:string|null;revision:number};
export type AskPreparation={context:StoryContext;semanticWarning:string|null};
export type AskOutput={
 answer:string;
 status:AnswerStatus;
 citations:AskCitation[];
 abstained:boolean;
 evidenceCount:number;
 hasEmbedding:boolean;
 warning:string|null;
};
export type AnsweredAsk=AskOutput&{
 result:Awaited<ReturnType<typeof generateKryaText>>;
};

type PreparedModel=Awaited<ReturnType<typeof prepareModel>>;

// Two retrieval passes, no extra model call. If embedding is down, hybrid retrieval safely falls back.
export async function prepareAskContext(db:StoryDatabase,projectId:string,question:string):Promise<AskPreparation>{
 let expanded=question;
 const chars=await db.from('characters').select('name,aliases').eq('project_id',projectId).eq('include_in_ai_context',true).is('deleted_at',null).limit(100);
 if(chars.error)throw Error('CONTEXT_READ_FAILED');
 for(const character of chars.data??[])if([character.name,...(character.aliases??[])].some((alias:string)=>alias.length>1&&question.toLocaleLowerCase().includes(alias.toLocaleLowerCase())))expanded+=` ${character.name} ${(character.aliases??[]).join(' ')}`;
 const baseQuery=expanded.slice(0,2000);
 let embedding:number[]|null=null;
 let semanticWarning:string|null=null;
 try{const config=resolveEmbeddingConfig();if(config)embedding=await createEmbedding(baseQuery,config.model,config.apiKey);}catch{semanticWarning='Pencarian semantik tidak tersedia; pencarian memakai kata kunci saja.';}
 const first=await buildStoryContext(db,projectId,baseQuery,embedding);
 let context=first;
 const hopQuery=first.evidence.length?secondHopQuery(baseQuery,first.evidence):baseQuery;
 if(hopQuery!==baseQuery){
  const second=await buildStoryContext(db,projectId,hopQuery.slice(0,2000),embedding);
  const evidence=mergeEvidence(first.evidence,second.evidence,6);
  if(evidence.length){
   const evidenceIds=new Set(evidence.map(chunk=>chunk.id));
   context={
    question:first.question,evidence,
    canon:[...first.canon,...second.canon].filter(fact=>evidenceIds.has(fact.chunk_id)).filter((fact,index,all)=>all.findIndex(item=>item.id===fact.id)===index).slice(0,20),
    timeline:[...new Map([...first.timeline,...second.timeline].map(event=>[event.id,event])).values()].slice(0,20),
    knowledge:[...new Map([...first.knowledge,...second.knowledge].map(knowledge=>[knowledge.id,knowledge])).values()].slice(0,20),
    characters:[...new Map([...first.characters,...second.characters].map(character=>[character.name,character])).values()],
    hasEmbedding:first.hasEmbedding||second.hasEmbedding,
   };
  }
 }
 return {context,semanticWarning};
}

export function noEvidenceAnswer(prepared:AskPreparation):AskOutput{
 return {
  answer:'Belum ditemukan bukti pada indeks terbaru. Perbarui Memory atau coba sebutkan nama karakter/kata kunci yang lebih spesifik.',
  status:'NO_EVIDENCE',citations:[],abstained:true,evidenceCount:0,hasEmbedding:prepared.context.hasEmbedding,warning:prepared.semanticWarning,
 };
}

// The caller reserves ai_generations first so rate limiting and trace IDs remain authoritative.
export async function answerAsk(
 db:StoryDatabase,projectId:string,question:string,generationId:string,preparedModel:PreparedModel,prepared:AskPreparation
):Promise<AnsweredAsk>{
 const context=prepared.context;
 if(!context.evidence.length)throw Error('NO_EVIDENCE');
 const prompt=JSON.stringify({question,context:{
  evidence:context.evidence.map(({id,title,story_time,chunk_index,content})=>({id,title,story_time,chunk_index,content})),
  canon:context.canon,timeline:context.timeline,knowledge:context.knowledge,characters:context.characters,
 }});
 const result=await generateKryaText(preparedModel,{maxOutputTokens:1800,timeoutMs:35000,system:MEMORY_SYSTEM+MEMORY_ASK,prompt},{generationId,projectId,userId:db.authenticatedUserId,sourceCount:context.evidence.length,workflow:'memory-ask'});
 const sources:MemorySource[]=context.evidence.map(e=>({id:e.id,chapter_id:e.chapter_id,title:e.title,story_time:e.story_time,source_revision:e.source_revision,chunk_index:e.chunk_index,content:e.content}));
 const {claims,status}=validateAnswer(parseModelJSON(result.text),sources);
 // Never cite a revision that changed while the model was working.
 for(const claim of claims){
  const chapter=await db.from('chapters').select('plain_text,revision_number').eq('id',claim.source.chapter_id).single();
  const chunk=await db.from('story_chunks').select('source_hash').eq('id',claim.source.id).single();
  if(chapter.error||chunk.error||!chapter.data||!chunk.data||chapter.data.revision_number!==claim.source.source_revision||createHash('md5').update(chapter.data.plain_text).digest('hex')!==chunk.data.source_hash)throw Error('STALE_SOURCE');
 }
 const statusText:Record<Exclude<AnswerStatus,'ANSWERED'>,string>={
  NOT_ESTABLISHED:'Bukti yang tersedia belum menetapkan jawaban ini. Cerita mungkin belum menjelaskannya.',
  NO_EVIDENCE:'Belum ditemukan bukti pada indeks terbaru. Perbarui Memory atau coba kata kunci lain.',
  CONTRADICTION:'Bukti yang ditemukan saling bertentangan. Periksa kutipan dan pertimbangkan revisi cerita.',
 };
 const abstained=!claims.length;
 return {
  answer:abstained?statusText[status==='ANSWERED'?'NOT_ESTABLISHED':status]:claims.map((claim,index)=>`${claim.text} [${index+1}]`).join('\n\n'),
  status,citations:claims.map((claim,index)=>({number:index+1,quote:claim.quote,source_id:claim.source.id,chapter_id:claim.source.chapter_id,title:claim.source.title,story_time:claim.source.story_time??null,revision:claim.source.source_revision})),
  abstained,evidenceCount:context.evidence.length,hasEmbedding:context.hasEmbedding,warning:prepared.semanticWarning,result,
 };
}
