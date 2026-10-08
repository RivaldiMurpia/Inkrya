// SERVER ONLY — Tavily search client (Phase 7). Bounded: basic depth pinned (1 credit per
// search; `auto_parameters` would otherwise silently flip to advanced and double the bill),
// small result count, per-call timeout. The API key never leaves the server and never
// appears in an error message.
export const TAVILY_ENDPOINT='https://api.tavily.com/search';
export const TAVILY_COST_PER_SEARCH=1;
export const MAX_RESULTS_PER_QUERY=5;
export const QUERY_MAX_LENGTH=200;
const CONTENT_CAP=2000;

export type TavilyResult={title:string;url:string;content:string;score:number};

export async function searchTavily(query:string,options:{apiKey:string;maxResults?:number;timeoutMs?:number;signal?:AbortSignal;request?:typeof fetch}):Promise<TavilyResult[]>{
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 const trimmed=query.trim();
 if(!trimmed||trimmed.length>QUERY_MAX_LENGTH)throw Error('TAVILY_QUERY_INVALID');
 const request=options.request??fetch;
 const timeout=options.timeoutMs??15000;
 let response:Response;
 try{
  // AbortSignal.any combines the per-call deadline with the caller's request signal.
  const timed=AbortSignal.timeout(timeout);
  const signal=options.signal?AbortSignal.any([timed,options.signal]):timed;
  response=await request(TAVILY_ENDPOINT,{
   method:'POST',
   headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.apiKey}`},
   body:JSON.stringify({query:trimmed,search_depth:'basic',max_results:options.maxResults??MAX_RESULTS_PER_QUERY,include_answer:false,include_raw_content:false}),
   redirect:'error',
   cache:'no-store',
   signal,
  });
 }catch{
  throw Error('TAVILY_UNAVAILABLE');
 }
 if(!response.ok)throw Error('TAVILY_UNAVAILABLE');
 let body:unknown;
 try{body=await response.json()}catch{throw Error('TAVILY_INVALID_RESPONSE')}
 const b=body as {results?:unknown}|null;
 if(!b||typeof b!=='object'||!Array.isArray(b.results))throw Error('TAVILY_INVALID_RESPONSE');
 return b.results.flatMap((raw:unknown)=>{
  const r=raw as Record<string,unknown>|null;
  if(!r||typeof r!=='object')return [];
  if(typeof r.title!=='string'||!r.title||typeof r.url!=='string'||!r.url||typeof r.score!=='number'||!Number.isFinite(r.score))return [];
  return [{title:r.title,url:r.url,content:typeof r.content==='string'?r.content.slice(0,CONTENT_CAP).trim():'',score:r.score}];
 });
}
