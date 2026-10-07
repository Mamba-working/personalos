import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
test('one history owner; no legacy application bootstrap enters the candidate',()=>{
  const controller=read('native/content/controller.ts'),shell=read('components/PersistentMotionShell.tsx'),island=read('components/NativeContentIsland.tsx');
  assert.doesNotMatch(controller,/history\.(?:pushState|replaceState|back)|addEventListener\(['"]popstate/);
  assert.doesNotMatch(shell,/runtime\/(?:app|host|chat-host|scene-bridge)\.js/);
  assert.match(island,/useState\(\(\) => \(\{__html: initialHtml\}\)\)/);
  assert.doesNotMatch(controller,/innerHTML|cloneNode|createElement\(['"]article/);
  assert.match(read('lib/navigation/navigation-authority.ts'),/env\.addEventListener\('popstate', onPop\)/);
  assert.doesNotMatch(read('lib/navigation/navigation-authority.ts'),/stopImmediatePropagation|stopPropagation|\.\.\.env.history.state/);
});
test('original world uses one actual renderer and actor; browser initialization is an explicit function',()=>{
  const scene=read('native/world/original-scene.js');
  assert.equal((scene.match(/new THREE.WebGLRenderer/g)||[]).length,1);assert.equal((scene.match(/actor.name='Ball \/ persistent actor'/g)||[]).length,1);
  assert.match(scene,/export function mountOriginalWorld/);assert.match(scene,/runtime\/world\/vendor\/three\/three.module.js/);assert.doesNotMatch(scene,/from ['"]three['"]/);assert.match(scene,/cleanup\(\); throw error/);
  assert.doesNotMatch(scene,/window\.addEventListener|document\.addEventListener|motionQuery\.addEventListener|hit\.addEventListener/);
  assert.match(scene,/renderer.domElement.remove\(\)/);assert.match(scene,/if\(window.ballStudy===study\)delete window.ballStudy/);
});
