import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSolarFixture} from './weather-solar-fixture.mjs';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import {createWeatherEffect,weatherCharacterResponse} from '../../runtime/modules/weather.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const settle=f=>{for(let i=0;i<110;i++)f.effect.update(.1);};
function world(preset='clear'){
 const scene=new THREE.Scene(),actor=new THREE.Group(),face=new THREE.Group();
 actor.name='Ball / persistent actor';face.name='original face';actor.add(face);
 const body=new THREE.Mesh(new THREE.SphereGeometry(.88,16,12),new THREE.MeshPhysicalMaterial({roughness:.34,clearcoat:.3,clearcoatRoughness:.27}));actor.add(body);scene.add(actor);
 const key=new THREE.DirectionalLight('#fff7ee',3),sky=new THREE.HemisphereLight('#eef0f6','#788298',1.5);key.position.set(-3.5,8,5.5);key.castShadow=true;scene.add(key,sky);
 let state={phase:'home',weather:{preset},placement:{mode:'hero',progress:0},reduced:false};const responses=[];
 const effect=createWeatherEffect({THREE,scene,actor,getState:()=>state,applyWeatherResponse:r=>responses.push(r)});
 return{scene,actor,body,face,key,sky,effect,responses,set(patch){state={...state,...patch};},get state(){return state;}};
}
test('actual field consumer identifies Clear/Rain/Wind without renderer, and quiet removes all line attention',()=>{
 const f=createSolarFixture();try{
  const read=()=>({root:f.element.style.backgroundImage,color:f.element.style.backgroundColor,light:f.element.querySelector('.weather-light-plane').style.cssText,cloud:f.element.querySelector('.weather-cloud-plane').style.cssText,rain:f.element.querySelector('.weather-far-rain').style.opacity,wind:f.element.querySelector('.weather-wind-lines').style.opacity,pool:f.element.querySelector('.weather-rain-pools').style.opacity});
  f.preset('clear');const clear=read();f.preset('rain');const rain=read();f.preset('wind');const wind=read();
  assert.equal(new Set([clear.color,rain.color,wind.color]).size,3);assert.equal(clear.rain,'0');assert.ok(Number(rain.rain)>=.5,'fallback rain must remain legible');assert.ok(Number(wind.wind)>=.35);assert.ok(Number(rain.pool)>=.4);
  assert.equal(f.element.querySelectorAll('.weather-far-rain path').length,24);assert.equal(f.element.querySelectorAll('svg').length,1);
  f.preset('rain');f.emit({readingQuiet:true});const quiet=read();assert.equal(quiet.rain,'0');assert.equal(quiet.wind,'0');assert.equal(quiet.pool,'0');
  assert.equal(f.calls.raf,0);assert.equal(f.calls.timer,0);
 }finally{f.close();}
});
test('the alpha4 actual solar projection drives both the base wash and new directional spill at 4/22/45/75',()=>{
 const f=createSolarFixture();try{
  f.preset('clear');const frames=[4,22,45,75].map(a=>{f.input(a);return{solar:f.snapshot().state.effective.solarProjection,spill:f.element.querySelector('.weather-light-plane').style.backgroundImage};});
  assert.equal(new Set(frames.map(f=>f.spill)).size,4);for(const f of frames)assert.ok(f.spill.includes(`${Math.round(f.solar.x*10)/10}%`));
  for(let i=1;i<frames.length;i++)assert.ok(frames[i].solar.y<frames[i-1].solar.y);
  f.api.setWeather({azimuth:-65});const left=f.element.querySelector('.weather-light-plane').style.backgroundImage;f.api.setWeather({azimuth:65});assert.notEqual(left,f.element.querySelector('.weather-light-plane').style.backgroundImage);
 }finally{f.close();}
});
test('actual Three rain geometry occupies above/beside actor, six contact drips, temporal falls and physical slant',()=>{
 const f=world('rain');try{
  const root=f.scene.children.at(-1),rain=root.children.find(n=>n.name.includes('rain strokes'));const positions=()=>Array.from(rain.geometry.attributes.position.array);
  const a=positions();assert.equal(a.length,192);assert.ok(a.filter((_,i)=>i%6===1).some(y=>y>1));assert.ok(a.filter((_,i)=>i%6===1).some(y=>y<-.4));
  assert.ok(rain.material.opacity>.6);f.effect.update(.1);assert.notDeepEqual(positions(),a);
  assert.ok(positions()[3]>positions()[0]);f.set({weather:{preset:'rain',direction:180}});settle(f);assert.ok(positions()[3]<positions()[0]);
  for(let i=26;i<32;i++){const y=positions()[i*6+1];assert.ok(y>=-.861&&y<=-.77);}
 }finally{f.effect.dispose();}
});
test('actual wind segments form three traversing streams and consume reversed direction without changing resource counts',()=>{
 const f=world('wind');try{
  const root=f.scene.children.at(-1),wind=root.children.find(n=>n.name.includes('wind strokes'));assert.equal(root.children.length,3);assert.equal(wind.geometry.attributes.position.count,36);assert.ok(wind.visible);
  const a=Array.from(wind.geometry.attributes.position.array);f.effect.update(.1);assert.notDeepEqual(Array.from(wind.geometry.attributes.position.array),a);
  f.set({weather:{preset:'wind',direction:-118}});settle(f);const b=wind.geometry.attributes.position.array;assert.ok(Math.sign(a[33]-a[0])!==Math.sign(b[33]-b[0]));
 }finally{f.effect.dispose();}
});
test('existing key light changes actual direction with altitude and azimuth, then restores position/color/intensity exactly',()=>{
 const f=world(),original=new THREE.Vector3(-3.5,8,5.5);try{
  const a=f.key.position.clone();f.set({weather:{preset:'clear',altitude:75,azimuth:65}});settle(f);const b=f.key.position.clone();assert.notDeepEqual(a,b);assert.ok(b.y>a.y);assert.ok(b.x>0);
  f.set({weather:{preset:'clear',altitude:4,azimuth:-65}});settle(f);assert.ok(f.key.position.x<0);assert.ok(f.key.position.y<b.y);
  f.set({readingQuiet:true});f.effect.update(0);assert.deepEqual(f.key.position,original);assert.equal(f.key.intensity,3);
  f.set({readingQuiet:false});f.effect.update(0);assert.notDeepEqual(f.key.position,original);
 }finally{f.effect.dispose();assert.deepEqual(f.key.position,original);assert.equal(f.key.intensity,3);}
});
test('material rain response uses original source ceramic and restores source values without mutation of face or actor transforms',()=>{
 const f=world('rain');const identity=f.body.material.uuid,geometry=f.body.geometry.uuid;
 try{assert.ok(f.body.material.roughness<.34);assert.ok(f.body.material.clearcoat>.3);assert.equal(f.body.material.uuid,identity);assert.equal(f.body.geometry.uuid,geometry);
  assert.deepEqual(f.actor.position.toArray(),[0,0,0]);assert.deepEqual(f.actor.scale.toArray(),[1,1,1]);assert.deepEqual(f.face.quaternion.toArray(),[0,0,0,1]);
  const response=f.responses.at(-1);assert.ok(response.eyeOpen<1&&response.eyeOpen>.9);assert.ok(Math.abs(response.lean)<=.035);
  f.set({reduced:true});f.effect.update(.1);const t=f.effect.getState().time;f.effect.update(.1);assert.equal(f.effect.getState().time,t);
 }finally{f.effect.dispose();near(f.body.material.roughness,.34);near(f.body.material.clearcoat,.3);near(f.body.material.clearcoatRoughness,.27);}
});
test('the opt-in original world writer consumes same-frame response without introducing a second face or pose timer',()=>{
 const source=fs.readFileSync(new URL('../../runtime/world/scene.js',import.meta.url),'utf8');
 assert.match(source,/factory\(\{THREE,scene,actor,applyWeatherResponse,/);assert.match(source,/nativeEyeOpen=p\.open\*blink;eyeVertices\(nativeEyeOpen,0\)/);assert.match(source,/face\.rotateZ\(response\.lean\|\|0\)/);
 assert.match(source,/eyeVertices\(nativeEyeOpen\*\(response\.eyeOpen\|\|1\)/);
 const p=weatherCharacterResponse({rain:.7,wind:6.5,windVector:[9,0],solarEnergy:.8},0,false);assert.ok(p.lean<=.035);assert.ok(p.sunShade<=.035);
});
test('the exact optional face writer produces a bounded quaternion and original-eye opening, resetting with every source frame',()=>{
 const source=fs.readFileSync(new URL('../../runtime/world/scene.js',import.meta.url),'utf8');
 const fn=source.match(/function applyWeatherResponse\(response\)\{([^\n]+)\}/)?.[1];assert.ok(fn);
 const face=new THREE.Group(),nativeEyeOpen=.94,values=[];
 const apply=new Function('face','nativeEyeOpen','eyeVertices',`return function(response){${fn}}`)(face,nativeEyeOpen,(opening,roll)=>values.push([opening,roll]));
 const response=weatherCharacterResponse({rain:.7,wind:6.5,windVector:[6,2],solarEnergy:0},1,true);
 const native=new THREE.Quaternion().setFromEuler(new THREE.Euler(.05,-.03,.02));face.quaternion.copy(native);apply(response);const reacted=face.quaternion.clone();
 assert.ok(native.angleTo(reacted)>0);assert.ok(native.angleTo(reacted)<.08);near(values[0][0],nativeEyeOpen*response.eyeOpen);assert.equal(values[0][1],0);
 for(let i=0;i<100;i++){face.quaternion.copy(native);apply(response);assert.ok(face.quaternion.angleTo(reacted)<1e-7);}
 // Entering reading restores source pose without needing a weather-owned transform reset.
 face.quaternion.copy(native);assert.deepEqual(face.quaternion.toArray(),native.toArray());
 assert.ok(source.indexOf('nativeEyeOpen=p.open*blink')<source.indexOf('for(const effect of effects.values())effect.update(Math.min(.05,dt),effectState())'));
});
