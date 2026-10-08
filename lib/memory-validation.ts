export type MemorySource={id:string;chapter_id:string;title:string;story_time?:string|null;source_revision:number;chunk_index:number;content:string};
export type AnswerStatus='ANSWERED'|'NOT_ESTABLISHED'|'NO_EVIDENCE'|'CONTRADICTION';
export type ValidatedClaim={text:string;quote:string;source:MemorySource};
export function parseModelJSON(text:string){
 // Models occasionally emit raw control characters inside string literals (a newline in
 // the middle of a quote). Strip them before parsing; JSON.parse otherwise fails hard.
 const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').replace(/[\u0000-\u001F]/g,' ');
 // Some models append commentary after the JSON object; keep only the first balanced value.
 const trimmed=cleaned.slice(cleaned.search(/[[{]/));
 let depth=0,inString=false,escaped=false,end=-1;
 for(let i=0;i<trimmed.length;i++){
  const ch=trimmed[i];
  if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue}
  if(ch==='"')inString=true;
  else if(ch==='{'||ch==='[')depth++;
  else if(ch==='}'||ch===']'){depth--;if(!depth){end=i+1;break}}
 }
 const value=end>0?trimmed.slice(0,end):trimmed;
 try{return JSON.parse(value)}
 catch{
  // Common model defect: a trailing comma before a closing brace/bracket. Remove them
  // outside string literals and retry once; a still-invalid body throws as before.
  let out='',inStr=false,esc=false;
  for(let i=0;i<value.length;i++){
   const ch=value[i];
   if(inStr){out+=ch;if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}
   if(ch==='"'){inStr=true;out+=ch;continue}
   if(ch===','){let j=i+1;while(j<value.length&&/\s/.test(value[j]))j++;if(value[j]==='}'||value[j]===']')continue}
   out+=ch;
  }
  return JSON.parse(out);
 }
}
const STATUS_VALUES:AnswerStatus[]=['ANSWERED','NOT_ESTABLISHED','NO_EVIDENCE','CONTRADICTION'];

// Contract: ANSWERED requires ≥1 supported claim; any other status returns [] claims.
// A model that claims ANSWERED but supplies no valid claims is downgraded to NOT_ESTABLISHED.
//
// Per-claim failure policy (Phase 8 finding): the model occasionally paraphrases its own
// quote, and ONE such claim used to throw UNSUPPORTED_CITATION, discarding the whole answer
// server-side (a deterministic 503). Now a paraphrased quote is re-anchored to the real span
// in its source — the rendered citation stays truthful because the quote is replaced by an
// exact substring — and only a claim with no anchor at all is dropped. Structural garbage
// (wrong shape, >6 claims) still throws: that is not a partial answer.
function reAnchor(quote:string,content:string):string|null{
 // Longest window of the quote that is still an exact substring, shrunk from the end first
 // then the start — cheap (no alignment tables) and sufficient for a one-word paraphrase.
 if(content.includes(quote))return quote;
 for(let end=quote.length;end>=20;end--){
  const head=quote.slice(0,end);
  if(content.includes(head))return head;
 }
 for(let start=0;start<=quote.length-20;start++){
  const tail=quote.slice(start);
  if(content.includes(tail))return tail;
 }
 return null;
}

export function validateAnswer(value:unknown,sources:MemorySource[]):{claims:ValidatedClaim[];status:AnswerStatus}{
 const x=value as {claims?:{text?:unknown;source_id?:unknown;quote?:unknown}[];status?:unknown};
 if(!x||typeof x!=='object'||!Array.isArray(x.claims)||x.claims.length>6)throw Error('INVALID_ANSWER');
 const raw:ValidatedClaim[]=[];
 for(const c of x.claims){
  if(typeof c!=='object'||c===null)continue;
  const source=sources.find(s=>s.id===c.source_id);
  if(typeof c.text!=='string'||!c.text.trim()||c.text.length>1200||typeof c.quote!=='string'||c.quote.length<5||c.quote.length>1000||!source)continue;
  if(source.content.includes(c.quote)){raw.push({text:c.text,quote:c.quote,source});continue}
  // Paraphrase: re-anchor to the real span. No anchor → the claim is dropped, not fatal.
  const anchored=reAnchor(c.quote,source.content);
  if(anchored)raw.push({text:c.text,quote:anchored,source});
 }
 const requested=typeof x.status==='string'&&(STATUS_VALUES as string[]).includes(x.status)?x.status as AnswerStatus:'ANSWERED';
 if(!raw.length)return {claims:[],status:requested==='ANSWERED'?'NOT_ESTABLISHED':requested};
 if(requested!=='ANSWERED'&&requested!=='CONTRADICTION')return {claims:[],status:requested};
 return {claims:raw,status:requested};
}
const SPO={subject:500,predicate:200,object:500} as const;
function spo(value:unknown,field:keyof typeof SPO,max:number):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 return value.trim().slice(0,max);
}
// Extended insights: facts gain optional SPO + confidence; optional events and knowledge.
// Any entry whose quote is not an exact substring of the chunk is silently dropped.
// Events without a story_time are dropped — the model must never invent a date.
export function validateInsights(value:unknown,source:string){
 const x=value as {
  summary?:unknown;
  facts?:{claim?:unknown;quote?:unknown;subject?:unknown;predicate?:unknown;object?:unknown;confidence?:unknown}[];
  events?:{story_time?:unknown;title?:unknown;event_type?:unknown;quote?:unknown;description?:unknown}[];
  knowledge?:{character?:unknown;fact_key?:unknown;statement?:unknown;knows?:unknown;story_time?:unknown;quote?:unknown}[];
 };
 if(!x||typeof x.summary!=='string'||!x.summary.trim()||x.summary.length>3000||!Array.isArray(x.facts)||x.facts.length>12)throw Error('INVALID_INSIGHTS');
 const factOk=(c:{claim?:unknown;quote?:unknown})=>typeof c.claim==='string'&&c.claim.length>0&&c.claim.length<=1000&&typeof c.quote==='string'&&c.quote.length>=5&&c.quote.length<=1000&&source.includes(c.quote);
 const facts=x.facts.slice(0,8).filter(factOk).map(f=>({
  claim:f.claim as string,quote:f.quote as string,
  subject:spo(f.subject,'subject',500),predicate:spo(f.predicate,'predicate',200),object:spo(f.object,'object',500),
  confidence:typeof f.confidence==='number'&&Number.isFinite(f.confidence)?Math.min(1,Math.max(0,f.confidence)):null,
 }));
 const EVENT_TYPES=['event','birth','death','discovery','meeting','conflict','reveal','other'];
 const events=(x.events??[]).slice(0,8).filter(e=>
  typeof e.title==='string'&&e.title.length>0&&e.title.length<=300
  &&typeof e.story_time==='string'&&e.story_time.length>0&&e.story_time.length<=100
  &&typeof e.quote==='string'&&e.quote.length>=5&&e.quote.length<=1000&&source.includes(e.quote)
  &&(typeof e.event_type!=='string'||EVENT_TYPES.includes(e.event_type))
 ).map(e=>({
  story_time:e.story_time as string,title:e.title as string,
  event_type:typeof e.event_type==='string'?e.event_type:'event',
  description:typeof e.description==='string'?e.description.slice(0,1000):'',
  quote:e.quote as string,
 }));
 const knowledge=(x.knowledge??[]).slice(0,8).filter(k=>
  typeof k.character==='string'&&k.character.length>0&&k.character.length<=200
  &&typeof k.statement==='string'&&k.statement.length>0&&k.statement.length<=1000
  &&typeof k.quote==='string'&&k.quote.length>=5&&k.quote.length<=1000&&source.includes(k.quote)
 ).map(k=>({
  character:k.character as string,
  fact_key:typeof k.fact_key==='string'&&k.fact_key.trim()?k.fact_key.trim().slice(0,200):(k.statement as string).slice(0,200),
  statement:k.statement as string,
  knows:k.knows===false?false:true,
  story_time:typeof k.story_time==='string'&&k.story_time.length>0&&k.story_time.length<=100?k.story_time:null,
  quote:k.quote as string,
 }));
 return {summary:x.summary,facts,events,knowledge};
}
