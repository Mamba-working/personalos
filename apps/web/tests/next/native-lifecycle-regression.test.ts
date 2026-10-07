import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountContent } from '../../native/content/controller';
import { createNavigationAuthority } from '../../lib/navigation/navigation-authority';
import { records } from '../../lib/server/demo-content';
import { renderContent } from '../../lib/server/content-html';
const manifest=records.map(({id,category,title,height,index,kind})=>({id,category,title,height,index,kind}));
const sleep=()=>new Promise(resolve=>setTimeout(resolve,30));
function fixture({url='http://localhost/',reduced=false}={}) {
  const state={category:'all',item:null,chat:false} as const;
  const dom=new JSDOM(`<!doctype html><html><body><header class="topbar"></header><div id="native-content-island">${renderContent(state)}</div></body></html>`,{url,pretendToBeVisual:true}),env=dom.window,doc=env.document;
  let time=0,nextId=0;const frames=new Map<number,FrameRequestCallback>();
  Object.defineProperty(doc,'scrollingElement',{value:doc.documentElement});Object.defineProperty(doc,'hidden',{value:false,writable:true,configurable:true});
  env.performance.now=()=>time;env.requestAnimationFrame=callback=>{frames.set(++nextId,callback);return nextId;};env.cancelAnimationFrame=id=>{frames.delete(id);};
  const media=Object.assign(new env.EventTarget(),{matches:reduced,media:'(prefers-reduced-motion: reduce)'});env.matchMedia=()=>media as never;
  env.HTMLElement.prototype.getBoundingClientRect=function(){const width=this.classList.contains('slot')||this.classList.contains('identity')?330:this.id==='feed'?1030:1040,height=this.classList.contains('identity')?300:this.classList.contains('topbar')?76:parseFloat(this.style.getPropertyValue('--height'))||600;return{x:24,y:100,width,height,top:100,left:24,right:24+width,bottom:100+height,toJSON(){return this;}}};
  Object.defineProperty(env.HTMLElement.prototype,'offsetWidth',{get(){return this.getBoundingClientRect().width}});Object.defineProperty(env.HTMLElement.prototype,'offsetHeight',{get(){return this.getBoundingClientRect().height}});Object.defineProperty(env.HTMLElement.prototype,'scrollHeight',{get(){return 2000}});
  const root=doc.getElementById('native-content-island')!;
  return {dom,env,doc,root,frames,media,now:()=>time,elapse(ms:number){time+=ms;},frame(ms:number){time+=ms;const pending=[...frames];frames.clear();for(const[,callback]of pending)callback(time);return pending.length;},frameAt(stamp:number){const pending=[...frames];frames.clear();for(const[,callback]of pending)callback(stamp);},visible(visible:boolean){Object.defineProperty(doc,'hidden',{value:!visible,writable:true,configurable:true});doc.dispatchEvent(new env.Event('visibilitychange'));}};
}

test('navigation mount and disposal leave opaque framework history state untouched',()=>{
  const f=fixture(),opaque={frameworkOwned:{tree:['initial']},marker:'do-not-replace'};f.env.history.replaceState(opaque,'');const initial=f.env.history.state,depth=f.env.history.length;
  const originalReplace=f.env.history.replaceState.bind(f.env.history),originalPush=f.env.history.pushState.bind(f.env.history);let writes=0;
  f.env.history.replaceState=(...args)=>{writes++;originalReplace(...args);};f.env.history.pushState=(...args)=>{writes++;originalPush(...args);};
  try{for(let i=0;i<3;i++){const authority=createNavigationAuthority(f.env as unknown as Window,manifest,()=>({feed:0,reader:0}));authority.dispose();authority.checkpoint();}assert.equal(writes,0);assert.equal(f.env.history.state,initial);assert.equal(f.env.history.length,depth);}finally{f.dom.window.close();}
});

