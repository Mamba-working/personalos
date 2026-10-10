import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from '../public/vendor/three/addons/loaders/GLTFLoader.js';
import {WeatherModel} from '../public/weather-model.js';
import {WeatherClock, sampleSun} from '../public/weather-clock.js';
import {WaterRenderer} from '../public/water-renderer.js';
import {sunDirection,foregroundBounds,fitSunShadow} from '../public/lighting.js';
const bytes=await fs.readFile(new URL('../public/assets/foreground.glb',import.meta.url));
const expectedSHA='11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89';
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSHA);
const load=async()=>{const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.updateMatrixWorld(true);return g.scene;};
const report={passed:false,scope:'Actual immutable GLB, official Three classes and BVH in Node. NO WebGL, shader compilation, GPU visual or device-FPS acceptance.',tests:{},glbSHA256:expectedSHA};
const root=await load(),allEvents=[];const start=performance.now(),model=new WeatherModel({colliderRoot:root,onEvent:e=>allEvents.push(e)});
report.cpu={constructionMs:performance.now()-start};assert.equal(model.drainage.boundary.size,384);assert.equal(model.drainage.points.length,24577);
const simStart=performance.now();for(let i=0;i<1440;i++)model.step();report.cpu.twelveSecondSimulationMs=performance.now()-simStart;
const snap=model.snapshot();assert.ok(snap.counts.canopy>100);assert.ok(snap.counts.ball>0);assert.ok(snap.counts.ground>100);assert.ok(snap.counts.rimGroundHits>100);assert.ok(snap.distinctRimVertices>32);
const byID=new Map(allEvents.map(e=>[e.eventId,e]));let rimRippleChains=0;
for(const event of allEvents){
 if(event.type==='rim-release'){assert.ok(event.sourceImpacts.length>0);for(const id of event.sourceImpacts){const source=byID.get(id);assert.equal(source.kind,'rain');assert.equal(source.collider,'canopy');assert.ok(source.time<=event.time);}assert.ok(model.drainage.boundary.has(event.rimVertex));}
 if(event.type==='ripple'&&event.kind==='rim'){const impact=byID.get(event.parentEvent);assert.equal(impact.collider,'ground');assert.equal(impact.kind,'rim');const release=byID.get(impact.parentEvent);assert.equal(release.type,'rim-release');assert.equal(impact.sourceImpact,release.sourceImpact);rimRippleChains++;}
}
assert.equal(rimRippleChains,snap.counts.rimGroundHits);assert.equal(snap.overflow.runoff,0);assert.equal(snap.overflow.drops,0);assert.equal(snap.overflow.rims,0);
for(const [key,p] of Object.entries(snap.pools))assert.ok(p.active<=p.capacity,key);
assert.ok(model.events.length<=2048);report.tests.causalRealMesh={...snap.counts,distinctRimVertices:snap.distinctRimVertices,completeRimRippleChains:rimRippleChains,rimBoundaryVertices:384,pools:snap.pools,overflow:snap.overflow};
const digest=()=>crypto.createHash('sha256').update(JSON.stringify(allEvents)).digest('hex'),firstDigest=digest();allEvents.length=0;model.reset();for(let i=0;i<1440;i++)model.step();assert.equal(digest(),firstDigest);report.tests.seedResetIdenticalEventDigest=firstDigest;
const cadence=[];for(const fps of[15,30,60,120]){const m=new WeatherModel({colliderRoot:await load()}),c=new WeatherClock();for(let i=0;i<fps*12;i++)c.advance(1/fps,dt=>m.step(dt));assert.equal(m.ticks,1440);assert.equal(c.sunTicks,1440);assert.deepEqual(m.counts,model.counts);cadence.push({displayHz:fps,ticks:m.ticks,counts:{...m.counts}});m.dispose();}report.tests.displayCadence=cadence;
const c=new WeatherClock();c.advance(.1,()=>{});c.running=false;const paused=c.snapshot();c.advance(100,()=>{throw new Error('Paused stepped');});assert.deepEqual(c.snapshot(),paused);c.running=true;c.advance(2,()=>{});assert.equal(c.ticks,42);assert.equal(c.droppedWallSeconds,1.75);c.selectSun('B');c.playSun();assert.equal(c.sunTicks,0);c.reset();assert.equal(c.ticks,0);report.tests.pauseResumeStallBound=true;
const scene=new THREE.Scene(),rendererRoot=await load();scene.add(rendererRoot);const rm=new WeatherModel({colliderRoot:rendererRoot}),water=new WaterRenderer({scene,model:rm});assert.equal(water.group.visible,true);assert.equal(water.markers.visible,false);
for(let i=0;i<360;i++){rm.step();if(i%4===0)water.sync();}water.sync();assert.equal(water.lastNormalTick,360);assert.ok(water.normalBytes.some((v,i)=>i%4===0&&v!==128));
for(const m of water.materials){assert.equal(m.isMeshPhysicalMaterial,true);assert.equal(m.ior,1.333);assert.equal(m.opacity,1);assert.equal(m.transparent,false);assert.equal(m.metalness,0);assert.ok(m.transmission>.9);}
const previous=water.normalUpdates;rm.reset();water.sync();assert.ok(water.normalUpdates>previous);assert.equal(water.lastNormalTick,0);assert.equal(water.normalBytes[1],255);assert.equal(rm.stepListeners.size,1);
water.dispose();water.dispose();assert.equal(rm.stepListeners.size,0);assert.equal(water.group.parent,null);rm.dispose();rm.dispose();assert.equal(rm.adapter.colliders.size,0);report.tests.stockMaterialNormalAndLifecycle=true;
const light=new THREE.DirectionalLight();light.shadow.mapSize.set(2048,2048);const bound=foregroundBounds(root);const shadow=[];
for(let i=0;i<=120;i++){const s=sampleSun(i/10),dir=sunDirection(s),fit=fitSunShadow(light,bound,dir,model.groundY);for(const p of fit.points){const ndc=new THREE.Vector3(...p).project(light.shadow.camera);assert.ok(Math.abs(ndc.x)<=1.000001&&Math.abs(ndc.y)<=1.000001&&Math.abs(ndc.z)<=1.000001);}assert.ok(fit.width<8&&fit.height<8);if(i%60===0)shadow.push({seconds:i/10,...fit,points:undefined});}report.tests.shadowCoverage=shadow;
let camera,ball,canopy,shaft;root.traverse(o=>{if(o.isCamera)camera=o;if(o.userData.slice_role==='ball')ball=o;if(o.userData.slice_role==='canopy')canopy=o;if(o.name.includes('straight_coaxial'))shaft=o;});
camera.aspect=1.5;camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);const project=p=>{const n=p.clone().project(camera);return[(n.x+1)*450,(1-n.y)*300];};
const ballCenter=project(new THREE.Box3().setFromObject(ball).getCenter(new THREE.Vector3()));const canopyCenter=project(new THREE.Box3().setFromObject(canopy).getCenter(new THREE.Vector3()));assert.ok(Math.abs(ballCenter[0]-609.999976)<.005);assert.ok(canopyCenter[0]>ballCenter[0]);
const shaftPoints=[];for(let i=0;i<shaft.geometry.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(shaft.geometry.attributes.position,i).applyMatrix4(shaft.matrixWorld);shaftPoints.push(project(p));}
report.tests.identityProjection={native:[900,600],ballCenterPixel:ballCenter,canopyCenterPixel:canopyCenter,umbrellaScreenRight:true,shaftBoundsPixels:{minX:Math.min(...shaftPoints.map(p=>p[0])),maxX:Math.max(...shaftPoints.map(p=>p[0])),minY:Math.min(...shaftPoints.map(p=>p[1])),maxY:Math.max(...shaftPoints.map(p=>p[1]))},note:'Exact same immutable source geometry/camera; projected checks are not visual verification'};
const widths=[],rimWidths=[];const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
const footprint=p=>{const a=project(p.position.clone().addScaledVector(right,-p.radius)),b=project(p.position.clone().addScaledVector(right,p.radius));return Math.hypot(a[0]-b[0],a[1]-b[1]);};
for(let i=0;i<240;i++){model.step();for(const p of model.rain)if(p.active&&p.position.y<.8)widths.push(footprint(p));for(const p of model.drops)if(p.active&&p.kind==='rim')rimWidths.push(footprint(p));}
const stats=a=>{a.sort((a,b)=>a-b);return {samples:a.length,min:a[0],p50:a[Math.floor(a.length*.5)],p90:a[Math.floor(a.length*.9)],max:a.at(-1),fractionAtLeast2px:a.filter(x=>x>=2).length/a.length};};
report.tests.projectedWaterWidthPixels={native:[900,600],rain:stats(widths),rim:stats(rimWidths),note:'Projected geometry width only; no claim of visible highlight/contrast or antialiased image quality'};
assert.ok(report.tests.projectedWaterWidthPixels.rain.p90>2);assert.ok(report.tests.projectedWaterWidthPixels.rim.p50>2);
model.dispose();report.passed=true;await fs.writeFile(new URL('./results/candidate-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
