import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent,read} from './content-fixture.mjs';
const turn = () => new Promise(resolve => setTimeout(resolve,30));
// JSDOM history traversal uses multiple queued tasks. Await its actual event
// instead of a wall-clock guess that races under the aggregate's parallel load.
const traverse = (fixture,direction) => new Promise((resolve,reject) => {
 const done = () => {clearTimeout(timeout);resolve();};
 const timeout = setTimeout(() => {fixture.w.removeEventListener('popstate',done);reject(new Error(`No popstate for history.${direction}()`));},10000);
 fixture.w.addEventListener('popstate',done,{once:true});
 fixture.w.history[direction]();
});

test('candidate feed has 18 unique original articles and exact 6/6/6 category filters', () => {
 const f=bootContent(); try {
  assert.equal(f.records.length,18); assert.equal(new Set(f.records.map(x=>x.id)).size,18);
  const original=[...f.d.querySelectorAll('article.card')]; assert.equal(original.length,18);
  for(const category of ['work','thoughts','labs','all']) {
   f.click(`[data-filter="${category}"]`);
   assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,category==='all'?18:6);
   assert.equal(f.$(`[data-filter="${category}"]`).getAttribute('aria-pressed'),'true');
   assert.equal(new URL(f.w.location).searchParams.get('space'),category);
   assert.deepEqual(new Set(f.d.querySelectorAll('article.card')),new Set(original));
   for(const article of original)assert.equal(f.$(`[data-content-id="${article.dataset.contentId}"]`),article);
   for(const slot of f.d.querySelectorAll('.slot')) assert.equal(slot.inert,slot.classList.contains('excluded'));
  }
  assert.deepEqual(f.errors,[]);
 } finally {f.close();}
});

for(const width of [390,1180]) test(`same article/subtree survives open, reading, Escape, return, and focus at ${width}px synthetic width`,async()=>{
 const f=bootContent({width}); try {
  const article=f.$('[data-content-id="work-context"]'),slot=article.parentElement,subtree=[...article.querySelectorAll('*')],button=article.querySelector('.open-card');
  f.d.scrollingElement.scrollTop=820; button.focus(); button.click(); f.settle();
  assert.equal(f.$('#canvas').firstElementChild,article); assert.equal(f.w.personalOSContent.getState().phase,'detail');
  assert.equal(f.$('#feed').inert,true); assert.equal(f.d.activeElement,f.$('#close')); assert.equal(article.querySelector('.detail-body').inert,false);
  f.$('#reader').scrollTop=260;
  f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await turn(); f.settle();
  assert.equal(article.parentElement,slot); assert.equal(f.$('#stage').hidden,true); assert.equal(f.$('#feed').inert,false);
  assert.equal(f.d.activeElement,button); assert.equal(f.d.scrollingElement.scrollTop,820);
  assert.deepEqual([...article.querySelectorAll('*')],subtree); assert.equal(f.d.querySelectorAll('#title-work-context').length,1); assert.deepEqual(f.errors,[]);
 } finally {f.close();}
});

test('content back/forward restores the same detail and original reading position',async()=>{
 const f=bootContent(); try {
  const article=f.$('[data-content-id="thoughts-reading"]'),slot=article.parentElement;
  f.d.scrollingElement.scrollTop=1350; article.querySelector('.open-card').click(); f.settle();
  assert.equal(new URL(f.w.location).searchParams.get('item'),'thoughts-reading');
  await traverse(f,'back'); f.settle(); assert.equal(article.parentElement,slot); assert.equal(f.d.scrollingElement.scrollTop,1350);
  await traverse(f,'forward'); f.settle(); assert.equal(f.$('#canvas').firstElementChild,article); assert.equal(f.w.personalOSContent.getState().phase,'detail');
 } finally {f.close();}
});

