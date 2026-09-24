import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MODEL_TASKS,resolveModelConfig,configuredProvider,NEBIUS_BASE_URL,configurationErrorMessage} from '../lib/ai/models.ts';
import {taskForAction} from '../lib/ai/router.ts';
import {systemForAction,outputTokensForWriting,GENERAL_SYSTEM} from '../lib/ai/writing-prompts.ts';
import {createNebiusModel,verifyNebiusModel,aiConfigurationStatus} from '../lib/ai/provider.ts';
import {generateKryaText} from '../lib/ai/generate.ts';
import {startTrace,safeTraceMetadata} from '../lib/langsmith/tracing.ts';
import {authReturnUrl} from '../lib/auth-redirect.ts';

test('OAuth returns to the exact owned Preview origin and rejects lookalike hosts',()=>{
 const preview='https://inkrya-git-hackathon-nebius-2026-rivaldi-murpias-projects.vercel.app';
 assert.equal(authReturnUrl(preview),preview+'/');
 for(const origin of ['https://inkrya.vercel.app',preview+'.evil.example','https://other.vercel.app','http://'+preview.slice(8),'//evil.example']){
  assert.equal(authReturnUrl(origin),'https://inkrya.vercel.app/');
 }
});

// Synthetic model IDs and keys. No paid network requests in this suite.
process.env.LANGSMITH_TRACING='false';
const env={INKRYA_AI_PROVIDER:'nebius',NEBIUS_API_KEY:'test-only-key',NEBIUS_TEXT_MODEL:'nvidia/Nemotron-test-fixture'};
const config=resolveModelConfig('writer',env);
const context={generationId:randomUUID(),projectId:'project-private-fixture',userId:'user-private-fixture',sourceCount:3,workflow:'provider-smoke'};
const completion=(text='Maya memasuki ruang kontrol.')=>Response.json({id:'fixture',object:'chat.completion',created:1,model:config.id,choices:[{index:0,message:{role:'assistant',content:text},finish_reason:'stop'}],usage:{prompt_tokens:25,completion_tokens:10,total_tokens:35}});

