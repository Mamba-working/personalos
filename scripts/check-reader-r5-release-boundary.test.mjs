import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startApi} from '../apps/api/src/server.mjs';
import {startStatic} from '../apps/web/dev-server.mjs';
import {READER_R5_RELEASE, verifyReaderR5Boundary, verifyReaderR5Identity} from './check-reader-r5-release-boundary.mjs';
import {ALPHA9_HISTORY, alpha9SourceManifest, historicalAlpha9Root, historicalAlpha9Source} from './historical-alpha9.mjs';
import {verifyProvenance, verifySourcePayload, runtimeInventory} from './check-provenance.mjs';
import {publicSourcePaths} from './check-source-scope.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=(dir,p)=>JSON.parse(fs.readFileSync(path.join(dir,p)));
function edit(dir,p,fn){const v=json(dir,p);fn(v);fs.writeFileSync(path.join(dir,p),JSON.stringify(v,null,2)+'\n');}
function resign(dir){const files=runtimeInventory(dir);edit(dir,'provenance/active-candidate.json',v=>{v.files=files;v.runtimeFileCount=files.length;v.runtimeSHA256=sha(JSON.stringify(files));});}
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'personalos-alpha10-negative-'));try{for(const p of [...publicSourcePaths(root),...alpha9SourceManifest(root).generatedFiles.map(f=>f.path)]){fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.copyFileSync(path.join(root,p),path.join(dir,p));}return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}

