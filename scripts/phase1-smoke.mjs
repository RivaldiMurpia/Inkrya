import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareModel} from '../lib/ai/provider.ts';
import {generateKryaText} from '../lib/ai/generate.ts';
import {MODEL_TASKS,resolveModelConfig} from '../lib/ai/models.ts';
import {createTraceClient,safeTraceMetadata} from '../lib/langsmith/tracing.ts';
import {MEMORY_SYSTEM,MEMORY_ASK,MEMORY_ANALYZE} from '../lib/memory-prompts.ts';
import {parseModelJSON,validateAnswer,validateInsights} from '../lib/memory-validation.ts';

// Explicit, bounded integration check using public synthetic fixtures only.
// This verifies provider + trace transport, not login, RLS, or application history.
const source={id:'11111111-1111-4111-8111-111111111111',chapter_id:'22222222-2222-4222-8222-222222222222',title:'Synthetic activation fixture',source_revision:1,chunk_index:0,content:'Mira tiba di Stasiun Aruna pada pukul tujuh malam. Ia menyimpan kunci kuningan di laci meja radio. Damar belum mengetahui lokasi kunci itu.'};
const cases=[
  {name:'prose',task:'writer',maxOutputTokens:350,system:'Kamu penulis fiksi. Tulis langsung prosa bahasa Indonesia, tanpa pengantar, analisis, judul, atau markdown.',prompt:'Tulis satu paragraf 50–80 kata tentang Mira yang mendengar sinyal radio misterius di Stasiun Aruna. Gunakan sudut pandang orang ketiga.'},
  {name:'supported',task:'qa',maxOutputTokens:500,system:MEMORY_SYSTEM+MEMORY_ASK,prompt:JSON.stringify({question:'Di mana Mira menyimpan kunci kuningan?',sources:[source]})},
  {name:'unknown',task:'qa',maxOutputTokens:200,system:MEMORY_SYSTEM+MEMORY_ASK,prompt:JSON.stringify({question:'Apa warna mobil Mira?',sources:[source]})},
  {name:'extraction',task:'memory',maxOutputTokens:700,system:MEMORY_SYSTEM+MEMORY_ANALYZE,prompt:JSON.stringify({source})},
].map(c=>({...c,generationId:randomUUID()}));

let stage='configuration';
try {
  assert.ok(process.argv.includes('--allow-credit-usage'));
  assert.equal(process.env.INKRYA_AI_PROVIDER,'nebius');
  assert.equal(process.env.LANGSMITH_TRACING,'true');
  const client=createTraceClient();
  assert.ok(client);
  const routes=MODEL_TASKS.map(task=>resolveModelConfig(task));
  // Initial activation deliberately exercises one model. Independent role
  // overrides need their own evaluation before use.
  for(const route of routes)assert.equal(route.id,'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B');
  console.log('PHASE1_ROUTES',JSON.stringify(routes.map(({task,provider,id})=>({task,provider,model:id}))));
  const records=await mkdtemp(join(tmpdir(),'inkrya-phase1-'));
  const completed=[];
  for(const item of cases) {
    stage=item.name;
    const prepared=await prepareModel(item.task);
    const context={generationId:item.generationId,projectId:'inkrya-public-synthetic-activation',sourceCount:item.name==='prose'?0:1,workflow:'provider-smoke'};
    // Reserve an addressable, non-user smoke record before inference. No user
    // database or manuscript is touched by this diagnostic script.
    const recordPath=join(records,item.generationId+'.json');
    await writeFile(recordPath,JSON.stringify({id:item.generationId,case:item.name,status:'pending'}),{mode:0o600});
    const result=await generateKryaText(prepared,{system:item.system,prompt:item.prompt,maxOutputTokens:item.maxOutputTokens,timeoutMs:35000},context);
    assert.equal(result.tracing,'sent');
    assert.ok(Number.isFinite(result.usage.inputTokens)&&result.usage.inputTokens>0);
    assert.ok(Number.isFinite(result.usage.outputTokens)&&result.usage.outputTokens>0);
    if(item.name==='prose') {
      assert.ok(result.text.length>100);
      assert.ok(/Mira/.test(result.text)&&/Aruna/.test(result.text));
      assert.ok(!/^(?:Okay|Let me|We need|Analysis:|Here is)/i.test(result.text.trim()));
      console.log('PHASE1_SYNTHETIC_PROSE',JSON.stringify({text:result.text}));
    } else if(item.name==='extraction') {
      const parsed=parseModelJSON(result.text);
      const valid=validateInsights(parsed,source.content);
      assert.ok(valid.facts.length>0);
      assert.equal(valid.facts.length,parsed.facts.length);
    } else {
      const claims=validateAnswer(parseModelJSON(result.text),[source]);
      if(item.name==='unknown')assert.equal(claims.length,0);
      else {assert.ok(claims.length>0);assert.ok(claims.some(c=>/laci/i.test(c.text)))}
    }
    const evidence={id:item.generationId,case:item.name,pass:true,model:result.model,provider:result.provider,latencyMs:result.latencyMs,inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens,traceStatus:result.tracing};
    await writeFile(recordPath,JSON.stringify({...evidence,status:'complete'}));
    completed.push({evidence,context,config:prepared.config,inputCharacters:item.system.length+item.prompt.length,outputCharacters:result.text.length});
    console.log('PHASE1_CASE',JSON.stringify(evidence));
  }
  stage='trace-readback';
  for(const item of completed) {
    const run=await client.readRun(item.evidence.id);
    assert.equal(run.id,item.evidence.id);
    assert.deepEqual(run.inputs,{input_characters:item.inputCharacters});
    assert.deepEqual(run.outputs,{success:true,latency_ms:item.evidence.latencyMs,output_characters:item.outputCharacters,usage:{input_tokens:item.evidence.inputTokens,output_tokens:item.evidence.outputTokens,total_tokens:item.evidence.inputTokens+item.evidence.outputTokens}});
    for(const [key,value] of Object.entries(safeTraceMetadata(item.context,item.config)))assert.equal(run.extra?.metadata?.[key],value);
    assert.ok(!JSON.stringify(run).includes(source.content));
    console.log('PHASE1_TRACE',JSON.stringify({id:run.id,pass:true,contentLogging:false,readback:true}));
  }
  console.log('PHASE1_ACTIVATION',JSON.stringify({pass:true,inferenceRequests:cases.length,maxOutputTokens:cases.reduce((sum,c)=>sum+c.maxOutputTokens,0),authenticatedAppFlow:'not-tested'}));
} catch {
  // Never print provider exceptions: they can contain request bodies or keys.
  console.error('PHASE1_ACTIVATION',JSON.stringify({pass:false,stage,error:'ACTIVATION_CHECK_FAILED',automaticRetries:0}));
  process.exitCode=1;
}
