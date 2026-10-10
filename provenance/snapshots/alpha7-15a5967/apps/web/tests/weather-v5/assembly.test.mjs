import {withoutMobileWorldClip} from '../integration/world-layers-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {bootWorld} from '../integration/world-cpu-fixture.mjs';
import {createWeatherEffect} from '../../runtime/modules/weather.js';
const protectedFiles=JSON.parse(fs.readFileSync(new URL('./fixtures/clock-reviewed-protected.json',import.meta.url),'utf8'));
test('assembly preserves 61 untouched fef4654 runtime files and the exact mobile world-clip ownership delta',()=>{for(const [rel,expected]of Object.entries(protectedFiles)){if(['app.js','host.js'].includes(rel))continue;const raw=fs.readFileSync(new URL('../../runtime/'+rel,import.meta.url));const bytes=rel==='chat/chat-mobile-flow.css'?withoutMobileWorldClip(raw.toString()):raw;assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,rel);}assert.equal(Object.keys(protectedFiles).filter(p=>!['app.js','host.js'].includes(p)).length,62);});
test('assembled real scene delivers full presentation elapsed time but bounded weather simulation, keeping original actor/canvas',()=>{
 const f=bootWorld({manual:true,query:'?manual=1&space=all'});let effect;try{
  const actor=f.cpu.actor,canvas=f.cpu.renderer.domElement,delivered=[],simulation=[];f.world.onFrame(dt=>delivered.push(dt));
  const release=f.world.registerEffect('weather',ctx=>{effect=createWeatherEffect({...ctx,getState:()=>({...ctx.getState(),weather:{preset:'rain'}})});return{...effect,update(dt,state){simulation.push(dt);effect.update(dt,state);}};});
  f.study.step(10);assert.equal(delivered.at(-1),10);assert.equal(simulation.at(-1),.05);assert.equal(effect.getState().effect.phaseTime,.05);assert.equal(effect.getState().effect.visible,true);
  assert.equal(f.cpu.actor,actor);assert.equal(f.cpu.renderer.domElement,canvas);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);assert(f.cpu.face.quaternion.toArray().every(Number.isFinite));
  f.w.contentStudy.open('work-context',{push:false});f.settle();const phase=effect.getState().effect.phaseTime;f.study.step(10);assert.equal(effect.getState().effect.visible,false);assert.equal(effect.getState().effect.phaseTime,phase);assert.equal(f.w.contentStudy.snapshot().phase,'detail');release();assert.equal(f.cpu.actor,actor);
 }finally{f.destroy();}
});
test('assembled story temporarily owns original cards while weather honors narrative quiet and returns cleanly',()=>{
 const f=bootWorld({manual:true,query:'?manual=1&space=all'});let effect;try{const nodes=[...f.d.querySelectorAll('article.card')],actor=f.cpu.actor;
  f.world.registerEffect('weather',ctx=>(effect=createWeatherEffect({...ctx,getState:()=>({...ctx.getState(),weather:{preset:'wind'}})})));
  f.study.step(.05);assert.equal(effect.getState().effect.visible,true);f.world.story.replay();f.study.step(.1);assert.equal(effect.getState().effect.visible,false);assert.equal(f.world.story.getState().borrowed,true);f.world.story.skip();f.study.step(1);assert.equal(f.world.story.getState().phase,'home');assert.equal(f.world.story.getState().borrowed,false);assert.equal(f.cpu.actor,actor);assert.deepEqual([...f.d.querySelectorAll('article.card')],nodes);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);
 }finally{f.destroy();}
});
