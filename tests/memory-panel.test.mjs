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
  return Response.json({jobs:[],chunks:[],insights:[],facts:[{id:'synthetic-fact',chunk_id:'old-chunk',title:'Sinyal Aruna',claim:'Kunci berada di laci.',quote:'Mira menyimpan kunci kuningan di laci meja radio.',status:'pending',revision:1,current}],events:[],knowledge:[]});
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

test('Answer status is rendered distinctly and new review sections load with events and knowledge',async()=>{
 const originalFetch=globalThis.fetch;
 const approvedRpc=[];
 setDatabase({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},like(){return this},order(){return this},limit:async()=>({data:[],error:null})}),rpc:(name,args)=>{approvedRpc.push(name);return Promise.resolve({data:null,error:null})}});
 globalThis.fetch=async()=>{
  return Response.json({jobs:[],chunks:[],insights:[],
   facts:[],
   events:[{id:'ev1',chunk_id:'ch1',title:'Sinyal diterima',quote:'Sinyal diterima di stasiun.',story_time:'2048-04-17',event_type:'discovery',status:'PROPOSED',revision:0,current:true,chunk_index:0}],
   knowledge:[{id:'kn1',chunk_id:'ch1',character_name:'Mira',statement:'Mira mengetahui Helios.',quote:'Mira mengetahui Helios.',learned_at_story_time:'2048-04-17',knows:true,status:'PROPOSED',revision:0,current:true}]});
 };
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(MemoryPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  assert.match(container.textContent,/Review peristiwa/);
  assert.match(container.textContent,/Review pengetahuan karakter/);
  assert.match(container.textContent,/Sinyal diterima/);
  assert.match(container.textContent,/Mira mengetahui Helios/);
  await act(async()=>button(container,'Setujui').click());
  assert.ok(approvedRpc.length>=1);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});

test('Abstention history renders its own notice instead of a normal answer',async()=>{
 const originalFetch=globalThis.fetch;
 setDatabase({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},like(){return this},order(){return this},limit:async()=>({data:[{id:'ask-1',prompt:'[Ask My Story] Apa ini?',result:JSON.stringify({answer:'Bukti belum menetapkan jawaban ini.',status:'NOT_ESTABLISHED',citations:[],abstained:true})}],error:null})}),rpc:()=>Promise.resolve({data:null,error:null})});
 globalThis.fetch=async()=>Response.json({jobs:[],chunks:[],insights:[],facts:[],events:[],knowledge:[]});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(MemoryPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Apa ini?').click());
  assert.match(container.textContent,/Cerita belum menetapkan hal ini/);
  assert.match(container.textContent,/Bukti belum menetapkan jawaban ini/);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
