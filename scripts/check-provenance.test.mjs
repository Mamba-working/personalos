import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {historicalAlpha6Root} from './historical-alpha6.mjs';
import {verifyProvenance,verifySourcePayload,runtimeInventory,HISTORICAL_PROVENANCE} from './check-provenance.mjs';
import {historicalWorldLayers,verifyShadowCacheBoundary,SHADOW_CACHE_BOUNDARY} from './check-shadow-cache-boundary.mjs';
// Historical assertions below stay unchanged and execute on pinned alpha.6 inputs.
const root=historicalAlpha6Root(path.resolve(new URL('../',import.meta.url).pathname)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Deliberate duplicate oracle: do not derive historical expectations from the active candidate.
const pinned={
 'export-policy.json':'0f782049e914df98374f5d06d800e2af54e745002647fd0d90544a07e0e460f5',
 'import-verification.json':'3699baac108d2feaa992e06db0b2e2c6f1d52869ccaacf9815cb92187d94012a',
 'releases.json':'d815c0e81e1549e3f83eaaed8f0d54e5079f4fc280b9fc281c07b1639a1abcd7',
 'runtime-files.json':'a74283e78182bff5fdb16fcb99b6894712c3d2c8840ece76b16429d10de8a7cc',
 'source-allowlist.json':'c1b20944189a33f5368e254d3bce474118318605d442c52eccb82b546e7de408',
 'tooling-verification.json':'c7c898a24a93f57094dd2d0f41c6b13dade9a97b88b53c8e9fb56afc5178d764',
 'vendor-dependencies.json':'0fbe77a79547705a4b50de50505ae86ae305b8341fe2713d8d617a95e8502c83',
};
const get=(dir,rel)=>JSON.parse(fs.readFileSync(path.join(dir,rel),'utf8'));
const edit=(dir,rel,fn)=>{const value=get(dir,rel);fn(value);fs.writeFileSync(path.join(dir,rel),JSON.stringify(value,null,2)+'\n');};
function resign(dir){const files=runtimeInventory(dir);edit(dir,'provenance/active-candidate.json',c=>{c.files=files;c.runtimeSHA256=sha(JSON.stringify(files));});}
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'personalos-alpha6-provenance-'));try{for(const rel of ['provenance','apps/web/runtime','package.json','package-lock.json','apps/web/package.json','apps/api/package.json','packages/contracts/package.json','packages/contracts/index.mjs']){const dest=path.join(dir,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,rel),dest,{recursive:true});}return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('active alpha.6 inventory and immutable historical records verify independently',()=>{assert.deepEqual(HISTORICAL_PROVENANCE,pinned);for(const [name,hash]of Object.entries(pinned))assert.equal(sha(fs.readFileSync(path.join(root,'provenance',name))),hash,name);const result=verifyProvenance(root);assert.equal(result.productVersion,'v0.1.0-alpha.6');assert.equal(result.runtimeFiles,70);});
for(const mutation of ['changed','missing','additional','symlink'])test(`runtime ${mutation} is rejected`,()=>fixture(dir=>{const file=path.join(dir,'apps/web/runtime/app.js');if(mutation==='changed')fs.appendFileSync(file,'\n// mutation');if(mutation==='missing')fs.unlinkSync(file);if(mutation==='additional')fs.writeFileSync(path.join(dir,'apps/web/runtime/extra.js'),'');if(mutation==='symlink'){fs.unlinkSync(file);fs.symlinkSync('host.js',file);}assert.throws(()=>verifyProvenance(dir));}));
for(const mutation of ['digest','missing-entry','duplicate-entry','order','missing-manifest','fake-source'])test(`candidate ${mutation} is rejected`,()=>fixture(dir=>{const rel='provenance/active-candidate.json';if(mutation==='missing-manifest')fs.unlinkSync(path.join(dir,rel));else edit(dir,rel,c=>{if(mutation==='digest')c.runtimeSHA256='0'.repeat(64);if(mutation==='missing-entry')c.files.pop();if(mutation==='duplicate-entry')c.files.push(c.files[0]);if(mutation==='order')c.files.reverse();if(mutation==='fake-source')c.sourcePayloadCommit='not-a-commit';});assert.throws(()=>verifyProvenance(dir));}));
for(const name of Object.keys(pinned))test(`historical ${name} cannot be rewritten together with candidate-side expected hash`,()=>fixture(dir=>{const rel='provenance/'+name;fs.appendFileSync(path.join(dir,rel),'\n');edit(dir,'provenance/active-candidate.json',c=>{c.historicalProvenance[name]=sha(fs.readFileSync(path.join(dir,rel)));});assert.throws(()=>verifyProvenance(dir),/Historical provenance changed/);}));
for(const surface of ['root','web','lock','lock-root','lock-web','contract','metadata'])test(`product version drift at ${surface} is rejected`,()=>fixture(dir=>{const old='0.1.0-alpha.4';if(surface==='root')edit(dir,'package.json',x=>x.version=old);if(surface==='web')edit(dir,'apps/web/package.json',x=>x.version=old);if(surface==='lock')edit(dir,'package-lock.json',x=>x.version=old);if(surface==='lock-root')edit(dir,'package-lock.json',x=>x.packages[''].version=old);if(surface==='lock-web')edit(dir,'package-lock.json',x=>x.packages['apps/web'].version=old);if(surface==='contract'){const p=path.join(dir,'packages/contracts/index.mjs');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('0.1.0-alpha.6',old));}if(surface==='metadata')edit(dir,'apps/web/runtime/release-meta.json',x=>x.productVersion='v'+old);if(surface==='metadata')resign(dir);assert.throws(()=>verifyProvenance(dir));}));
for(const mutation of ['acceptance','gate','public-commit','public-tag','deployed','source-label'])test(`unearned release claim ${mutation} is rejected`,()=>fixture(dir=>{if(['acceptance','gate'].includes(mutation))edit(dir,'apps/web/runtime/release-meta.json',m=>{if(mutation==='acceptance')m.fullUnifiedAcceptance=true;else m.deferredGates=[];});else edit(dir,'provenance/active-candidate.json',c=>{if(mutation==='public-commit')c.publicGitCommit='1'.repeat(40);if(mutation==='public-tag')c.publicGitTag='v0.1.0-alpha.5';if(mutation==='deployed')c.deployed=true;if(mutation==='source-label')c.inputs.publicAlpha4Commit=c.inputs.localSnapshotCommit;});if(['acceptance','gate'].includes(mutation))resign(dir);assert.throws(()=>verifyProvenance(dir));}));
test('mapped source payload agrees with final runtime and version files when history is available',t=>{const c=get(root,'provenance/active-candidate.json');const exists=spawnSync('git',['cat-file','-e',c.sourcePayloadCommit+'^{commit}'],{cwd:root});if(exists.status!==0){t.skip('Source object is unavailable in this shallow checkout; portable inventory remains enforced');return;}assert(verifySourcePayload(root).verifiedTrackedFiles>=69);});

