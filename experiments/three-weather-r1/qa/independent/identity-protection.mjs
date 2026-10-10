import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from '../../public/vendor/three/addons/loaders/GLTFLoader.js';
const root=new URL('../../',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(await fs.readFile(new URL('SOURCE-FROZEN-SHA256.json',root),'utf8'));
assert.equal(frozen.files.length,22,'All original source anchors remain present');
const identityProjection=frozen.files.map(({relative,bytes,sha256})=>({relative,bytes,sha256}));
assert.equal(sha(JSON.stringify(identityProjection)),'8f464693b2621726f7cd7fce59fe869367ccd1e7e428d5e0ae7e572dd0833ad9','Original identity assertions must not change');
for(const f of frozen.files){
 assert.ok(!f.source.startsWith('/')&&!f.source.split('/').includes('..'),'Portable source path');
 const sourceBytes=await fs.readFile(new URL(f.source,root));
 assert.equal(sourceBytes.length,f.bytes,`Frozen source length changed: ${f.relative}`);
 assert.equal(sha(sourceBytes),f.sha256,`Frozen source changed: ${f.relative}`);
}
const bytes=await fs.readFile(new URL('public/assets/foreground.glb',root));assert.equal(sha(bytes),'11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.updateMatrixWorld(true);
let camera,ball,canopy,shaft,meshCount=0,triangleCount=0;const eyes=[];
gltf.scene.traverse(o=>{if(o.isCamera)camera=o;if(!o.isMesh)return;meshCount++;triangleCount+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;if(o.userData.slice_role==='ball')ball=o;if(o.userData.slice_role==='canopy')canopy=o;if(o.userData.slice_role==='eye')eyes.push(o);if(o.name.includes('straight_coaxial'))shaft=o;});
assert.equal(meshCount,35);assert.equal(triangleCount,101726);assert.equal(eyes.length,2);assert.ok(shaft);
const project=o=>{const ndc=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);return[450+450*ndc.x,300-300*ndc.y];};
const bp=project(ball),cp=project(canopy),sp=project(shaft),manifest=JSON.parse(await fs.readFile(new URL('public/assets/export-manifest.json',root),'utf8'));
assert.ok(bp.every((v,i)=>Math.abs(v-manifest.sourceProjectionAnchors.ballCenterPixel[i])<.005));assert.ok(cp[0]>bp[0],'Umbrella stays screen right of ball');assert.ok(sp[0]>bp[0],'Approved original straight shaft stays screen right');
const report={passed:true,scope:'Original GLB byte identity preserves all mesh/camera geometry; CPU source-camera projection anchors only, not a rendered screenshot',frozenSourceSnapshotFilesChecked:frozen.files.length,privateOriginalLocationsRechecked:false,assetSha256:sha(bytes),meshCount,triangleCount,eyes:eyes.length,originalStraightShaft:shaft.name,ballCenterPixel:bp,canopyCenterPixel:cp,shaftCenterPixel:sp,camera:{fov:camera.fov,aspect:camera.aspect}};
await fs.writeFile(new URL('../results/identity-protection-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
