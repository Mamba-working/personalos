import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import {createShadowCache} from '../../runtime/world/shadow-cache.js';
import {bootWorld} from './world-cpu-fixture.mjs';

function fixture() {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),parent=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.castShadow=true;
  const light=new THREE.DirectionalLight();light.castShadow=true;light.position.set(2,4,3);
  scene.add(parent,light,light.target);parent.add(mesh);
  const renderer={shadowMap:{enabled:true,type:THREE.VSMShadowMap,autoUpdate:true,needsUpdate:false}};
  const cache=createShadowCache({THREE,renderer,scene,camera});
  const frame=()=>{const refresh=cache.prepare();if(refresh){light.shadow.map||={};light.shadow.camera.updateProjectionMatrix();light.shadow.needsUpdate=false;renderer.shadowMap.needsUpdate=false;}return refresh;};
  frame();frame();assert.equal(frame(),false);
  return{scene,camera,parent,mesh,light,renderer,cache,frame};
}
function dirtyThenClean(f,edit) {edit();assert.equal(f.frame(),true);assert.equal(f.frame(),false);}

test('static VSM reuses the existing scene, actor, light, renderer and shadow map',()=>{
 const f=fixture(),map=f.light.shadow.map,geometry=f.mesh.geometry;
 for(let i=0;i<60;i++)assert.equal(f.frame(),false);
 assert.equal(f.light.shadow.map,map);assert.equal(f.mesh.geometry,geometry);assert.equal(f.renderer.shadowMap.autoUpdate,false);
});
test('world transforms, visible hierarchy, participant flags and replacement/removal invalidate',()=>{
 const f=fixture();
 for(const edit of [()=>f.parent.position.x++,()=>f.mesh.rotation.z+=.1,()=>f.mesh.scale.x+=.1,
  ()=>f.parent.visible=false,()=>f.parent.visible=true,()=>f.mesh.castShadow=false,
  ()=>f.mesh.receiveShadow=true,()=>f.mesh.layers.set(1),()=>f.camera.layers.enable(1),
  ()=>f.mesh.geometry=new THREE.BoxGeometry(),()=>f.mesh.material=new THREE.MeshStandardMaterial(),
  ()=>f.mesh.removeFromParent(),()=>f.parent.add(f.mesh)])dirtyThenClean(f,edit);
});
test('GPU attribute versions, index, draw range and material depth inputs invalidate',()=>{
 const f=fixture();
 for(const edit of [()=>f.mesh.geometry.attributes.position.needsUpdate=true,
  ()=>f.mesh.geometry.index.needsUpdate=true,()=>f.mesh.geometry.setDrawRange(0,3),
  ()=>f.mesh.material.side=THREE.DoubleSide,()=>f.mesh.material.visible=false,()=>f.mesh.material.visible=true,
  ()=>f.mesh.material.alphaTest=.5,()=>f.mesh.material.map=new THREE.Texture(),
  ()=>f.mesh.material.map.needsUpdate=true,()=>f.mesh.material.map.offset.x=.2,
  ()=>{f.mesh.material.clipShadows=true;f.mesh.material.clippingPlanes=[new THREE.Plane()];},
  ()=>f.mesh.material.clippingPlanes[0].constant=2])dirtyThenClean(f,edit);
 // Writes not uploaded to the GPU cannot change its shadow geometry.
 f.mesh.geometry.attributes.position.array[0]+=1;assert.equal(f.frame(),false);
 f.mesh.material.color.set('red');f.mesh.material.roughness=.1;f.mesh.material.opacity=.5;assert.equal(f.frame(),false);
});
test('VSM tracks receive-only geometry; non-participant eyes and weather do not dirty shadows',()=>{
 const f=fixture(),eye=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial());f.mesh.add(eye);
 assert.equal(f.frame(),false);eye.geometry.attributes.position.needsUpdate=true;eye.rotation.x=.2;assert.equal(f.frame(),false);
 dirtyThenClean(f,()=>eye.receiveShadow=true);dirtyThenClean(f,()=>eye.geometry.attributes.position.needsUpdate=true);
 dirtyThenClean(f,()=>f.renderer.shadowMap.type=THREE.PCFShadowMap);
 eye.geometry.attributes.position.needsUpdate=true;assert.equal(f.frame(),false);
});
test('light/target, camera projection, map quality and explicit refresh invalidate',()=>{
 const f=fixture();
 for(const edit of [()=>f.light.position.y++,()=>f.light.target.position.x++,
  ()=>f.light.shadow.camera.far++,()=>f.light.shadow.camera.projectionMatrix.elements[0]+=.1,
  ()=>f.light.shadow.radius++,()=>f.light.shadow.blurSamples++,()=>f.light.shadow.mapSize.x=1024,
  ()=>f.light.shadow.map=null,()=>f.light.shadow.needsUpdate=true,
  ()=>f.renderer.shadowMap.needsUpdate=true,()=>f.cache.invalidate()]) {
   edit();assert.equal(f.frame(),true);f.frame();assert.equal(f.frame(),false);
 }
 f.light.intensity+=.1;f.light.color.set('red');assert.equal(f.frame(),false);
});
test('custom shadow callbacks/materials and animated geometry conservatively refresh',()=>{
 for(const edit of [f=>f.mesh.onBeforeShadow=()=>{},f=>f.mesh.customDepthMaterial=new THREE.MeshDepthMaterial(),
  f=>f.mesh.isSkinnedMesh=true,f=>f.mesh.isInstancedMesh=true,
  f=>f.mesh.geometry.morphAttributes.position=[f.mesh.geometry.attributes.position.clone()],
  f=>f.mesh.material=new THREE.ShaderMaterial(),f=>f.scene.onBeforeRender=()=>{}]) {
  const f=fixture();edit(f);assert.equal(f.frame(),true);assert.equal(f.frame(),true);f.cache.dispose();
 }
});
test('reflection save/restore cannot consume or overwrite pending cache invalidation; dispose is inert',()=>{
 const f=fixture();f.cache.invalidate();assert.equal(f.cache.prepare(),true);
 const before=f.renderer.shadowMap.autoUpdate;f.renderer.shadowMap.autoUpdate=false;f.renderer.shadowMap.autoUpdate=before;
 assert.equal(f.renderer.shadowMap.needsUpdate,true);f.frame();assert.equal(f.frame(),false);
 f.cache.dispose();assert.equal(f.renderer.shadowMap.autoUpdate,true);f.cache.invalidate();assert.equal(f.cache.prepare(),false);f.cache.dispose();
});
test('context restoration follows the replacement renderer shadow service',()=>{
 const f=fixture(),old=f.renderer.shadowMap;
 f.renderer.shadowMap={...old,autoUpdate:true,needsUpdate:false};
 assert.equal(f.frame(),true);assert.equal(f.renderer.shadowMap.autoUpdate,false);assert.equal(f.frame(),false);
 f.cache.dispose();assert.equal(f.renderer.shadowMap.autoUpdate,true);
});
test('native world keeps eyes live, resumes with fresh shadows, and disposes the same renderer',()=>{
 const f=bootWorld({enabled:true,reduced:true,manual:true}),{renderer,scene,actor,key,eyes}=f.cpu;
 try {
  f.study.step(0);f.study.step(0);const count=renderer.shadowRefreshes;
  for(let i=0;i<10;i++)f.study.step(.05);
  assert.equal(renderer.shadowRefreshes,count);assert(eyes[0].mesh.geometry.attributes.position.version>10);
  Object.defineProperty(f.d,'hidden',{value:true,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.equal(renderer.shadowRefreshes,count);key.position.x+=1;
  Object.defineProperty(f.d,'hidden',{value:false,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));f.study.step(0);
  assert.equal(renderer.shadowRefreshes,count+1);f.study.step(0);assert.equal(renderer.shadowRefreshes,count+1);
  f.w.dispatchEvent(new f.w.Event('resize'));f.study.step(0);assert.equal(renderer.shadowRefreshes,count+2);
  assert.equal(f.cpu.actor,actor);assert.equal(f.cpu.scene,scene);assert.equal(f.renderers.length,1);
 } finally {f.destroy();}
 assert.equal(renderer.disposed,true);assert.equal(renderer.shadowMap.autoUpdate,true);
});
test('native book intro and transitions stay dynamic until the same actor settles at home',()=>{
 const f=bootWorld({enabled:true,manual:true});
 try {
  let last=f.cpu.renderer.shadowRefreshes;
  for(let i=0;i<10;i++){f.study.step(.15);assert(f.cpu.renderer.shadowRefreshes>last);last=f.cpu.renderer.shadowRefreshes;}
  f.world.story.skip();for(let i=0;i<20;i++)f.study.step(.1);
  assert.equal(f.world.story.getState().phase,'home');f.study.step(0);f.study.step(0);last=f.cpu.renderer.shadowRefreshes;
  for(let i=0;i<10;i++)f.study.step(.05);assert.equal(f.cpu.renderer.shadowRefreshes,last);
 }finally{f.destroy();}
});
