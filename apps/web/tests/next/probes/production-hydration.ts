// Exploratory diagnostic, excluded from the acceptance suite: JSDOM cannot execute this Next/Turbopack bootstrap reliably.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
const require=createRequire(import.meta.url);
const wait=()=>new Promise(resolve=>setTimeout(resolve,50));
test('production Next scripts hydrate and refresh the opaque island in a no-GPU DOM harness',async()=>{
  const port=4198,base=`http://127.0.0.1:${port}`,logs:string[]=[];
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>logs.push(String(chunk)));child.stderr.on('data',chunk=>logs.push(String(chunk)));
  let dom:JSDOM|undefined;
  const exceptions:string[]=[],recoveries:string[]=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>exceptions.push(String(error)));
  virtualConsole.on('error',(...args)=>{const value=args.map(String).join(' ');if(!value.includes('Error creating WebGL context'))recoveries.push(value);});
  try{
    const started=Date.now();let response:Response|undefined;
    while(Date.now()-started<15000){if(child.exitCode!==null)throw new Error(logs.join(''));try{response=await fetch(base);if(response.ok)break;}catch{}await wait();}
    assert.ok(response?.ok,logs.join(''));
    const html=await response.text();let originals: Element[]=[];
    dom=new JSDOM(html,{url:base,pretendToBeVisual:true,runScripts:'dangerously',resources:'usable',virtualConsole,beforeParse(env){
      Object.assign(env,{TextEncoder,TextDecoder,ReadableStream,TransformStream,AbortController,AbortSignal,Request,Response,Headers});
      env.fetch=((url: string|URL,options?:RequestInit)=>fetch(new URL(String(url),base),options)) as never;
      env.matchMedia=()=>Object.assign(new env.EventTarget(),{matches:true,media:'(prefers-reduced-motion: reduce)',onchange:null,addListener(){},removeListener(){},dispatchEvent:()=>true}) as never;
      env.HTMLCanvasElement.prototype.getContext=()=>null;
      Object.defineProperty(env.document,'scrollingElement',{get:()=>env.document.documentElement});
      env.scrollTo=()=>{};
      env.document.addEventListener('DOMContentLoaded',()=>{originals=[...env.document.querySelectorAll('article.card')];});
    }});
    const env=dom.window as typeof dom.window & {personalOSNextContent?:{open(id:string):void;advance(dt:number):void;snapshot():{phase:string}}};
    const deadline=Date.now()+12000;while(!env.personalOSNextContent&&Date.now()<deadline)await wait();
    assert.ok(env.personalOSNextContent,JSON.stringify({exceptions,recoveries,logs}));
    if(originals.length===0)throw new Error('Did not capture pre-adoption SSR nodes');
    assert.equal(originals.length,18);assert.ok(originals.every(node=>env.document.contains(node)));
    env.personalOSNextContent.open('thoughts-long');env.personalOSNextContent.advance(1);
    const article=env.document.querySelector('#canvas article')!,reader=env.document.getElementById('reader')!;reader.scrollTop=280;
    const button=[...env.document.querySelectorAll('button')].find(node=>node.textContent==='Refresh payload')!;button.click();await new Promise(resolve=>setTimeout(resolve,600));
    assert.equal(env.document.querySelector('#canvas article'),article);assert.equal(reader.scrollTop,280);assert.ok(originals.every(node=>env.document.contains(node)));
    assert.equal(env.document.querySelectorAll('#world-stage canvas').length,0);
    assert.deepEqual(exceptions,[]);assert.deepEqual(recoveries,[]);
  }finally{dom?.window.close();child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});}
});
