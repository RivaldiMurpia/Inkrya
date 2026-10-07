import {loadComponent} from './helpers/component-runtime.mjs';
import {setDatabase} from './helpers/mock-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

const WritePanel=await loadComponent('components/write-panel.tsx');
const button=(container,label)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label);
const textarea=container=>container.querySelector('textarea');
// Controlled React textarea: the native value setter is required for React's onChange to fire.
function type(container,text){
 const el=textarea(container);
 Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,text);
 el.dispatchEvent(new Event('input',{bubbles:true}));
}

function ndjson(lines){
 const stream=new ReadableStream({
  start(controller){
   for(const line of lines)controller.enqueue(new TextEncoder().encode(JSON.stringify(line)+'\n'));
   controller.close();
  },
 });
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}});
}

test('Only executed stages appear, unresolved issues surface honestly',async()=>{
 const originalFetch=globalThis.fetch;
 const result={draft:'Draf yang diperbaiki.',plan:{goal:'Konfrontasi.',scenePlan:['Pembuka'],suggestedStoryTime:null},
  issues:[{type:'alive_dead_conflict',severity:'critical',claim:'Vale hidup',evidence_ids:['fact-1'],explanation:'Karakter mati',repair_hint:'Revisi'}],
  resolved:false,repairAttempts:2,critic:{strengths:['Rapat'],improvements:['Selesaikan konflik']},steps:[],warning:null};
 setDatabase({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},insert(){return this},update(){return this}}),rpc:()=>Promise.resolve({data:null,error:null})});
 globalThis.fetch=async()=>ndjson([
  {type:'stage',stage:'context',detail:'Konteks cerita siap · 1 bagian relevan · 1 peristiwa · 1 pengetahuan karakter'},
  {type:'stage',stage:'plan',detail:'Rencana bab dibuat · 1 adegan'},
  {type:'stage',stage:'draft',detail:'Draf dibuat'},
  {type:'stage',stage:'guardian',detail:'Masalah kontinuitas ditemukan · 1',issueCount:1},
  {type:'stage',stage:'repair',detail:'Perbaikan dicoba · upaya 1 dari 2',atIndex:1},
  {type:'stage',stage:'recheck',detail:'Masalah tersisa · 1',issueCount:1},
  {type:'stage',stage:'repair',detail:'Perbaikan dicoba · upaya 2 dari 2',atIndex:2},
  {type:'stage',stage:'recheck',detail:'Masalah tersisa · 1',issueCount:1},
  {type:'stage',stage:'critic',detail:'Kritik selesai'},
  {type:'result',...result},
 ]);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(WritePanel,{projectId:'synthetic-project',chapters:[],onChapterCreated:()=>{}})));
  await act(async()=>type(container,'Lanjutkan adegan.'));
  await act(async()=>button(container,'Tulis bab dengan Krya').click());
  assert.match(container.textContent,/Masalah kontinuitas ditemukan/);
  assert.match(container.textContent,/Perbaikan dicoba · upaya 2 dari 2/);
  assert.match(container.textContent,/Kritik selesai/);
  assert.ok(!container.textContent.includes('Kontinuitas bersih'));
  assert.match(container.textContent,/Masalah kontinuitas belum teratasi/);
  assert.match(container.textContent,/Konflik status hidup\/mati/);
  assert.match(container.textContent,/fact-1/);
  assert.match(container.textContent,/Draf yang diperbaiki./);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});

test('Apply converts the draft to a tiptap doc, saves via save_chapter and notifies studio',async()=>{
 const originalFetch=globalThis.fetch;
 const chapters=[{id:'ch-1',project_id:'synthetic-project',title:'Bab 1',content_json:{},plain_text:'',revision_number:1,position:0}];
 const calls={insert:null,rpc:null,created:null};
 setDatabase({
  auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},
  from(table){
   return {
    select(){return this},eq(){return this},
    insert(payload){calls.insert={table,payload};return {select:()=>({single:async()=>({data:{id:'ch-new',project_id:'synthetic-project',title:'Bab 2',content_json:payload.content_json,plain_text:payload.plain_text,revision_number:1,position:1},error:null})})}},
   };
  },
  rpc(name,args){calls.rpc={name,args};return Promise.resolve({data:null,error:null})},
 });
 globalThis.fetch=async()=>ndjson([
  {type:'stage',stage:'context',detail:'Konteks cerita siap'},
  {type:'stage',stage:'plan',detail:'Rencana bab dibuat'},
  {type:'stage',stage:'draft',detail:'Draf dibuat'},
  {type:'stage',stage:'guardian',detail:'Kontinuitas bersih',issueCount:0},
  {type:'stage',stage:'critic',detail:'Kritik selesai'},
  {type:'result',draft:'Paragraf pertama.\n\nParagraf kedua.',plan:{goal:'g',scenePlan:[],suggestedStoryTime:null},issues:[],resolved:true,repairAttempts:0,critic:{strengths:[],improvements:[]},steps:[],warning:null},
 ]);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(WritePanel,{projectId:'synthetic-project',chapters,onChapterCreated:c=>{calls.created=c}})));
  await act(async()=>type(container,'Tulis bab.'));
  await act(async()=>button(container,'Tulis bab dengan Krya').click());
  assert.match(container.textContent,/Kontinuitas bersih/);
  assert.ok(!container.textContent.includes('Masalah kontinuitas belum teratasi'));
  await act(async()=>button(container,'Pakai sebagai bab baru').click());
  assert.equal(calls.insert.table,'chapters');
  assert.equal(calls.insert.payload.title,'Bab 2');
  assert.equal(calls.insert.payload.position,1);
  assert.deepEqual(calls.insert.payload.content_json,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Paragraf pertama.'}]},{type:'paragraph',content:[{type:'text',text:'Paragraf kedua.'}]}]});
  assert.equal(calls.rpc.name,'save_chapter');
  assert.equal(calls.rpc.args.p_chapter_id,'ch-new');
  assert.equal(calls.rpc.args.p_base_revision,1);
  assert.equal(calls.created.id,'ch-new');
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
