import {loadComponent} from './helpers/component-runtime.mjs';
import {setDatabase} from './helpers/mock-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

const MemoryPanel=await loadComponent('components/memory-panel.tsx');
const button=(container,label)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label);

test('A chapter revision change disables stale fact approval and preserves the source-to-chapter link',async()=>{
 const originalFetch=globalThis.fetch;
 let current=true;const opened=[];const requests=[];
 setDatabase({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},like(){return this},order(){return this},limit:async()=>({data:[],error:null})}),rpc:()=>{assert.fail('A stale fact must not be approved')}});
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.method,'GET');requests.push(url);
  if(url.includes('sourceId='))return Response.json({title:'Sinyal Aruna',current:false,source:{chapter_id:'synthetic-chapter',source_revision:2,content:'Mira menyimpan kunci kuningan di laci meja radio.'}});
  return Response.json({jobs:[],chunks:[],insights:[],facts:[{id:'synthetic-fact',chunk_id:'old-chunk',title:'Sinyal Aruna',claim:'Kunci berada di laci.',quote:'Mira menyimpan kunci kuningan di laci meja radio.',status:'pending',revision:1,current}]});
 };
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(MemoryPanel,{projectId:'synthetic-project',onOpenChapter:async id=>{opened.push(id)}})));
  assert.match(container.textContent,/Sumber terkini/);assert.equal(button(container,'Setujui').disabled,false);
  current=false;
  await act(async()=>button(container,'Muat ulang').click());
  assert.match(container.textContent,/Sumber berubah/);assert.equal(button(container,'Setujui').disabled,true);
  await act(async()=>button(container,'Setujui').click());
  await act(async()=>button(container,'Sumber: Sinyal Aruna').click());
  assert.match(container.textContent,/Sinyal Aruna · versi 2/);
  assert.match(container.textContent,/Sumber ini berasal dari revisi lama. Buka bab untuk melihat versi terbaru/);
  await act(async()=>button(container,'Buka bab').click());
  assert.deepEqual(opened,['synthetic-chapter']);
  assert.equal(requests.at(-1),'/api/memory?projectId=synthetic-project&sourceId=old-chunk');
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