test('alpha.10 binds the exact r5 delta and all 375 predecessor source files',()=>{
 const proof=verifyProvenance(root);assert.equal(proof.productVersion,'v0.1.0-alpha.10');assert.equal(proof.runtimeFiles,73);assert.equal(proof.browserAcceptance,false);
 assert.deepEqual(verifyReaderR5Boundary(root,runtimeInventory(root)).changed,['runtime/app.js','runtime/index.html','runtime/material.css','runtime/release-meta.json']);
 const history=alpha9SourceManifest(root),prior=historicalAlpha9Root(root);assert.equal(history.files.length,375);
 for(const f of history.files)assert.equal(sha(fs.readFileSync(path.join(prior,f.path))),f.sha256,f.path);
 assert.equal(verifyProvenance(prior).runtimeSHA256,ALPHA9_HISTORY.runtimeSHA256);
 for(const p of ['scripts/check-reader-release-boundary.test.mjs','scripts/check-reader-r4-release-boundary.test.mjs','docs/ALPHA9_CANDIDATE.md'])assert.deepEqual(fs.readFileSync(path.join(root,p)),fs.readFileSync(path.join(prior,p)));
});
for(const relative of ['app.js','material.css','card-projection.js','card-projection.css','chat-host.js'])test(`r5 unauthorized ${relative} bytes cannot be re-signed`,()=>fixture(dir=>{
 fs.appendFileSync(path.join(dir,'apps/web/runtime',relative),'\n/* unauthorized */');resign(dir);
 assert.throws(()=>verifyReaderR5Boundary(dir,runtimeInventory(dir)),/Frozen reader r5 runtime changed|Reader r5 runtime scope exceeded|Unchanged alpha.9 runtime drifted/);assert.throws(()=>verifyProvenance(dir));
}));
for(const mutation of ['extra-runtime','removed-runtime','runtime-symlink'])test(`r5 ${mutation} is rejected`,()=>fixture(dir=>{
 const p=path.join(dir,'apps/web/runtime/unapproved.js');if(mutation==='extra-runtime')fs.writeFileSync(p,'');if(mutation==='removed-runtime')fs.unlinkSync(path.join(dir,'apps/web/runtime/material.css'));if(mutation==='runtime-symlink')fs.symlinkSync('app.js',p);
 assert.throws(()=>{resign(dir);verifyProvenance(dir);});
}));
for(const mutation of ['title','revision','version'])test(`stale r4 ${mutation} is rejected independently of re-signing`,()=>fixture(dir=>{
 if(mutation==='title'){const p=path.join(dir,'apps/web/runtime/index.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('Motion reader alpha r5','Motion reader alpha r4'));}
 else edit(dir,'apps/web/runtime/release-meta.json',v=>{if(mutation==='revision')v.readerCandidate.id='split-card-reader-r4';else v.productVersion='v0.1.0-alpha.9';});
 resign(dir);assert.throws(()=>verifyReaderR5Identity(dir),/Reader r5 (document title|revision identity|product identity) differs/);assert.throws(()=>verifyProvenance(dir));
}));
for(const mutation of ['inventory','allowlist','browser-acceptance'])test(`r5 envelope ${mutation} cannot reauthorize itself`,()=>fixture(dir=>{
 edit(dir,'provenance/active-candidate.json',v=>{if(mutation==='inventory')v.files.pop();if(mutation==='allowlist')v.runtimeOnlyAllowlist.push('runtime/host.js');if(mutation==='browser-acceptance')v.browserAcceptance=true;});assert.throws(()=>verifyProvenance(dir));
}));
for(const relative of [ALPHA9_HISTORY.manifest,ALPHA9_HISTORY.snapshot+'/apps/web/runtime/app.js','apps/web/tests/integration/reader-surface-continuity.test.mjs'])test(`r5 historical/input corruption ${relative} is rejected`,()=>fixture(dir=>{
 fs.appendFileSync(path.join(dir,relative),'\n');assert.throws(()=>verifyProvenance(dir));
}));
test('alpha.9 cached reconstruction remains immutable',()=>fixture(dir=>{const prior=historicalAlpha9Root(dir);fs.appendFileSync(path.join(prior,'apps/web/runtime/index.html'),'\n');assert.throws(()=>historicalAlpha9Root(dir),/Reconstructed historical source changed/);}));
test('r5 unapproved public source is rejected',()=>fixture(dir=>{fs.writeFileSync(path.join(dir,'unapproved.txt'),'');assert.throws(()=>verifyProvenance(dir),/Unexpected alpha.10 public source path/);}));
for(const mutation of ['runtime','supporting','extra'])test(`r5 committed ${mutation} drift is rejected`,()=>fixture(dir=>{
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 const p=path.join(dir,mutation==='runtime'?'apps/web/runtime/app.js':'scripts/check-reader-r5-release-boundary.test.mjs'),original=fs.readFileSync(p);
 if(mutation==='extra')fs.writeFileSync(path.join(dir,'unapproved.txt'),'');else fs.appendFileSync(p,'\n');
 git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@localhost');git('add','.');git('commit','-q','-m','Negative payload fixture');fs.writeFileSync(p,original);if(mutation==='extra')fs.unlinkSync(path.join(dir,'unapproved.txt'));
 assert.throws(()=>verifySourcePayload(dir),/Mapped public source blob differs|Mapped public source path set differs|Mapped payload differs/);
}));
test('real HTTP title, metadata and status agree with exact alpha.10/r5 pins',async()=>{
 const servers=[];try{assert.equal(READER_R5_RELEASE.version,'v0.1.0-alpha.10');assert.equal(READER_R5_RELEASE.revision,'split-card-reader-r5');assert.equal(READER_R5_RELEASE.documentTitle,'PersonalOS · Motion reader alpha r5');
 const api=await startApi({port:0});servers.push(api);const web=await startStatic({port:0});servers.push(web);const origin=`http://127.0.0.1:${web.address().port}`;
 const status=await fetch(`http://127.0.0.1:${api.address().port}/api/v1/status`),metadata=await fetch(origin+'/release-meta.json'),entry=await fetch(origin+'/');for(const r of [status,metadata,entry])assert.equal(r.status,200);
 const body=await status.json(),meta=await metadata.json();assert.equal(body.productVersion,READER_R5_RELEASE.version.slice(1));assert.equal(meta.productVersion,READER_R5_RELEASE.version);assert.equal(meta.readerCandidate.id,READER_R5_RELEASE.revision);assert.equal((await entry.text()).match(/<title>([^<]+)<\/title>/)?.[1],READER_R5_RELEASE.documentTitle);assert.equal(meta.readerCandidate.browserAcceptance,false);assert.deepEqual(body.capabilities,{health:true,status:true,contentApi:false,chatApi:false,authentication:false,persistence:false});assert.equal(body.frontendConnected,false);
 }finally{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
});
test('six surface regressions pass r5 and fail the authenticated r4 implementation',()=>fixture(dir=>{
 fs.symlinkSync(fs.realpathSync(path.join(root,'apps/web/tests/integration/node_modules')),path.join(dir,'apps/web/tests/integration/node_modules'),'dir');const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const run=()=>spawnSync(process.execPath,['--test','--test-reporter=tap','apps/web/tests/integration/reader-surface-continuity.test.mjs'],{cwd:dir,env,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});
 const clean=run();assert.equal(clean.status,0,clean.stdout+clean.stderr);assert.match(clean.stdout,/# pass 6/);
 for(const p of ['app.js','material.css'])fs.writeFileSync(path.join(dir,'apps/web/runtime',p),historicalAlpha9Source(root,'apps/web/runtime/'+p));
 const old=run();assert.equal(old.status,1,old.stdout+old.stderr);assert.match(old.stdout,/# fail 6/);assert.match(old.stdout,/the last painted surface must already equal the native rounded\/clipped card/);
}));
