import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent} from './content-fixture.mjs';
import {createStoryLifecycle} from '../../runtime/story/lifecycle.js';
import {createFrameClock} from '../../runtime/story/frame-clock.js';

const ids=['work-context','thoughts-type','labs-spring'];
test('story presentation borrows the same articles once and restores exact nodes, slots, styles and actions',()=>{
 const f=bootContent();try{
  const nodes=ids.map(id=>f.$(`[data-content-id="${id}"]`)),slots=nodes.map(n=>n.parentElement),subtrees=nodes.map(n=>[...n.querySelectorAll('*')]);
  nodes[0].setAttribute('style','outline: 1px solid red;'); nodes[0].querySelector('.identity').setAttribute('style','width: 321px;');
  const styles=nodes.map(n=>[n.getAttribute('style'),n.querySelector('.identity').getAttribute('style')]);
  const api=f.w.personalOSContent.presentation,lease=api.acquire(ids);assert(lease);assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(f.d.querySelectorAll('#story-content-layer').length,1);
  assert.equal(api.acquire(ids),null);assert.equal(f.d.querySelectorAll('.slot').length,18);
  for(let i=0;i<nodes.length;i++){assert.equal(lease.items[i].article,nodes[i]);assert.equal(nodes[i].parentElement,f.$('#story-content-layer'));assert.equal(slots[i].parentElement.className,'feed-column');assert.equal(nodes[i].inert,true);assert.equal(nodes[i].dataset.storyOwner,'world');assert.deepEqual([...nodes[i].querySelectorAll('*')],subtrees[i]);}
  assert.equal(lease.targets().length,3);assert.equal(lease.release('test'),true);assert.equal(lease.release('stale'),false);
  for(let i=0;i<nodes.length;i++){assert.equal(nodes[i].parentElement,slots[i]);assert.deepEqual([nodes[i].getAttribute('style'),nodes[i].querySelector('.identity').getAttribute('style')],styles[i]);assert.deepEqual([...nodes[i].querySelectorAll('*')],subtrees[i]);}
  assert.equal(f.$('#story-content-layer').hidden,true);assert.equal(api.getState().leased,false);
  nodes[0].querySelector('.open-card').click();f.settle();assert.equal(f.$('#canvas').firstElementChild,nodes[0]);
 }finally{f.close();}
});

test('reader, mobile ownership, excluded category, unknown IDs and duplicates deny story acquisition',()=>{
 const f=bootContent();try{
  const api=f.w.personalOSContent.presentation;assert.equal(api.acquire(['missing']),null);assert.equal(api.acquire([ids[0],ids[0]]),null);
  f.w.contentStudy.open(ids[0]);f.settle();assert.equal(api.acquire(ids),null);f.w.contentStudy.close('test',{history:false});f.settle();
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-hold'));assert.equal(api.acquire(ids),null);f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-release'));
  f.click('[data-filter="work"]');assert.equal(api.acquire(ids),null);
 }finally{f.close();}
});

test('content selection and filtering revoke the presentation lease before normal content owns the original article',()=>{
 for(const operation of ['select','filter']){const f=bootContent();try{
  const api=f.w.personalOSContent.presentation,article=f.$(`[data-content-id="${ids[0]}"]`),lease=api.acquire(ids);assert(lease);
  if(operation==='select'){f.w.contentStudy.open(ids[0]);f.settle();assert.equal(f.$('#canvas').firstElementChild,article);}else{f.click('[data-filter="labs"]');assert.equal(f.$('#story-content-layer').children.length,0);assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,6);}
  assert.equal(lease.released,true);assert.equal(api.getState().leased,false);assert.equal(f.d.querySelectorAll('article.card').length,18);
 }finally{f.close();}}
});

test('story clock advances through handoff then releases once at home; no external resize clock',()=>{
 const events=[],returns=[];let acquired=0;const s=createStoryLifecycle({onStart:()=>{acquired++;return true;},onReturn:r=>returns.push(r)});s.subscribe(e=>events.push(e));
 assert.equal(s.getState().phase,'story');assert.equal(acquired,1);
 for(let i=0;i<100;i++)s.advance(.1);assert.equal(s.getState().phase,'handoff');assert(events.some(e=>e.action==='handoff'));
 const before=s.getState().time;s.advance(1000);assert(Math.abs(s.getState().time-before-.1)<1e-9);
 for(let i=0;i<40;i++)s.advance(.1);assert.equal(s.getState().phase,'home');assert.deepEqual(returns,['completed']);s.advance(1);assert.deepEqual(returns,['completed']);
});

