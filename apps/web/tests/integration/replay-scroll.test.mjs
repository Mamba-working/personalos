import test from 'node:test';
import assert from 'node:assert/strict';
import {bootHost} from './host-fixture.mjs';
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function nativeScroll(f){
 const calls=[];f.w.scrollTo=options=>{calls.push({...options});if(options.behavior!=='smooth')f.d.scrollingElement.scrollTop=options.top;};
 return{calls,move(top,{end=false}={}){f.d.scrollingElement.scrollTop=top;f.w.dispatchEvent(new f.w.Event('scroll'));if(end)f.w.dispatchEvent(new f.w.Event('scrollend'));},end(){f.w.dispatchEvent(new f.w.Event('scrollend'));}};
}
test('deep replay requests native smooth return while entry stays home, waits for scrollend at top, then borrows story',async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{
  f.d.scrollingElement.scrollTop=1600;const replay=f.host.replay();await flush();assert.equal(scroll.calls.length,1);assert.equal(scroll.calls[0].behavior,'smooth');assert.equal(scroll.calls[0].top,0);assert.equal(f.d.scrollingElement.scrollTop,1600);assert.equal(f.host.getState().entry,'home');assert.equal(f.$('#content-root').inert,false);assert.equal(f.host.getState().replayPreparation.phase,'scrolling');assert(!f.calls.includes('replay'));
  scroll.move(700,{end:true});await flush();assert(!f.calls.includes('replay'));assert.equal(f.host.getState().entry,'home');scroll.move(0,{end:true});assert.equal(await replay,true);assert.deepEqual(f.replayOffsets,[0]);assert.equal(f.host.getState().pendingReplay,false);assert.equal(f.$('#host-replay').hasAttribute('aria-busy'),false);
 }finally{f.close();}
});
for(const action of ['wheel','Escape','api','button-repeat'])test(`replay ${action} interruption stops native return at current offset and blocks stale replay`,async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{
  f.d.scrollingElement.scrollTop=1900;const replay=f.host.replay();await flush();scroll.move(830);
  if(action==='wheel')f.w.dispatchEvent(new f.w.Event('wheel'));else if(action==='Escape')f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape'}));else if(action==='api')assert.equal(f.host.cancelReplay(),true);else {f.$('#host-replay').dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));f.click('#host-replay');}
  assert.equal(await replay,false);assert.equal(scroll.calls.at(-1).behavior,'auto');assert.equal(scroll.calls.at(-1).top,830);assert.equal(f.d.scrollingElement.scrollTop,830);assert.equal(f.host.getState().entry,'home');assert.equal(f.host.getState().pendingReplay,false);assert.equal(f.host.getState().replayPreparation.phase,'idle');assert(!f.calls.includes('replay'));
  scroll.move(0,{end:true});await flush();assert(!f.calls.includes('replay'));assert.equal(f.$('#host-replay').hasAttribute('aria-busy'),false);
 }finally{f.close();}
});
test('new replay request cancels prior scroll preparation and only latest completion starts story',async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{
  f.d.scrollingElement.scrollTop=1900;const first=f.host.replay();await flush();scroll.move(900);const latest=f.host.replay();await flush();assert.equal(await first,false);assert.equal(scroll.calls[1].top,900);assert.equal(scroll.calls[1].behavior,'auto');assert.equal(scroll.calls[2].behavior,'smooth');scroll.end();await flush();assert(!f.calls.includes('replay'));scroll.move(0,{end:true});assert.equal(await latest,true);assert.deepEqual(f.replayOffsets,[0]);
 }finally{f.close();}
});
test('replay from scrolled detail returns the original reader article before requesting native smooth return',async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{
  const article=f.$('[data-content-id="work-context"]'),slot=article.parentElement;f.d.scrollingElement.scrollTop=1700;f.w.contentStudy.open('work-context',{push:false});f.settle();f.$('#reader').scrollTop=240;
  const replay=f.host.replay();await flush();assert.equal(f.w.personalOSContent.getState().phase,'return');assert.equal(scroll.calls.length,0);assert(!f.calls.includes('replay'));assert.equal(article.parentElement,f.$('#canvas'));
  f.settle();await flush();assert.equal(article.parentElement,slot);assert.equal(scroll.calls.length,1);assert.equal(scroll.calls[0].behavior,'smooth');assert.equal(f.d.scrollingElement.scrollTop,1700);assert.equal(f.host.getState().entry,'home');scroll.move(0,{end:true});assert.equal(await replay,true);assert.deepEqual(f.replayOffsets,[0]);
 }finally{f.close();}
});
test('cancel while waiting for chat close prevents any later scroll preparation or story replay',async()=>{
 const f=await bootHost({chatPhase:'open',mobileOwned:true}),scroll=nativeScroll(f);try{
  f.d.scrollingElement.scrollTop=1700;const replay=f.host.replay();await flush();assert.equal(f.host.cancelReplay(),true);f.completeChatClose();assert.equal(await replay,false);assert.equal(scroll.calls.length,0);assert(!f.calls.includes('replay'));assert.equal(f.d.scrollingElement.scrollTop,1700);
 }finally{f.close();}
});
test('replay after a category filter starts at native top without filter anchor jump',async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{
  f.click('[data-filter="labs"]');f.d.scrollingElement.scrollTop=1600;const replay=f.host.replay();await flush();scroll.move(0,{end:true});assert.equal(await replay,true);assert.equal(f.w.personalOSContent.getState().category,'all');assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,18);assert.deepEqual(f.replayOffsets,[0]);assert.equal(f.d.scrollingElement.scrollTop,0);
 }finally{f.close();}
});
test('replay waits for filtered slots to settle before native scroll; layout interruption cancels without stale work',async()=>{
 for(const cancel of [false,true]){const f=await bootHost(),scroll=nativeScroll(f);try{
  f.click('[data-filter="labs"]');f.d.scrollingElement.scrollTop=1500;const slot=f.$('[data-id="work-context"]'),original=slot.getBoundingClientRect.bind(slot);let stable=false;slot.getBoundingClientRect=()=>{const r=original();return stable?r:{...r,height:0,bottom:r.top};};
  const replay=f.host.replay();await flush();assert.equal(f.host.getState().replayPreparation.phase,'layout');assert.equal(f.d.scrollingElement.scrollTop,1500);assert.equal(scroll.calls.length,0);assert(!f.calls.includes('replay'));
  if(cancel)f.w.dispatchEvent(new f.w.Event('wheel'));stable=true;for(const [id,fn]of [...f.frames]){f.frames.delete(id);fn(f.w.performance.now());}await flush();
  if(cancel){assert.equal(await replay,false);assert.equal(scroll.calls.length,0);assert(!f.calls.includes('replay'));}else{assert.equal(scroll.calls[0].behavior,'smooth');scroll.move(0,{end:true});assert.equal(await replay,true);assert.deepEqual(f.replayOffsets,[0]);}
 }finally{f.close();}}
});
test('reduced replay uses standard auto scroll and reaches native top before rewind',async()=>{
 const f=await bootHost(),scroll=nativeScroll(f);try{f.host.setReduced(true);f.d.scrollingElement.scrollTop=1800;assert.equal(await f.host.replay(),true);assert.equal(scroll.calls[0].behavior,'auto');assert.equal(scroll.calls[0].top,0);assert.deepEqual(f.replayOffsets,[0]);}finally{f.close();}
});
