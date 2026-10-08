// Phase 8 evaluation runner (headless). Two arms, one grader.
//
//   pipeline arm  — drives the live Preview API with the standing test account:
//                   /api/memory {action:'ask'} for question cases, /api/write for scene cases.
//   baseline arm  — calls Nebius DIRECTLY with no retrieved story context, for the cases
//                   marked arm:'both'. Write baselines are then judged by the SAME guardian
//                   the pipeline uses, so the comparison is not rigged by two detectors.
//
// Usage:
//   node --env-file=.env.local scripts/eval-runner.mjs --arm pipeline
//   node --env-file=.env.local scripts/eval-runner.mjs --arm both
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, INKRYA_PREVIEW_URL (or --url), EVAL_EMAIL, EVAL_PASSWORD,
//      NEBIUS_API_KEY for the baseline arm. Nothing here prints a key, a token, or full prose.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {gradeCase} from '../lib/eval-grading.ts';

const here=dirname(fileURLToPath(import.meta.url));
const root=join(here,'..');
const FIXTURE_PROJECT='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const SUPABASE_URL='https://ecurjotykfqiejrpczdm.supabase.co';
const ANON_KEY='sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX';

function arg(name,fallback){
 const index=process.argv.indexOf(`--${name}`);
 return index>=0?process.argv[index+1]:fallback;
}

const arm=arg('arm','pipeline');
assert.ok(arm==='pipeline'||arm==='both','--arm must be pipeline or both');

const previewUrl=(arg('url',process.env.INKRYA_PREVIEW_URL)||'').replace(/\/$/,'');
assert.ok(/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(previewUrl),'INKRYA_PREVIEW_URL must be a vercel.app deployment');

const email=process.env.EVAL_EMAIL??'e2e-analyze@example.com';
const password=process.env.EVAL_PASSWORD;
assert.ok(password,'EVAL_PASSWORD is required');

const cases=readFileSync(join(root,'qa','eval','last-signal-eval.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));

// Bypass cookie for the protected preview. Set once from the shareable link the operator mints.
const bypass=arg('bypass',process.env.VERCEL_BYPASS_SECRET)??'';
const previewHeaders=bypass?{Cookie:`_vercel_jwt=${bypass}`}:{};

async function signIn(){
 const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
  method:'POST',
  headers:{apikey:ANON_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({email,password}),
 });
 if(!response.ok)throw Error('EVAL_SIGNIN_FAILED');
 const {access_token}=await response.json();
 if(!access_token)throw Error('EVAL_SIGNIN_FAILED');
 return access_token;
}

// Chapter titles are needed to turn the API's citation chapter_ids into the dataset's labels.
async function chapterTitles(token){
 const response=await fetch(`${SUPABASE_URL}/rest/v1/chapters?project_id=eq.${FIXTURE_PROJECT}&select=id,title`,{
  headers:{apikey:ANON_KEY,Authorization:`Bearer ${token}`},
 });
 if(!response.ok)throw Error('EVAL_CHAPTERS_FAILED');
 return new Map((await response.json()).map(row=>[row.id,row.title]));
}

async function postJson(path,token,body){
 const response=await fetch(`${previewUrl}${path}`,{
  method:'POST',
  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...previewHeaders},
  body:JSON.stringify(body),
 });
 const text=await response.text();
 return {status:response.status,text};
}

async function runAsk(item,token,titles){
 const {status,text}=await postJson('/api/memory',token,{projectId:FIXTURE_PROJECT,action:'ask',question:item.input.question});
 if(status!==200)return {kind:'ask',status:'',citations:[],answer:'',error:`HTTP_${status}`};
 const body=JSON.parse(text);
 return {
  kind:'ask',status:body.status,answer:body.answer??'',
  citations:(body.citations??[]).map(c=>({chapter_id:c.chapter_id,title:titles.get(c.chapter_id)??c.title??''})),
 };
}

// The write route streams NDJSON; only the final result line matters.
function lastResultLine(text){
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
 for(let i=lines.length-1;i>=0;i--){
  try{const parsed=JSON.parse(lines[i]);if(parsed.type==='result')return parsed}catch{/* keep scanning */}
 }
 return null;
}

async function runWrite(item,token){
 const {status,text}=await postJson('/api/write',token,{projectId:FIXTURE_PROJECT,instruction:item.input.instruction});
 // The route returns NDJSON but does not set a streaming status; a 4xx/5xx carries JSON.
 if(status!==200)return {kind:'write',findings:[],repairAttempts:0,unresolved:0,draft:'',error:`HTTP_${status}`};
 const result=lastResultLine(text);
 if(!result)return {kind:'write',findings:[],repairAttempts:0,unresolved:0,draft:'',error:'NO_RESULT_LINE'};
 return {
  kind:'write',
  findings:result.findings??result.issues??[],
  repairAttempts:result.repairAttempts??0,
  unresolved:(result.issues??[]).length,
  draft:result.draft??'',
 };
}

