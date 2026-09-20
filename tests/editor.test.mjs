import {loadComponent} from './helpers/component-runtime.mjs';
import {setDatabase} from './helpers/mock-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';

const Writer=await loadComponent('components/writer.tsx');
const source='Mira menyimpan kunci kuningan di laci meja radio.';
const content=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
const fixture=()=>({id:'synthetic-chapter',project_id:'synthetic-project',title:'Sinyal Aruna',revision_number:2,plain_text:source,content_json:content(source),position:0});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(){
 localStorage.clear();let server=fixture();const writes=[];let delay;
 setDatabase({rpc:async(name,args)=>{assert.equal(name,'save_chapter');writes.push(structuredClone(args));if(delay)await delay;if(args.p_base_revision!==server.revision_number)return {data:null,error:{message:'REVISION_CONFLICT'}};server={...server,title:args.p_title,plain_text:args.p_plain_text,content_json:args.p_content,revision_number:server.revision_number+1};return {data:structuredClone(server),error:null}},from:()=>({select(){return this},eq(){return this},order(){return this},range:async()=>({data:[],error:null})})});
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);let setShown;
 function Harness(){const [chapter,setChapter]=useState(fixture());const [shown,setVisible]=useState(true);setShown=setVisible;return shown?React.createElement(Writer,{chapter,userId:'synthetic-user',onDirty:()=>{},onSaved:setChapter}):React.createElement('p',null,'Memory')}
 await act(async()=>{root.render(React.createElement(Harness));await pause(20)});
 return {container,writes,get server(){return server},setDelay(value){delay=value},externalEdit(){server={...server,revision_number:server.revision_number+1,plain_text:'Perubahan tab lain.'}},async show(value){await act(async()=>{setShown(value);await pause(20)})},async settle(){await act(async()=>{await pause(1700)})},async close(){await act(async()=>root.unmount());container.remove()}};
}
const button=(container,label)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label);

test('Opening/reopening a chapter and toggling history must not create a revision',async()=>{
 const h=await setup();try{
  await h.settle();assert.equal(h.writes.length,0,'opening an unchanged chapter must not save');
  await act(async()=>button(h.container,'Riwayat').click());
  await act(async()=>button(h.container,'Kembali menulis').click());
  await h.settle();assert.equal(h.writes.length,0,'history mode is not a manuscript edit');
  await h.show(false);await h.show(true);await h.settle();assert.equal(h.writes.length,0,'returning from Memory must not save');
 }finally{await h.close()}
});

test('Return from Memory, edit twice and preserve the newest content without a conflict',async()=>{
 const h=await setup();try{
  await h.show(false);await h.show(true);
  await act(async()=>h.container.querySelector('[contenteditable]').editor.commands.setContent(content(source+' Mira menutup pintu.')));
  await h.settle();
  await act(async()=>h.container.querySelector('[contenteditable]').editor.commands.insertContent(' Damar mengetuk.'));
  await h.settle();
  assert.equal(h.writes.length,2);assert.equal(h.server.revision_number,4);assert.match(h.server.plain_text,/Damar mengetuk/);assert.match(h.container.textContent,/Tersimpan/);assert.doesNotMatch(h.container.textContent,/Konflik versi/);
 }finally{await h.close()}
});

test('A delayed mount-only save followed by Memory navigation must not create a revision conflict',async()=>{
 const h=await setup();let release;h.setDelay(new Promise(resolve=>{release=resolve}));try{
  await h.settle();await h.show(false);
  await act(async()=>{release();await pause(20)});
  h.setDelay(undefined);await h.show(true);await h.settle();
  assert.doesNotMatch(h.container.textContent,/Konflik versi/);
  assert.equal(h.writes.length,0);assert.equal(h.server.revision_number,2);
 }finally{release();await h.close()}
});

test('Edits made during a save are queued against the returned revision',async()=>{
 const h=await setup();let release;h.setDelay(new Promise(resolve=>{release=resolve}));try{
  const editor=h.container.querySelector('[contenteditable]').editor;
  await act(async()=>editor.commands.setContent(content(source+' Mira menutup pintu.')));
  await act(async()=>button(h.container,' Simpan').click());
  await act(async()=>editor.commands.insertContent(' Damar mengetuk.'));
  await act(async()=>{release();await pause(20)});
  await h.settle();
  assert.deepEqual(h.writes.map(w=>w.p_base_revision),[2,3]);
  assert.match(h.server.plain_text,/Mira menutup pintu/);assert.match(h.server.plain_text,/Damar mengetuk/);
  assert.equal(localStorage.getItem('inkrya:draft:synthetic-user:synthetic-chapter'),null);
 }finally{release();await h.close()}
});

test('A real concurrent chapter revision preserves the local draft and does not overwrite the server',async()=>{
 const h=await setup();try{
  h.externalEdit();
  await act(async()=>h.container.querySelector('[contenteditable]').editor.commands.setContent(content('Draft lokal yang belum digabung.')));
  await h.settle();
  assert.match(h.container.textContent,/Konflik versi/);
  assert.equal(h.server.plain_text,'Perubahan tab lain.');
  assert.match(localStorage.getItem('inkrya:draft:synthetic-user:synthetic-chapter'),/Draft lokal/);
  assert.equal(h.writes.length,1);
 }finally{await h.close()}
});

test('Duplicate update notifications after an acknowledged save do not write identical content',async()=>{
 const h=await setup();try{
  const editor=h.container.querySelector('[contenteditable]').editor;
  await act(async()=>editor.commands.setContent(content(source+' Mira menutup pintu.')));
  await h.settle();
  // A TipTap editability event emits update even with an unchanged document.
  await act(async()=>editor.setEditable(true));
  await h.settle();
  assert.equal(h.writes.length,1);assert.equal(h.server.revision_number,3);
  assert.match(h.container.textContent,/Tersimpan/);
 }finally{await h.close()}
});

test('Duplicate notifications during an in-flight save are acknowledged without another revision',async()=>{
 const h=await setup();let release;h.setDelay(new Promise(resolve=>{release=resolve}));try{
  const editor=h.container.querySelector('[contenteditable]').editor;
  await act(async()=>editor.commands.setContent(content(source+' Mira menutup pintu.')));
  await act(async()=>button(h.container,' Simpan').click());
  await act(async()=>editor.setEditable(true));
  await act(async()=>{release();await pause(20)});
  await h.settle();
  assert.equal(h.writes.length,1);assert.equal(h.server.revision_number,3);
  assert.equal(localStorage.getItem('inkrya:draft:synthetic-user:synthetic-chapter'),null);
 }finally{release();await h.close()}
});
