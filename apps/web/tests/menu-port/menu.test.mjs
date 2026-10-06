import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../integration/node_modules/jsdom/lib/api.js';
import {mountMenu} from '../../runtime/modules/menu.js';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture({reduced=false, animate=true, mobile=false, navigate}={}) {
  const dom = new JSDOM('<!doctype html><body><header><button id="before">Before</button><span id="menu"></span></header><main class="app" style="transform:none"><button id="feed">Feed</button></main><aside inert id="preexisting">Owner inert</aside></body>', {url:'https://example.test/runtime/?story=on&item=work-item'});
  const {window:win} = dom, doc=win.document;
  const mode=doc.createElement('style');mode.textContent=`.pos-menu-dialog{--pos-menu-mobile:${mobile?1:0}}`;doc.head.append(mode);
  const queries=[];
  win.matchMedia = query => { const q = new win.EventTarget();q.matches=query.includes('reduced')?reduced:mobile;q.media=query;queries.push(q);return q; };
  win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');this.querySelector('[autofocus]')?.focus();};
  win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');queueMicrotask(()=>this.dispatchEvent(new win.Event('close')));};
  const tracks=[];
  if(animate) win.Element.prototype.animate=function(frames,options){
    let resolve,reject;
    const a={element:this,frames,options,currentTime:0,playbackRate:1,playState:'running',cancelled:false,pause(){this.playState='paused';},play(){if(this.playState==='finished')this.renew();if(this.playbackRate<0&&this.currentTime<=0)this.currentTime=options.duration;if(this.playbackRate>=0&&this.currentTime>=options.duration)this.currentTime=0;this.playState='running';},renew(){this.finished=new Promise((r,j)=>{resolve=r;reject=j;});this.finished.catch(()=>{});},finish(){this.currentTime=this.playbackRate<0?0:options.duration;this.playState='finished';resolve();},cancel(){this.cancelled=true;this.playState='idle';reject();}};
    a.renew();tracks.push(a);return a;
  };
  let state={content:{category:'all',phase:'preview'},reduced:false},calls=[],subscribers=new Set();
  const host={getState:()=>state,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},navigate:async c=>{calls.push(c);return navigate?await navigate(c):true;}};
  const container=doc.querySelector('#menu'),api=mountMenu({host,container});
  const query=s=>container.querySelector(s),click=s=>query(s).click();
  return {dom,win,doc,host,api,container,query,click,tracks,calls,subscribers,queries,
    active(){return tracks.filter(t=>!t.cancelled);},
    async finish(){tracks.filter(t=>t.playState==='running').forEach(t=>t.finish());await flush();},
    async open(){query('.pos-menu-toggle').focus();click('.pos-menu-toggle');await flush();},
    emit(next){state={...state,...next};subscribers.forEach(f=>f(state));},
    silentState(next){state={...state,...next};},
    key(key,shiftKey=false){const e=new win.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true});doc.activeElement.dispatchEvent(e);return e;},
    dispose(){api.dispose();dom.window.close();},
  };
}

