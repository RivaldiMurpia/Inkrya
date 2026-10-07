// SERVER ONLY — Agentic Writing graph (Phase 4).
// LangGraph StateGraph: planner → writer → guardian → (repair → guardian re-check, ≤2) →
// critic. No checkpointer — single-request execution. Agents never read the DB directly;
// the same StoryContext package grounds all four roles (architecture §3.7). Stage events
// stream out via emit; only executed stages emit (demo spec §8).
import {randomUUID} from 'node:crypto';
import {Annotation,StateGraph,START,END} from '@langchain/langgraph';
import {generateKryaText} from './ai/generate.ts';
import type {prepareModel} from './ai/provider.ts';
import {prepareAskContext} from './ask.ts';
import type {StoryContext,StoryDatabase} from './story-context.ts';
import {PLANNER_SYSTEM,WRITER_SYSTEM,GUARDIAN_SYSTEM,REPAIR_SYSTEM,CRITIC_SYSTEM} from './agent-prompts.ts';
import {
 validatePlan,validateGuardianIssues,validateCritic,parseModelJSON,
 type ChapterPlan,type GuardianIssue,type CriticReport,
} from './agent-validation.ts';

export type Role='planner'|'writer'|'continuity'|'critic';
export type AgentStage='context'|'plan'|'draft'|'guardian'|'recheck'|'repair'|'critic';
export type AgentStep={stage:AgentStage;detail:string;atIndex?:number;issueCount?:number};
export type TokenTotals={inputTokens:number;outputTokens:number};
export type WriteResult={
 draft:string;plan:ChapterPlan;issues:GuardianIssue[];findings:GuardianIssue[];resolved:boolean;repairAttempts:number;
 critic:CriticReport|null;steps:AgentStep[];tokenUsage:TokenTotals;hasEmbedding:boolean;warning:string|null;
};

type PreparedModel=Awaited<ReturnType<typeof prepareModel>>;
type CallResult={text:string;usage:{inputTokens?:number;outputTokens?:number}};
// Injectable model caller for tests (pattern from scripts/phase1-constrained-writer.mjs).
export type WriteCallFn=(role:Role,system:string,prompt:string,maxOutputTokens:number)=>Promise<CallResult>;

const MAX_REPAIRS=2;
const GUARDIAN_CONTENT_CAP=1200; // guardian needs claim+id, not full prose (input budget)
// Worst case: planner 30s + writer 45s + 3×guardian 30s + 2×repair 45s + critic 30s
// = 285s < maxDuration 300. Keep this math comment with the code.
const TIMEOUT={planner:30000,writer:45000,continuity:30000,critic:30000} as const;
const TOKENS={planner:1400,writer:1800,continuity:1200,critic:900} as const;

type Emit=(step:AgentStep)=>void;

// Context payload for guardian/repair — ids survive so evidence_ids stay inspectable.
function guardianPayload(context:StoryContext){
 return {
  evidence:context.evidence.map(e=>({id:e.id,title:e.title,story_time:e.story_time,chunk_index:e.chunk_index,content:e.content.slice(0,GUARDIAN_CONTENT_CAP)})),
  canon:context.canon,timeline:context.timeline,knowledge:context.knowledge,characters:context.characters,
 };
}
// Writer gets full evidence prose (the 48k input budget in generateKryaText caps it).
function writerPayload(context:StoryContext){
 return {
  evidence:context.evidence.map(({id,title,story_time,chunk_index,content})=>({id,title,story_time,chunk_index,content})),
  canon:context.canon,timeline:context.timeline,knowledge:context.knowledge,characters:context.characters,
 };
}

// LangGraph state. Input fields are set once at invoke; the rest evolve through nodes.
const WriteState=Annotation.Root({
 instruction:Annotation<string>({reducer:(_,b)=>b,default:()=>''}),
 context:Annotation<StoryContext|null>({reducer:(_,b)=>b,default:()=>null}),
 plan:Annotation<ChapterPlan|null>({reducer:(_,b)=>b,default:()=>null}),
 draft:Annotation<string>({reducer:(_,b)=>b,default:()=>''}),
 issues:Annotation<GuardianIssue[]>({reducer:(_,b)=>b,default:()=>[]}),
 // Every issue ever detected, deduped — survives repair so the UI can show what the
 // Guardian found even after a fix (demo §19: knowledge leak must be inspectable).
 findings:Annotation<GuardianIssue[]>({reducer:(a,b)=>[...a,...b.filter(next=>!a.some(seen=>seen.type===next.type&&seen.claim===next.claim))],default:()=>[]}),
 repairAttempts:Annotation<number>({reducer:(_,b)=>b,default:()=>0}),
 // Channel is `report`, not `critic`: node names and channel names must not collide.
 report:Annotation<CriticReport|null>({reducer:(_,b)=>b,default:()=>null}),
});

