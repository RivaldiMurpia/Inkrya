import {readFile} from 'node:fs/promises';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import {JSDOM} from 'jsdom';

// Component tests, not a browser session. Network/database are always mocked.
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://synthetic.inkrya.test/',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Text','DocumentFragment','MutationObserver','DOMParser','Event','MouseEvent','KeyboardEvent','localStorage']){
 Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
}
globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cache=new Map();
async function componentUrl(url){
 if(cache.has(url.href))return cache.get(url.href);
 let code=transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText;
 const imports=[...code.matchAll(/from ["']([^"']+)["']/g)];
 for(const [match,specifier] of imports){
  const resolved=specifier==='@/lib/supabase'?new URL('./mock-db.mjs',import.meta.url).href
   :specifier.startsWith('.')?await componentUrl(new URL(specifier+'.tsx',url))
   :import.meta.resolve(specifier);
  code=code.replace(match,`from ${JSON.stringify(resolved)}`);
 }
 const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(url.href,result);return result;
}
export async function loadComponent(path){return (await import(await componentUrl(new URL('../../'+path,import.meta.url)))).default}
export {dom};
