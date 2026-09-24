import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const keys=['family','forbidden_changes','id','paragraphs','pov','provenance','required_facts','scene_goal','source_draft_en','target_id','target_word_range'];
const inputKeys=['source_draft_en','required_facts','forbidden_changes','pov','target_word_range','scene_goal','paragraphs'];
const idTags=['Aruna','Mira','Damar','Nala','Raka']; // Reserved external synthetic acceptance cases.
const foreign=/\b(?:the|and|with|without|she|he|they|her|his|then|suddenly|meanwhile|however|was|were)\b/iu;
const unsafe=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFFFD]/u;
const norm=s=>s.normalize('NFC').toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const words=s=>s.trim().split(/\s+/u).filter(Boolean).length;
const sorted=o=>Object.keys(o).sort().join('|');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const assert=(condition,message)=>{if(!condition)throw Error(message)};

function readLines(file){
 const source=readFileSync(file,'utf8');
 assert(source.endsWith('\n'),`${file}: missing final newline`);
 return source.trimEnd().split('\n').map((line,index)=>{
  let row;
  try{row=JSON.parse(line)}catch{throw Error(`${file}:${index+1}: invalid JSON`)}
  return row;
 });
}

function checkStrings(value,path){
 if(typeof value==='string'){
  assert(value.length>0&&value===value.trim(),`${path}: empty or padded string`);
  assert(value.normalize('NFC')===value,`${path}: non-NFC Unicode`);
  assert(!unsafe.test(value),`${path}: unsafe Unicode/control character`);
 }else if(Array.isArray(value))value.forEach((part,index)=>checkStrings(part,`${path}[${index}]`));
 else if(value&&typeof value==='object')Object.entries(value).forEach(([key,part])=>checkStrings(part,`${path}.${key}`));
}

