import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from '../../public/vendor/three/addons/loaders/GLTFLoader.js';
import {WeatherModel} from '../../public/weather-model.js';
import {WeatherClock,FIXED_STEP} from '../../public/weather-clock.js';
import {WaterRenderer} from '../../public/water-renderer.js';
import {fitSunShadow,sunDirection,foregroundBounds} from '../../public/lighting.js';
const root=new URL('../../',import.meta.url);
const bytes=await fs.readFile(new URL('public/assets/foreground.glb',root));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);
const failures=[];const results={webglTested:false,gpuTimingTested:false};
const test=(name,fn)=>{try{results[name]=fn();console.log('PASS',name);}catch(error){failures.push({name,error:error.message});console.error('FAIL',name,error.message);}};
let events=[];
const model=new WeatherModel({colliderRoot:gltf.scene,onEvent:e=>events.push(e)});
const state=()=>({seed:model.seed,ticks:model.ticks,time:model.time,sequence:model.sequence,randomState:model.randomState,counts:model.counts,overflow:model.overflow,
 pools:Object.fromEntries(['rain','drops','runoff','rims','ripples','contacts'].map(k=>[k,model[k].map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='route')))])),events});
const activeState=()=>({seed:model.seed,ticks:model.ticks,time:model.time,sequence:model.sequence,randomState:model.randomState,counts:model.counts,overflow:model.overflow,
 pools:Object.fromEntries(['rain','drops','runoff','rims','ripples','contacts'].map(k=>[k,model[k].filter(p=>p.active).map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='route')))])),events});