// Build per request so node closures capture this request's emit/call/limits.
function buildWriteGraph(call:WriteCallFn,emit:Emit){
 const nodeCall=async(role:Role,system:string,prompt:string)=>{
  return await call(role,system,prompt,TOKENS[role]);
 };
 return new StateGraph(WriteState)
  .addNode('planner',async(state:{instruction:string;context:StoryContext|null})=>{
   const ctx=state.context!;
   const prompt=JSON.stringify({instruction:state.instruction,state:writerPayload(ctx),cast:ctx.characters.map(c=>({name:c.name,role:c.role}))});
   const {text}=await nodeCall('planner',PLANNER_SYSTEM,prompt);
   const plan=validatePlan(parseModelJSON(text),ctx);
   emit({stage:'plan',detail:`Rencana bab dibuat · ${plan.scenePlan.length} adegan`});
   return {plan};
  })
  .addNode('writer',async(state:typeof WriteState.State)=>{
   const prompt=JSON.stringify({instruction:state.instruction,plan:state.plan,context:writerPayload(state.context!)});
   const {text}=await nodeCall('writer',WRITER_SYSTEM,prompt);
   emit({stage:'draft',detail:'Draf dibuat'});
   return {draft:text.trim()};
  })
  .addNode('guardian',async(state:typeof WriteState.State)=>{
   const fresh=state.repairAttempts===0;
   const prompt=JSON.stringify({draft:state.draft,plan:state.plan,evidence:guardianPayload(state.context!)});
   const {text}=await nodeCall('continuity',GUARDIAN_SYSTEM,prompt);
   const issues=validateGuardianIssues(parseModelJSON(text),state.context!);
   if(fresh)emit({stage:'guardian',detail:issues.length?`Masalah kontinuitas ditemukan · ${issues.length}`:'Kontinuitas bersih',issueCount:issues.length});
   else emit({stage:'recheck',detail:issues.length?`Masalah tersisa · ${issues.length}`:'Masalah teratasi',issueCount:issues.length});
   return {issues,findings:issues};
  })
  .addNode('repair',async(state:typeof WriteState.State)=>{
   const pass=state.repairAttempts+1;
   const prompt=JSON.stringify({draft:state.draft,issues:state.issues,evidence:guardianPayload(state.context!)});
   const {text}=await nodeCall('writer',REPAIR_SYSTEM(pass),prompt);
   emit({stage:'repair',detail:`Perbaikan dicoba · upaya ${pass} dari ${MAX_REPAIRS}`,atIndex:pass});
   return {draft:text.trim(),repairAttempts:pass};
  })
  .addNode('critic',async(state:typeof WriteState.State)=>{
   const prompt=JSON.stringify({instruction:state.instruction,plan:state.plan,draft:state.draft});
   const {text}=await nodeCall('critic',CRITIC_SYSTEM,prompt);
   const critic=validateCritic(parseModelJSON(text));
   emit({stage:'critic',detail:'Kritik selesai'});
   return {report:critic};
  })
  .addEdge(START,'planner')
  .addEdge('planner','writer')
  .addEdge('writer','guardian')
  .addConditionalEdges('guardian',(state:typeof WriteState.State)=>{
   if(!state.issues.length||state.repairAttempts>=MAX_REPAIRS)return 'critic';
   return 'repair';
  })
  .addEdge('repair','guardian')
  .addEdge('critic',END)
  .compile();
}

// Reserve → nodes → result. Throws NO_EVIDENCE / INVALID_* / AI_GENERATION_FAILED /
// REQUEST_ABORTED; the route maps every error and marks the quota row.
export async function runWriteGraph(input:{
 db:StoryDatabase;projectId:string;instruction:string;userId:string;generationId:string;
 prepared:Record<Role,PreparedModel>;signal?:AbortSignal;emit?:Emit;call?:WriteCallFn;
}):Promise<WriteResult>{
 const {db,projectId,instruction,userId}=input;
 const signal=input.signal;
 const steps:AgentStep[]=[];
 const totals:TokenTotals={inputTokens:0,outputTokens:0};
 const emit=(step:AgentStep)=>{steps.push(step);input.emit?.(step)};
 // Per-call trace UUID; quota traceability lives on the ai_generations row. Injectable
 // `call` replaces the model wrapper in tests (phase1-constrained-writer pattern); token
 // totals accumulate around either implementation.
 const baseCall:WriteCallFn=input.call??(async(role,system,prompt,maxOutputTokens)=>{
  if(signal?.aborted)throw Error('REQUEST_ABORTED');
  const result=await generateKryaText(
   input.prepared[role],
   {system,prompt,maxOutputTokens,timeoutMs:TIMEOUT[role],signal},
   {generationId:randomUUID(),projectId,userId,sourceCount:0,workflow:'write-agent'},
  );
  return {text:result.text,usage:{inputTokens:result.usage?.inputTokens,outputTokens:result.usage?.outputTokens}};
 });
 const call:WriteCallFn=async(role,system,prompt,maxOutputTokens)=>{
  const result=await baseCall(role,system,prompt,maxOutputTokens);
  totals.inputTokens+=result.usage?.inputTokens??0;
  totals.outputTokens+=result.usage?.outputTokens??0;
  return result;
 };

 // Stage 0: grounding via the Phase 3 machinery, unchanged. Empty evidence → NO_EVIDENCE
 // (route maps it; the quota row was already inserted — insert-first convention).
 const preparedContext=await prepareAskContext(db,projectId,instruction);
 const context=preparedContext.context;
 if(!context.evidence.length)throw Error('NO_EVIDENCE');
 emit({stage:'context',detail:`Konteks cerita siap · ${context.evidence.length} bagian relevan · ${context.timeline.length} peristiwa · ${context.knowledge.length} pengetahuan karakter`});

 const graph=buildWriteGraph(call,emit);
 const final=await graph.invoke(
  {instruction,context,plan:null,draft:'',issues:[],findings:[],repairAttempts:0,report:null},
  {signal,recursionLimit:16},
 );
 return {
  draft:final.draft,plan:final.plan!,issues:final.issues,findings:final.findings,
  resolved:final.issues.length===0,repairAttempts:final.repairAttempts,
  critic:final.report,steps,tokenUsage:totals,hasEmbedding:context.hasEmbedding,
  warning:preparedContext.semanticWarning,
 };
}
