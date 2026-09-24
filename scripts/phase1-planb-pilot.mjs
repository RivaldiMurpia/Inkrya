import assert from 'node:assert/strict';
import {generateText} from 'ai';
import {prepareModel} from '../lib/ai/provider.ts';
import {cases} from './phase1-writer-cases.mjs';
import {runConstrainedCase} from './phase1-constrained-writer.mjs';

// Only previously catalog-verified, already benchmarked Writer candidates.
const candidates={
 'planb-qwen':'Qwen/Qwen3-235B-A22B-Instruct-2507',
 'planb-qwen35':'Qwen/Qwen3.5-397B-A17B',
 'planb-qwen-repeat':'Qwen/Qwen3-235B-A22B-Instruct-2507',
 'planb-qwen35-repeat':'Qwen/Qwen3.5-397B-A17B',
};
const mode=process.env.INKRYA_VERIFY_PHASE1_MODE;
const writerId=candidates[mode];
let results=[];
try {
 assert.ok(process.argv.includes('--allow-credit-usage'));
 assert.ok(writerId);
 assert.equal(process.env.VERCEL_ENV,'preview');
 assert.equal(process.env.VERCEL_GIT_COMMIT_REF,'hackathon/nebius-2026');
 assert.equal(process.env.VERCEL_GIT_COMMIT_SHA,process.env.INKRYA_VERIFY_PHASE1_COMMIT);
 assert.equal(process.env.INKRYA_AI_PROVIDER,'nebius');
 const roles={planner:await prepareModel('planner',process.env),qa:await prepareModel('qa',process.env),writer:await prepareModel('writer',{...process.env,WRITER_MODEL:writerId,LANGSMITH_TRACING:'false'})};
 assert.equal(roles.writer.config.id,writerId);
 assert.match(roles.planner.config.id,/^nvidia\/.*nemotron/i);
 assert.match(roles.qa.config.id,/^nvidia\/.*nemotron/i);
 const call=async({stage,role,system,prompt,maxOutputTokens})=>{
  const prepared=roles[role];
  assert.ok(prepared);
  const options=prepared.config.id==='nvidia/nemotron-3-super-120b-a12b'||prepared.config.id==='Qwen/Qwen3.5-397B-A17B'
   ? {providerOptions:{nebius:{chat_template_kwargs:{enable_thinking:false}}}} : {};
  const started=Date.now();
  const response=await generateText({model:prepared.model,system,prompt,maxOutputTokens,maxRetries:0,abortSignal:AbortSignal.timeout(25000),...options});
  return {text:response.text,usage:response.usage,model:prepared.config.id,latencyMs:Date.now()-started,stage};
 };
 const emit=(type,payload)=>console.log(`PHASE1_PLANB_${type}`,JSON.stringify({mode,writer:writerId,...payload}));
 // Two cases in parallel, then two more: no more than two simultaneous
 // synthetic cases; maximum 6 calls per case, 24 per candidate deployment.
 for(let index=0;index<cases.length;index+=2){
  const batch=await Promise.all(cases.slice(index,index+2).map(item=>runConstrainedCase(item,call,emit)));
  results.push(...batch);
 }
}catch{
 console.error('PHASE1_PLANB_ERROR',JSON.stringify({mode,writer:writerId,reason:'CONFIG_OR_CATALOG_FAILED'}));
}
console.log('PHASE1_PLANB_SUMMARY',JSON.stringify({mode,writer:writerId,results:results.map(({case:name,requests,repairCalls,firstPass,repaired,passed,error})=>({case:name,requests,repairCalls,firstPassMechanical:firstPass?.mechanical.passed??false,firstPassSemantic:firstPass?.semantic.passed??false,repairedMechanical:repaired?.mechanical.passed??null,repairedSemantic:repaired?.semantic.passed??null,finalObjective:passed,error})),casesAttempted:results.length,objectivePassed:results.filter(result=>result.passed).length,maximumCases:4,maximumInferenceRequests:24,maximumOutputTokens:6960,maximumRepairsPerCase:1,automaticRetries:0,humanReviewRequired:true}));
// A mechanical/LLM-verifier pass cannot substitute for independent human
// assessment. Do not replace the approved Preview deployment with this build.
process.exitCode=1;