test('Legacy provider stays default; invalid provider never silently falls back',()=>{
  assert.equal(configuredProvider({}),'gateway');
  assert.equal(resolveModelConfig('writer',{NEBIUS_API_KEY:'set-but-not-enabled'}).provider,'gateway');
  assert.throws(()=>configuredProvider({INKRYA_AI_PROVIDER:'typo'}),/INVALID_AI_PROVIDER/);
});
test('Every PRD text role resolves explicitly and role override wins',()=>{
  for(const task of MODEL_TASKS) assert.equal(resolveModelConfig(task,env).id,env.NEBIUS_TEXT_MODEL);
  assert.equal(resolveModelConfig('planner',{...env,PLANNER_MODEL:'nvidia/Nemotron-planner-fixture'}).id,'nvidia/Nemotron-planner-fixture');
  assert.equal(taskForAction('ask'),'qa');assert.equal(taskForAction('analyze'),'memory');assert.equal(taskForAction('continue'),'writer');
});
test('Word-bounded writing preserves the other AI workflows and the global output ceiling',()=>{
  assert.equal(systemForAction('chat'),GENERAL_SYSTEM);
  assert.equal(systemForAction('brainstorm'),GENERAL_SYSTEM);
  assert.notEqual(systemForAction('rewrite'),GENERAL_SYSTEM);
  assert.equal(outputTokensForWriting('continue','Lanjutkan 55–70 kata.',true),900);
  assert.equal(outputTokensForWriting('rewrite','Tulis ulang 45-60 kata.',true),900);
  assert.equal(outputTokensForWriting('rewrite','Tulis ulang 45-60 kata.'),1400);
  assert.equal(outputTokensForWriting('chat','55–70 kata'),1400);
  assert.equal(outputTokensForWriting('rewrite','5–1000 kata'),1400);
});
test('Reject missing key, missing model, wrong family, and arbitrary endpoint',()=>{
  assert.throws(()=>resolveModelConfig('writer',{...env,NEBIUS_API_KEY:''}),/API_KEY_MISSING/);
  assert.throws(()=>resolveModelConfig('writer',{...env,NEBIUS_TEXT_MODEL:''}),/MODEL_MISSING/);
  assert.throws(()=>resolveModelConfig('writer',{...env,NEBIUS_TEXT_MODEL:'other/model'}),/NVIDIA_NEMOTRON_REQUIRED/);
  assert.throws(()=>resolveModelConfig('writer',{...env,NEBIUS_BASE_URL:'https://attacker.example/v1'}),/NOT_ALLOWED/);
});
test('Catalog checks availability and never leak provider response text',async()=>{
  const request=async(url,init)=>{assert.equal(url,NEBIUS_BASE_URL+'/models');assert.equal(init.redirect,'error');return Response.json({data:[{id:config.id}]})};
  await verifyNebiusModel(config,'catalog-test-key',request);
  await assert.rejects(()=>verifyNebiusModel({...config,id:'nvidia/Nemotron-unavailable'},'catalog-test-key',request),/MODEL_UNAVAILABLE/);
  await assert.rejects(()=>verifyNebiusModel(config,'bad-catalog-key',async()=>new Response('SECRET response',{status:401})),/CATALOG_UNAVAILABLE/);
  assert.ok(!configurationErrorMessage(Error('SECRET response')).includes('SECRET'));
});
test('Nebius adapter uses chat completions, bounded tokens, and persisted run context',async()=>{
  let calls=0;
  const request=async(url,init)=>{calls++;assert.equal(url,NEBIUS_BASE_URL+'/chat/completions');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);assert.equal(body.model,config.id);assert.equal(body.max_tokens,100);return completion()};
  const prepared={config,model:createNebiusModel(config,env.NEBIUS_API_KEY,request)};
  const output=await generateKryaText(prepared,{system:'Test only',prompt:'Synthetic story only',maxOutputTokens:100},context);
  assert.equal(output.text,'Maya memasuki ruang kontrol.');assert.equal(output.usage.totalTokens,35);assert.equal(output.provider,'nebius');assert.equal(calls,1);
  await assert.rejects(()=>generateKryaText(prepared,{system:'',prompt:'x',maxOutputTokens:2500},context),/BUDGET_EXCEEDED/);
  await assert.rejects(()=>generateKryaText(prepared,{system:'',prompt:'x',maxOutputTokens:100},{...context,generationId:''}),/PERSISTED_GENERATION_REQUIRED/);
  assert.equal(calls,1);
});
test('Provider failure has no retries, no fallback, no raw error exposure',async()=>{
  let calls=0;const prepared={config,model:createNebiusModel(config,'test',async()=>{calls++;return new Response('private text secret-key',{status:500})})};
  await assert.rejects(()=>generateKryaText(prepared,{system:'',prompt:'x',maxOutputTokens:100},context),/^Error: AI_GENERATION_FAILED$/);assert.equal(calls,1);
});
test('Super writer may think while Nano and structured Super tasks remain non-thinking',async()=>{
  const nano={...config,id:'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B'};
  const superModel={...config,id:'nvidia/nemotron-3-super-120b-a12b'};
  const superQA={...superModel,task:'qa'};
  for(const modelConfig of [nano,superModel,superQA,config]) {
    const request=async(url,init)=>{
      const body=JSON.parse(init.body);
      assert.deepEqual(body.chat_template_kwargs,modelConfig!==config?{enable_thinking:modelConfig===superModel}:undefined);
      if(modelConfig===superModel||modelConfig===superQA){assert.equal(body.temperature,1);assert.equal(body.top_p,0.95)}
      return completion();
    };
    await generateKryaText({config:modelConfig,model:createNebiusModel(modelConfig,'test',request)},{system:'Synthetic',prompt:'Fixture',maxOutputTokens:100},context);
  }
});
test('Reasoning-like blocks are not accepted as final prose',async()=>{
  const prepared={config,model:createNebiusModel(config,'test',async()=>completion('<think>internal reasoning</think>'))};
  await assert.rejects(()=>generateKryaText(prepared,{system:'',prompt:'x',maxOutputTokens:100},context),/AI_GENERATION_FAILED/);
});
test('Status never returns API credentials; missing Nebius config is not ready',async()=>{
  const status=await aiConfigurationStatus(env);assert.equal(status.provider,'nebius');assert.equal(status.configured,true);assert.equal(status.verification,'configuration-only');
  assert.ok(!JSON.stringify(status).includes(env.NEBIUS_API_KEY));
  assert.equal((await aiConfigurationStatus({...env,NEBIUS_API_KEY:''})).configured,false);
});
test('LangSmith sends allowlisted metadata only and pseudonymizes IDs',async()=>{
  const bodies=[];const traceEnv={LANGSMITH_TRACING:'true',LANGSMITH_API_KEY:'trace-test-only',LANGSMITH_PROJECT:'test-project'};
  const finish=await startTrace(context,config,123,traceEnv,async(url,init)=>{assert.ok(String(url).startsWith('https://api.smith.langchain.com/'));assert.equal(init.redirect,'error');if(init.body)bodies.push(JSON.parse(typeof init.body==='string'?init.body:new TextDecoder().decode(init.body)));return Response.json({})});
  assert.equal(await finish({success:true,latencyMs:20,outputCharacters:10,usage:{inputTokens:5,outputTokens:2,totalTokens:7}}),'sent');
  const serialized=JSON.stringify(bodies);assert.ok(bodies.length>=2);assert.ok(!serialized.includes('project-private-fixture'));assert.ok(!serialized.includes('user-private-fixture'));assert.ok(!serialized.includes('trace-test-only'));assert.ok(!serialized.includes('Synthetic story'));
  assert.equal(safeTraceMetadata(context,config).content_logging,false);
});
test('Tracing opt-out performs zero requests; bad configuration is reported without failing AI',async()=>{
  let calls=0;const request=async()=>{calls++;return Response.json({})};
  const off=await startTrace(context,config,10,{},request);assert.equal(await off({success:true,latencyMs:2}),'disabled');assert.equal(calls,0);
  const bad=await startTrace(context,config,10,{LANGSMITH_TRACING:'true'},request);assert.equal(await bad({success:true,latencyMs:2}),'failed');assert.equal(calls,0);
});
test('LangSmith outage stops after one attempt without exposing remote error bodies',async()=>{
  let calls=0;
  const finish=await startTrace(context,config,10,{LANGSMITH_TRACING:'true',LANGSMITH_API_KEY:'test'},async()=>{calls++;return new Response('PRIVATE DEBUG BODY',{status:500})});
  assert.equal(await finish({success:true,latencyMs:2}),'failed');assert.equal(calls,1);
});
