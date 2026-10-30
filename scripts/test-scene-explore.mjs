import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source=readFileSync(new URL('../integrations/native-shell/scene-explore.js',import.meta.url),'utf8');
function harness(){
 const dom=new JSDOM('<main id="content-root"><button>Article</button></main><button id="host-explore">探索场景</button><button id="host-open-chat">Chat</button><div id="host-menu"></div><aside id="scene-explore-controls" hidden><button id="scene-explore-return">返回内容</button></aside>',{runScripts:'outside-only',url:'https://example.test'});
 const w=dom.window;let y=320,now=0,frame=0;const frames=new Map(),subscribers=new Set();
 let state={reduced:false,scene:{ready:true,failed:null},content:{phase:'preview',reflow:{active:false}},chat:{phase:'closed'},menu:{open:false,modal:false}};
 Object.defineProperty(w,'scrollY',{get:()=>y});w.scrollTo=({top})=>{y=top};w.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame};w.cancelAnimationFrame=id=>frames.delete(id);Object.defineProperty(w.performance,'now',{value:()=>now});
 w.personalOSHost={getState:()=>({...state,sceneExplore:w.personalOSSceneExplore?.getState()}),moduleChanged:name=>{for(const fn of subscribers)fn({...state,action:'module-'+name})},subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)},registerModule(){}};
 w.eval(source);const api=w.personalOSSceneExplore,button=w.document.querySelector('#host-explore');
 return {w,api,button,close:()=>dom.window.close(),patch(p){state={...state,...p};for(const fn of subscribers)fn({...state,action:'test'});},advance(ms=16){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},settle(){for(let i=0;i<180&&frames.size;i++)this.advance();},scrollTo(v){y=v;w.dispatchEvent(new w.Event('scroll'));}};
}
test('exploration fades in place, preserves scroll/focus and restores inert ownership',t=>{
 const h=harness();t.after(h.close);h.button.focus();assert.equal(h.api.enter(),true);assert.equal(h.api.getState().phase,'entering');assert.equal(h.api.getState().contentInert,true);h.settle();assert.equal(h.api.getState().opacity,0);assert.equal(h.api.getState().inputEnabled,true);
 h.scrollTo(800);assert.equal(h.w.scrollY,320);assert.equal(h.w.document.activeElement.id,'scene-explore-return');assert.equal(h.w.document.querySelector('#host-menu').inert,true);
 h.api.exit();assert.equal(h.api.getState().inputEnabled,false);h.settle();assert.equal(h.api.getState().phase,'reading');assert.equal(h.api.getState().opacity,1);assert.equal(h.api.getState().contentInert,false);assert.equal(h.w.scrollY,320);assert.equal(h.w.document.activeElement,h.button);assert.equal(h.w.document.querySelector('#scene-explore-controls').hidden,true);
});
test('rapid reversal preserves both fade position and velocity',t=>{
 const h=harness();t.after(h.close);h.api.enter();h.advance(120);const before=h.api.getState();assert.ok(before.opacity>0&&before.opacity<1);assert.ok(before.velocity<0);h.api.exit();const reversed=h.api.getState();h.api.enter();const resumed=h.api.getState();for(const next of [reversed,resumed]){assert.equal(next.opacity,before.opacity);assert.equal(next.velocity,before.velocity);assert.equal(next.inputEnabled,false)}h.settle();assert.equal(h.api.getState().phase,'exploring');
});
test('modal/reflow/not-ready states deny acquisition and reduced motion restores instantly',t=>{
 const h=harness();t.after(h.close);for(const patch of [{content:{phase:'detail'}},{content:{phase:'preview',reflow:{active:true}}},{content:{phase:'preview'},chat:{phase:'open'}},{chat:{phase:'closed'},menu:{open:true}},{menu:{open:false},scene:{ready:false}}]){h.patch(patch);assert.equal(h.api.enter(),false)}h.patch({scene:{ready:true},reduced:true});assert.equal(h.api.enter(),true);assert.equal(h.api.getState().phase,'exploring');h.api.exit();assert.equal(h.api.getState().phase,'reading');assert.equal(h.api.getState().contentInert,false);
});
test('forced returns cannot be reversed into an unavailable scene or competing UI',t=>{
 for (const patch of [{scene:{ready:true,failed:'context-lost'}},{content:{phase:'detail'}},{chat:{phase:'open'}},{menu:{open:true}}]) {
  const h=harness();t.after(h.close);h.button.focus();h.api.enter();h.settle();h.patch(patch);
  assert.equal(h.api.getState().phase,'returning');assert.equal(h.api.enter(),false);
  h.settle();assert.equal(h.api.getState().phase,'reading');assert.equal(h.api.getState().contentInert,false);assert.equal(h.api.getState().inputEnabled,false);
 }
});
test('Space retains native return-button activation while scene scroll keys stay blocked',t=>{
 const h=harness();t.after(h.close);h.api.enter();h.settle();
 const key=node=>{const e=new h.w.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});node.dispatchEvent(e);return e;};
 assert.equal(key(h.w.document.querySelector('#scene-explore-return')).defaultPrevented,false);
 assert.equal(key(h.w.document.body).defaultPrevented,true);
});