const run=(hz,seconds=12)=>{events=[];model.reset(20261010);const clock=new WeatherClock();for(let f=0;f<hz*seconds;f++)clock.advance(1/hz,()=>model.step());return{digest:hash(JSON.stringify(activeState())),state:JSON.parse(JSON.stringify(activeState())),clock:clock.snapshot(),counts:{...model.counts},events:[...events]};};
const runs=[15,30,60,120].map(hz=>({hz,...run(hz)}));
function differences(a,b,path='',out=[]){if(out.length>=12)return out;if(typeof a!=='object'||typeof b!=='object'||a===null||b===null){if(a!==b)out.push({path,a,b});return out;}for(const key of new Set([...Object.keys(a),...Object.keys(b)])){differences(a[key],b[key],`${path}.${key}`,out);if(out.length>=12)break;}return out;}
results.cadenceDiagnostic=runs.map(r=>({hz:r.hz,digest:r.digest,eventDigest:hash(JSON.stringify(r.events)),counts:r.counts,firstDifferences:differences(runs[0].state,r.state)}));
test('cadence_determinism',()=>{assert.equal(new Set(runs.map(r=>r.digest)).size,1);assert.ok(runs.every(r=>r.clock.ticks===1440));return runs.map(({hz,digest,counts})=>({hz,digest,counts}));});
const allEvents=runs[0].events;
test('event_causality',()=>{
 const byId=new Map();let rimHits=0,rimRipples=0;const normal=new THREE.Vector3();const triangle=new THREE.Triangle();const point=new THREE.Vector3();
 for(const e of allEvents){assert.ok(!byId.has(e.eventId),'Event IDs unique');byId.set(e.eventId,e);
  if(e.parentEvent){const parent=byId.get(e.parentEvent);assert.ok(parent,`Missing previous parent ${e.parentEvent}`);assert.ok(e.time>=parent.time,`${e.type} event precedes parent`);if(e.type==='impact')assert.ok(e.impactTime+1e-9>=parent.time,`Impact time ${e.impactTime} precedes parent ${parent.time}`);}
  if(e.type==='impact'){
   const mesh=model.adapter.colliders.get(e.collider).mesh,index=mesh.geometry.index,p=mesh.geometry.attributes.position;const face=e.faceIndex*3;
   triangle.setFromPointsAndIndices(Array.from({length:3},(_,k)=>new THREE.Vector3().fromBufferAttribute(p,index.getX(face+k)).applyMatrix4(mesh.matrixWorld)),0,1,2);
   point.fromArray(e.position);assert.ok(triangle.closestPointToPoint(point,new THREE.Vector3()).distanceTo(point)<1e-6,'BVH hit on its reported real face');normal.fromArray(e.normal);assert.ok(Math.abs(normal.length()-1)<1e-6);
   if(e.kind==='rim'&&e.collider==='ground')rimHits++;
  }
  if(e.type==='runoff'){const source=byId.get(e.sourceImpact);assert.equal(source.type,'impact');assert.equal(source.collider,'canopy');assert.equal(source.faceIndex,e.sourceFace);}
  if(e.type==='rim-feed')assert.equal(byId.get(e.parentEvent).type,'runoff');
  if(e.type==='rim-release'){assert.equal(byId.get(e.parentEvent).type,'rim-feed');assert.ok(e.sourceImpacts.every(id=>byId.get(id)?.collider==='canopy'));}
  if(e.type==='ripple'){const parent=byId.get(e.parentEvent);assert.equal(parent.type,'impact');assert.equal(parent.collider,'ground');assert.deepEqual(e.position,parent.position);if(e.kind==='rim'){rimRipples++;assert.equal(parent.kind,'rim');}}
 }
 assert.ok(rimHits>100);assert.equal(rimRipples,rimHits,'Each rim ground impact generates its causal ripple even under pool pressure');return{eventCount:allEvents.length,rimHits,rimRipples};
});
test('real_boundary_drainage',()=>{
 const d=model.drainage,key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,edges=new Set(d.boundaryEdges.map(e=>key(...e)));const used=new Set();let chords=0;const byId=new Map(allEvents.map(e=>[e.eventId,e]));let routeSegments=0;
 for(const v of d.boundary)for(const n of d.neighbors[v])if(d.boundary.has(n)&&!edges.has(key(v,n)))chords++;
 for(const e of allEvents.filter(e=>e.type==='runoff')){assert.ok(edges.has(key(...e.rimEdge)),'Every release interpolation uses an actual count-one boundary edge');const a=d.points[e.rimEdge[0]],b=d.points[e.rimEdge[1]],p=new THREE.Vector3().fromArray(e.rimPosition);assert.ok(new THREE.Line3(a,b).closestPointToPoint(p,true,new THREE.Vector3()).distanceTo(p)<1e-6);used.add(e.rimVertex);
  const impact=byId.get(e.sourceImpact),route=d.route({faceIndex:impact.faceIndex,worldPoint:new THREE.Vector3().fromArray(impact.position),worldNormal:new THREE.Vector3().fromArray(impact.normal)});
  for(let i=1;i<route.vertices.length;i++){assert.ok(d.neighbors[route.vertices[i-1]].has(route.vertices[i]),'Drainage path follows real triangle edges');routeSegments++;}
  for(const fraction of[0,.25,.5,.75,1]){const normal=d.sampleNormal(route,route.length*fraction);assert.ok(Math.abs(normal.length()-1)<1e-6,'Surface bead normal remains unit-length');assert.ok(Number.isFinite(d.sample(route,route.length*fraction).length()),'Surface path sampling remains finite');}
 }
 assert.ok(used.size>32);return{points:d.points.length,boundaryVertices:d.boundary.size,boundaryEdges:edges.size,distinctUsedRimVertices:used.size,interiorBoundaryChords:chords,routeSegmentsVerified:routeSegments};
});
test('pause_reset_and_invalid_step',()=>{
 const clock=new WeatherClock();events=[];model.reset();for(let i=0;i<60;i++)clock.advance(1/60,()=>model.step());clock.running=false;const before=hash(JSON.stringify(activeState()));for(let i=0;i<500;i++)clock.advance(.2,()=>model.step());assert.equal(hash(JSON.stringify(activeState())),before);clock.running=true;clock.advance(1/60,()=>model.step());assert.equal(model.ticks,122);assert.throws(()=>model.step(1/60));
 const resetRun=run(60);assert.equal(resetRun.digest,runs[0].digest);return{pauseTicks:120,resumeTicks:122,resetDigest:resetRun.digest};
});
test('bounded_pools_and_events',()=>{for(const [key,capacity]of[['rain',176],['runoff',112],['drops',192],['rims',64],['ripples',112],['contacts',96]]){assert.equal(model[key].length,capacity);assert.ok(model[key].filter(p=>p.active).length<=capacity);}assert.ok(model.events.length<=2048);assert.ok(model.rims.every(r=>!r.active||(r.sources.length<=8&&r.parents.length<=8)));return model.snapshot().pools;});
test('original_asset_and_baseline_hashes',()=>{assert.equal(hash(bytes),'11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89');return {assetSha256:hash(bytes)};});
test('shadow_coverage',()=>{
 const light=new THREE.DirectionalLight();light.shadow.mapSize.set(2048,2048);const bounds=foregroundBounds(gltf.scene),out=[];
 for(let tick=0;tick<=1440;tick+=6){const progress=tick/1440,state={azimuth:-60+120*progress,elevation:12+6*progress+30*Math.sin(Math.PI*progress)};const d=sunDirection(state),fit=fitSunShadow(light,bounds,d,model.groundY);light.shadow.updateMatrices(light);for(const xyz of fit.points){const projected=new THREE.Vector3().fromArray(xyz).project(light.shadow.camera);assert.ok(Math.max(Math.abs(projected.x),Math.abs(projected.y),Math.abs(projected.z))<1,`Out-of-shadow-frustum point ${projected.toArray()}`);}if(tick%720===0)out.push({...state,width:fit.width,height:fit.height,worldTexelSize:fit.worldTexelSize});}return {sunSamples:241,examples:out};
});
const scene=new THREE.Scene();scene.add(gltf.scene);const renderer=new WaterRenderer({scene,model});
test('curved_droplets_and_wave_normals',()=>{
 assert.ok(renderer.rainMesh.isInstancedMesh);assert.ok(renderer.waterGeometry.attributes.normal.count>20);assert.ok(renderer.rainMesh.material.isMeshPhysicalMaterial);assert.equal(renderer.rainMesh.material.ior,1.333);
 const identity=new THREE.Matrix4();assert.ok(model.ground.matrixWorld.equals(identity),'Object-space ground normal field assumes world-aligned ground mesh');
 model.reset();renderer.updateGround(true);const flat=hash(renderer.normalBytes);for(const p of model.rain)p.nextBirth=Infinity;const r=model.ripples[0];Object.assign(r,{active:true,position:new THREE.Vector3(.5,model.groundY,-.3),birth:0,life:1,radius:.06});for(let i=0;i<24;i++)model.step();renderer.updateGround(true);assert.notEqual(hash(renderer.normalBytes),flat,'Causal ripple changes normal bytes');return {geometry:renderer.waterGeometry.type,vertices:renderer.waterGeometry.attributes.position.count,normalMapType:model.ground.material.normalMapType,normalBytes:renderer.normalBytes.length};
});
test('renderer_reset_without_stale_ripple',()=>{
 const dirty=hash(renderer.normalBytes);model.reset();renderer.sync();assert.notEqual(hash(renderer.normalBytes),dirty,'A reset must clear prior ripple normal map immediately');return{normalTick:renderer.lastNormalTick,modelTick:model.ticks};
});
test('normal_field_cadence_determinism',()=>{
 const variants=[];
 for(const hz of[15,30,60,120]){model.reset();renderer.updateGround(true);for(const p of model.rain)p.nextBirth=Infinity;Object.assign(model.ripples[0],{active:true,position:new THREE.Vector3(.5,model.groundY,-.3),birth:0,life:1,radius:.06});const c=new WeatherClock();for(let f=0;f<hz*32/120;f++){c.advance(1/hz,()=>model.step());renderer.sync();}variants.push({hz,tick:model.ticks,normalTick:renderer.lastNormalTick,normalDigest:hash(renderer.normalBytes)});}
 results.normalCadenceDiagnostic=variants;assert.equal(new Set(variants.map(v=>v.normalDigest)).size,1,'The same simulation tick must yield the same ground normal field across display rates');return variants;
});
renderer.dispose();model.dispose();
test('idempotent_disposal',()=>{renderer.dispose();model.dispose();assert.equal(model.adapter.colliders.size,0);assert.equal(scene.children.includes(renderer.group),false);return true;});
results.failures=failures;results.passed=failures.length===0;
await fs.writeFile(new URL('../results/independent-contracts-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:results.passed,failures},null,2));if(failures.length)process.exitCode=1;
