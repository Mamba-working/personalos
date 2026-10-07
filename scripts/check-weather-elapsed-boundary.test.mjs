import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyProvenance,verifySourcePayload,runtimeInventory} from './check-provenance.mjs';
import {WEATHER_ELAPSED_BOUNDARY,verifyWeatherElapsedBoundary,applyWeatherElapsedHunks} from './check-weather-elapsed-boundary.mjs';
import {ALPHA6_HISTORY,alpha6Inventory,alpha6Source,historicalAlpha6Root} from './historical-alpha6.mjs';
import {publicSourcePaths,verifySourceScope} from './check-source-scope.mjs';
const root=path.resolve(new URL('../',import.meta.url).pathname),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(dir,p)=>fs.readFileSync(path.join(dir,p),'utf8'),json=(dir,p)=>JSON.parse(read(dir,p));
const edit=(dir,p,fn)=>{const v=json(dir,p);fn(v);fs.writeFileSync(path.join(dir,p),JSON.stringify(v,null,2)+'\n');};
function resign(dir){const files=runtimeInventory(dir);edit(dir,'provenance/active-candidate.json',a=>{a.files=files;a.runtimeFileCount=files.length;a.runtimeSHA256=sha(JSON.stringify(files));});}
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'personalos-alpha7-negative-'));try{
 for(const p of publicSourcePaths(root)){fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.copyFileSync(path.join(root,p),path.join(dir,p));}
 for(const name of ['three.core.js','three.module.js'])fs.copyFileSync(path.join(root,'apps/web/runtime/world/vendor/three',name),path.join(dir,'apps/web/runtime/world/vendor/three',name));
 return fn(dir);
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('alpha.7 exact implementation and metadata boundary verifies with all 70 runtime files',()=>{
 const proof=verifyProvenance(root);assert.equal(proof.productVersion,'v0.1.0-alpha.7');assert.equal(proof.runtimeFiles,70);assert.deepEqual(verifyWeatherElapsedBoundary(root,runtimeInventory(root)).changed,['runtime/modules/weather.js','runtime/release-meta.json','runtime/world/scene.js']);
 assert.equal(WEATHER_ELAPSED_BOUNDARY.weatherSHA256,'44a2de63f5e6fb1f64341005d433881837eb9fa3b10d005602df8c1bd2830c1b');assert.equal(WEATHER_ELAPSED_BOUNDARY.sceneSHA256,'3337839ee4f75808c9b2e626be6809fd24a13261a89e0522db93423ae1e75fae');
});
test('new payload is a real local Git object matching every final runtime/version path, not an inherited or invented commit',t=>{
 const a=json(root,'provenance/active-candidate.json');verifyProvenance(root);if(spawnSync('git',['cat-file','-e',a.sourcePayloadCommit],{cwd:root}).status!==0){t.skip('Local payload object unavailable in this source-only or shallow checkout; portable exact-delta gates remain mandatory');return;}assert.notEqual(a.sourcePayloadCommit,alpha6Inventory(root).sourcePayloadCommit);assert.notEqual(a.sourcePayloadCommit,ALPHA6_HISTORY.commit);assert.equal(verifySourcePayload(root).verifiedTrackedFiles,72);assert.equal(a.publicGitCommit,null);assert.equal(a.publicGitTag,null);assert.equal(a.deployed,false);
});
test('complete historical alpha.6 target is reconstructed exactly and still verifies its original payload object',t=>{
 assert.equal(ALPHA6_HISTORY.inventorySHA256,'ccfe9580a6a9d375f79ea8bf0d628ef05f5a29a16a696ab5702d3bcb0a828549');const prior=historicalAlpha6Root(root),proof=verifyProvenance(prior);assert.equal(proof.runtimeSHA256,'788f43e664fa3d3ec97b4aaa51cf8a725e7ca8377ec963ddde313e1ae5bbf18e');assert.equal(proof.productVersion,'v0.1.0-alpha.6');if(spawnSync('git',['cat-file','-e',proof.sourcePayloadCommit],{cwd:prior}).status!==0){t.skip('Historical local payload object unavailable; complete pinned alpha.6 inventory already verified');return;}assert.equal(verifySourcePayload(prior).verifiedTrackedFiles,72);
});
test('actual alpha.7 effect call follows native face writing and precedes shadow preparation/render',()=>{
 const source=read(root,'apps/web/runtime/world/scene.js'),pose=source.indexOf('nativeEyeOpen=p.open*blink'),effect=source.indexOf('for(const effect of effects.values())effect.update(Math.min(.05,dt),effectState(),{elapsed:dt,stamp})'),shadow=source.indexOf(' shadowCache.prepare();'),render=source.indexOf('renderer.render(scene,camera);');assert(pose>=0&&effect>pose&&shadow>effect&&render>shadow);
});
test('the 19 elapsed tests participate in the normal web aggregate, with no historical suite removed',()=>{
 const runner=read(root,'apps/web/tests/integration/run.mjs');for(const name of ['menu-port','weather-port','weather-v5','weather-elapsed'])assert(runner.includes("path.resolve(here,'../"+name+"')"));assert(runner.includes('test-concurrency=4'));assert(runner.includes('timeout:60000'));
});
test('exact hunk application rejects missing/ambiguous anchors rather than applying approximate patches',()=>{
 assert.throws(()=>applyWeatherElapsedHunks('none',[{before:'anchor',after:'new'}]),/exactly once/);assert.throws(()=>applyWeatherElapsedHunks('anchor anchor',[{before:'anchor',after:'new'}]),/exactly once/);assert.throws(()=>applyWeatherElapsedHunks('one',[{before:'',after:'new'}]),/Empty/);
});
for(const mutation of ['weather-extra','scene-extra','scene-missing-hook','service-extra','other-runtime','missing-runtime','additional-runtime','runtime-symlink','hunk-before','hunk-after','hunk-count','baseline-inventory','baseline-weather','baseline-scene','baseline-metadata','baseline-version','broadened-allowlist','reordered-allowlist','metadata-acceptance','metadata-gates','previous-commit','previous-inventory','historical-input-label','public-commit','public-tag','deployed','fake-source','inherited-source','extra-public-file','source-list','public-symlink'])test(`alpha.7 ${mutation} remains rejected even after current inventory/count/digest re-signing`,()=>fixture(dir=>{
 const append=p=>fs.appendFileSync(path.join(dir,p),'\n// unauthorized change');
 const rewrite=(p,a,b)=>fs.writeFileSync(path.join(dir,p),read(dir,p).replace(a,b));
 if(mutation==='weather-extra')append('apps/web/runtime/modules/weather.js');
 if(mutation==='scene-extra')append('apps/web/runtime/world/scene.js');
 if(mutation==='scene-missing-hook')rewrite('apps/web/runtime/world/scene.js','{elapsed:dt,stamp}','{elapsed:0,stamp}');
 if(mutation==='service-extra')append('apps/web/runtime/world/shadow-cache.js');
 if(mutation==='other-runtime')append('apps/web/runtime/host.js');
 if(mutation==='missing-runtime')fs.unlinkSync(path.join(dir,'apps/web/runtime/modules/weather.js'));
 if(mutation==='additional-runtime')fs.writeFileSync(path.join(dir,'apps/web/runtime/extra.js'),'');
 if(mutation==='runtime-symlink'){const p=path.join(dir,'apps/web/runtime/modules/weather.js');fs.unlinkSync(p);fs.symlinkSync('../host.js',p);assert.throws(()=>verifyProvenance(dir));return;}
 if(mutation.startsWith('hunk-'))edit(dir,'provenance/alpha7-weather-elapsed-hunks.json',j=>{if(mutation==='hunk-before')j.files[0].operations[0].before+=' ';if(mutation==='hunk-after')j.files[0].operations[0].after+=' ';if(mutation==='hunk-count')j.files[0].operations.pop();});
 if(mutation==='baseline-inventory')edit(dir,ALPHA6_HISTORY.inventory,a=>a.files.pop());
 if(mutation==='baseline-weather')append(ALPHA6_HISTORY.snapshot+'/apps/web/runtime/modules/weather.js');
 if(mutation==='baseline-scene')append(ALPHA6_HISTORY.snapshot+'/apps/web/runtime/world/scene.js');
 if(mutation==='baseline-metadata')append(ALPHA6_HISTORY.snapshot+'/apps/web/runtime/release-meta.json');
 if(mutation==='baseline-version')append(ALPHA6_HISTORY.snapshot+'/package.json');
 if(mutation==='metadata-acceptance')edit(dir,'apps/web/runtime/release-meta.json',j=>j.fullUnifiedAcceptance=true);
 if(mutation==='metadata-gates')edit(dir,'apps/web/runtime/release-meta.json',j=>j.deferredGates=[]);
 if(mutation==='extra-public-file')fs.writeFileSync(path.join(dir,'extra-note.txt'),'unreviewed');
 if(mutation==='source-list')edit(dir,'provenance/alpha7-source-files.json',j=>j.pop());
 if(mutation==='public-symlink')fs.symlinkSync('README.md',path.join(dir,'unreviewed-link'));
 edit(dir,'provenance/active-candidate.json',a=>{
  if(mutation==='broadened-allowlist')a.runtimeOnlyAllowlist.push('runtime/host.js');if(mutation==='reordered-allowlist')a.runtimeOnlyAllowlist.reverse();if(mutation==='previous-commit')a.previousCandidate.commit='1'.repeat(40);if(mutation==='previous-inventory')a.previousCandidate.inventory='provenance/candidates/alpha5-world-layers-652d790.json';if(mutation==='historical-input-label')a.inputs.clockCommit='1'.repeat(40);if(mutation==='public-commit')a.publicGitCommit='1'.repeat(40);if(mutation==='public-tag')a.publicGitTag='v0.1.0-alpha.7';if(mutation==='deployed')a.deployed=true;if(mutation==='fake-source')a.sourcePayloadCommit='not-a-commit';if(mutation==='inherited-source')a.sourcePayloadCommit='4d625229daf76418bf03555d45173d114626db8d';
 });
 resign(dir);assert.throws(()=>verifyProvenance(dir));
}));
for(const rel of ['package.json','apps/web/package.json','package-lock.json','packages/contracts/index.mjs'])test(`alpha.7 version drift at ${rel} is rejected`,()=>fixture(dir=>{fs.writeFileSync(path.join(dir,rel),read(dir,rel).replaceAll('0.1.0-alpha.7','0.1.0-alpha.6'));assert.throws(()=>verifyProvenance(dir));}));
test('cached historical roots do not conceal later snapshot corruption',()=>fixture(dir=>{historicalAlpha6Root(dir);fs.appendFileSync(path.join(dir,ALPHA6_HISTORY.snapshot,'apps/web/runtime/world/scene.js'),'\n');assert.throws(()=>historicalAlpha6Root(dir),/Frozen alpha.6 snapshot changed/);}));
test('unchanged historical live-source fallbacks are independently pinned',()=>fixture(dir=>{assert(alpha6Source(dir,'apps/web/runtime/host.js').length>0);fs.appendFileSync(path.join(dir,'apps/web/runtime/host.js'),'\n');assert.throws(()=>alpha6Source(dir,'apps/web/runtime/host.js'),/Unchanged historical source drifted/);}));
test('public source scope is an exact path allowlist, separate from credential heuristics',()=>{const paths=verifySourceScope(root);assert(paths.includes('scripts/check-weather-elapsed-boundary.test.mjs'));assert(paths.includes('apps/web/tests/weather-elapsed/elapsed.test.mjs'));assert(!paths.some(p=>p.includes('/qa/')||p.endsWith('.png')||p.endsWith('browser-report.json')));});

for(const historical of ['provenance/alpha6-shadow-cache-hunks.json','provenance/snapshots/alpha5-world-layers/world/scene.js','provenance/candidates/alpha5-controls-984814b.json'])test(`repeated verification cannot hide changed older input ${historical}`,()=>fixture(dir=>{
 verifyProvenance(dir);fs.appendFileSync(path.join(dir,historical),'\n');assert.throws(()=>verifyProvenance(dir));
}));
for(const mutation of ['missing-path','extra-path','changed-blob','tree-object'])test(`real local payload ${mutation} is rejected against the complete current runtime path set`,()=>fixture(dir=>{
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const file=path.join(dir,'apps/web/runtime/app.js'),original=fs.readFileSync(file),extra=path.join(dir,'apps/web/runtime/unapproved.js');
 if(mutation==='missing-path')fs.unlinkSync(file);if(mutation==='extra-path')fs.writeFileSync(extra,'export const unapproved=true;');if(mutation==='changed-blob')fs.appendFileSync(file,'\n// changed payload');
 git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@localhost');git('add','.');git('commit','-q','-m','Negative payload fixture');const commit=git('rev-parse',mutation==='tree-object'?'HEAD^{tree}':'HEAD');
 fs.writeFileSync(file,original);if(mutation==='extra-path')fs.unlinkSync(extra);edit(dir,'provenance/active-candidate.json',a=>a.sourcePayloadCommit=commit);
 assert.throws(()=>verifySourcePayload(dir),mutation==='tree-object'?/must reference a commit object/:mutation==='changed-blob'?/Mapped payload differs/:/runtime path set differs/);
}));
