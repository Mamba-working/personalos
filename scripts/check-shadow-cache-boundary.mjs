import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// Independent reviewed-byte oracles. Updating an active inventory cannot widen
// this alpha.6 scope or rewrite the prior CSS-only world's assertions.
export const SHADOW_CACHE_BOUNDARY = Object.freeze({
  baselineCommit:'652d79050449e907380d21ae940dadaf7bbad9f7',
  baselineInventory:'provenance/candidates/alpha5-world-layers-652d790.json',
  baselineInventorySHA256:'557d11ae0cb2cd268a969887468e629258e6c465736080163a13cc1ced16e3ae',
  baselineSceneSHA256:'07239468840def699c9111bd9e6879df313a48dad5ef791dea4f01a9ac71aad3',
  baselineMetadataSHA256:'7ae100d1d310899b0e69a30f643dc89bcc2444b0b74a8a79d2ae97511bdb6c08',
  sceneSHA256:'823a25d68a0e52d0b20f44ef436a99fbaa202d4dfdb1daf6be941d067187de3a',
  serviceSHA256:'6482c892a62b81322dc96ab8d47aa3d00084517209a61fa5a3c0579c44fdd99d',
  metadataSHA256:'b299a9872645319c16d195a196645f9bf1d92769e7d183d6bd9baa8c3bf9bcaa',
  hunksSHA256:'2d02e63071090f58edadad179022ef091d909ac0e01c476f4dbc18ca67751fd4',
});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(root,relative)=>fs.readFileSync(path.join(root,relative),'utf8');
export function historicalWorldLayers(root) {
  const source=read(root,SHADOW_CACHE_BOUNDARY.baselineInventory);
  assert.equal(sha(source),SHADOW_CACHE_BOUNDARY.baselineInventorySHA256,'Frozen alpha.5 world-layer inventory changed');
  return JSON.parse(source);
}
export function historicalLayerSource(root,relative) {
  const active=JSON.parse(read(root,'provenance/active-candidate.json'));
  if(active.productVersion==='v0.1.0-alpha.5')return read(root,'apps/web/runtime/'+relative);
  assert.equal(active.productVersion,'v0.1.0-alpha.6','Historical layer check requires an explicit version mapping');
  const expected={'world/scene.js':SHADOW_CACHE_BOUNDARY.baselineSceneSHA256,'release-meta.json':SHADOW_CACHE_BOUNDARY.baselineMetadataSHA256};
  if(!Object.hasOwn(expected,relative))return read(root,'apps/web/runtime/'+relative);
  const source=read(root,'provenance/snapshots/alpha5-world-layers/'+relative);
  assert.equal(sha(source),expected[relative],`Frozen historical layer source changed: ${relative}`);
  return source;
}
export function applyReviewedShadowHooks(source,operations) {
  for(const {before,after} of operations) {
    assert(before.length>0,'Empty hook anchor');
    assert.equal(source.split(before).length-1,1,'Reviewed shadow hook anchor must occur exactly once');
    source=source.replace(before,after);
  }
  return source;
}
export function verifyShadowCacheBoundary(root,current) {
  const baseline=historicalWorldLayers(root),pin=SHADOW_CACHE_BOUNDARY;
  const oldScene=historicalLayerSource(root,'world/scene.js');
  historicalLayerSource(root,'release-meta.json');
  const hunksText=read(root,'provenance/alpha6-shadow-cache-hunks.json');
  assert.equal(sha(hunksText),pin.hunksSHA256,'Reviewed shadow-hook operations changed');
  const hunks=JSON.parse(hunksText);
  assert.equal(hunks.baselineSceneSHA256,pin.baselineSceneSHA256);
  assert.equal(hunks.candidateSceneSHA256,pin.sceneSHA256);
  assert.equal(hunks.operations.length,6,'All six reviewed owner-hook hunks are required');
  const actualScene=read(root,'apps/web/runtime/world/scene.js');
  assert.equal(actualScene,applyReviewedShadowHooks(oldScene,hunks.operations),'Scene differs from the exact reviewed shadow-service hooks');
  assert.equal(sha(actualScene),pin.sceneSHA256,'Reviewed scene bytes differ');
  assert.equal(sha(read(root,'apps/web/runtime/world/shadow-cache.js')),pin.serviceSHA256,'Reviewed shadow-cache service differs');
  assert.equal(sha(read(root,'apps/web/runtime/release-meta.json')),pin.metadataSHA256,'Reviewed alpha.6 metadata differs');
  const before=new Map(baseline.files.map(x=>[x.path,x.sha256])),after=new Map(current.map(x=>[x.path,x.sha256]));
  const changed=[...new Set([...before.keys(),...after.keys()])].filter(p=>before.get(p)!==after.get(p)).sort();
  assert.deepEqual(changed,['runtime/release-meta.json','runtime/world/scene.js','runtime/world/shadow-cache.js'],'Alpha.6 runtime scope exceeded');
  return {baseline,changed};
}
