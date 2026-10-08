import {loadComponent} from './helpers/component-runtime.mjs';
import {setDatabase} from './helpers/mock-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

const DoctorPanel=await loadComponent('components/doctor-panel.tsx');
const button=(container,label)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label);
const report={
 coverage:{chaptersTotal:10,chaptersReady:10,chaptersSummarized:7,chaptersWithStoryTime:8,canonFacts:25,canonEvents:13,canonKnowledge:6,charactersTracked:4,worldRulesProvided:true,
  skipped:['Story bible kosong — cek pelanggaran aturan dunia dilewati.']},
 findings:[
  {engine:'code',kind:'forgotten_character',severity:'low',claim:'Leni tidak muncul lagi setelah Bab 3.',explanation:'Leni terakhir muncul di Bab 3.',evidence_ids:['ch-3'],chapter_id:'ch-3',resolvedEvidence:[{id:'ch-3',label:'Bab: Bab 3'}]},
  {engine:'ai',kind:'knowledge_error',severity:'high',claim:'Kenan menyebut Helios sebelum mengetahuinya.',explanation:'Dialog merujuk Helios.',evidence_ids:['kn-1'],chapter_id:null,resolvedEvidence:[{id:'kn-1',label:'Pengetahuan: Kenan'}]},
 ],
 aiAvailable:true,warning:null,
};

function sessionDb(){
 return {auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})})};
}

test('a clean report renders no findings and says so with its coverage base',async()=>{
 const originalFetch=globalThis.fetch;
 setDatabase(sessionDb());
 globalThis.fetch=async()=>Response.json({coverage:report.coverage,findings:[],aiAvailable:true,warning:null});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(DoctorPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  await act(async()=>button(container,'Jalankan pemeriksaan').click());
  assert.match(container.textContent,/Tidak ada temuan pada pemeriksaan ini/);
  assert.match(container.textContent,/25 fakta kanon · 13 peristiwa · 6 pengetahuan · 4 karakter dipantau/);
  assert.match(container.textContent,/Cek yang dilewati \(1\)/);
  assert.doesNotMatch(container.textContent,/92%/); // no invented health scores, ever
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
test('findings render grouped by severity with evidence and chapter links',async()=>{
 const originalFetch=globalThis.fetch;
 const opened=[];
 setDatabase(sessionDb());
 globalThis.fetch=async()=>Response.json(report);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(DoctorPanel,{projectId:'synthetic-project',onOpenChapter:async id=>{opened.push(id)}})));
  await act(async()=>button(container,'Jalankan pemeriksaan').click());
  assert.match(container.textContent,/2 temuan/);
  assert.match(container.textContent,/TINGGI/);
  assert.match(container.textContent,/RENDAH/);
  assert.match(container.textContent,/pemeriksaan otomatis/);
  assert.match(container.textContent,/pemeriksaan AI/);
  // Evidence buttons exist for every resolved id.
  assert.ok(button(container,'Pengetahuan: Kenan'));
  await act(async()=>button(container,'Buka bab').click());
  assert.deepEqual(opened,['ch-3']);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
test('an AI failure degrades to code findings with an honest warning',async()=>{
 const originalFetch=globalThis.fetch;
 setDatabase(sessionDb());
 globalThis.fetch=async()=>Response.json({coverage:report.coverage,findings:[report.findings[0]],aiAvailable:false,warning:'Pemeriksaan AI gagal; hanya hasil pemeriksaan otomatis yang ditampilkan.'});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(DoctorPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  await act(async()=>button(container,'Jalankan pemeriksaan').click());
  assert.match(container.textContent,/Pemeriksaan AI tidak berjalan pada laporan ini/);
  assert.match(container.textContent,/hanya hasil pemeriksaan otomatis yang ditampilkan/);
  assert.match(container.textContent,/1 temuan/);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
test('opening the panel renders the latest persisted report from history',async()=>{
 const originalFetch=globalThis.fetch;
 const requests=[];
 setDatabase({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-session'}}})},from:()=>({select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[{id:'doc-1',result:JSON.stringify(report)}],error:null})})});
 globalThis.fetch=async(url,options)=>{requests.push({url,options});throw Error('fetch must not run')};
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(DoctorPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  assert.match(container.textContent,/2 temuan/);
  // No AI slot was spent just by opening the panel.
  assert.deepEqual(requests,[]);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
test('a quota error from the API surfaces as an Indonesian notice',async()=>{
 const originalFetch=globalThis.fetch;
 setDatabase(sessionDb());
 globalThis.fetch=async()=>Response.json({error:'Batas 20 permintaan AI dalam 24 jam tercapai.'},{status:429});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(React.createElement(DoctorPanel,{projectId:'synthetic-project',onOpenChapter:async()=>{}})));
  await act(async()=>button(container,'Jalankan pemeriksaan').click());
  assert.match(container.textContent,/Batas 20 permintaan AI dalam 24 jam tercapai/);
 }finally{await act(async()=>root.unmount());container.remove();globalThis.fetch=originalFetch}
});
