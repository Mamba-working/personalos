import test from 'node:test';
import {READER_R5_RELEASE} from '../../scripts/check-reader-r5-release-boundary.mjs';
import assert from 'node:assert/strict';
import {startStatic} from './dev-server.mjs';
async function withWeb(run){const server=await startStatic({port:0});try{await run(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('static server provides the frozen HTML and local release metadata',()=>withWeb(async origin=>{
  const entry=await fetch(origin+'/');assert.equal(entry.status,200);assert.match(await entry.text(),/PersonalOS/);
  const meta=await fetch(origin+'/release-meta.json');assert.equal(meta.status,200);assert.equal((await meta.json()).productVersion,READER_R5_RELEASE.version);
}));
test('static server serves required third-party notices',()=>withWeb(async origin=>{
  for(const route of ['/world/vendor/aora/LICENSE','/world/vendor/aora/NOTICE.md','/world/vendor/three/LICENSE','/chat/vendor/gsap/NOTICE.txt'])assert.equal((await fetch(origin+route)).status,200);
}));
test('static server does not expose repo files, directories or mutation routes',()=>withWeb(async origin=>{
  for(const route of ['/.git/config','/package.json','/tests/integration/package.json','/%2e%2e%2fpackage.json','/world/'])assert.equal((await fetch(origin+route)).status,404);
  const head=await fetch(origin+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
}));
