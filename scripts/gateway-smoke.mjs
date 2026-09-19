import {generateText} from 'ai';
const model='inclusionai/ling-3.0-flash-vl-free';
// Synthetic QA only: no manuscript, user identifiers or keys printed.
try {
 const response=await fetch('https://ai-gateway.vercel.sh/v1/models',{signal:AbortSignal.timeout(8000)});
 const catalog=await response.json();const entry=catalog.data.find(x=>x.id===model);
 if(!entry?.pricing||Number(entry.pricing.input)!==0||Number(entry.pricing.output)!==0)throw Error('FREE_MODEL_UNAVAILABLE');
 const result=await generateText({model,reasoning:'none',maxOutputTokens:700,maxRetries:0,abortSignal:AbortSignal.timeout(25000),system:'Kamu partner penulis Indonesia. Jawab langsung dengan prosa bahasa Indonesia. Jangan tampilkan analisis, rencana, hitungan kata, atau penjelasan proses berpikir.',prompt:'Tulis satu paragraf pembuka novel bahasa Indonesia tentang seorang penulis yang menemukan surat di perpustakaan. Hanya prosa singkat.'});
 console.log('KRYA_SMOKE',JSON.stringify({ok:Boolean(result.text.trim()),model,text:result.text,usage:result.usage}));
}catch(error){console.log('KRYA_SMOKE',JSON.stringify({ok:false,model,errorType:error.name,status:error.statusCode??null,message:String(error.message).replace(/Bearer\s+\S+/g,'Bearer [redacted]').slice(0,400)}))}