test('mounts only inside supplied container and is idempotent',()=>{
  const f=fixture();assert.equal(mountMenu({host:f.host,container:f.container}),f.api);
  assert.equal(f.doc.querySelectorAll('dialog').length,1);assert.equal(f.doc.querySelectorAll('.pos-menu-toggle').length,1);
  assert.equal(f.container.children.length,1);assert.equal(f.doc.querySelector('#preexisting').hasAttribute('inert'),true);
  assert.deepEqual(f.api.getState(),{phase:'closed',open:false,modal:false,category:'all',reduced:false,pendingCategory:null,error:null,disposed:false});f.dispose();
});
test('category links retain real URL semantics and omit unsupported legacy destinations',()=>{
  const f=fixture();for(const a of f.container.querySelectorAll('a')){const url=new URL(a.href);assert.equal(url.searchParams.get('story'),'on');assert.equal(url.searchParams.get('space'),a.dataset.menuCategory);assert.equal(url.searchParams.has('item'),false);}
  assert.equal(f.container.querySelectorAll('[data-menu-category]').length,4);assert.equal(f.query('[data-menu-category=all]').getAttribute('aria-current'),'page');
  assert.doesNotMatch(f.container.textContent,/关于原型|关于我|吴逸飞|查看独立|主动提示/);f.dispose();
});
test('opening and closing settle, release native modal, restore focus without changing page geometry',async()=>{
  const f=fixture();const before=f.doc.querySelector('.app').outerHTML;await f.open();assert.equal(f.api.getState().phase,'opening');assert.equal(f.query('dialog').open,true);assert.equal(f.doc.activeElement,f.query('.pos-menu-toggle'));
  await f.finish();assert.equal(f.api.getState().phase,'open');f.click('.pos-menu-toggle');await f.finish();
  assert.equal(f.api.getState().phase,'closed');assert.equal(f.query('dialog').open,false);assert.equal(f.doc.activeElement,f.query('.pos-menu-toggle'));assert.equal(f.doc.querySelector('.app').outerHTML,before);assert.equal(f.doc.body.getAttribute('style'),null);f.dispose();
});
const shift = frame => Number(frame.transform.match(/translateX\(([-\d.]+)/)?.[1] || 0);
const frameAt = (animation, ms) => {
  const offset=ms/animation.options.duration,frames=animation.frames;
  const end=frames.findIndex(frame=>frame.offset>=offset);
  if(end<=0)return frames[0];
  const a=frames[end-1],b=frames[end],p=(offset-a.offset)/(b.offset-a.offset);
  return {transform:`translateX(${shift(a)+(shift(b)-shift(a))*p}px)`};
};
test('reverse retargets each track from its presented position and incoming velocity',async()=>{
  const f=fixture();await f.open();f.active().forEach(t=>t.currentTime=280);
  const opening=f.active()[0],before=shift(frameAt(opening,280));
  f.click('.pos-menu-toggle');const closing=f.active()[0];
  assert.equal(f.api.getState().phase,'closing');assert.ok(opening.cancelled);
  assert.ok(Math.abs(shift(closing.frames[0])-before)<.25);
  assert.ok(shift(closing.frames[1])<shift(closing.frames[0]),'incoming opening velocity is preserved initially');
  assert.ok(closing.options.duration>=180&&closing.options.duration<800);
  assert.ok(f.active().every(t=>t.frames[1].offset<.1),'close has no opening delay');
  f.active().forEach(t=>t.currentTime=60);f.click('.pos-menu-toggle');
  assert.equal(f.api.getState().phase,'opening');assert.ok(closing.cancelled);
  opening.finish();closing.finish();await flush();assert.equal(f.api.getState().phase,'opening');
  await f.finish();assert.equal(f.api.getState().phase,'open');assert.equal(f.query('dialog').open,true);f.dispose();
});
test('same-task open/close at zero settles without Web Animations auto-rewind',async()=>{
  const f=fixture();await f.open();assert.ok(f.tracks.every(t=>t.currentTime===0));f.click('.pos-menu-toggle');assert.equal(f.api.getState().phase,'closed');assert.equal(f.api.getState().modal,false);assert.ok(f.tracks.every(t=>t.currentTime===0));f.dispose();
});
test('same-task close/reopen at full progress settles without a reset to zero',async()=>{
  const f=fixture();await f.open();await f.finish();f.click('.pos-menu-toggle');f.click('.pos-menu-toggle');assert.equal(f.api.getState().phase,'open');assert.ok(f.active().length===0);assert.equal(f.query('.pos-menu-panel').style.transform,'translateX(0px)');await flush();assert.equal(f.api.getState().modal,true);f.dispose();
});
test('rapid completed close/reopen ignores queued native close event',async()=>{
  const f=fixture({reduced:true});await f.open();f.click('.pos-menu-toggle');f.click('.pos-menu-toggle');await flush();assert.equal(f.api.getState().phase,'open');assert.equal(f.query('dialog').open,true);f.dispose();
});
test('Tab cycles and Escape preempts existing document-capture chat handlers',async()=>{
  const f=fixture();let chatKeys=0;f.doc.addEventListener('keydown',()=>chatKeys++,true);await f.open();f.tracks.forEach(t=>t.currentTime=200);
  assert.equal(f.key('Tab').defaultPrevented,true);assert.equal(f.doc.activeElement,f.query('[data-menu-category=work]'));
  f.key('Tab',true);assert.equal(f.doc.activeElement,f.query('.pos-menu-toggle'));f.key('Tab',true);assert.equal(f.doc.activeElement,f.query('[data-menu-category=all]'));
  f.key('Escape');assert.equal(chatKeys,0);assert.equal(f.api.getState().phase,'closing');await f.finish();f.key('Tab');assert.equal(chatKeys,1);f.dispose();
});
test('Escape repeated during close settles immediately rather than reopening',async()=>{
  const f=fixture();await f.open();f.key('Escape');f.key('Escape');assert.equal(f.api.getState().phase,'closed');assert.equal(f.query('dialog').open,false);f.dispose();
});
test('reduced motion opens and closes synchronously and preference changes settle in-flight work',async()=>{
  const f=fixture({reduced:true});await f.open();assert.equal(f.api.getState().phase,'open');f.click('.pos-menu-toggle');assert.equal(f.api.getState().phase,'closed');f.dispose();
  const g=fixture();await g.open();g.emit({reduced:true});assert.equal(g.api.getState().phase,'open');g.emit({reduced:false});g.click('.pos-menu-toggle');g.queries[0].matches=true;g.queries[0].dispatchEvent(new g.win.Event('change'));assert.equal(g.api.getState().phase,'closed');g.dispose();
});
test('no WAAPI still has a usable native menu and zero pending motion',async()=>{
  const f=fixture({animate:false});await f.open();assert.equal(f.api.getState().phase,'open');f.click('.pos-menu-toggle');assert.equal(f.api.getState().modal,false);f.dispose();
});
test('actual category click delegates once to host, closes, and synchronizes current category',async()=>{
  const f=fixture();await f.open();f.tracks.forEach(t=>t.currentTime=200);f.click('[data-menu-category=thoughts]');assert.deepEqual(f.calls,['thoughts']);assert.equal(f.api.getState().phase,'closing');await flush();f.emit({content:{category:'thoughts',phase:'preview'}});
  assert.equal(f.query('[data-menu-category=thoughts]').getAttribute('aria-current'),'page');assert.equal(f.query('[data-menu-category=all]').hasAttribute('aria-current'),false);await f.finish();assert.equal(f.api.getState().pendingCategory,null);f.dispose();
});
test('opening refreshes category from host when original filters changed without a notification',async()=>{
  const f=fixture();f.silentState({content:{category:'labs',phase:'preview'}});await f.open();assert.equal(f.api.getState().category,'labs');assert.equal(f.query('[data-menu-category=labs]').getAttribute('aria-current'),'page');f.dispose();
});
test('modifier-click keeps browser link semantics and performs no host navigation',async()=>{
  const f=fixture();await f.open();const e=new f.win.MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true});f.query('[data-menu-category=work]').addEventListener('click',event=>{queueMicrotask(()=>event.preventDefault());});
  f.query('[data-menu-category=work]').dispatchEvent(e);assert.deepEqual(f.calls,[]);assert.equal(e.defaultPrevented,false);f.dispose();
});
test('repeated pending category click deduplicates and newer category intent wins local status',async()=>{
  const resolvers={};const f=fixture({navigate:c=>new Promise(resolve=>{resolvers[c]=resolve;})});await f.open();f.tracks.forEach(t=>t.currentTime=200);f.click('[data-menu-category=work]');f.click('[data-menu-category=work]');assert.deepEqual(f.calls,['work']);f.click('.pos-menu-toggle');f.click('[data-menu-category=labs]');assert.deepEqual(f.calls,['work','labs']);
  resolvers.work(false);await flush();assert.equal(f.api.getState().pendingCategory,'labs');assert.equal(f.api.getState().error,null);resolvers.labs(true);await flush();assert.equal(f.api.getState().pendingCategory,null);f.dispose();
});
test('navigation rejection is announced and menu remains reopenable',async()=>{
  const f=fixture({navigate:async()=>{throw Error('host unavailable');}});await f.open();f.click('[data-menu-category=work]');await flush();assert.match(f.api.getState().error,/再试一次/);assert.match(f.query('[role=status]').textContent,/再试一次/);await f.finish();await f.open();assert.equal(f.api.getState().error,null);f.dispose();
});
test('one live status node stays inside active modal and returns outside on close',async()=>{
  let fail;const f=fixture({navigate:()=>new Promise((resolve,reject)=>fail=reject)});await f.open();f.tracks.forEach(t=>t.currentTime=200);const status=f.query('[role=status]');assert.ok(f.query('dialog').contains(status));f.click('[data-menu-category=work]');fail(Error('unavailable'));await flush();assert.match(status.textContent,/再试一次/);assert.ok(f.query('dialog').contains(status));await f.finish();assert.equal(f.query('dialog').contains(status),false);assert.equal(f.query('[role=status]'),status);f.dispose();
});
test('backdrop only dismisses taps that started outside panel',async()=>{
  const f=fixture();await f.open();f.query('.pos-menu-link').dispatchEvent(new f.win.Event('pointerdown',{bubbles:true}));f.click('.pos-menu-shade');assert.equal(f.api.getState().open,true);f.query('.pos-menu-shade').dispatchEvent(new f.win.Event('pointerdown',{bubbles:true}));f.click('.pos-menu-shade');assert.equal(f.api.getState().open,false);f.dispose();
});
test('wheel and touch cannot chain from empty menu or scroll edges to the underlying page',async()=>{
  const f=fixture();await f.open();const scroller=f.query('.pos-menu-content'),link=f.query('.pos-menu-link');Object.defineProperties(scroller,{clientHeight:{value:400,configurable:true},scrollHeight:{value:800,configurable:true}});
  const wheel=(node,deltaY)=>{const e=new f.win.WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true});node.dispatchEvent(e);return e.defaultPrevented;};
  assert.equal(wheel(f.query('.pos-menu-shade'),100),true);assert.equal(wheel(link,-100),true);assert.equal(wheel(link,100),false);scroller.scrollTop=400;assert.equal(wheel(link,100),true);assert.equal(wheel(link,-100),false);
  const touch=(type,y)=>{const e=new f.win.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientY:y}]});link.dispatchEvent(e);return e.defaultPrevented;};
  scroller.scrollTop=0;touch('touchstart',100);assert.equal(touch('touchmove',150),true);assert.equal(touch('touchmove',100),false);
  Object.defineProperty(scroller,'scrollHeight',{value:400});assert.equal(wheel(link,100),true);touch('touchstart',100);assert.equal(touch('touchmove',90),true);assert.equal(f.doc.documentElement.scrollTop,0);f.dispose();
});
test('Ctrl-wheel and trackpad pinch preserve browser zoom even at empty/menu backdrop boundaries',async()=>{
  const f=fixture();await f.open();for(const node of [f.query('.pos-menu-shade'),f.query('.pos-menu-link')]){const e=new f.win.WheelEvent('wheel',{deltaY:100,ctrlKey:true,bubbles:true,cancelable:true});node.dispatchEvent(e);assert.equal(e.defaultPrevented,false);}f.dispose();
});
test('keyboard scroll is scoped to menu while Space on a button retains native activation',async()=>{
  const f=fixture();await f.open();const scroller=f.query('.pos-menu-content');Object.defineProperties(scroller,{clientHeight:{value:400},scrollHeight:{value:1000}});
  assert.equal(f.key(' ').defaultPrevented,false);f.query('.pos-menu-link').focus();assert.equal(f.key('End').defaultPrevented,true);assert.equal(scroller.scrollTop,600);f.key('Home');assert.equal(scroller.scrollTop,0);f.key('PageDown');assert.equal(scroller.scrollTop,340);f.key('ArrowUp');assert.equal(scroller.scrollTop,300);f.key(' ',true);assert.equal(scroller.scrollTop,0);assert.equal(f.doc.documentElement.scrollTop,0);f.dispose();
});
test('dispose cancels animation, releases modal, unsubscribes and does not delete host nodes',async()=>{
  let finishNavigation;const f=fixture({navigate:()=>new Promise(r=>finishNavigation=r)});await f.open();f.click('[data-menu-category=work]');const tracks=[...f.tracks];f.api.dispose();finishNavigation(false);await flush();assert.equal(f.container.children.length,0);assert.equal(f.subscribers.size,0);assert.ok(tracks.every(t=>t.cancelled));assert.equal(f.doc.querySelector('#preexisting').hasAttribute('inert'),true);assert.equal(f.api.getState().disposed,true);assert.equal(f.doc.querySelector('dialog'),null);f.dispose();
});
test('independent source timing uses CSS width mode and opening-only row delays',async()=>{
  for(const mobile of [false,true]) {
    const f=fixture({mobile});await f.open();const tracks=f.active();
    assert.equal(tracks[0].options.duration,800);assert.equal(tracks[1].options.duration,850);
    assert.equal(tracks.at(-1).options.duration,300);
    for(let i=0;i<3;i++) {
      const delay=(mobile?100:0)+i*30,track=tracks[i+2];
      assert.equal(track.options.duration,800+delay);
      if(delay)assert.equal(track.frames[1].offset,delay/(800+delay));
    }
    await f.finish();f.click('.pos-menu-toggle');const close=f.active();
    assert.equal(close[0].options.duration,800);assert.equal(close[1].options.duration,850);
    assert.equal(close.at(-1).options.duration,300);
    assert.ok(close.every(t=>t.frames[1].offset*t.options.duration<=10.001));
    await f.finish();f.dispose();
  }
  const css=fs.readFileSync(new URL('../../runtime/modules/menu.css',import.meta.url),'utf8');
  assert.match(css,/safe-area-inset-bottom/);assert.match(css,/--pos-menu-mobile:1/);
});
test('one identical button moves into modal controls and returns to its reserved anchor',async()=>{
  const f=fixture(),button=f.query('.pos-menu-toggle'),anchor=f.query('.pos-menu-anchor');
  await f.open();assert.equal(f.query('.pos-menu-toggle'),button);assert.equal(button.parentElement,f.query('.pos-menu-controls'));
  assert.equal(f.query('dialog').querySelectorAll('button').length,1);assert.ok(anchor.style.width);assert.equal(f.doc.activeElement,button);
  await f.finish();f.click('.pos-menu-toggle');await f.finish();assert.equal(button.parentElement,anchor);assert.equal(anchor.getAttribute('style'),null);assert.equal(button.getAttribute('style'),null);f.dispose();
});
test('resize rebases in-flight position, reads CSS mode, and cancels stale completions',async()=>{
  const f=fixture();await f.open();f.active().forEach(t=>t.currentTime=280);
  const old=f.active()[0],oldWidth=f.win.innerWidth,before=shift(frameAt(old,280))+oldWidth-Math.min(650,oldWidth*.65);
  f.win.innerWidth=390;f.doc.querySelector('style').textContent='.pos-menu-dialog{--pos-menu-mobile:1}';f.win.dispatchEvent(new f.win.Event('resize'));
  const next=f.active()[0];assert.ok(old.cancelled);assert.ok(Math.abs(shift(next.frames[0])-before)<.25);assert.equal(f.api.getState().phase,'opening');
  old.finish();await flush();assert.equal(f.api.getState().phase,'opening');await f.finish();assert.equal(f.api.getState().phase,'open');
  f.api.dispose();f.win.dispatchEvent(new f.win.Event('resize'));assert.equal(f.query('.pos-menu'),null);f.dom.window.close();
});
test('horizontal reveal is isolated while the native y scroller retains a stable gutter',()=>{
  const css=fs.readFileSync(new URL('../../runtime/modules/menu.css',import.meta.url),'utf8');
  assert.match(css,/\.pos-menu-content\{[^}]*overflow-x:hidden;overflow-y:auto[^}]*scrollbar-gutter:stable/);
  assert.match(css,/\.pos-menu-reveal\{[^}]*overflow-x:clip;overflow-y:visible/);
  assert.match(css,/\.pos-menu-controls\{[^}]*pointer-events:none/);
  assert.match(css,/\.pos-menu-controls \.pos-menu-toggle\{[^}]*pointer-events:auto/);
});
test('close waits for the independently timed edge and ignores cancelled completions',async()=>{
  const f=fixture({mobile:true});await f.open();await f.finish();f.click('.pos-menu-toggle');
  const closing=f.active(),edge=closing.find(t=>t.element.matches('.pos-menu-edge'));
  closing.filter(t=>t!==edge).forEach(t=>t.finish());await flush();
  assert.equal(f.api.getState().phase,'closing');assert.equal(f.api.getState().modal,true);
  edge.finish();await flush();assert.equal(f.api.getState().phase,'closed');f.dispose();
});
test('resize inside a mobile row delay preserves the remaining delay rather than restarting it',async()=>{
  const f=fixture({mobile:true});await f.open();f.active().forEach(t=>t.currentTime=50);
  f.win.dispatchEvent(new f.win.Event('resize'));
  const rows=f.active().filter(t=>t.element.matches('.pos-menu-link'));
  for(let i=0;i<3;i++) {
    assert.equal(rows[i].options.duration,850+i*30);
    assert.equal(rows[i].frames[1].offset*rows[i].options.duration,50+i*30);
  }
  f.dispose();
});
test('fallback paths style the single icon and outside native close restores its node',async()=>{
  const f=fixture({animate:false});await f.open();const button=f.query('.pos-menu-toggle');
  assert.match(button.querySelector('i').style.transform,/rotate\(45deg\)/);
  f.query('dialog').close();await flush();assert.equal(f.api.getState().phase,'closed');
  assert.equal(button.parentElement,f.query('.pos-menu-anchor'));assert.match(button.querySelector('i').style.transform,/rotate\(0deg\)/);f.dispose();
});
test('source ownership forbids new routing, ticker, renderer, canvas, or foreign DOM mutations',()=>{
  const source=fs.readFileSync(new URL('../../runtime/modules/menu.js',import.meta.url),'utf8');assert.doesNotMatch(source,/requestAnimationFrame|setInterval|pushState|replaceState|popstate|new.*Renderer|createElement\(['"]canvas|document\.body|\.inert\s*=/);assert.doesNotMatch(source,/^import\s/m);assert.match(source,/await host\.navigate\(next\)/);
});
