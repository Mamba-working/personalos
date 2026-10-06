import test from 'node:test';
import assert from 'node:assert/strict';
import {bootHost} from './host-fixture.mjs';
const microtasks=async()=>{await Promise.resolve();await Promise.resolve();};
test('host replay waits for actual chat closed and mobile ownership release before new story',async()=>{
 const f=await bootHost({chatPhase:'open',mobileOwned:true});try{
  const replay=f.host.replay();assert.equal(f.host.getState().pendingReplay,true);assert.deepEqual(f.calls,['chat-close']);assert.equal(f.host.getState().chat.phase,'closing');assert.equal(f.host.getState().chat.mobileFlow.owned,true);
  await microtasks();assert(!f.calls.includes('replay'));
  f.completeChatClose();assert.equal(await replay,true);assert.deepEqual(f.calls,['chat-close','replay']);assert.equal(f.host.getState().pendingReplay,false);
 }finally{f.close();}
});
test('host replay closes chat then reader, and starts after the original article returned',async()=>{
 const f=await bootHost({chatPhase:'open'});try{
  const article=f.$('[data-content-id="work-context"]'),slot=article.parentElement;f.w.contentStudy.open('work-context');f.settle();
  const replay=f.host.replay();assert.deepEqual(f.calls,['chat-close']);f.completeChatClose();await microtasks();assert.equal(f.w.personalOSContent.getState().phase,'return');assert.equal(article.parentElement,f.$('#canvas'));assert(!f.calls.includes('replay'));
  f.settle();assert.equal(await replay,true);assert.equal(article.parentElement,slot);assert.equal(f.w.personalOSContent.getState().phase,'preview');assert.equal(f.calls.at(-1),'replay');
 }finally{f.close();}
});
test('latest navigation wins while chat close is pending and stale replay never starts',async()=>{
 const f=await bootHost({chatPhase:'open',mobileOwned:true});try{
  const replay=f.host.replay(),earlier=f.host.navigate('work'),latest=f.host.navigate('labs');assert(!f.calls.includes('replay'));assert.equal(f.w.personalOSContent.getState().category,'all');
  f.completeChatClose();assert.equal(await replay,false);assert.equal(await earlier,false);assert.equal(await latest,true);assert.equal(f.w.personalOSContent.getState().category,'labs');assert(!f.calls.includes('replay'));assert.equal(f.host.getState().pendingReplay,false);assert.equal(f.subscriptions,1);
 }finally{f.close();}
});
test('host navigation releases story lease before changing category and rejects invalid category',async()=>{
 const f=await bootHost();try{
  const ids=['work-context','thoughts-type','labs-spring'],nodes=ids.map(id=>f.$(`[data-content-id="${id}"]`)),slots=nodes.map(n=>n.parentElement),lease=f.w.personalOSContent.presentation.acquire(ids);assert(lease);
  assert.equal(await f.host.navigate('unknown'),false);assert.equal(lease.released,false);assert.equal(await f.host.navigate('thoughts'),true);assert.equal(lease.released,true);nodes.forEach((n,i)=>assert.equal(n.parentElement,slots[i]));assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,6);assert.deepEqual(f.calls,['skip:navigation']);
 }finally{f.close();}
});
test('height-only viewport resize preserves authoritative hero bounds; width change recaptures; dock uses visual viewport',async()=>{
 const f=await bootHost();try{
  const initial=f.placement({x:99,y:99,r:9});assert.deepEqual({...initial.bounds},{x:340,y:220,w:120,h:120});
  f.setScreen({x:320,y:180,r:50});Object.defineProperty(f.w,'innerHeight',{value:600,configurable:true});f.w.dispatchEvent(new f.w.Event('resize'));await new Promise(r=>setTimeout(r,690));
  assert.deepEqual({...f.placement().bounds},{...initial.bounds});
  Object.defineProperty(f.w,'innerWidth',{value:900,configurable:true});f.w.dispatchEvent(new f.w.Event('resize'));await new Promise(r=>setTimeout(r,690));assert.deepEqual({...f.placement().bounds},{x:270,y:130,w:100,h:100});
  f.w.visualViewport={width:900,height:550,offsetLeft:20,offsetTop:100};f.d.scrollingElement.scrollTop=500;assert.deepEqual({...f.placement().bounds},{x:824,y:522,w:48,h:48});
 }finally{f.close();}
});
test('initial chat=open restores once with history disabled for ready and fallback hosts',async()=>{
 for(const fallback of [false,true]){const f=await bootHost({query:'?chat=open',fallback});try{
  assert.deepEqual(f.calls.filter(x=>x==='chat-show'),['chat-show']);assert.equal(f.showOptions[0].history,false);
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:world-availability'));await microtasks();assert.equal(f.calls.filter(x=>x==='chat-show').length,1);
 }finally{f.close();}}
});