test('detail action and keyboard focus trap operate, and category intent closes current detail first',async()=>{
 const f=bootContent(); try {
  f.click('[data-content-id="labs-spring"] .open-card'); f.settle();
  const body=f.$('[data-content-id="labs-spring"] .detail-body'),last=[...body.querySelectorAll('button,a')].at(-1);
  f.click('[data-content-id="labs-spring"] [data-damping="1.00"]'); assert.match(body.querySelector('[data-readout]').textContent,/1\.00/);
  last.focus(); f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})); assert.equal(f.d.activeElement,f.$('#close'));
  f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})); assert.equal(f.d.activeElement,last);
  f.click('[data-filter="work"]'); await turn(); f.settle(); assert.equal(f.w.personalOSContent.getState().category,'work'); assert.equal(f.$('#stage').hidden,true); assert.equal(f.d.activeElement,f.$('[data-filter="work"]')); assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,6);
 } finally {f.close();}
});

test('reversal and latest selection keep a single article identity and no duplicate dialog title',async()=>{
 const f=bootContent(); try {
  const first=f.$('[data-content-id="work-context"]'); f.w.contentStudy.open('work-context'); f.w.contentStudy.advance(.05);
  f.w.contentStudy.close('test',{history:false}); f.w.contentStudy.advance(.03); f.w.contentStudy.open('work-context',{push:false}); f.settle();
  assert.equal(f.$('#canvas').firstElementChild,first); assert.equal(f.w.personalOSContent.getState().phase,'detail');
  f.w.contentStudy.open('thoughts-type',{push:false}); f.settle(); f.settle();
  assert.equal(f.w.personalOSContent.getState().id,'thoughts-type'); assert.equal(f.d.querySelectorAll('article.card').length,18); assert.equal(f.d.querySelectorAll('#title-work-context').length,1);
 } finally {f.close();}
});

test('mobile hold suspends actual content advance until release and preserves selected node',()=>{
 const f=bootContent();try {
  const article=f.$('[data-content-id="work-context"]'); f.w.contentStudy.open('work-context'); f.w.contentStudy.advance(.05); const before=f.w.personalOSContent.getState();
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-hold')); f.w.contentStudy.advance(1);
  assert.deepEqual(f.w.personalOSContent.getState().pose,before.pose); assert.equal(f.$('#canvas').firstElementChild,article);
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-restoring')); f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-restored')); f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-release')); f.settle(); assert.equal(f.w.personalOSContent.getState().phase,'detail');
 } finally {f.close();}
});

test('host uses actual fallback entry and content API when renderer unavailable (chat mounting boundary stubbed)',async()=>{
 const f=bootContent(); try {
  const calls=[]; f.w.__mountChat=async()=>({getState:()=>({open:false}),show:()=>calls.push('show'),close:()=>calls.push('close'),clockChanged(){},preferencesChanged(){},subscribe(){return()=>{};},isPageLocked:()=>false});
  f.w.personalOSWorldAvailability={status:'failed',reason:'webgl-unavailable'};
  f.w.eval(read('world-availability.js').replace(/\bexport /g,'')+';window.__readiness=createWorldReadiness;window.__availabilityEvent=WORLD_AVAILABILITY_EVENT;');
  f.w.eval('(()=>{const mountChat=window.__mountChat,createWorldReadiness=window.__readiness,WORLD_AVAILABILITY_EVENT=window.__availabilityEvent;'+read('host.js').replace(/^import[^\n]+\n/gm,'')+'})();'); await turn();
  assert.equal(f.$('#host-chat-fallback').hidden,false); assert.equal(f.$('#host-open-chat').disabled,false); assert.equal(f.$('#content-root').inert,false);
  f.click('#host-open-chat'); assert.deepEqual(calls,['show']);
  await f.w.personalOSHost.select('work-context'); f.settle(); assert.equal(f.w.personalOSContent.getState().id,'work-context');
  f.w.personalOSHost.cancel(); await turn();f.settle();assert.equal(f.w.personalOSContent.getState().phase,'preview');
  f.w.personalOSHost.setCategory('labs'); assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,6);
  assert.equal(f.w.personalOSHost.world(),null); assert.equal(f.d.querySelectorAll('#ball-world-root').length,1);
 } finally {f.close();}
});
test('unknown initial space safely falls back to all without hiding articles or crashing',()=>{
 const f=bootContent({query:'?space=not-a-category'});try{assert.equal(f.w.personalOSContent.getState().category,'all');assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,18);assert.equal(f.$('[data-filter="all"]').getAttribute('aria-pressed'),'true');assert.deepEqual(f.errors,[]);}finally{f.close();}
});
