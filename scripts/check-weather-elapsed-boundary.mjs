import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {ALPHA6_HISTORY,alpha6Inventory,alpha6Source,historicalAlpha6Root} from './historical-alpha6.mjs';
import {verifySourceScope} from './check-source-scope.mjs';
export const WEATHER_ELAPSED_BOUNDARY=Object.freeze({
 baseCommit:'b4fe3cc3b1e663bec4930a20bf7b7cdb5bc59326',
 hunks:'provenance/alpha7-weather-elapsed-hunks.json',
 hunksSHA256:'3f3903e0faecf6af9b64034669b182dcc97fe5d90075e561ba81d24b6bda6196',
 weatherSHA256:'44a2de63f5e6fb1f64341005d433881837eb9fa3b10d005602df8c1bd2830c1b',
 sceneSHA256:'3337839ee4f75808c9b2e626be6809fd24a13261a89e0522db93423ae1e75fae',
 metadataSHA256:'14020223418e5f510fcbe697eaca77afd0020ea05eb83228b5b350fa03e6ff34',
 serviceSHA256:'6482c892a62b81322dc96ab8d47aa3d00084517209a61fa5a3c0579c44fdd99d',
 changed:Object.freeze(['runtime/modules/weather.js','runtime/release-meta.json','runtime/world/scene.js'])
});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
const json=(root,p)=>JSON.parse(read(root,p));
export function applyWeatherElapsedHunks(source,operations){
 for(const {before,after}of operations){assert(before.length>0,'Empty elapsed hook anchor');assert.equal(source.split(before).length-1,1,'Elapsed hook anchor must occur exactly once');source=source.replace(before,after);}return source;
}
export function verifyWeatherElapsedBoundary(root,current){
 const pin=WEATHER_ELAPSED_BOUNDARY,baseline=alpha6Inventory(root),text=read(root,pin.hunks);assert.equal(sha(text),pin.hunksSHA256,'Reviewed elapsed hunks changed');
 const hunks=JSON.parse(text);assert.equal(hunks.baseCommit,pin.baseCommit);assert.deepEqual(hunks.files.map(x=>x.path),['runtime/modules/weather.js','runtime/world/scene.js']);
 const expected={'runtime/modules/weather.js':pin.weatherSHA256,'runtime/world/scene.js':pin.sceneSHA256};
 for(const item of hunks.files){const old=alpha6Source(root,'apps/web/'+item.path),actual=read(root,'apps/web/'+item.path);assert.equal(sha(old),item.beforeSHA256);assert.equal(item.afterSHA256,expected[item.path]);assert.equal(item.operations.length,item.path.endsWith('weather.js')?8:1);assert.equal(actual,applyWeatherElapsedHunks(old,item.operations),'Runtime differs from exact elapsed-only hunks: '+item.path);assert.equal(sha(actual),expected[item.path]);}
 assert.equal(sha(read(root,'apps/web/runtime/release-meta.json')),pin.metadataSHA256,'Reviewed alpha.7 disclosure differs');
 assert.equal(sha(read(root,'apps/web/runtime/world/shadow-cache.js')),pin.serviceSHA256,'Shadow-cache owner changed');
 const before=new Map(baseline.files.map(x=>[x.path,x.sha256])),after=new Map(current.map(x=>[x.path,x.sha256]));
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(p=>before.get(p)!==after.get(p)).sort();assert.deepEqual(changed,pin.changed,'Temporal-only runtime scope exceeded');
 return{baseline,changed};
}
export function verifyAlpha7Provenance(root,{current,verifyHistorical,historicalProvenance,requiredDeferred}){
 const active=json(root,'provenance/active-candidate.json');
 verifySourceScope(root);
 // The complete alpha.6 verifier still executes against pinned inputs; no old
 // exact assertion is weakened merely because a new active version exists.
 const historical=verifyHistorical(historicalAlpha6Root(root));assert.equal(historical.productVersion,'v0.1.0-alpha.6');
 const {baseline,changed}=verifyWeatherElapsedBoundary(root,current);
 assert.equal(active.schemaVersion,1);assert.equal(active.kind,'local-composite-candidate');assert.equal(active.status,'unpublished-acceptance-pending');assert.equal(active.productVersion,'v0.1.0-alpha.7');assert.equal(active.revision,'visible-weather-elapsed-r1');
 assert.equal(active.publicGitCommit,null);assert.equal(active.publicGitTag,null);assert.equal(active.deployed,false);assert.match(active.sourcePayloadCommit,/^[a-f0-9]{40}$/);assert.notEqual(active.sourcePayloadCommit,'0'.repeat(40));assert.notEqual(active.sourcePayloadCommit,baseline.sourcePayloadCommit,'Alpha.7 must map its own payload');
 assert.deepEqual(active.previousCandidate,{commit:ALPHA6_HISTORY.commit,runtimeSHA256:baseline.runtimeSHA256,inventory:ALPHA6_HISTORY.inventory});assert.deepEqual(active.runtimeOnlyAllowlist,changed);
 assert.deepEqual(active.historicalProvenance,historicalProvenance);assert.equal(active.algorithm,baseline.algorithm);assert.deepEqual(active.files,current);assert.equal(active.runtimeSHA256,sha(JSON.stringify(current)));assert.equal(active.runtimeFileCount,current.length);assert.equal(current.length,70);
 const version='0.1.0-alpha.7',pkg=json(root,'package.json'),web=json(root,'apps/web/package.json'),lock=json(root,'package-lock.json'),meta=json(root,'apps/web/runtime/release-meta.json');
 for(const [name,value]of Object.entries({root:pkg.version,web:web.version,lock:lock.version,lockRoot:lock.packages[''].version,lockWeb:lock.packages['apps/web'].version}))assert.equal(value,version,'Version mismatch: '+name);
 assert.equal(read(root,'packages/contracts/index.mjs').match(/export const PRODUCT_VERSION = '([^']+)'/)?.[1],version);
 assert.equal(meta.productVersion,active.productVersion);assert.equal(meta.channel,'alpha');assert.equal(meta.fullUnifiedAcceptance,false);assert(meta.reviewLabel.includes('Local alpha.7 candidate'));
 for(const gate of requiredDeferred)assert(meta.deferredGates.includes(gate),'Deferred gate removed: '+gate);
 for(const rel of ['apps/api/package.json','packages/contracts/package.json'])assert.equal(json(root,rel).version,'0.0.1');
 for(const [key,value]of Object.entries(baseline.inputs))assert.equal(active.inputs[key],value,'Historical input relabeled: '+key);
 assert.equal(active.inputs.weatherElapsed,'Exact alpha.6-to-alpha.7 elapsed-only hunks; same art and renderer-owned shadow cache');
 return{kind:active.kind,productVersion:active.productVersion,sourcePayloadCommit:active.sourcePayloadCommit,runtimeFiles:current.length,runtimeSHA256:active.runtimeSHA256};
}
