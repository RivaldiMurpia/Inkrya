import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';

// Build first. No authenticated data or provider inference involved.
for(const [index,provider] of ['gateway','nebius'].entries()) {
  const port=3217+index;
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,INKRYA_AI_PROVIDER:provider,NEBIUS_API_KEY:'',AI_GATEWAY_API_KEY:'',LANGSMITH_TRACING:'false'}});
  let ready=false;
  const mark=chunk=>{if(String(chunk).includes('Ready'))ready=true};child.stdout.on('data',mark);child.stderr.on('data',mark);
  try {
    const start=Date.now();
    while(!ready&&Date.now()-start<12000&&child.exitCode===null)await new Promise(r=>setTimeout(r,100));
    assert.ok(ready,'Dev HTTP test server did not start');
    const base=`http://127.0.0.1:${port}`;
    const status=await (await fetch(base+'/api/ai')).json();assert.equal(status.provider,provider);
    if(provider==='nebius')assert.equal(status.configured,false);
    for(const path of ['/api/ai','/api/memory'])assert.equal((await fetch(base+path,{method:'POST',body:'{}'})).status,401);
    assert.equal((await fetch(base+'/api/memory?projectId=invalid')).status,401);
    assert.equal((await fetch(base+'/api/ai/11111111-1111-4111-8111-111111111111')).status,401);
    console.log(`PASS HTTP: ${provider} config and unauthenticated generation/history denial`);
  } finally {
    if(child.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed}
  }
}
