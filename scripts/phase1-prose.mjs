import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareModel} from '../lib/ai/provider.ts';
import {generateKryaText} from '../lib/ai/generate.ts';
import {WRITING_SYSTEM,outputTokensForWriting} from '../lib/ai/writing-prompts.ts';

// Four calls maximum in this follow-up: the before/after pair was recorded by
// the preceding diagnostic deployment. Re-evaluate the same four fixed cases.
// Fixed synthetic text only; output is logged solely for human prose review.
const cases=[
 {name:'continue-radio',action:'continue',min:55,max:70,instruction:'Lanjutkan adegan ini dalam 55–70 kata, satu paragraf, sudut pandang orang ketiga. Mira mendengar tiga ketukan melalui radio. Damar tetap tidak mengetahui tempat kunci. Jangan kenalkan tokoh baru.',selection:'',context:'Mira tiba di Stasiun Aruna pada pukul tujuh malam. Ia menyimpan kunci kuningan di laci meja radio. Damar belum mengetahui lokasi kunci itu.'},
 {name:'continue-menara',action:'continue',min:50,max:65,instruction:'Lanjutkan adegan ini dalam 50–65 kata, satu paragraf, sudut pandang orang ketiga. Nala melihat lampu keempat padam dan berusaha memberi tahu Raka. Jangan ubah tempat surat atau muncul tokoh baru.',selection:'',context:'Nala dan Raka berjaga di menara pelabuhan. Empat lampu di ujung dermaga masih menyala. Surat untuk penjaga kapal tersimpan di bawah bangku dekat pintu menara.'},
 {name:'rewrite-radio',action:'rewrite',min:45,max:60,instruction:'Tulis ulang menjadi 45–60 kata, satu paragraf, sudut pandang orang ketiga, lebih tegang namun tetap alami. Pertahankan fakta bahwa kunci berada di saku Mira dan radio hanya berdengung. Jangan tambahkan tokoh atau kejadian baru.',selection:'Mira masuk ke ruang radio. Kunci kuningan ada di saku jaketnya. Radio di meja berdengung pelan.',context:'Mira sendirian di ruang radio Stasiun Aruna. Kunci kuningan berada di saku jaketnya.'},
 {name:'rewrite-surat',action:'rewrite',min:50,max:65,instruction:'Tulis ulang menjadi 50–65 kata, satu paragraf, sudut pandang orang ketiga, dengan suasana hujan yang tenang. Surat tetap di bawah bangku, belum dibaca oleh Nala atau Raka. Jangan tambahkan fakta baru.',selection:'Hujan terdengar di atap menara. Nala menunggu di dekat jendela. Raka duduk di lantai. Surat yang belum mereka baca masih di bawah bangku.',context:'Di menara pelabuhan, Nala dan Raka belum membaca surat yang tersimpan di bawah bangku.'},
];

let stage='configuration';
try{
 assert.ok(process.argv.includes('--allow-credit-usage'));
 assert.equal(process.env.VERCEL_ENV,'preview');
 assert.equal(process.env.VERCEL_GIT_COMMIT_REF,'hackathon/nebius-2026');
 assert.equal(process.env.VERCEL_GIT_COMMIT_SHA,process.env.INKRYA_VERIFY_PHASE1_COMMIT);
 assert.equal(process.env.INKRYA_AI_PROVIDER,'nebius');
 // Only this synthetic build diagnostic disables tracing. Application tracing
 // stays enabled and already passed its separate persisted-run readback gate.
 process.env.LANGSMITH_TRACING='false';
 const prepared=await prepareModel('writer');
 assert.equal(prepared.config.id,'nvidia/nemotron-3-super-120b-a12b');
 const records=await mkdtemp(join(tmpdir(),'inkrya-prose-'));
 let failures=0;
 for(const item of cases){
  stage=item.name;
  const id=randomUUID();
  const path=join(records,id+'.json');
  await writeFile(path,JSON.stringify({id,case:item.name,version:'after-v3',status:'pending'}),{mode:0o600});
  const prompt=JSON.stringify({action:item.action,instruction:item.instruction,selected_text:item.selection,context:[{label:'Bab: synthetic (versi 1)',text:item.context}],context_truncated:false});
  const result=await generateKryaText(prepared,{system:WRITING_SYSTEM,prompt,maxOutputTokens:outputTokensForWriting(item.action,item.instruction,true),timeoutMs:35000},{generationId:id,projectId:'inkrya-public-synthetic-prose',sourceCount:1,workflow:'provider-smoke'});
  const text=result.text.trim();
  const words=text.split(/\s+/u).length;
  const singleParagraph=!/\n\s*\n/u.test(text);
  const noMeta=!/^(?:#{1,6}\s|(?:Berikut|Tentu|Ini adalah|Jumlah kata)\b)/iu.test(text)&&!/\b(?:jumlah kata|word count)\s*[:：]/iu.test(text)&&!/\(\s*\d+\s+kata\s*\)\s*$/iu.test(text);
  const noKnownLeakage=!/\b(?:inconscio|everything|reveal|headset|transmitter|both)\b/iu.test(text)&&!/[a-z][A-Z][a-z]/u.test(text)&&!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
  const completeSentence=/[.!?…][”"']?$/u.test(text);
  const lengthPass=words>=item.min&&words<=item.max;
  const objectivePass=singleParagraph&&noMeta&&noKnownLeakage&&completeSentence&&lengthPass;
  if(!objectivePass)failures++;
  const metrics={case:item.name,version:'after-v3',id,words,expected:`${item.min}-${item.max}`,singleParagraph,noMeta,noKnownLeakage,completeSentence,lengthPass,objectivePass,latencyMs:result.latencyMs,inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens};
  await writeFile(path,JSON.stringify({...metrics,status:'complete'}));
  console.log('PHASE1_PROSE_CASE',JSON.stringify(metrics));
  console.log('PHASE1_PROSE_OUTPUT',JSON.stringify({case:item.name,version:'after-v3',text}));
 }
 console.log('PHASE1_PROSE_COMPARISON',JSON.stringify({syntheticCases:cases.length,inferenceRequests:cases.length,outputTokenCeiling:cases.reduce((sum,item)=>sum+outputTokensForWriting(item.action,item.instruction,true),0),candidateObjectiveFailures:failures,manualReviewRequired:true,comparedTo:'dpl_87vsgnhwbNpAKRLmYt8f6pPfbdoq'}));
 if(failures)process.exitCode=1;
}catch{
 // Provider errors can include request content/keys. Never print raw exceptions.
 console.error('PHASE1_PROSE_COMPARISON',JSON.stringify({pass:false,stage,reason:'DIAGNOSTIC_FAILED',automaticRetries:0}));
 process.exitCode=1;
}
