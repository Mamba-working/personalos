import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import * as old from './fixtures/v3/weather.js';
import * as next from '../../runtime/modules/weather.js';
function world(module,preset){const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);let state={phase:'home',weather:{preset}};const effect=module.createWeatherEffect({THREE,scene,actor,getState:()=>state});return{effect,root:scene.children.at(-1),set(patch){state.weather={preset,...patch};}};}
function warm(f){for(let i=0;i<600;i++)f.effect.update(.1);}
function wind(f){return Array.from(f.root.children.find(n=>n.name.includes('wind strokes')).geometry.attributes.position.array);}
const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
test('wind retarget after one minute preserves instantaneous phase instead of rescaling elapsed time',()=>{
 const a=world(old,'wind'),b=world(next,'wind');try{warm(a);warm(b);const aa=wind(a),bb=wind(b);a.set({wind:3.2});b.set({wind:3.2});a.effect.update(.01);b.effect.update(.01);
  assert.ok(delta(aa,wind(a))>.03,'old time-times-speed retarget jump reproduced');assert.ok(delta(bb,wind(b))<.012,'new phase continues from the current field');
 }finally{a.effect.dispose();b.effect.dispose();}
});
test('rain retarget after one minute moves visible streaks only by the new frame velocity',()=>{
 const a=world(old,'rain'),b=world(next,'rain');
 function read(f){const r=f.root.children.find(n=>n.name.includes('rain strokes'));return{position:Array.from(r.geometry.attributes.position.array),color:Array.from(r.geometry.attributes.color.array)};}
 function visibleDelta(a,b){let max=0;for(let i=0;i<26;i++)if(a.color[i*8+3]>.3&&b.color[i*8+3]>.3)max=Math.max(max,Math.abs(a.position[i*6+1]-b.position[i*6+1]));return max;}
 try{warm(a);warm(b);const aa=read(a),bb=read(b);a.set({rain:.2});b.set({rain:.2});a.effect.update(.01);b.effect.update(.01);
  assert.ok(visibleDelta(aa,read(a))>.2,'old rate change teleports visible drops');assert.ok(visibleDelta(bb,read(b))<.03,'new integration advances only one 10 ms sample');
 }finally{a.effect.dispose();b.effect.dispose();}
});
test('pause retains actual rain/wind arrays, ground-ring phase and bounded character cue',()=>{
 const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);let state={phase:'home',weather:{preset:'rain'}},response;
 const effect=next.createWeatherEffect({THREE,scene,actor,getState:()=>state,applyWeatherResponse:r=>response=r});const root=scene.children.at(-1);
 try{for(let i=0;i<33;i++)effect.update(.1);const geometry=root.children.map(n=>Array.from(n.geometry.attributes.position.array)),before={response:{...response},phase:root.children[0].material.uniforms.uTime.value};
  state.weather={preset:'rain',paused:true};effect.update(.1);assert.deepEqual(root.children.map(n=>Array.from(n.geometry.attributes.position.array)),geometry);assert.deepEqual(response,before.response);assert.equal(root.children[0].material.uniforms.uTime.value,before.phase);
  assert.match(root.children[0].material.fragmentShader,/fract\(uTime\*\.62\+fi\*\.317\)/);assert.doesNotMatch(root.children[0].material.fragmentShader,/uTime\*\.62\*uMotion/);assert.equal(effect.needsFrame(),false);
 }finally{effect.dispose();}
});
test('wind hands over to rain at zero visible weight rather than popping off at a rain threshold',()=>{
 const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);let state={phase:'home',reduced:true,weather:{preset:'wind'}};
 const effect=next.createWeatherEffect({THREE,scene,actor,getState:()=>state}),wind=scene.children.at(-1).children.find(n=>n.name.includes('wind strokes'));
 try{assert.ok(wind.visible&&wind.material.opacity>.45);const opacities=[];for(const rain of [.02,.06,.1,.14,.17999,.18,.18001]){state.weather={preset:'wind',rain};effect.update(0);opacities.push(wind.material.opacity);if(rain>.1799)assert.ok(wind.material.opacity<1e-6);}
  for(let i=1;i<opacities.length;i++)assert.ok(opacities[i]<=opacities[i-1]);assert.equal(wind.visible,false);
 }finally{effect.dispose();}
});
