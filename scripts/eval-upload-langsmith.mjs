// Phase 8 — upload the evaluation dataset to LangSmith (idempotent).
// Creates the dataset `inkrya-last-signal-eval` if absent and adds one example per case,
// skipping ids already present. Run with the key from the environment:
//   node --env-file=.env.local scripts/eval-upload-langsmith.mjs
// Exits 0 with SKIPPED_NO_KEY when LANGSMITH_API_KEY is absent — the report then records
// repo-only, honestly.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=join(here,'..');
const DATASET='inkrya-last-signal-eval';

const apiKey=process.env.LANGSMITH_API_KEY;
if(!apiKey){console.log('SKIPPED_NO_KEY');process.exit(0)}

const cases=readFileSync(join(root,'qa','eval','last-signal-eval.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
const {Client}=await import('langsmith');
const client=new Client({apiKey,apiUrl:(process.env.LANGSMITH_ENDPOINT||'https://api.smith.langchain.com').replace(/\/$/,''),callerOptions:{maxRetries:1}});

let dataset;
try{dataset=await client.readDataset({datasetName:DATASET})}
catch{dataset=await client.createDataset(DATASET,{description:'Inkrya Phase 8 — The Last Signal synthetic fixture evaluation (24 cases).'})}

// Existing example ids, so a re-run is a no-op rather than duplicates.
const existing=new Set();
for await(const example of client.listExamples({datasetId:dataset.id}))existing.add(example.inputs?.case_id);

const fresh=cases.filter(c=>!existing.has(c.id));
if(fresh.length){
 await client.createExamples({datasetId:dataset.id,examples:fresh.map(c=>({
  inputs:{case_id:c.id,question:c.input.question,instruction:c.input.instruction,arm:c.arm},
  outputs:{expected:c.expected},
  metadata:{category:c.category,note:c.note},
 }))});
}
console.log(`uploaded ${fresh.length} examples (${existing.size} already present, ${cases.length} total)`);