test('user intent resolves history wrappers installed after mount without copying their opaque state',()=>{
  const f=fixture(),authority=createNavigationAuthority(f.env as unknown as Window,manifest,()=>({feed:730,reader:0}));
  const originalReplace=f.env.history.replaceState.bind(f.env.history),originalPush=f.env.history.pushState.bind(f.env.history);const calls:string[]=[];
  const wrapper=(method:string,original:History['pushState'])=>(data:Record<string,unknown>,unused:string,url?:string|URL|null)=>{calls.push(method);assert.deepEqual(Object.keys(data),['personalosNext']);original({...data,frameworkOwned:'wrapper-installed-after-child-mount'},unused,url);};
  f.env.history.replaceState=wrapper('replaceState',originalReplace);f.env.history.pushState=wrapper('pushState',originalPush);
  try{assert.deepEqual(calls,[]);authority.open('thoughts-long');assert.deepEqual(calls,['replaceState','pushState']);assert.equal(f.env.history.state.frameworkOwned,'wrapper-installed-after-child-mount');authority.dispose();assert.equal(calls.length,2);}finally{authority.dispose();f.dom.window.close();}
});

test('reader offsets belong to stable history entry IDs, including repeated URLs',async()=>{
  const f=fixture(),position={feed:730,reader:0},authority=createNavigationAuthority(f.env as unknown as Window,manifest,()=>({...position}));
  const restored:number[]=[];authority.subscribe((_route,saved)=>{if(saved){position.reader=saved.reader;restored.push(saved.reader);}});
  const traverse=async(direction:'back'|'forward')=>{const popped=new Promise<void>(resolve=>f.env.addEventListener('popstate',()=>resolve(),{once:true}));f.env.history[direction]();await popped;};
  try{authority.open('thoughts-long');const first=f.env.history.state.personalosNext.id;position.reader=527;authority.open('thoughts-long');const second=f.env.history.state.personalosNext.id;assert.notEqual(first,second);position.reader=840;await traverse('back');assert.equal(position.reader,527);position.reader=615;await traverse('forward');assert.equal(position.reader,840);await traverse('back');assert.equal(position.reader,615);assert.deepEqual(restored,[527,840,615]);}finally{authority.dispose();f.dom.window.close();}
});

test('Close then reopen then Close queues the latest intent without a second traversal',async()=>{
  const f=fixture(),authority=createNavigationAuthority(f.env as unknown as Window,manifest,()=>({feed:730,reader:527}));
  const originalBack=f.env.history.back.bind(f.env.history);let traversals=0;f.env.history.back=()=>{traversals++;originalBack();};
  try{authority.filter('thoughts');authority.open('thoughts-long');const popped=new Promise<void>(resolve=>f.env.addEventListener('popstate',()=>resolve(),{once:true}));authority.close();authority.open('thoughts-long');authority.close();assert.equal(traversals,1);await popped;assert.equal(authority.getState().item,null);assert.equal(authority.getState().category,'thoughts');assert.equal(f.env.location.search,'?space=thoughts');}finally{authority.dispose();f.dom.window.close();}
});

test('direct browser Back then Forward restores the outgoing reader position without a Close checkpoint',async()=>{
  const f=fixture({reduced:true}),controller=mountContent(f.root,manifest),article=f.root.querySelector('[data-content-id="thoughts-long"]'),reader=f.doc.getElementById('reader')!;
  try{f.doc.documentElement.scrollTop=730;controller.open('thoughts-long');f.frame(16);reader.scrollTop=527;f.env.history.back();await sleep();f.frame(16);assert.equal(controller.snapshot().phase,'preview');assert.equal(f.doc.documentElement.scrollTop,730);f.env.history.forward();await sleep();f.frame(16);assert.equal(controller.snapshot().phase,'detail');assert.equal(reader.scrollTop,527);assert.equal(f.doc.querySelector('#canvas article'),article);}finally{controller.dispose();f.dom.window.close();}
});

for(const hz of [60,30,10,2])test(`${hz} Hz native RAF consumes full active elapsed and retains nodes through open and close`,async()=>{
  const f=fixture(),controller=mountContent(f.root,manifest),article=f.root.querySelector('[data-content-id="thoughts-long"]');
  try{controller.open('thoughts-long');let elapsed=0;while(controller.snapshot().phase!=='detail'&&elapsed<2){f.frame(1000/hz);elapsed+=1/hz;}assert.equal(controller.snapshot().phase,'detail');assert(elapsed<=.9+1/hz);assert.equal(f.doc.querySelector('#canvas article'),article);controller.close();await sleep();elapsed=0;while(controller.snapshot().phase!=='preview'&&elapsed<2){f.frame(1000/hz);elapsed+=1/hz;}assert.equal(controller.snapshot().phase,'preview');assert(elapsed<=.9+1/hz);assert.equal(article?.parentElement?.getAttribute('data-id'),'thoughts-long');assert.equal(f.frames.size,0);assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='detail-ready').length,1);assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='returned').length,1);}finally{controller.dispose();f.dom.window.close();}
});

