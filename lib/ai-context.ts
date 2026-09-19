export type Source={label:string;text:string};
// A deliberately bounded context window, not full-manuscript semantic retrieval.
export function boundContext(sources:Source[],budget=22000){
 let remaining=budget;const included:Source[]=[];let truncated=false;
 for(const source of sources){const text=source.text.slice(0,Math.max(0,Math.min(remaining,12000)));if(text.length<source.text.length)truncated=true;if(!text)continue;included.push({label:source.label,text});remaining-=text.length}
 return {sources:included,truncated};
}
