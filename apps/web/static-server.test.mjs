import test from 'node:test';
import assert from 'node:assert/strict';
import {startStatic} from './dev-server.mjs';
async function withWeb(run){const server=await startStatic({port:0});try{await run(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('static server provides the frozen HTML and local release metadata',()=>withWeb(async origin=>{
  const entry=await fetch(origin+'/');assert.equal(entry.status,200);assert.match(await entry.text(),/PersonalOS/);
  const meta=await fetch(origin+'/release-meta.json');assert.equal(meta.status,200);assert.equal((await meta.json()).productVersion,'v0.1.0-alpha.8');
}));
test('static server serves required third-party notices',()=>withWeb(async origin=>{
  for(const route of ['/motion/vendor/three/LICENSE','/chat/vendor/gsap/NOTICE.txt'])assert.equal((await fetch(origin+route)).status,200);
}));
test('static server does not expose repo files, directories or mutation routes',()=>withWeb(async origin=>{
  for(const route of ['/.git/config','/package.json','/tests/integration/package.json','/%2e%2e%2fpackage.json','/world/'])assert.equal((await fetch(origin+route)).status,404);
  const head=await fetch(origin+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
}));
test('static server serves terrain images and WebGL binaries with required MIME types',()=>withWeb(async origin=>{
  const image=await fetch(origin+'/motion/assets/terrain/kawaguchi_detail.webp');
  assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/^image\/webp/);
  const terrain=await fetch(origin+'/motion/assets/terrain/kawaguchi_polar.u16');
  assert.equal(terrain.status,200);assert.match(terrain.headers.get('content-type'),/^application\/octet-stream/);
  const three=await fetch(origin+'/motion/vendor/three/three.module.js');
  assert.equal(three.status,200);assert.match(three.headers.get('content-type'),/^text\/javascript/);
}));
test('old 3D renderer and exclusive vendor paths are absent',()=>withWeb(async origin=>{
  for(const route of ['/world/scene.js','/world/vendor/aora/rings.js','/scene-bridge.js','/world-availability.js','/story/story.js'])assert.equal((await fetch(origin+route)).status,404);
}));
