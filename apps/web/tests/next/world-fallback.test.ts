import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountOriginalWorld } from '../../native/world/original-scene.js';
import rings from '../../native/world/rings-data.js';
import { worldHTML } from '../../lib/server/world-html';
import { renderContent } from '../../lib/server/content-html';
test('actual Three renderer refuses missing WebGL; no canvas is counted as an initialized Ball',()=>{
  const dom=new JSDOM(`<!doctype html><html><body>${worldHTML}${renderContent({category:'all',item:null,chat:false})}</body></html>`,{url:'http://localhost/',pretendToBeVisual:true}),env=dom.window;
  env.HTMLCanvasElement.prototype.getContext=()=>null;
  const query=new env.EventTarget();Object.assign(query,{matches:true,media:'(prefers-reduced-motion: reduce)'});
  const saved=new Map<string,PropertyDescriptor|undefined>();
  for(const[key,value]of Object.entries({window:env,document:env.document,matchMedia:()=>query,location:env.location,devicePixelRatio:1,innerWidth:1200,innerHeight:800})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const error=console.error;console.error=()=>{};
  try{assert.throws(()=>mountOriginalWorld(env.document.getElementById('ball-world-root')!,rings),/WebGL/);assert.equal(env.document.querySelectorAll('#world-stage canvas').length,0);assert.equal((env as unknown as {ballStudy?:unknown}).ballStudy,undefined);assert.equal(env.document.querySelectorAll('article.card').length,18);assert.equal(env.document.querySelector('#content-root')!.hasAttribute('inert'),false);}finally{console.error=error;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});
