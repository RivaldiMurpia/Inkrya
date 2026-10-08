// Research credit meter (Phase 7). Separate from the LLM quota on purpose: Tavily bills
// its own credits, so the meter reads Tavily credits recorded on research rows, not
// ai_generations row counts. Pure arithmetic — all IO (usage sums, the key) lives with
// the callers.
import {MAX_QUERIES} from './research-validation.ts';
import {TAVILY_COST_PER_SEARCH} from './tavily.ts';
import type {Environment} from './ai/models.ts';

export const DEFAULT_DAILY_CREDITS_PER_USER=24;
export const DEFAULT_MONTHLY_CREDITS=500;
// One run costs at most three searches; the check reserves the worst case, never the
// optimistic number.
export const MAX_RUN_CREDITS=MAX_QUERIES*TAVILY_COST_PER_SEARCH;

export type ResearchConfig={apiKey:string;dailyCreditsPerUser:number;monthlyCredits:number};

const positiveInt=(value:string|undefined,fallback:number,label:string):number=>{
 if(value===undefined)return fallback;
 if(!/^\d+$/.test(value.trim()))throw Error('TAVILY_CREDITS_INVALID');
 const parsed=Number(value.trim());
 if(!Number.isInteger(parsed)||parsed<1)throw Error('TAVILY_CREDITS_INVALID');
 return parsed;
};

export function researchConfig(env:Environment=process.env):ResearchConfig{
 const apiKey=env.TAVILY_API_KEY?.trim()||'';
 if(!apiKey)throw Error('TAVILY_API_KEY_MISSING');
 return {
  apiKey,
  dailyCreditsPerUser:positiveInt(env.TAVILY_DAILY_CREDITS_PER_USER,DEFAULT_DAILY_CREDITS_PER_USER,'daily'),
  monthlyCredits:positiveInt(env.TAVILY_MONTHLY_CREDITS,DEFAULT_MONTHLY_CREDITS,'monthly'),
 };
}

export type CreditDecision={allowed:boolean;reason:'ok'|'USER_LIMIT'|'GLOBAL_LIMIT';userUsed:number;userRemaining:number;globalRemaining:number;runCost:number};

// Worst-case reservation: a user with fewer credits left than one run's maximum is
// refused, so a refusal can never leave a run half-paid. The check runs before the quota
// insert and is not atomic: two simultaneous runs can both pass it, and the overshoot is
// bounded by exactly one run's worst case (MAX_RUN_CREDITS). Making it atomic would need
// a counter row with a transaction; this phase does not add one.
export function researchCreditBudget(input:{userUsed:number;globalUsed:number;config:Pick<ResearchConfig,'dailyCreditsPerUser'|'monthlyCredits'>}):CreditDecision{
 const runCost=MAX_RUN_CREDITS;
 const userRemaining=Math.max(0,input.config.dailyCreditsPerUser-input.userUsed);
 const globalRemaining=Math.max(0,input.config.monthlyCredits-input.globalUsed);
 if(globalRemaining<runCost)return {allowed:false,reason:'GLOBAL_LIMIT',userUsed:input.userUsed,userRemaining,globalRemaining,runCost};
 if(userRemaining<runCost)return {allowed:false,reason:'USER_LIMIT',userUsed:input.userUsed,userRemaining,globalRemaining,runCost};
 return {allowed:true,reason:'ok',userUsed:input.userUsed,userRemaining,globalRemaining,runCost};
}
