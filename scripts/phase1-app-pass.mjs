// App-level Phase 1 acceptance: run the four synthetic prose cases through the LIVE
// /api/ai route (action continue/rewrite) on Preview with the standing test account,
// once per accepted writer model. Same filters as the offline rounds.
// Output: qa/phase1-fewshot/app-pass-2026-10-09.jsonl — no keys, bounded prose (400 chars).
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

assert.ok(process.argv.includes('--allow-credit-usage'),'pass --allow-credit-usage');
const previewUrl='https://inkrya-oqtbo0t5j-rivaldi-murpias-projects.vercel.app';
const {cookie,token}=JSON.parse(readFileSync('.e2e_app_pass.json','utf8'));
assert.ok(cookie&&token,'bypass cookie and access token required');
const FIXTURE_PROJECT='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';

const cases=[
 {name:'app-continue-radio',action:'continue',min:55,max:70,instruction:'Lanjutkan adegan ini dalam 55–70 kata, satu paragraf, sudut pandang orang ketiga. Mira mendengar tiga ketukan melalui radio. Damar tetap tidak mengetahui tempat kunci. Jangan kenalkan tokoh baru.',selection:''},
 {name:'app-rewrite-radio',action:'rewrite',min:45,max:60,instruction:'Tulis ulang menjadi 45–60 kata, satu paragraf, sudut pandang orang ketiga, lebih tegang namun tetap alami. Pertahankan fakta bahwa kunci berada di saku Mira dan radio hanya berdengung. Jangan tambahkan tokoh atau kejadian baru.',selection:'Mira masuk ke ruang radio. Kunci kuningan ada di saku jaketnya. Radio di meja berdengung pelan.'},
 {name:'app-continue-menara',action:'continue',min:50,max:65,instruction:'Lanjutkan adegan ini dalam 50–65 kata, satu paragraf, sudut pandang orang ketiga. Nala melihat lampu keempat padam dan berusaha memberi tahu Raka. Jangan ubah tempat surat atau muncul tokoh baru.',selection:''},
 {name:'app-rewrite-surat',action:'rewrite',min:50,max:65,instruction:'Tulis ulang menjadi 50–65 kata, satu paragraf, sudut pandang orang ketiga, dengan suasana hujan yang tenang. Surat tetap di bawah bangku, belum dibaca oleh Nala atau Raka. Jangan tambahkan fakta baru.',selection:'Hujan terdengar di atap menara. Nala menunggu di dekat jendela. Raka duduk di lantai. Surat yang belum mereka baca masih di bawah bangku.'},
];
const models=['openai/gpt-oss-120b','deepseek-ai/DeepSeek-V4-Flash-0731'];

// Fetch one fixture chapter id so `continue` carries the mandatory active-chapter context.
let chapterId=null;
{
 const r=await fetch('https://ecurjotykfqiejrpczdm.supabase.co/rest/v1/chapters?project_id=eq.bbbbbbbb-bbbb-4bbb-8bbb-000000000001&select=id&order=position&limit=1',{headers:{apikey:'sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX',Authorization:`Bearer ${token}`}});
 const rows=await r.json();
 chapterId=rows[0]?.id??null;
}
assert.ok(chapterId,'fixture chapter required for continue cases');

const rows=[];
let n=0;
for(const model of models)for(const item of cases){
 n++;
 const started=Date.now();
 let row={n,model,case:item.name,status:'pending'};
 try{
  const r=await fetch(`${previewUrl}/api/ai`,{
   method:'POST',
   headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,Cookie:cookie},
   body:JSON.stringify({projectId:FIXTURE_PROJECT,chapterId,action:item.action,instruction:item.instruction,selection:item.selection,context:{chapter:item.action==='continue',bible:false,characters:false,notes:false},writerModel:model}),
   signal:AbortSignal.timeout(70000),
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(`HTTP_${r.status}:${body.error||''}`.slice(0,120));
  const prose=(body.text||'').trim();
  const words=prose?prose.split(/\s+/u).length:0;
  Object.assign(row,{status:'complete',words,expected:`${item.min}-${item.max}`,
   lengthPass:words>=item.min&&words<=item.max,
   singleParagraph:!/\n\s*\n/u.test(prose),
   noMeta:!/^(?:#{1,6}\s|(?:Berikut|Tentu|Ini adalah|Jumlah kata)\b)/iu.test(prose)&&!/\b(?:jumlah kata|word count)\s*[:：]/iu.test(prose)&&!/\(\s*\d+\s+kata\s*\)\s*$/iu.test(prose),
   noKnownLeakage:!/\b(?:inconscio|everything|reveal|headset|transmitter|both)\b/iu.test(prose)&&!/[a-z][A-Z][a-z]/u.test(prose)&&!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(prose),
   completeSentence:/[.!?…][”"']?$/u.test(prose),
   noReasoning:!/<\/?think(?:ing)?>/iu.test(prose),
   latencyMs:Date.now()-started,generationId:body.id||null,
   prose:prose.slice(0,400)});
 }catch(e){row={...row,status:'error',reason:String(e&&e.message||e).slice(0,120)}}
 rows.push(row);
 mkdirSync('qa/phase1-fewshot',{recursive:true});
 writeFileSync('qa/phase1-fewshot/app-pass-2026-10-09.jsonl',rows.map(r=>JSON.stringify(r)).join('\n'));
 console.log(`app-pass ${n}/8 ${model.split('/')[1]} ${row.case} ${row.status==='complete'?row.words+'w len='+row.lengthPass:row.reason}`);
}
const all=rows.filter(r=>r.status==='complete');
const mechPass=all.length===8&&all.every(r=>r.lengthPass&&r.singleParagraph&&r.noMeta&&r.noKnownLeakage&&r.completeSentence&&r.noReasoning);
console.log('APP_PASS_SUMMARY',JSON.stringify({mechanicalPass:mechPass,complete:all.length,humanReviewRequired:true}));
