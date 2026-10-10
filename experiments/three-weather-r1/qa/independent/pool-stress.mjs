import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {GLTFLoader} from '../../public/vendor/three/addons/loaders/GLTFLoader.js';
import {WeatherModel} from '../../public/weather-model.js';
const bytes=await fs.readFile(new URL('../../public/assets/foreground.glb',import.meta.url));
const results=[];
for(const config of[{seed:0,rainCapacity:1,seconds:12},{seed:4294967295,rainCapacity:256,seconds:12},{seed:20261010,rainCapacity:256,seconds:60}]){
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.updateMatrixWorld(true);
 const m=new WeatherModel({...config,colliderRoot:gltf.scene});const capacities=Object.fromEntries(['rain','runoff','drops','rims','ripples','contacts'].map(k=>[k,m[k].length]));const peaks=Object.fromEntries(Object.keys(capacities).map(k=>[k,0]));
 for(let tick=0;tick<config.seconds*120;tick++){m.step();for(const key of Object.keys(capacities)){assert.equal(m[key].length,capacities[key]);const active=m[key].filter(p=>p.active);peaks[key]=Math.max(peaks[key],active.length);for(const p of active)if(p.position)assert.ok(Number.isFinite(p.position.x+p.position.y+p.position.z),'No non-finite active position');}assert.ok(m.events.length<=2048);assert.ok(m.rims.every(r=>!r.active||r.sources.length<=8));}
 const before=JSON.stringify(m.snapshot());m.enabled=false;const pausedTicks=m.ticks;m.step();assert.equal(m.ticks,pausedTicks);m.enabled=true;assert.equal(JSON.stringify(m.snapshot()),before);
 results.push({...config,capacities,peaks,counts:{...m.counts},overflow:{...m.overflow},eventBufferLength:m.events.length,bvhBuilds:m.adapter.stats.bvhBuilds});m.dispose();assert.equal(m.adapter.colliders.size,0);
}
const report={passed:true,scope:'CPU simulated fixed pool capacities and finite positions over60s plus uint32 seed/capacity extremes. No process-memory leak benchmark, WebGL or GPU performance inference.',results};await fs.writeFile(new URL('../results/pool-stress-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