export function validatePair(r,m,split){
 const key=r?.id??'(missing id)';
 assert(r&&typeof r==='object'&&!Array.isArray(r)&&sorted(r)===keys.slice().sort().join('|'),`${key}: invalid record schema`);
 assert(/^pc-\d\d-[1-5]-(tenang|tegang|jernih)$/u.test(r.id),`${key}: invalid id`);
 assert(/^setting-\d\d-scene-[1-5]$/u.test(r.family),`${key}: invalid family`);
 assert(r.provenance==='original_synthetic_v1',`${key}: unknown provenance`);
 assert(r.pov==='third_person'&&r.paragraphs===1,`${key}: invalid POV/paragraph constraint`);
 assert(typeof r.scene_goal==='string'&&typeof r.source_draft_en==='string'&&typeof r.target_id==='string',`${key}: invalid text field`);
 assert(Array.isArray(r.required_facts)&&r.required_facts.length>=3&&r.required_facts.every(x=>typeof x==='string'&&x.length>5),`${key}: missing required facts`);
 assert(Array.isArray(r.forbidden_changes)&&r.forbidden_changes.length>=2&&r.forbidden_changes.every(x=>typeof x==='string'&&x.length>5),`${key}: missing forbidden changes`);
 assert(r.target_word_range&&sorted(r.target_word_range)==='max|min'&&Number.isInteger(r.target_word_range.min)&&Number.isInteger(r.target_word_range.max)&&r.target_word_range.min>=30&&r.target_word_range.max<=85&&r.target_word_range.min<r.target_word_range.max,`${key}: invalid word range`);
 checkStrings(r,key);
 const n=words(r.target_id);
 assert(n>=r.target_word_range.min&&n<=r.target_word_range.max,`${key}: word range ${n} outside ${r.target_word_range.min}-${r.target_word_range.max}`);
 assert(!/[\r\n]/u.test(r.target_id)&&/[.!?][”"']?$/u.test(r.target_id),`${key}: paragraph or incomplete sentence`);
 assert(!foreign.test(r.target_id)&&!/<\/?(?:think|analysis|final)\b/iu.test(r.target_id),`${key}: obvious language/meta leakage`);
 assert(!idTags.some(name=>new RegExp(`\\b${name}\\b`,'iu').test(JSON.stringify(r))),`${key}: external acceptance corpus leakage`);
 assert(m&&sorted(m)==='messages'&&Array.isArray(m.messages)&&m.messages.length===3,`${key}: invalid Nebius JSONL schema`);
 const [system,user,assistant]=m.messages;
 assert(system?.role==='system'&&typeof system.content==='string'&&user?.role==='user'&&typeof user.content==='string'&&assistant?.role==='assistant'&&typeof assistant.content==='string',`${key}: invalid messages`);
 assert(m.messages.every(msg=>sorted(msg)==='content|role'),`${key}: unsupported Nebius message key`);
 const input=Object.fromEntries(inputKeys.map(field=>[field,r[field]]));
 assert(!user.content.includes(r.target_id),`${key}: answer appears in prompt`);
 assert(!system.content.includes(r.target_id),`${key}: answer appears in system`);
 let parsedInput;
 try{parsedInput=JSON.parse(user.content)}catch{throw Error(`${key}: user prompt is not JSON`)}
 assert(same(parsedInput,input),`${key}: user prompt differs from record`);
 assert(assistant.content===r.target_id,`${key}: answer differs from record`);
 checkStrings(m,`${key}.messages`);
 return {id:r.id,family:r.family,prompt:norm(user.content),answer:norm(r.target_id),source:norm(r.source_draft_en),words:n,bytes:Buffer.byteLength(JSON.stringify(m),'utf8'),characters:JSON.stringify(m).length,split};
}

export function validateCorpus(trainRecords,trainMessages,evalRecords,evalMessages){
 assert(trainRecords.length===120&&trainMessages.length===120,'expected 120 train pairs');
 assert(evalRecords.length===30&&evalMessages.length===30,'expected 30 held-out pairs');
 const rows=[...trainRecords.map((r,i)=>validatePair(r,trainMessages[i],'train')),...evalRecords.map((r,i)=>validatePair(r,evalMessages[i],'heldout'))];
 const unique=(field)=>assert(new Set(rows.map(r=>r[field])).size===rows.length,`duplicate/overlapping ${field}`);
 ['id','prompt','answer'].forEach(unique);
 const sources=new Map();
 for(const r of rows){
  assert(!sources.has(r.source)||sources.get(r.source)===r.family,`source leakage across scene families: ${r.id}`);
  sources.set(r.source,r.family);
 }
 const families=split=>new Set(rows.filter(r=>r.split===split).map(r=>r.family));
 const trainFamilies=families('train'),evalFamilies=families('heldout');
 assert(trainFamilies.size===40&&evalFamilies.size===10,'family count unexpected');
 assert([...trainFamilies].every(f=>!evalFamilies.has(f)),'train/eval family overlap');
 const setting=family=>family.split('-scene-')[0];
 const trainSettings=new Set([...trainFamilies].map(setting));
 assert([...evalFamilies].every(f=>!trainSettings.has(setting(f))),'train/eval setting leakage');
 // A changed name or one punctuation mark cannot launder an eval answer into train.
 const shingles=s=>{const w=s.split(' '),out=new Set();for(let i=0;i<=w.length-5;i++)out.add(w.slice(i,i+5).join(' '));return out};
 const grams=rows.map(r=>shingles(r.answer));
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  if(rows[i].family===rows[j].family)continue;
  const a=grams[i],b=grams[j];
  if(!a.size||!b.size)continue;
  const overlap=[...a].filter(g=>b.has(g)).length/(a.size+b.size-[...a].filter(g=>b.has(g)).length);
  assert(overlap<0.7,`near-duplicate answer across families: ${rows[i].id} / ${rows[j].id}`);
 }
 const stats=split=>{
  const subset=rows.filter(r=>r.split===split),w=subset.map(r=>r.words);
  return {pairs:subset.length,scene_families:new Set(subset.map(r=>r.family)).size,settings:new Set(subset.map(r=>setting(r.family))).size,words_min:Math.min(...w),words_max:Math.max(...w),words_total:w.reduce((a,b)=>a+b,0),jsonl_bytes:subset.reduce((a,r)=>a+r.bytes+1,0),characters_total:subset.reduce((a,r)=>a+r.characters,0)};
 };
 return {valid:true,train:stats('train'),heldout:stats('heldout')};
}

export function validateDirectory(dir='qa/plan-c'){
 const file=name=>readLines(resolve(dir,name));
 return validateCorpus(file('train.records.jsonl'),file('train.nebius.jsonl'),file('heldout.records.jsonl'),file('heldout.reference.jsonl'));
}

if(import.meta.url===pathToFileURL(resolve(process.argv[1]||'')).href){
 try{console.log(JSON.stringify(validateDirectory(process.argv[2]||'qa/plan-c'),null,2))}
 catch(error){console.error(error.message);process.exitCode=1}
}
