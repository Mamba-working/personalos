import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import * as next from '../../runtime/modules/weather.js';
import * as old from './fixtures/alpha6-weather.js';
import {createFrameClock} from '../../runtime/story/frame-clock.js';
import {bootWorld} from '../integration/world-cpu-fixture.mjs';
import {createSolarFixture} from '../weather-v5/weather-solar-fixture.mjs';
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b} (epsilon ${e})`);
const keys=['altitude','azimuth','cloud','rain','wind','direction'];
function effect(module=next,preset='cloudy') {
 const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshPhysicalMaterial({roughness:.34,clearcoat:.3,clearcoatRoughness:.27}));actor.add(body);
 const key=new THREE.DirectionalLight('#FFF7EE',3);key.castShadow=true;key.position.set(-3.5,8,5.5);scene.add(key);
 const sky=new THREE.HemisphereLight('#EEF0F6','#788298',1.5);scene.add(sky);
 let state={phase:'home',weather:{preset}},response=null,stamp=0;
 const instance=module.createWeatherEffect({THREE,scene,actor,getState:()=>state,applyWeatherResponse:r=>response=r});
 const root=scene.children.at(-1);
 function frame(dt,metadata=true){stamp+=dt*1000;instance.update(Math.min(.05,dt),state,metadata?{elapsed:dt,stamp}:undefined);}
 function snapshot(){return{weather:instance.getState(),geometries:root.children.map(n=>Array.from(n.geometry.attributes.position.array)),colors:Array.from(root.children[1].geometry.attributes.color.array),light:{position:key.position.toArray(),color:key.color.toArray(),intensity:key.intensity},material:{roughness:body.material.roughness,clearcoat:body.material.clearcoat,clearcoatRoughness:body.material.clearcoatRoughness},response:{...response},poolTime:root.children[0].material.uniforms.uTime.value};}
 return{instance,root,scene,actor,frame,snapshot,get stamp(){return stamp;},set stamp(v){stamp=v;},set(patch,epoch){state.weather={...state.weather,...patch};if(epoch!==undefined)instance.markIntent?.(epoch);},policy(patch){state={...state,...patch};},dispose(){instance.dispose();body.geometry.dispose();body.material.dispose();}};
}
function advance(f,total,cadence,metadata=true){for(let spent=0;spent<total-1e-11;){const dt=Math.min(cadence,total-spent);f.frame(dt,metadata);spent+=dt;}}
function equivalent(a,b) {
 for(const k of keys){near(a.weather.effective[k],b.weather.effective[k],2e-10);near(a.weather.target[k],b.weather.target[k],2e-10);}
 near(a.weather.time,b.weather.time,2e-9);near(a.weather.effect.phaseTime,b.weather.effect.phaseTime,2e-9);
 for(let j=0;j<a.geometries.length;j++)for(let i=0;i<a.geometries[j].length;i++)near(a.geometries[j][i],b.geometries[j][i],2e-6);
 for(let i=0;i<a.colors.length;i++)near(a.colors[i],b.colors[i],2e-6);
 for(const k of ['position','color'])for(let i=0;i<3;i++)near(a.light[k][i],b.light[k][i],2e-9);
 near(a.light.intensity,b.light.intensity,2e-9);for(const k of Object.keys(a.material))near(a.material[k],b.material[k],2e-9);
 for(const k of Object.keys(a.response))near(a.response[k],b.response[k],2e-9);near(a.poolTime,b.poolTime,2e-9);
}
test('frozen alpha.6 negative is independently pinned and reproduces .05-second-per-frame slowdown',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/alpha6-weather.js',import.meta.url))).digest('hex'),'cad38afb17e2934e33133e805f2973dfed98779777a540aa2c467283492553f3');
 for(const cadence of [.1,.8,2]){const a=effect(old),b=effect();try{a.set({preset:'rain'});b.set({preset:'rain'});advance(a,8,cadence,false);advance(b,8,cadence);near(a.snapshot().weather.time,Math.ceil(8/cadence)*.05,1e-8);near(b.snapshot().weather.time,8);assert.equal(b.snapshot().weather.transitioning,false);assert.equal(a.snapshot().weather.transitioning,true);assert.ok(b.snapshot().weather.effective.rain-a.snapshot().weather.effective.rain>.0001);}finally{a.dispose();b.dispose();}}
});
test('callers without metadata keep the original exact capped effect behavior',()=>{
 const a=effect(old),b=effect();try{for(let i=0;i<350;i++){if([1,8,70,130,170,230].includes(i)){const patch={preset:i%2?'rain':'wind',wind:(i%9)+.1,autoSun:i>200};a.set(patch);b.set(patch);}const dt=[.016,.1,.7,0,.01][i%5];a.instance.update(dt);b.instance.update(dt);const aa=a.snapshot(),bb=b.snapshot();assert.deepEqual(bb,aa);}}finally{a.dispose();b.dispose();}
});
for(const preset of ['rain','wind','clear','dawn'])test(`${preset}: equal elapsed trajectories match at 16ms, 100ms, 800ms and single long frames`,()=>{
 for(const seconds of [.016,.1,.4,.8,1.6,3.2,7.5,8.1,20]){const reference=effect();reference.set({preset});advance(reference,seconds,.016);try{const expected=reference.snapshot();for(const cadence of [.1,.8,seconds]){const f=effect();try{f.set({preset});advance(f,seconds,cadence);equivalent(expected,f.snapshot());}finally{f.dispose();}}}finally{reference.dispose();}}
});
test('exact integrated velocity includes the whole rain/wind blend rather than endpoint Euler velocity',()=>{
 const f=effect(next,'clear');try{f.set({preset:'rain'});f.frame(.4);const s=f.snapshot(),rainArea=.7*(.4-(1-Math.exp(-1.7*.4))/1.7),phase=.58*.4+.48*rainArea;
  near(s.geometries[1][1],1.65-phase*2.48,2e-7);near(s.weather.effective.rain,.7*(1-Math.exp(-1.7*.4)));near(s.poolTime,.4);
 }finally{f.dispose();}
});
test('retarget preserves presentation and phase; repeated interruption remains cadence-independent',()=>{
 const a=effect(next,'rain'),b=effect(next,'rain');try{
  for(const [time,patch] of [[3.2,{wind:3.2,rain:.2,direction:-80}],[.4,{preset:'wind'}],[.8,{preset:'rain'}],[.1,{preset:'clear'}],[8,{preset:'rain'}]]){
   advance(a,time,.016);advance(b,time,.8);equivalent(a.snapshot(),b.snapshot());const before=a.snapshot();a.set(patch,a.stamp);b.set(patch,b.stamp);assert.deepEqual(a.snapshot().geometries,before.geometries);assert.deepEqual(a.snapshot().weather.effective,before.weather.effective);near(a.snapshot().weather.effect.phaseTime,before.weather.effect.phaseTime);a.frame(0);b.frame(0);equivalent(a.snapshot(),b.snapshot());
  }
  advance(a,10,.016);advance(b,10,10);equivalent(a.snapshot(),b.snapshot());
 }finally{a.dispose();b.dispose();}
});
test('new intent starts at its event epoch, stale RAF timestamps and duplicate updates cannot steal time',()=>{
 const f=effect(next,'clear'),expected=effect(next,'clear');try{
  f.frame(.1);expected.frame(.1);f.set({preset:'rain'},490);expected.set({preset:'rain'});f.instance.update(.05,undefined,{elapsed:.4,stamp:480});near(f.snapshot().weather.time,.1);f.instance.update(.05,undefined,{elapsed:.5,stamp:500});expected.frame(.01);equivalent(f.snapshot(),expected.snapshot());
  f.instance.update(.05,undefined,{elapsed:.5,stamp:1000});expected.frame(.5);equivalent(f.snapshot(),expected.snapshot());
 }finally{f.dispose();expected.dispose();}
});
test('native mounted controls record only real input changes, including same-frame retarget and pause resume',()=>{
 const f=createSolarFixture({attached:true});let stamp=0;f.w.performance.now=()=>stamp;const e=f.effects.get('weather');try{
  // Registration uses the real document epoch; this explicit event starts the test epoch.
  stamp=490;f.api.setWeather({preset:'rain'});const before=f.api.getState();e.update(.05,undefined,{elapsed:.5,stamp:500});near(f.api.getState().time-before.time,.01);
  stamp=990;assert.equal(f.api.setWeather({preset:'rain'}),false);e.update(.05,undefined,{elapsed:.5,stamp:1000});near(f.api.getState().time-before.time,.51);
  stamp=1100;f.api.setWeather({paused:true});e.update(.05,undefined,{elapsed:.5,stamp:1500});const paused=f.api.getState();e.update(.05,undefined,{elapsed:600,stamp:601500});near(f.api.getState().effect.phaseTime,paused.effect.phaseTime);
  stamp=601990;f.api.setWeather({paused:false});e.update(.05,undefined,{elapsed:.5,stamp:602000});near(f.api.getState().effect.phaseTime-paused.effect.phaseTime,.01,1e-8);
 }finally{f.close();}
});
test('hidden frame-clock suspension excludes its gap, resumes without a catch-up burst or phase reset',()=>{
 const f=effect(next,'rain');let stamp=0,visible=true,id=0;const pending=new Map();
 const clock=createFrameClock({now:()=>stamp,visible:()=>visible,request:fn=>{pending.set(++id,fn);return id;},cancel:id=>pending.delete(id),step:(dt,t)=>f.instance.update(Math.min(.05,dt),undefined,{elapsed:dt,stamp:t}),needsFrame:()=>f.instance.needsFrame()});
 function frame(dt){stamp+=dt;assert.equal(pending.size,1);const [[id,fn]]=pending;pending.delete(id);fn(stamp);}
 try{clock.wake();frame(100);const before=f.snapshot();visible=false;clock.suspend();stamp+=600000;assert.equal(pending.size,0);assert.deepEqual(f.snapshot(),before);visible=true;clock.wake();frame(16);near(f.snapshot().weather.time-before.weather.time,.016);near(f.snapshot().poolTime-before.poolTime,.016);assert.equal(pending.size,1);}finally{clock.dispose();f.dispose();}
});
test('quiet, disabled, paused and reduced time stays excluded; exact target/static policies are retained',()=>{
 for(const mode of ['quiet','disabled','paused','reduced']){const f=effect(next,'rain');try{f.frame(.1);if(mode==='quiet')f.policy({readingQuiet:true});if(mode==='disabled')f.set({enabled:false});if(mode==='paused')f.set({paused:true});if(mode==='reduced')f.policy({reduced:true});const before=f.snapshot();f.frame(600);near(f.snapshot().weather.time,before.weather.time);near(f.snapshot().poolTime,before.poolTime);assert.equal(f.instance.needsFrame(),false);
  if(mode==='quiet')f.policy({readingQuiet:false});if(mode==='disabled')f.set({enabled:true});if(mode==='paused')f.set({paused:false});if(mode==='reduced')f.policy({reduced:false});f.instance.markIntent(f.stamp);f.frame(.016);near(f.snapshot().weather.time,before.weather.time+.016,1e-8);near(f.snapshot().poolTime,before.poolTime+.016,1e-8);
 }finally{f.dispose();}}
});
test('auto-sun ramp and its cap have the same trajectory at all frame rates, including an initially lagging climate',()=>{
 for(const initial of [{preset:'dawn',autoSun:true},{altitude:74.995,autoSun:true,effective:{altitude:22}}])for(const elapsed of [.1,.4,.8,3.2,20,600]){
  const a=next.createWeatherModel(initial),b=next.createWeatherModel(initial);for(let t=0;t<elapsed-1e-10;){const dt=Math.min(.016,elapsed-t);a.advanceInterval(dt);t+=dt;}b.advanceInterval(elapsed);for(const k of keys){near(a.getState().effective[k],b.getState().effective[k],2e-8);near(a.getState().target[k],b.getState().target[k],2e-8);}near(a.getState().time,b.getState().time,1e-8);assert.ok(b.getState().target.altitude<=75);
 }
});
test('a ten-minute visible frame has bounded analytic work and finite state, and reaches the exact target',()=>{
 const f=effect();f.set({preset:'rain'});const expm1=Math.expm1,log=Math.log;let calls=0;Math.expm1=x=>{calls++;return expm1(x);};Math.log=x=>{calls++;return log(x);};try{f.frame(600);assert.ok(calls<=12);const s=f.snapshot();near(s.weather.time,600);near(s.poolTime,600);assert.equal(s.weather.transitioning,false);for(const a of s.geometries)assert.ok(a.every(Number.isFinite));}finally{Math.expm1=expm1;Math.log=log;f.dispose();}
});
test('real scene preserves bounded legacy dt while delivering full visible metadata, actor/canvas and shadow owner',()=>{
 const f=bootWorld({manual:true,query:'?manual=1&space=all'});let e;try{const actor=f.cpu.actor,canvas=f.cpu.renderer.domElement,cache=f.cpu.shadowCache,deliveries=[];
  f.world.registerEffect('weather',ctx=>{e=next.createWeatherEffect({...ctx,getState:()=>({...ctx.getState(),weather:{preset:'rain'}})});return{...e,update(dt,state,frame){deliveries.push({dt,frame});e.update(dt,state,frame);}};});
  f.study.step(10);assert.equal(deliveries.at(-1).dt,.05);assert.equal(deliveries.at(-1).frame.elapsed,10);near(e.getState().effect.phaseTime,10);assert.equal(f.cpu.actor,actor);assert.equal(f.cpu.renderer.domElement,canvas);assert.equal(f.cpu.shadowCache,cache);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);
  const before=e.getState().effect.phaseTime;f.w.contentStudy.open('work-context',{push:false});f.settle();f.study.step(10);near(e.getState().effect.phaseTime,before);assert.equal(e.getState().effect.visible,false);
 }finally{f.destroy();}
});
test('runtime scope is two modules; six shadow-cache owner hooks and service bytes remain unchanged',()=>{
 const scene=fs.readFileSync(new URL('../../runtime/world/scene.js',import.meta.url),'utf8');
 const restored=scene.replace(" // Keep the bounded legacy simulation argument. Analytic consumers can opt into\n // the world's active-visible interval; they never create a clock or replay frames.\n for(const effect of effects.values())effect.update(Math.min(.05,dt),effectState(),{elapsed:dt,stamp});", " // Effects are procedural simulations with their own bounded-step policy. They\n // do not receive the uncapped presentation/timeline clock or replay missed frames.\n for(const effect of effects.values())effect.update(Math.min(.05,dt),effectState());");
 const hash=v=>crypto.createHash('sha256').update(v).digest('hex');assert.notEqual(restored,scene);assert.equal(hash(restored),'823a25d68a0e52d0b20f44ef436a99fbaa202d4dfdb1daf6be941d067187de3a');
 assert.equal(hash(fs.readFileSync(new URL('../../runtime/world/shadow-cache.js',import.meta.url))),'6482c892a62b81322dc96ab8d47aa3d00084517209a61fa5a3c0579c44fdd99d');
});
test('native host quiet entry/resume records its actual epoch and no quiet debt is replayed',()=>{
 const f=createSolarFixture({attached:true});let stamp=0;f.w.performance.now=()=>stamp;const e=f.effects.get('weather');try{
  f.api.setWeather({preset:'rain'});e.update(.05,undefined,{elapsed:.1,stamp:100});const phase=f.api.getState().effect.phaseTime;
  stamp=110;f.emit({readingQuiet:true});e.update(.05,undefined,{elapsed:600,stamp:600100});near(f.api.getState().effect.phaseTime,phase);
  stamp=600490;f.emit({readingQuiet:false});e.update(.05,undefined,{elapsed:.4,stamp:600500});near(f.api.getState().effect.phaseTime,phase+.01,1e-8);
  stamp=600990;f.emit({readingQuiet:false});e.update(.05,undefined,{elapsed:.5,stamp:601000});near(f.api.getState().effect.phaseTime,phase+.51,1e-8);
 }finally{f.close();}
});
test('timed rain remains invisible across emitter wraps and timed wind retains its periodic seam',()=>{
 const eps=.0001,speed=.58+.7*.48;
 for(const i of [0,1,7,25,26,31]){const f=effect(next,'rain');try{const boundary=(1-(i*.61803398875)%1)/speed;f.frame(boundary-eps);const a=f.snapshot();f.frame(eps*2);const b=f.snapshot();assert.ok(a.colors[i*8+3]<1e-5);assert.ok(b.colors[i*8+3]<1e-5);f.frame(.5/speed-eps);assert.ok(f.snapshot().colors[i*8+3]>.99);}finally{f.dispose();}}
 const f=effect(next,'wind');try{const initial=f.snapshot(),period=Math.PI*2/(6.5*.55);for(let i=0;i<8;i++){f.frame(period);const a=f.snapshot();for(let j=0;j<a.geometries[2].length;j++)near(initial.geometries[2][j],a.geometries[2][j],1e-6);}}finally{f.dispose();}
});
test('all preset light/material/character end states match alpha.6, with unchanged weather geometry and shaders',()=>{
 for(const preset of Object.keys(next.WEATHER_PRESETS)){const a=effect(old),b=effect();try{a.set({preset,paused:true});b.set({preset,paused:true});a.frame(1,false);b.frame(1);const aa=a.snapshot(),bb=b.snapshot();assert.deepEqual(bb.weather.effective,aa.weather.effective);assert.deepEqual(bb.light,aa.light);assert.deepEqual(bb.material,aa.material);assert.deepEqual(bb.response,aa.response);assert.deepEqual(bb.geometries,aa.geometries);for(let j=0;j<3;j++){assert.equal(b.root.children[j].material.fragmentShader,a.root.children[j].material.fragmentShader);assert.equal(b.root.children[j].material.vertexShader,a.root.children[j].material.vertexShader);}}finally{a.dispose();b.dispose();}}
});
