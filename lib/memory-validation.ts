export type MemorySource={id:string;chapter_id:string;title:string;source_revision:number;chunk_index:number;content:string};
export function parseModelJSON(text:string){return JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}
export function validateAnswer(value:unknown,sources:MemorySource[]){
 const x=value as {claims?:{text?:unknown;source_id?:unknown;quote?:unknown}[]};
 if(!x||!Array.isArray(x.claims)||x.claims.length>6)throw Error('INVALID_ANSWER');
 return x.claims.map(c=>{const source=sources.find(s=>s.id===c.source_id);if(typeof c.text!=='string'||!c.text.trim()||c.text.length>1200||typeof c.quote!=='string'||c.quote.length<5||c.quote.length>1000||!source||!source.content.includes(c.quote))throw Error('UNSUPPORTED_CITATION');return {text:c.text,quote:c.quote,source}});
}
export function validateInsights(value:unknown,source:string){
 const x=value as {summary?:unknown;facts?:{claim?:unknown;quote?:unknown}[]};
 if(!x||typeof x.summary!=='string'||!x.summary.trim()||x.summary.length>3000||!Array.isArray(x.facts)||x.facts.length>8)throw Error('INVALID_INSIGHTS');
 return {summary:x.summary,facts:x.facts.filter(f=>typeof f.claim==='string'&&f.claim.length>0&&f.claim.length<=1000&&typeof f.quote==='string'&&f.quote.length>=5&&f.quote.length<=1000&&source.includes(f.quote))};
}
