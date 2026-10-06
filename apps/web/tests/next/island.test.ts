import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import NativeContentIsland from '../../components/NativeContentIsland';
import { renderContent } from '../../lib/server/content-html';
import { records } from '../../lib/server/demo-content';
import { parseRoute } from '../../lib/navigation/route-state';
import { mountContent } from '../../native/content/controller';
import { createNavigationAuthority } from '../../lib/navigation/navigation-authority';
import { assessGPU } from './gpu-gate';
const defaultRoute={category:'all',item:null,chat:false} as const;
const manifest=records.map(({id,category,title,height,index,kind})=>({id,category,title,height,index,kind}));
function environment(html: string, url='http://localhost/') {
  const dom=new JSDOM(`<!doctype html><html><body><header class="topbar"></header><div id="root">${html}</div></body></html>`,{url,pretendToBeVisual:true});
  const env=dom.window;
  Object.defineProperty(env.document,'scrollingElement',{value:env.document.documentElement});
  const query=new env.EventTarget();Object.assign(query,{matches:true,media:'(prefers-reduced-motion: reduce)'});env.matchMedia=()=>query as never;
  env.HTMLElement.prototype.getBoundingClientRect=function(){const w=this.classList.contains('slot')||this.classList.contains('identity')?330:this.id==='feed'?1030:1040;const h=this.classList.contains('identity')?300:this.classList.contains('topbar')?76:parseFloat(this.style.getPropertyValue('--height'))||600;return{x:24,y:100,width:w,height:h,top:100,left:24,right:24+w,bottom:100+h,toJSON(){return this;}}};
  Object.defineProperty(env.HTMLElement.prototype,'offsetWidth',{get(){return this.getBoundingClientRect().width}});
  Object.defineProperty(env.HTMLElement.prototype,'offsetHeight',{get(){return this.getBoundingClientRect().height}});
  Object.defineProperty(env.HTMLElement.prototype,'scrollHeight',{get(){return 2000}});
  return dom;
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,40));
test('SSR has exactly 18 unique authored articles and readable deep-link body without scripts',()=>{
  for(const params of ['', 'space=thoughts&item=thoughts-long&chat=open']){
    const route=parseRoute(new URLSearchParams(params),records),dom=environment(renderContent(route)),doc=dom.window.document;
    assert.equal(doc.querySelectorAll('article.card').length,18);assert.equal(new Set([...doc.querySelectorAll('[id]')].map(node=>node.id)).size,doc.querySelectorAll('[id]').length);
    for(const record of records)assert.ok(doc.getElementById(`title-${record.id}`)?.textContent===record.title);
    assert.equal(doc.querySelectorAll('script').length,0);
    if(route.item){assert.equal(doc.querySelector('#canvas article')?.getAttribute('data-content-id'),route.item);assert.ok(doc.querySelector('#canvas .detail-body')!.textContent!.includes('让文字保留自己的节奏'));assert.equal(doc.querySelector('#canvas .detail-body')!.hasAttribute('inert'),false);}
    dom.window.close();
  }
});
test('route parser rejects unknown records and resolves conflicting category truth',()=>{
  assert.deepEqual(parseRoute(new URLSearchParams('space=work&item=thoughts-long'),records),{category:'thoughts',item:'thoughts-long',chat:false});
  assert.deepEqual(parseRoute(new URLSearchParams('space=bad&item=evil&chat=yes'),records),defaultRoute);
});
test('Strict Mode hydration adopts the exact SSR nodes; rerender and refresh payload never overwrite native ownership',async()=>{
  const initialHtml=renderContent(defaultRoute),element=React.createElement(StrictMode,null,React.createElement(NativeContentIsland,{initialHtml,manifest}));
  const dom=environment(renderToString(element)),env=dom.window,container=env.document.getElementById('root')!;
  const saved=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value]of Object.entries({window:env,document:env.document,navigator:env.navigator,HTMLElement:env.HTMLElement,Node:env.Node,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const nodes=[...container.querySelectorAll('article.card')],errors:unknown[]=[],originalError=console.error;console.error=(...args)=>errors.push(args);
  let root: ReturnType<typeof hydrateRoot>|undefined;
  try {
    await act(async()=>{root=hydrateRoot(container,element,{onRecoverableError:error=>errors.push(error)});});
    const native=()=> (env as unknown as {personalOSNextContent:ReturnType<typeof mountContent>}).personalOSNextContent;
    assert.equal(native().snapshot().articleCount,18);assert.ok(nodes.every(node=>container.contains(node)));
    const long=nodes.find(node=>node.getAttribute('data-content-id')==='thoughts-long')!;
    env.document.documentElement.scrollTop=730;
    await act(async()=>{native().open('thoughts-long');native().advance(1);});
    assert.equal(long.parentElement?.id,'canvas');assert.equal(native().snapshot().phase,'detail');
    const reader=env.document.getElementById('reader')!;reader.scrollTop=280;
    await act(async()=>{root!.render(React.createElement(StrictMode,null,React.createElement(NativeContentIsland,{initialHtml:renderContent({category:'work',item:null,chat:false}),manifest:[...manifest]})));});
    assert.equal(long.parentElement?.id,'canvas');assert.equal(reader.scrollTop,280);assert.ok(nodes.every(node=>container.contains(node)));
    await act(async()=>{native().close();native().advance(1);await pause();native().advance(1);});
    assert.equal(long.parentElement?.getAttribute('data-id'),'thoughts-long');assert.equal(env.document.documentElement.scrollTop,730);assert.equal(env.document.activeElement,long.querySelector('.open-card'));
    await act(async()=>{env.history.forward();await pause();native().advance(1);});
    assert.equal(long.parentElement?.id,'canvas');assert.equal(reader.scrollTop,280);
    await act(async()=>{native().close();native().open('thoughts-long');await pause();native().advance(1);});
    assert.equal(long.parentElement?.id,'canvas');assert.equal(native().snapshot().phase,'detail');
    assert.equal(container.querySelectorAll('article.card').length,18);assert.equal(errors.length,0,JSON.stringify(errors));
    // Actual component departure/return, distinct from a Next router integration result.
    await act(async()=>{root!.render(React.createElement('div',null,'departed'));});
    assert.equal((env as unknown as {personalOSNextContent?:unknown}).personalOSNextContent,undefined);
    await act(async()=>{root!.render(element);});assert.equal(native().snapshot().articleCount,18);
    await act(async()=>{root!.unmount();});root=undefined;
    assert.equal(errors.length,0,JSON.stringify(errors));
  } finally {if(root)await act(async()=>root!.unmount());console.error=originalError;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});
test('deep-link mount preserves history depth and exact article, cleanup/setup releases every controller',()=>{
  const route={category:'thoughts',item:'thoughts-long',chat:false} as const,dom=environment(`<div id="native-content-island">${renderContent(route)}</div>`,'http://localhost/?space=thoughts&item=thoughts-long');
  const host=dom.window.document.getElementById('native-content-island')!,article=host.querySelector('[data-content-id="thoughts-long"]'),depth=dom.window.history.length;
  for(let i=0;i<3;i++){const controller=mountContent(host,manifest);controller.advance(1);assert.equal(host.querySelector('#canvas article'),article);assert.equal(dom.window.history.length,depth);controller.dispose();assert.equal(controller.snapshot().listeners,0);assert.equal(controller.snapshot().framePending,false);assert.equal(host.querySelectorAll('article.card').length,18);}
  dom.window.close();
});
test('GPU gate never passes zero canvases or non-rendering doubles',()=>{
  const missing={availability:'fallback',canvasCount:0,actorCount:0};assert.equal(assessGPU(missing,missing).status,'blocked');
  const fake={availability:'ready',canvasCount:0,actorCount:0};assert.equal(assessGPU(fake,fake).status,'failed');
  const idle={availability:'ready',canvasCount:1,actorCount:1,actorUUID:'ball',calls:0,frames:0};assert.equal(assessGPU(idle,idle).status,'failed');
  const realShape={...idle,calls:2,frames:4};assert.equal(assessGPU(realShape,{...realShape,actorUUID:'different'}).status,'failed');assert.equal(assessGPU(realShape,realShape).status,'passed');
});

test('route departure cleanup cannot overwrite Next pathname or destination query',()=>{
  const dom=environment('');
  const authority=createNavigationAuthority(dom.window as unknown as Window,manifest,()=>({feed:0,reader:0}));
  authority.open('thoughts-long');
  dom.window.history.pushState({nextRoute:true},'', '/route-check?probe=1');
  authority.dispose();
  assert.equal(dom.window.location.pathname+dom.window.location.search,'/route-check?probe=1');
  assert.deepEqual(dom.window.history.state,{nextRoute:true});
  dom.window.close();
});

test('completed reader advance is idempotent and has no residual RAF',async()=>{
  const dom=environment(`<div id="native-content-island">${renderContent(defaultRoute)}</div>`),host=dom.window.document.getElementById('native-content-island')!;
  const controller=mountContent(host,manifest),reader=host.querySelector<HTMLElement>('#reader')!;
  try{
    controller.open('thoughts-long');controller.advance(1);reader.scrollTop=280;
    controller.advance(1);assert.equal(reader.scrollTop,280,'Repeated completion must never reset a user scroll offset');
    assert.equal(controller.snapshot().framePending,false,'Completion must cancel the previously scheduled RAF');
    await pause();assert.equal(reader.scrollTop,280);
    assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='detail-ready').length,1);
  }finally{controller.dispose();dom.window.close();}
});

test('bound reduced-motion completion handler does not repeat settlement or reset native reader scroll',async()=>{
  const dom=environment(`<div id="native-content-island">${renderContent(defaultRoute)}</div>`),host=dom.window.document.getElementById('native-content-island')!;
  const query=dom.window.matchMedia('(prefers-reduced-motion: reduce)') as MediaQueryList & {matches:boolean};
  query.matches=false;
  const controller=mountContent(host,manifest),reader=host.querySelector<HTMLElement>('#reader')!;
  try{
    controller.open('thoughts-long');assert.equal(controller.snapshot().framePending,true);
    query.matches=true;query.dispatchEvent(new dom.window.Event('change'));
    assert.equal(controller.snapshot().phase,'detail');reader.scrollTop=280;
    query.matches=false;query.dispatchEvent(new dom.window.Event('change'));
    query.matches=true;query.dispatchEvent(new dom.window.Event('change'));
    assert.equal(reader.scrollTop,280,'The actual bound change handler must be idempotent at completion');
    assert.equal(controller.snapshot().framePending,false);
    await pause();assert.equal(reader.scrollTop,280);assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='detail-ready').length,1);
  }finally{controller.dispose();dom.window.close();}
});