test('reading revision retains the exact frozen initial-alpha.5 inventory and observed-failure identity',()=>{const active=historicalWorldLayers(root);assert.equal(active.revision,'world-layers-r3');assert.equal(active.initialCandidate.commit,'0fc929ff0b602ac3b2769804ef7a447c61d30afa');assert.equal(sha(fs.readFileSync(path.join(root,'provenance/candidates/alpha5-0fc929f.json'))),'945d3617cd25ac364f1d51b20f9916b4de07479ea007785a10b0d4b80f4c6ff3');});
test('rewritten initial-alpha.5 inventory is rejected even though original alpha.4 records remain intact',()=>fixture(dir=>{fs.appendFileSync(path.join(dir,'provenance/candidates/alpha5-0fc929f.json'),'\n');assert.throws(()=>verifyProvenance(dir),/Initial alpha.5 inventory changed/);}));

test('frozen b917 reading inventory and unresolved pixel identity remain immutable',()=>{const active=historicalWorldLayers(root);assert.equal(active.readingShelfCandidate.commit,'b917dda0cb003824de6a5eb73b360fcffd72f4e3');assert.equal(sha(fs.readFileSync(path.join(root,'provenance/candidates/alpha5-reading-b917dda.json'))),'77cd914657ebbbc111619205dd68c0281b805bb0979a2e8a809e731673d9b96e');});
test('rewritten b917 reading inventory is rejected',()=>fixture(dir=>{fs.appendFileSync(path.join(dir,'provenance/candidates/alpha5-reading-b917dda.json'),'\n');assert.throws(()=>verifyProvenance(dir),/Reading r1 inventory changed/);}));

