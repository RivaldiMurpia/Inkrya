// Builds qa/eval/guardian-context.json — the StoryContext package the baseline arm hands to
// the SAME guardian the pipeline uses, so both arms are scored by one detector.
//
//   node --env-file=.env.local scripts/eval-build-context.mjs
//
// Reads the fixture corpus as the standing test account. Env: EVAL_EMAIL, EVAL_PASSWORD.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const FIXTURE='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const URL='https://ecurjotykfqiejrpczdm.supabase.co';
const KEY='sb_publishable_OnGh-2JzH4PKzwR2iDxdXQ_GnKBkUJX';
const email=process.env.EVAL_EMAIL??'e2e-analyze@example.com';
const password=process.env.EVAL_PASSWORD;
if(!password)throw Error('EVAL_PASSWORD is required');

const signIn=await fetch(`${URL}/auth/v1/token?grant_type=password`,{
 method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
 body:JSON.stringify({email,password}),
});
if(!signIn.ok)throw Error('EVAL_SIGNIN_FAILED');
const token=(await signIn.json()).access_token;

async function get(path){
 const response=await fetch(`${URL}/rest/v1/${path}`,{headers:{apikey:KEY,Authorization:`Bearer ${token}`}});
 if(!response.ok)throw Error(`${path} → ${response.status}`);
 return response.json();
}

const [chunks,facts,events,knowledge,characters]=await Promise.all([
 get(`story_chunks?project_id=eq.${FIXTURE}&select=id,chapter_id,chunk_index,content,chapters(title,story_time)&order=chunk_index`),
 get(`story_facts?project_id=eq.${FIXTURE}&status=eq.CANON&select=id,claim,subject,predicate,object,quote,chunk_id,confidence`),
 get(`timeline_events?project_id=eq.${FIXTURE}&status=eq.CANON&select=id,story_time,title,event_type,chapter_id,quote,chunk_id`),
 get(`character_knowledge?project_id=eq.${FIXTURE}&status=eq.CANON&select=id,statement,knows,learned_at_story_time,quote,chunk_id,characters(name)`),
 get(`characters?project_id=eq.${FIXTURE}&deleted_at=is.null&select=id,name,aliases,role`),
]);

const context={
 evidence:chunks.map((chunk,index)=>({
  id:chunk.id,title:chunk.chapters.title,story_time:chunk.chapters.story_time,
  chunk_index:chunk.chunk_index,content:chunk.content,score:1-index*0.01,
 })),
 canon:facts.map(fact=>({id:fact.id,claim:fact.claim,subject:fact.subject,predicate:fact.predicate,object:fact.object,quote:fact.quote,chunk_id:fact.chunk_id,confidence:fact.confidence})),
 timeline:events.map(event=>({id:event.id,story_time:event.story_time,title:event.title,event_type:event.event_type,chapter_id:event.chapter_id,quote:event.quote,chunk_id:event.chunk_id})),
 knowledge:knowledge.map(row=>({id:row.id,character_name:row.characters.name,statement:row.statement,knows:row.knows,learned_at_story_time:row.learned_at_story_time,quote:row.quote,chunk_id:row.chunk_id})),
 characters:characters.map(character=>({name:character.name,aliases:character.aliases??[],role:character.role})),
};
writeFileSync(join(root,'qa','eval','guardian-context.json'),JSON.stringify(context,null,1));
console.log(`context: evidence ${context.evidence.length}, canon ${context.canon.length}, timeline ${context.timeline.length}, knowledge ${context.knowledge.length}, characters ${context.characters.length}`);
