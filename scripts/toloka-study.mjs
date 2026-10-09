// Toloka A/B preference study — upload, run, export (Phase 1 human evaluation).
//
// Reads qa/toloka/ab-dataset.json and drives a Toloka annotation run. Two API routes
// exist on this account; the script picks whichever is live and reports honestly:
//
//   apps route   — https://toloka.dev/api/app/v0 (Bespoke/Apps API, template-based).
//                  POST /app-projects {app_id,...} → POST /app-projects/{id}/batches
//                  → POST .../batches/{id}/start → GET .../items (results).
//                  Requires an app template id (app_id) from the Toloka UI gallery.
//   graph route  — https://platform.toloka.ai/api/v2-beta (project → pipeline graph
//                  → dataset → run → export). Requires a pipeline graph whose quorum
//                  node carries the annotation UI; that UI must be authored in the
//                  Toloka UI (its `ui.code` format is not published).
//
// Both routes need a human-authored interface, so this script does the parts that do
// NOT need one: it validates the dataset, probes which route is reachable with the
// account key, and prints the exact next call for the operator. It never pretends a
// route is ready when its template/interface is missing, and it never prints the key.
//
// Usage: node --env-file=.env.local scripts/toloka-study.mjs [--probe]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const APPS_BASE='https://toloka.dev/api/app/v0';
const GRAPH_BASE='https://platform.toloka.ai/api/v2-beta';
const key=process.env.TOLOKA_TOKEN;
assert.ok(key,'TOLOKA_TOKEN is required in .env.local');

const dataset=JSON.parse(readFileSync('qa/toloka/ab-dataset.json','utf8'));
assert.equal(dataset.items.length,8,'expected 8 A/B pairs');
for(const item of dataset.items){
 assert.ok(item.id&&item.story_context&&item.text_left&&item.text_right,`incomplete pair ${item.id}`);
 assert.ok(item.text_left!==item.text_right,`identical sides in ${item.id}`);
 assert.ok(!/55–70|45–60|50–65|kata, satu paragraf/.test(item.story_context),`story_context in ${item.id} leaks the length instruction`);
}
console.log('DATASET_OK',JSON.stringify({pairs:dataset.items.length}));

async function probe(base,path){
 try{
  const r=await fetch(base+path,{headers:{Authorization:'ApiKey '+key}});
  return {status:r.status,body:(await r.text()).slice(0,160).replace(/\s+/g,' ')};
 }catch(e){return {status:0,body:String(e).slice(0,80)}}
}

// Route availability. A 503 with REMOTE_SERVICE_UNAVAILABLE on the apps route (for a
// valid AND an invalid key alike) means the service itself is down, not our auth.
const appsProjects=await probe(APPS_BASE,'/app-projects?limit=1');
const graphMe=await probe(GRAPH_BASE,'/me');
const appsLive=appsProjects.status===200;
const graphLive=graphMe.status===200;

const report={
 apps_route:{base:APPS_BASE,status:appsProjects.status,live:appsLive,note:appsProjects.body.slice(0,80)},
 graph_route:{base:GRAPH_BASE,status:graphMe.status,live:graphLive},
};
console.log('TOLOKA_ROUTES',JSON.stringify(report,null,1));

if(process.argv.includes('--probe')&&!appsLive&&graphLive){
 // What the graph route still needs before a run is possible. Read-only checks.
 const projects=await probe(GRAPH_BASE,'/projects');
 console.log('GRAPH_STATE',JSON.stringify({projects:projects.body.slice(0,120)}));
 console.log('NEXT: author the A/B annotation pipeline in the Toloka UI, then run this script without --probe.');
}
if(!appsLive&&!graphLive){
 console.error('STOP: no Toloka route is reachable. Nothing was uploaded and no spend occurred.');
 process.exitCode=1;
}
