import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import * as old from './fixtures/v2/weather.js';
import * as candidate from '../../runtime/modules/weather.js';
function world(module,preset){const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);const effect=module.createWeatherEffect({THREE,scene,actor,getState:()=>({phase:'home',weather:{preset}})});return{scene,effect,root:scene.children.at(-1)};}
function at(f,time){let gap=time-f.effect.getState().effect.phaseTime;while(gap>.10000001){f.effect.update(.1);gap=time-f.effect.getState().effect.phaseTime;}if(gap>1e-10)f.effect.update(gap);return f;}
const verts=(f,kind)=>Array.from(f.root.children.find(n=>n.name.includes(kind+' strokes')).geometry.attributes.position.array);
const maxDelta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
test('actual V2 consumer reproduces the wind seam, V3 removes it at each former modulo boundary',()=>{
 const epsilon=1e-4,wind=6.5;
 for(const strand of [0,1,2]){
  const boundary=(1-strand*.31)/(wind*.09),a=world(old,'wind'),b=world(candidate,'wind');
  try{at(a,boundary-epsilon);const oldBefore=verts(a,'wind');at(a,boundary+epsilon);assert.ok(maxDelta(oldBefore,verts(a,'wind'))>.15,'old reset must be demonstrated, not assumed');
   at(b,boundary-epsilon);const before=verts(b,'wind');at(b,boundary+epsilon);assert.ok(maxDelta(before,verts(b,'wind'))<.0002,'continuous drift cannot jump at the old seam');
  }finally{a.effect.dispose();b.effect.dispose();}
 }
});
test('actual wind arrays are periodic and velocity-continuous over repeated complete cycles',()=>{
 const f=world(candidate,'wind'),period=Math.PI*2/(6.5*.55),epsilon=1e-4;try{
  const initial=verts(f,'wind');at(f,period);assert.ok(maxDelta(initial,verts(f,'wind'))<1e-5);
  for(let cycle=2;cycle<=8;cycle++){const t=period*cycle;at(f,t-epsilon);const a=verts(f,'wind');at(f,t);const b=verts(f,'wind');at(f,t+epsilon);const c=verts(f,'wind');
   assert.ok(maxDelta(a,b)<.0001);assert.ok(maxDelta(b,c)<.0001);const left=a.map((v,i)=>(b[i]-v)/epsilon),right=b.map((v,i)=>(c[i]-v)/epsilon);assert.ok(maxDelta(left,right)<.01,'Float32 sampled velocities match across wrap');}
 }finally{f.effect.dispose();}
});
test('real RGBA rain consumer is visible mid-flight and invisible on both sides of every emitter reset',()=>{
 const speed=.58+.7*.48,eps=1e-4;
 for(const drop of [0,1,7,25,26,31]){
  const f=world(candidate,'rain');try{
   const rain=f.root.children.find(n=>n.name.includes('rain strokes'));assert.equal(rain.material.vertexColors,true);assert.equal(rain.geometry.attributes.color.itemSize,4);assert.equal(rain.geometry.attributes.color.count,64);
   const phase=(drop*.61803398875)%1,boundary=(1-phase)/speed;
   at(f,boundary-eps);const before=rain.geometry.attributes.color.array[drop*8+3];at(f,boundary+eps);const after=rain.geometry.attributes.color.array[drop*8+3];assert.ok(before<1e-5&&after<1e-5,'the geometric reset has zero visible weight');
   at(f,boundary+.5/speed);const middle=rain.geometry.attributes.color.array[drop*8+3];assert.ok(middle>.99);assert.ok(middle*rain.material.opacity>.6,'rain was not hidden to pass continuity');
   assert.equal(f.root.children.length,3);
  }finally{f.effect.dispose();}
 }
});
test('r180 real material shader supports vertex alpha and the original ground ripple now enters with zero opacity',()=>{
 const vendor=fs.readFileSync(new URL('../../runtime/world/vendor/three/three.module.js',import.meta.url),'utf8');assert.match(vendor,/vertexAlphas: material\.vertexColors === true && !! geometry\.attributes\.color && geometry\.attributes\.color\.itemSize === 4/);assert.ok(vendor.includes('diffuseColor *= vColor'));
 const f=world(candidate,'rain');try{const pool=f.root.children[0];assert.match(pool.material.fragmentShader,/rings\+=ring\*\(1\.0-age\)\*smoothstep\(0\.0,\.15,age\)/);}finally{f.effect.dispose();}
});