async function baselineAsk(item){
 // No story context at all: the bare question, the way a generic assistant would see it.
 const answer=await baselineCall(item.input.question,'jawab singkat dalam bahasa Indonesia.');
 return {kind:'ask',status:answer?null:'',citations:[],answer:answer??'',...(!answer?{error:'BASELINE_FAILED'}:{})};
}

async function baselineWrite(item){
 const draft=await baselineCall(item.input.instruction,'tulis adegan fiksi dalam bahasa Indonesia, satu paragraf.');
 if(!draft)return {kind:'write',findings:[],repairAttempts:0,unresolved:0,draft:'',error:'BASELINE_FAILED'};
 // Judged by the SAME guardian the pipeline uses (a single continuity call over the fixture's
 // real context), so a baseline that violates canon is measured, not assumed.
 const findings=await guardianCall(item.input.instruction,draft);
 if(findings===null)return {kind:'write',findings:[],repairAttempts:0,unresolved:0,draft,error:'BASELINE_GUARDIAN_FAILED'};
 return {kind:'write',findings,repairAttempts:0,unresolved:findings.length,draft};
}

async function loadNebius(){
 const {generateText}=await import('ai');
 const {createOpenAICompatible}=await import('@ai-sdk/openai-compatible');
 const {NEBIUS_BASE_URL,resolveModelConfig}=await import('../lib/ai/models.ts');
 const key=process.env.NEBIUS_API_KEY;
 assert.ok(key,'NEBIUS_API_KEY is required for the baseline arm');
 const provider=createOpenAICompatible({name:'nebius',baseURL:NEBIUS_BASE_URL,apiKey:key});
 const model=provider.chatModel(resolveModelConfig('writer',{...process.env}).id);
 return {generateText,model};
}

let nebius=null;
async function baselineCall(prompt,system){
 nebius??=await loadNebius();
 const result=await nebius.generateText({model:nebius.model,system,prompt,maxOutputTokens:700,maxRetries:0,abortSignal:AbortSignal.timeout(35000)});
 return result.text.trim();
}

// The pipeline's guardian, invoked standalone for baseline drafts. Same prompt, same
// validator, same context package — the identical detector.
async function guardianCall(instruction,draft){
 nebius??=await loadNebius();
 const {GUARDIAN_SYSTEM}=await import('../lib/agent-prompts.ts');
 const {validateGuardianIssues,parseModelJSON}=await import('../lib/agent-validation.ts');
 const context=JSON.parse(readFileSync(join(root,'qa','eval','guardian-context.json'),'utf8'));
 const prompt=JSON.stringify({instruction,scene_story_time:null,draft,evidence:context});
 try{
  const text=await baselineCall(prompt,GUARDIAN_SYSTEM);
  return validateGuardianIssues(parseModelJSON(text),context);
 }catch{return null}
}

const token=await signIn();
const titles=await chapterTitles(token);
const results=[];

for(const item of cases){
 const observation=item.input.question?await runAsk(item,token,titles):await runWrite(item,token);
 results.push({id:item.id,category:item.category,arm:'pipeline',observation,rubric:gradeCase(item.expected,observation)});
 console.log(`eval pipeline ${item.id} ran=${observation.error?'no':'yes'}`);
 // Stay above the 10-second spinner between writes; the test account is exempt but the
 // runner must not depend on that exemption.
 if(item.input.instruction)await new Promise(resolve=>setTimeout(resolve,1500));
}

if(arm==='both'){
 for(const item of cases.filter(c=>c.arm==='both')){
  const observation=item.input.question?await baselineAsk(item):await baselineWrite(item);
  results.push({id:item.id,category:item.category,arm:'baseline',observation,rubric:gradeCase(item.expected,observation)});
  console.log(`eval baseline ${item.id} ran=${observation.error?'no':'yes'}`);
 }
}

const byCategory={};
for(const row of results){
 const key=`${row.category}:${row.arm}`;
 byCategory[key]??={cases:0,ran:0,passed:0,applicable:0};
 byCategory[key].cases++;
 if(row.rubric.ran)byCategory[key].ran++;
 byCategory[key].passed+=row.rubric.passed;
 byCategory[key].applicable+=row.rubric.applicable;
}
const summary={
 by_category:byCategory,
 totals:{cases:results.length,ran:results.filter(r=>r.rubric.ran).length,errored:results.filter(r=>r.observation.error).length},
 arm,
 deployment:previewUrl,
};

// Nothing here may carry a key, a token, or more than a bounded draft preview.
const payload={
 generated_at:new Date().toISOString(),
 fixture_project_id:FIXTURE_PROJECT,
 ...summary,
 cases:results.map(row=>({...row,observation:row.observation.kind==='write'?{...row.observation,draft:row.observation.draft.slice(0,400)}:row.observation})),
};
const stamp=new Date().toISOString().slice(0,10);
const outPath=join(root,'qa','eval',`results-${stamp}${arm==='both'?'-both':''}.json`);
writeFileSync(outPath,JSON.stringify(payload,null,1));
console.log('EVAL_DONE',JSON.stringify({out:outPath,...summary.totals}));