test('world layer revision preserves the frozen controls source inventory',()=>{const active=historicalWorldLayers(root);assert.equal(active.previousCandidate.commit,'984814b3c465d0400356d1e9ba6b0e1bd2a244b2');assert.equal(sha(fs.readFileSync(path.join(root,'provenance/candidates/alpha5-controls-984814b.json'))),'f39847f261c7d86ad5a6b2bff476fea6c1240350fb96eefa54218cce1ccb5253');});
test('rewritten controls source inventory is rejected',()=>fixture(dir=>{fs.appendFileSync(path.join(dir,'provenance/candidates/alpha5-controls-984814b.json'),'\n');assert.throws(()=>verifyProvenance(dir),/Reading r2 inventory changed/);}));

test('alpha.6 retains the published 652 lineage and exact reviewed runtime allowlist',()=>{
 const active=get(root,'provenance/active-candidate.json');
 assert.equal(active.revision,'static-shadow-cache-r1');
 assert.equal(active.previousCandidate.commit,'652d79050449e907380d21ae940dadaf7bbad9f7');
 assert.equal(sha(fs.readFileSync(path.join(root,'provenance/candidates/alpha5-world-layers-652d790.json'))),'557d11ae0cb2cd268a969887468e629258e6c465736080163a13cc1ced16e3ae');
 assert.deepEqual(verifyShadowCacheBoundary(root,runtimeInventory(root)).changed,['runtime/release-meta.json','runtime/world/scene.js','runtime/world/shadow-cache.js']);
 assert.equal(SHADOW_CACHE_BOUNDARY.serviceSHA256,'6482c892a62b81322dc96ab8d47aa3d00084517209a61fa5a3c0579c44fdd99d');
});
for(const mutation of ['scene-extra','scene-hook-missing','service-extra','unrelated-runtime','additional-runtime','hunks','historical-scene','historical-metadata','historical-manifest','allowlist'])test(`alpha.6 ${mutation} remains rejected after candidate inventory is re-signed`,()=>fixture(dir=>{
 const append=p=>fs.appendFileSync(path.join(dir,p),'\n// unauthorized mutation');
 if(mutation==='scene-extra')append('apps/web/runtime/world/scene.js');
 if(mutation==='scene-hook-missing'){const p=path.join(dir,'apps/web/runtime/world/scene.js');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(' shadowCache.prepare();',''));}
 if(mutation==='service-extra')append('apps/web/runtime/world/shadow-cache.js');
 if(mutation==='unrelated-runtime')append('apps/web/runtime/modules/weather.js');
 if(mutation==='additional-runtime')fs.writeFileSync(path.join(dir,'apps/web/runtime/other.js'),'');
 if(mutation==='hunks')edit(dir,'provenance/alpha6-shadow-cache-hunks.json',x=>x.operations.pop());
 if(mutation==='historical-scene')append('provenance/snapshots/alpha5-world-layers/world/scene.js');
 if(mutation==='historical-metadata')edit(dir,'provenance/snapshots/alpha5-world-layers/release-meta.json',x=>x.productVersion='v0.1.0-alpha.6');
 if(mutation==='historical-manifest')edit(dir,'provenance/candidates/alpha5-world-layers-652d790.json',x=>x.files.pop());
 if(mutation==='allowlist')edit(dir,'provenance/active-candidate.json',x=>x.runtimeOnlyAllowlist.push('runtime/modules/weather.js'));
 resign(dir);edit(dir,'provenance/active-candidate.json',x=>x.runtimeFileCount=runtimeInventory(dir).length);
 assert.throws(()=>verifyProvenance(dir));
}));
test('the versioned historical CSS-only oracle still asserts old scene and metadata hashes',()=>{
 for(const [p,hash] of Object.entries({'world/scene.js':'07239468840def699c9111bd9e6879df313a48dad5ef791dea4f01a9ac71aad3','release-meta.json':'7ae100d1d310899b0e69a30f643dc89bcc2444b0b74a8a79d2ae97511bdb6c08'}))assert.equal(sha(fs.readFileSync(path.join(root,'provenance/snapshots/alpha5-world-layers',p))),hash);
 const before=fs.readFileSync(path.join(root,'provenance/snapshots/alpha5-world-layers/world/scene.js'),'utf8');
 assert.doesNotMatch(before,/createShadowCache|shadowCache\.prepare/);
 assert.match(fs.readFileSync(path.join(root,'apps/web/runtime/world/scene.js'),'utf8'),/shadowCache\.prepare\(\)/);
});
