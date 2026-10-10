import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from '../../public/vendor/three/addons/loaders/GLTFLoader.js';
import {Sky} from '../../public/vendor/three/addons/objects/Sky.js';
import {WeatherClock,sampleSun} from '../../public/weather-clock.js';
import {sunDirection,fitSunShadow,foregroundBounds} from '../../public/lighting.js';
const root=new URL('../../',import.meta.url);
const source=await fs.readFile(new URL('public/app.js',root),'utf8');
const start=source.indexOf('function applyLighting('),end=source.indexOf('\nfunction render(',start);
assert.ok(start>=0&&end>start,'Locate actual app lighting function');
const bytes=await fs.readFile(new URL('public/assets/foreground.glb',root));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.updateMatrixWorld(true);
const bounds=foregroundBounds(gltf.scene);let ground;gltf.scene.traverse(o=>{if(o.userData.slice_role==='ground')ground=o;});const groundY=new THREE.Box3().setFromObject(ground).max.y;
const results=[];
for(const hz of[15,30,60,120]){
 const clock=new WeatherClock(),sky=new Sky(),sun=new THREE.DirectionalLight(),scene=new THREE.Scene();sun.shadow.mapSize.set(2048,2048);let live=0,peak=0,maxLagSeconds=0,maxLagDegrees=0;const captureTimes=[];
 const context={state:{ready:true,pmremCaptures:0},clock,sampleSun,sunDirection,fitSunShadow,sky,sun,scene,bounds,model:{groundY},lastLightingTick:-1,appliedSun:null,lastEnvironmentSeconds:null,
  environmentScene:{},temporaryMap:null,endpointMaps:new Map(['A','B'].map(name=>[name,{texture:{name,direction:sunDirection(sampleSun(name==='A'?0:12)).toArray()}}])),renderer:{shadowMap:{}},performance,environmentSamples:[],push:(a,v)=>a.push(v)};
 context.pmrem={fromScene(){live++;peak=Math.max(peak,live);captureTimes.push(clock.snapshot().sun.seconds);return{texture:{direction:sky.material.uniforms.sunPosition.value.toArray()},dispose(){live--;}};}};
 context.clearTemporary=()=>{if(context.temporaryMap){context.temporaryMap.dispose();context.temporaryMap=null;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nglobalThis.applyUnderTest=applyLighting;',context);
 context.applyUnderTest(true);
 for(let frame=0;frame<hz*12;frame++){clock.advance(1/hz,()=>{});context.applyUnderTest();const sample=clock.snapshot().sun,d=sunDirection(sample);
  assert.equal(context.lastLightingTick,clock.sunTicks);assert.ok(sky.material.uniforms.sunPosition.value.distanceTo(d)<1e-12);assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(d)<1e-12,'Direct sun and visible sky follow current frame');
  const envDirection=new THREE.Vector3().fromArray(scene.userData.environmentDirection);assert.ok(new THREE.Vector3().fromArray(scene.environment.direction).distanceTo(envDirection)<1e-12,'Environment metadata matches actual captured input direction');
  const lag=sample.seconds-context.lastEnvironmentSeconds;assert.ok(lag>=-1e-9&&lag<.5+1e-9,'PMREM temporal lag stays within coarse half-second budget');maxLagSeconds=Math.max(maxLagSeconds,lag);maxLagDegrees=Math.max(maxLagDegrees,THREE.MathUtils.radToDeg(d.angleTo(envDirection)));
 }
 assert.equal(clock.sunTicks,1440);assert.equal(context.lastEnvironmentSeconds,12);assert.equal(scene.environment.name,'B');assert.equal(live,0);assert.ok(captureTimes.length<=23,'Continuous12s playback respects23-intermediate capture budget');for(let i=1;i<captureTimes.length;i++)assert.ok(captureTimes[i]-captureTimes[i-1]>=.5-1e-9,'No more than2Hz automatic PMREM capture');
 assert.ok(live<=1);assert.ok(peak<=2,'At most old/new temporary PMREM targets during replacement');
 const intermediateCaptures=captureTimes.length;clock.reset();context.applyUnderTest(true);for(let i=0;i<32;i++)clock.advance(1/120,()=>{});context.applyUnderTest();assert.equal(context.lastEnvironmentSeconds,0);context.applyUnderTest(true);assert.equal(context.lastEnvironmentSeconds,32/120,'Pause refreshes exact current environment');assert.ok(new THREE.Vector3().fromArray(scene.userData.environmentDirection).distanceTo(sunDirection(clock.snapshot().sun))<1e-12);clock.advance(1/120,()=>{});context.applyUnderTest();assert.equal(context.lastLightingTick,33,'Resume continues current direct light');assert.equal(context.lastEnvironmentSeconds,32/120,'Forced pause capture does not regress');
 results.push({hz,playbackSeconds:12,intermediateCaptures,maxLagSeconds,maxLagDegrees,exactEndpoint:true,exactPause:true,temporaryPeakDuringReplacement:peak});context.clearTemporary();sky.geometry.dispose();sky.material.dispose();
}
const report={passed:true,scope:'Actual app applyLighting control flow executed in Node with real Three sun/sky geometry and shadow fitting. PMREM capture and renderer are explicit call-recording mocks; no WebGL, environment texture render, shader compile, GPU timing, or FPS claim.',results};
await fs.writeFile(new URL('../results/lighting-wiring-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
