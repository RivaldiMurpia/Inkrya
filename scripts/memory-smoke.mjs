import {generateText} from 'ai';
import {MEMORY_SYSTEM,MEMORY_ASK,MEMORY_ANALYZE} from '../lib/memory-prompts.ts';
import {validateAnswer,validateInsights,parseModelJSON} from '../lib/memory-validation.ts';
import {verifyFreeModel,KRYA_MODEL} from '../lib/krya-model.ts';
const sources=[{id:'11111111-1111-4111-8111-111111111111',chapter_id:'22222222-2222-4222-8222-222222222222',title:'QA Bab 1',source_revision:1,chunk_index:0,content:'Aurel bekerja di kantor BUMN di Duri. Kenan menghubungi Aurel untuk jastip skincare.'}];
try{
 await verifyFreeModel();
 for(const test of [{name:'supported',question:'Di mana Aurel bekerja?'},{name:'unknown',question:'Apa warna mobil Aurel?'},{name:'extraction',question:null}]){
 const result=await generateText({model:KRYA_MODEL,reasoning:'none',maxRetries:0,maxOutputTokens:900,abortSignal:AbortSignal.timeout(20000),system:MEMORY_SYSTEM+(test.name==='extraction'?MEMORY_ANALYZE:MEMORY_ASK),prompt:JSON.stringify({question:test.question,sources})});
 const parsed=parseModelJSON(result.text);
 if(test.name==='extraction'){const data=validateInsights(parsed,sources[0].content);if(!data.facts.length)throw Error('NO_VALID_FACTS');console.log('MEMORY_EVAL',JSON.stringify({case:test.name,pass:true,facts:data.facts.length}))}
 else{const claims=validateAnswer(parsed,sources);if(test.name==='supported'&&!claims.length||test.name==='unknown'&&claims.length)throw Error('EVALUATION_FAILED_'+test.name);console.log('MEMORY_EVAL',JSON.stringify({case:test.name,pass:true,claims:claims.length}))}
 }
}catch(e){console.log('MEMORY_EVAL',JSON.stringify({pass:false,error:e.name,message:String(e.message).slice(0,180)}));process.exitCode=1}