test('hidden pause excludes the hidden gap and resumes without a catch-up burst',()=>{
  const f=fixture(),controller=mountContent(f.root,manifest);const progress:number[]=[];f.env.addEventListener('personalos:content-transition',event=>progress.push((event as CustomEvent).detail.progress));
  try{controller.open('thoughts-long');f.frame(100);const before=progress.at(-1)!;f.visible(false);assert.equal(f.frames.size,0);f.elapse(600000);assert.equal(progress.at(-1),before);f.visible(true);f.frame(10);const after=progress.at(-1)!;assert(after>before&&after<.9);f.frame(1000);assert.equal(controller.snapshot().phase,'detail');assert.equal(f.frames.size,0);}finally{controller.dispose();f.dom.window.close();}
});

test('retarget epoch excludes earlier stalled time and stale same-frame RAF timestamps',async()=>{
  const f=fixture(),controller=mountContent(f.root,manifest);let progress=0;f.env.addEventListener('personalos:content-transition',event=>{progress=(event as CustomEvent).detail.progress;});
  try{controller.open('thoughts-long');f.frame(100);controller.close();await sleep();f.frame(20);f.elapse(5000);const before=progress;controller.open('thoughts-long');await sleep();f.frameAt(f.now()-10);assert.equal(progress,before,'A callback timestamp preceding this intent must consume zero time');f.frame(10);assert(progress>=before&&progress<.99);f.frame(1000);assert.equal(controller.snapshot().phase,'detail');}finally{controller.dispose();f.dom.window.close();}
});

test('repeated Close is idempotent and cannot keep postponing the return epoch',async()=>{
  const f=fixture(),controller=mountContent(f.root,manifest);
  try{controller.open('thoughts-long');f.frame(100);controller.close();await sleep();let elapsed=0;while(controller.snapshot().phase!=='preview'&&elapsed<2){f.elapse(90);controller.close();f.frame(10);elapsed+=.1;}assert.equal(controller.snapshot().phase,'preview');assert(elapsed<1);assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='cancel-return').length,1);}finally{controller.dispose();f.dom.window.close();}
});

test('non-finite elapsed is inert and a long visible stall settles exactly once',()=>{
  const f=fixture(),controller=mountContent(f.root,manifest);let lastProgress=0;f.env.addEventListener('personalos:content-transition',event=>{lastProgress=(event as CustomEvent).detail.progress;});
  try{controller.open('thoughts-long');for(const value of [NaN,Infinity,-Infinity,-5]){controller.advance(value);assert.equal(lastProgress,0);}f.frame(600000);assert.equal(controller.snapshot().phase,'detail');assert.equal(lastProgress,1);controller.advance(600);assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='detail-ready').length,1);assert.equal(f.frames.size,0);}finally{controller.dispose();f.dom.window.close();}
});

test('a progress listener retargeting a settled frame cannot complete the obsolete intent',async()=>{
  const f=fixture(),controller=mountContent(f.root,manifest);let reverse=false;
  const onProgress=(event:Event)=>{const detail=(event as CustomEvent).detail;if(reverse&&detail.action==='progress'&&detail.progress===1){reverse=false;controller.close();}};
  f.env.addEventListener('personalos:content-transition',onProgress);
  try{controller.open('thoughts-long');reverse=true;f.frame(1000);assert.equal(controller.snapshot().phase,'return');assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='detail-ready').length,0);await sleep();f.frame(1000);assert.equal(controller.snapshot().phase,'preview');assert.equal(controller.snapshot().trace.filter(entry=>entry.action==='returned').length,1);assert.equal(f.frames.size,0);}finally{controller.dispose();f.dom.window.close();}
});
