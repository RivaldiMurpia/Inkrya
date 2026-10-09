// Build the Toloka A/B preference dataset from the accepted Phase 1 prose runs.
//
// Pairs the gpt-oss-120b and DeepSeek-V4-Flash drafts for the same synthetic case,
// randomizes which model appears left/right (seeded, reproducible), and emits the
// JSON rows a Toloka batch expects — plus a sidecar manifest mapping each row back
// to the real models so the votes can be counted after export.
//
// Source runs: qa/phase1-fewshot/round4 (G), round5 (J), round6 (G2/J2). The
// app-pass prose is 400-char truncated and is NOT used here — a truncated sample
// would unfairly bias any human judgment. The story_context shown to evaluators is
// a neutral paraphrase of the seeded facts, NOT the acceptance instruction: the
// instruction names length targets, and length must not bias a preference vote.
//
// Output:
//   qa/toloka/ab-dataset.json       — {items:[{id,story_context,text_left,text_right}],manifest:{id:{left,right}}}
//   Human output spec (interface-side): choice ∈ {left,right,equal}, plus the three
//   demo-spec §15 questions answered per side.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root='qa/phase1-fewshot';
function read(file){return readFileSync(`${root}/${file}`,'utf8').trim().split('\n').map(JSON.parse)}

const r4=read('round4-2026-10-09.jsonl'),r5=read('round5-2026-10-09.jsonl'),r6=read('round6-2026-10-09.jsonl');
const G=[...r4.filter(r=>r.config==='G-gpt-oss-temp0.2'),...r6.filter(r=>r.config==='G2-gpt-oss-temp0.2-run2')];
const D=[...r5.filter(r=>r.config==='J-deepseek-v4-flash'),...r6.filter(r=>r.config==='J2-deepseek-v4-flash-run2')];
assert(G.length===8&&D.length===8);

// Seeded shuffle: deterministic left/right assignment per pair (no Math.random).
function seededBit(seed){const h=createHash('sha256').update(seed).digest();return h[0]&1}

const CASES=[
 {key:'continue-radio',context:'Mira tiba di Stasiun Aruna pada pukul tujuh malam. Ia menyimpan kunci kuningan di laci meja radio. Damar belum mengetahui lokasi kunci itu. Mira mendengar tiga ketukan melalui radio.'},
 {key:'rewrite-radio',context:'Mira sendirian di ruang radio Stasiun Aruna. Kunci kuningan berada di saku jaketnya. Radio di meja hanya berdengung pelan.'},
 {key:'continue-menara',context:'Nala dan Raka berjaga di menara pelabuhan. Lampu keempat di ujung dermaga padam, dan Nala berusaha memberi tahu Raka. Surat untuk penjaga kapal tetap di bawah bangku dekat pintu menara.'},
 {key:'rewrite-surat',context:'Hujan terdengar di atap menara pelabuhan. Nala menunggu di dekat jendela, Raka duduk di lantai, dan surat yang belum mereka baca masih di bawah bangku.'},
];
const MODEL_A={id:'openai/gpt-oss-120b',label:'gpt-oss-120b',rows:G};
const MODEL_B={id:'deepseek-ai/DeepSeek-V4-Flash-0731',label:'DeepSeek-V4-Flash-0731',rows:D};

const items=[],manifest={};
for(const run of [0,1]){ // run 0 = first pass, run 1 = stability repeat
 for(const c of CASES){
  // Index by occurrence, not find(): run 0 and run 1 must draw DIFFERENT drafts of the
  // same case, or the two rows would be byte-identical pairs.
  const pick=(rows)=>{const hits=rows.filter(r=>r.case===c.key&&r.prose.length>0&&r.status==='complete');return hits[run]};
  const a=pick(MODEL_A.rows),b=pick(MODEL_B.rows);
  if(!a||!b)continue;
  const id=`pair-${run}-${c.key}`;
  const leftIsA=seededBit(id)===1;
  const item={
   id,
   story_context:c.context,
   text_left:(leftIsA?a:b).prose,
   text_right:(leftIsA?b:a).prose,
  };
  items.push(item);
  manifest[id]={
   case:c.key,run,
   left:leftIsA?MODEL_A.label:MODEL_B.label,
   right:leftIsA?MODEL_B.label:MODEL_A.label,
  };
 }
}
assert(items.length===8,`expected 8 pairs, got ${items.length}`);

// Cut the story context the way the experiment ran: short evidence block, third person.
mkdirSync('qa/toloka',{recursive:true});
writeFileSync('qa/toloka/ab-dataset.json',JSON.stringify({items,manifest},null,1));
console.log('DATASET_BUILT',JSON.stringify({pairs:items.length,
 leftSplit:Object.values(manifest).filter(m=>m.left==='gpt-oss-120b').length+'/8 gpt-oss-left',
 sizes:items.map(i=>`${i.id}:${i.text_left.length}/${i.text_right.length}`).join(' ')}));