test('skip is bounded, repeat-safe, and replay returns prior ownership before new acquisition',()=>{
 const calls=[];const s=createStoryLifecycle({onStart:()=>{calls.push('acquire');return true;},onReturn:r=>calls.push('return:'+r)});
 s.advance(.1);assert.equal(s.skip(),true);assert.equal(s.skip(),false);assert.equal(s.getState().phase,'bridge');for(let i=0;i<9;i++)s.advance(.1);assert.equal(s.getState().phase,'home');assert.deepEqual(calls,['acquire','return:skipped']);
 assert.equal(s.replay(),true);s.advance(.1);assert.equal(s.replay(),true);assert.deepEqual(calls.slice(-3),['acquire','return:replay-return','acquire']);s.setReduced(true);assert.equal(s.getState().phase,'home');assert.equal(calls.at(-1),'return:reduced');
});

test('deep-link, reduced, disabled and content-denied entry settle without borrowing',()=>{
 for(const options of [{bypass:true},{reduced:true},{enabled:false}]){let acquired=0;const s=createStoryLifecycle({...options,onStart:()=>{acquired++;return true;}});assert.equal(s.getState().phase,'home');assert.equal(acquired,0);}
 const denied=createStoryLifecycle({onStart:()=>false});assert.equal(denied.getState().phase,'home');assert.equal(denied.getState().reason,'content-unavailable');
 const failed=createStoryLifecycle();failed.fail('context-lost');assert.equal(failed.getState().phase,'home');assert.equal(failed.getState().reason,'context-lost');
});

function clockFixture(){let id=0,visible=true,need=true,hook=()=>{};const pending=new Map(),samples=[];const clock=createFrameClock({request:fn=>{pending.set(++id,fn);return id;},cancel:id=>pending.delete(id),visible:()=>visible,needsFrame:()=>need,step:(dt,stamp)=>{samples.push({dt,stamp});hook();}});return{clock,pending,samples,setVisible:v=>visible=v,setNeed:v=>need=v,setHook:fn=>hook=fn,frame(stamp){assert.equal(pending.size,1);const [id,fn]=pending.entries().next().value;pending.delete(id);fn(stamp);}};}
test('single world RAF owner sleeps idle, bounds delta, suspends hidden and resumes without elapsed-time jump',()=>{
 const f=clockFixture();f.clock.wake();f.clock.wake();assert.equal(f.pending.size,1);f.frame(100);assert.equal(f.samples[0].dt,1/60);f.frame(3100);assert.equal(f.samples[1].dt,.05);f.setNeed(false);f.frame(3120);assert.equal(f.pending.size,0);f.setVisible(false);f.clock.wake();assert.equal(f.pending.size,0);f.setVisible(true);f.clock.wake();f.frame(10000);assert.equal(f.samples.at(-1).dt,1/60);f.clock.wake();f.clock.suspend();assert.equal(f.pending.size,0);f.clock.dispose();f.clock.wake();assert.equal(f.pending.size,0);
});
test('subscriber wake during the active frame never schedules duplicate world RAF ownership',()=>{
 const f=clockFixture();f.setHook(()=>f.clock.wake());f.clock.wake();f.frame(100);assert.equal(f.pending.size,1,'wake called by a subscriber must not add a second RAF when tick reschedules');f.clock.dispose();assert.equal(f.pending.size,0);
});
test('replay holds narrative time at zero throughout rewind before beginning story',()=>{
 const s=createStoryLifecycle({enabled:true,reduced:true});assert.equal(s.replay(),true);assert.equal(s.getState().phase,'rewind');assert.equal(s.getState().time,0);
 for(let i=0;i<8;i++){s.advance(.1);assert.equal(s.getState().phase,'rewind');assert.equal(s.getState().time,0);}
 s.advance(.1);s.advance(.001);assert.equal(s.getState().phase,'story');assert.equal(s.getState().time,0);
 s.advance(.05);assert.equal(s.getState().time,.05);
});
