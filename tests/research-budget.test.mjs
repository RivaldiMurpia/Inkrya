import test from 'node:test';
import assert from 'node:assert/strict';

const {researchConfig,researchCreditBudget,DEFAULT_DAILY_CREDITS_PER_USER,DEFAULT_MONTHLY_CREDITS,MAX_RUN_CREDITS}=await import('../lib/research-budget.ts');

test('MAX_RUN_CREDITS is 3 — the worst case the reservation must hold',()=>{
 assert.equal(MAX_RUN_CREDITS,3);
});

test('defaults are 24 daily and 500 monthly when the env vars are unset',()=>{
 const config=researchConfig({TAVILY_API_KEY:'tvly-k'});
 assert.equal(config.apiKey,'tvly-k');
 assert.equal(config.dailyCreditsPerUser,DEFAULT_DAILY_CREDITS_PER_USER);
 assert.equal(config.monthlyCredits,DEFAULT_MONTHLY_CREDITS);
 assert.equal(DEFAULT_DAILY_CREDITS_PER_USER,24);
 assert.equal(DEFAULT_MONTHLY_CREDITS,500);
});

test('a valid numeric override is honoured',()=>{
 const config=researchConfig({TAVILY_API_KEY:'k',TAVILY_DAILY_CREDITS_PER_USER:'10',TAVILY_MONTHLY_CREDITS:'1000'});
 assert.equal(config.dailyCreditsPerUser,10);
 assert.equal(config.monthlyCredits,1000);
});

test('a blank, zero, negative, or non-numeric override throws TAVILY_CREDITS_INVALID',()=>{
 for(const bad of ['','0','-5','banyak','1.5']){
  assert.throws(()=>researchConfig({TAVILY_API_KEY:'k',TAVILY_DAILY_CREDITS_PER_USER:bad}),/TAVILY_CREDITS_INVALID/,bad);
  assert.throws(()=>researchConfig({TAVILY_API_KEY:'k',TAVILY_MONTHLY_CREDITS:bad}),/TAVILY_CREDITS_INVALID/,bad);
 }
});

test('a missing or blank key throws TAVILY_API_KEY_MISSING',()=>{
 assert.throws(()=>researchConfig({}),/TAVILY_API_KEY_MISSING/);
 assert.throws(()=>researchConfig({TAVILY_API_KEY:'   '}),/TAVILY_API_KEY_MISSING/);
});

const config={dailyCreditsPerUser:24,monthlyCredits:500};

test('ok with exact remaining when both meters have room for a worst-case run',()=>{
 const d=researchCreditBudget({userUsed:20,globalUsed:497,config});
 assert.deepEqual(d,{allowed:true,reason:'ok',userUsed:20,userRemaining:4,globalRemaining:3,runCost:3});
});

test('USER_LIMIT when the user remaining is below the run cost',()=>{
 const d=researchCreditBudget({userUsed:22,globalUsed:100,config});
 assert.deepEqual(d,{allowed:false,reason:'USER_LIMIT',userUsed:22,userRemaining:2,globalRemaining:400,runCost:3});
});

test('GLOBAL_LIMIT when the global remaining is below the run cost',()=>{
 const d=researchCreditBudget({userUsed:0,globalUsed:498,config});
 assert.deepEqual(d,{allowed:false,reason:'GLOBAL_LIMIT',userUsed:0,userRemaining:24,globalRemaining:2,runCost:3});
});

test('the reservation is worst-case: 2 credits left refuses a run that may cost 3',()=>{
 const d=researchCreditBudget({userUsed:22,globalUsed:0,config});
 assert.equal(d.allowed,false);
 assert.equal(d.reason,'USER_LIMIT');
 // and at exactly the boundary: remaining == runCost passes
 const edge=researchCreditBudget({userUsed:21,globalUsed:497,config});
 assert.equal(edge.allowed,true);
 assert.equal(edge.userRemaining,3);
});

test('the RPC payload is normalised whether PostgREST returns an array or a single object',async()=>{
 // PostgREST serialises a set-returning function as an array even for one row; reading the
 // row as a plain object silently yields 0 and disables the meter entirely.
 const {creditUsageRow}=await import('../lib/research-budget.ts');
 assert.deepEqual(creditUsageRow([{user_credits_24h:28,global_credits_month:31}]),{userUsed:28,globalUsed:31});
 assert.deepEqual(creditUsageRow({user_credits_24h:3,global_credits_month:3}),{userUsed:3,globalUsed:3});
 assert.deepEqual(creditUsageRow([]),{userUsed:0,globalUsed:0});
 assert.deepEqual(creditUsageRow(null),{userUsed:0,globalUsed:0});
 assert.deepEqual(creditUsageRow('banyak'),{userUsed:0,globalUsed:0});
 // A string numeric from PostgREST (bigint is serialised as a string) still counts.
 assert.deepEqual(creditUsageRow([{user_credits_24h:'28',global_credits_month:'31'}]),{userUsed:28,globalUsed:31});
});
