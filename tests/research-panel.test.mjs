import {loadComponent} from './helpers/component-runtime.mjs';
import {setDatabase} from './helpers/mock-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

const ResearchPanel=await loadComponent('components/research-panel.tsx');
const button=(container,label)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label);
const textarea=container=>container.querySelector('textarea');
// Controlled React textarea: the native value setter is required for React's onChange to fire.
function type(container,text){
 const el=textarea(container);
 Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,text);
 el.dispatchEvent(new Event('input',{bubbles:true}));
}

const report={
 topic:'Bandung tahun 2010',
 queries:[{query:'transportasi Bandung 2010',reason:'latar'},{query:'cuaca Bandung Ramadan',reason:'atmosfer'}],
 sources:[
  {index:1,title:'Angkot di Bandung',url:'https://example.com/angkot',content:'Angkot dominan pada 2010.'},
  {index:2,title:'Iklim Jawa Barat',url:'https://example.com/iklim',content:'Musim hujan awal tahun.'},
 ],
 notes:{summary:'Transportasi umum didominasi angkot; cuaca awal tahun cenderung hujan.',notes:[
  {heading:'Transportasi',body:'Angkot adalah moda utama pada 2010.',citations:[1]},
  {heading:'Cuaca',body:'Ramadan 2010 jatuh pada musim hujan.',citations:[2]},
 ],unanswered:['Tarif angkot per rute']},
 dropStats:{notesProposed:3,notesKept:2,badShape:0,badText:0,noCitation:1,badUrl:0},
 credits:2,creditsRemaining:22,steps:[],warning:null,
};

function sessionDb(){
 return {auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})})};
}

async function submit(container){
 await act(async()=>type(container,'Bandung tahun 2010'));
 await act(async()=>button(container,'Jalankan riset').click());
}

async function render(fetchImpl){
 const originalFetch=globalThis.fetch;
 setDatabase(sessionDb());
 globalThis.fetch=fetchImpl;
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 await act(async()=>root.render(React.createElement(ResearchPanel,{projectId:'synthetic-project'})));
 return {container,root,restore:async()=>{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}};
}

test('a successful report renders summary, notes, and sources with safe external links',async()=>{
 const {container,restore}=await render(async()=>Response.json(report));
 try{
  await act(async()=>type(container,'Bandung tahun 2010'));
  await act(async()=>button(container,'Jalankan riset').click());
  assert.match(container.textContent,/angkot/i);
  assert.match(container.textContent,/Transportasi/);
  assert.match(container.textContent,/Ramadan 2010 jatuh pada musim hujan/);
  const anchors=[...container.querySelectorAll('a')];
  assert.equal(anchors.length,2);
  assert.equal(anchors[0].getAttribute('href'),'https://example.com/angkot');
  assert.match(anchors[0].getAttribute('rel')||'',/noopener/);
 }finally{await restore()}
});

test('the credit line states the real numbers and the isolation notice is present',async()=>{
 const {container,restore}=await render(async()=>Response.json(report));
 try{
  await submit(container);
  assert.match(container.textContent,/2 kredit/);
  assert.match(container.textContent,/22 kredit/);
  assert.match(container.textContent,/tidak masuk kanon/i);
 }finally{await restore()}
});

test('a javascript: source URL never renders as a link',async()=>{
 const hostile={...report,sources:[{index:1,title:'Jahat',url:'javascript:alert(1)',content:'x'}],credits:1,creditsRemaining:23};
 const {container,restore}=await render(async()=>Response.json(hostile));
 try{
  await submit(container);
  const bad=[...container.querySelectorAll('a')].filter(a=>(a.getAttribute('href')||'').startsWith('javascript:'));
  assert.equal(bad.length,0);
  assert.equal([...container.querySelectorAll('*')].filter(el=>el.getAttribute?.('href')?.startsWith('javascript:')).length,0);
 }finally{await restore()}
});

test('a user-limit 429 renders in role=alert and keeps the topic in the textarea',async()=>{
 const {container,restore}=await render(async()=>Response.json({error:'Kuota riset web kamu tersisa 2 kredit dari 3 yang dibutuhkan satu riset. Coba lagi besok.'},{status:429}));
 try{
  await act(async()=>type(container,'Bandung tahun 2010'));
  await act(async()=>button(container,'Jalankan riset').click());
  const alert=container.querySelector('[role="alert"]');
  assert.ok(alert,'an alert region must carry the message');
  assert.match(alert.textContent,/2 kredit/);
  assert.equal(textarea(container).value,'Bandung tahun 2010');
 }finally{await restore()}
});

test('the submit button is disabled in flight and a second click does not double-request',async()=>{
 let calls=0,release;
 const held=new Promise(resolve=>{release=resolve});
 const {container,restore}=await render(async()=>{calls++;await held;return Response.json(report)});
 try{
  await act(async()=>type(container,'Bandung tahun 2010'));
  await act(async()=>{button(container,'Jalankan riset').click()});
  // Still in flight: the label flips and the button is disabled, so a second click is inert.
  const inFlight=button(container,'Krya meriset…');
  assert.equal(inFlight.disabled,true);
  await act(async()=>inFlight.click());
  assert.equal(calls,1);
  release();
 }finally{await restore()}
});

test('zero sources renders the no-sources copy, not a silent empty section',async()=>{
 const empty={...report,sources:[],notes:{summary:'',notes:[],unanswered:[]},credits:2,creditsRemaining:22,warning:'Tidak ada sumber web yang ditemukan untuk topik ini. Coba kata kunci lain.'};
 const {container,restore}=await render(async()=>Response.json(empty));
 try{
  await submit(container);
  assert.match(container.textContent,/Tidak ada sumber/i);
 }finally{await restore()}
});

test('a nonzero drop count is stated to the author',async()=>{
 const {container,restore}=await render(async()=>Response.json(report));
 try{
  await submit(container);
  assert.match(container.textContent,/1 catatan/);
 }finally{await restore()}
});

test('the panel never renders a score or percentage',async()=>{
 const {container,restore}=await render(async()=>Response.json(report));
 try{
  await submit(container);
  assert.doesNotMatch(container.textContent,/%/);
 }finally{await restore()}
});
