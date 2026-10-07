import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyShadowCacheBoundary,applyReviewedShadowHooks} from '../../../../scripts/check-shadow-cache-boundary.mjs';
import {runtimeInventory} from '../../../../scripts/check-provenance.mjs';
import {historicalAlpha6Root} from '../../../../scripts/historical-alpha6.mjs';
const root=historicalAlpha6Root(new URL('../../../../',import.meta.url).pathname);
test('alpha.6 graphics boundary permits only the reviewed service, exact owner hooks and release metadata',()=>{
 assert.deepEqual(verifyShadowCacheBoundary(root,runtimeInventory(root)).changed,['runtime/release-meta.json','runtime/world/scene.js','runtime/world/shadow-cache.js']);
});
test('precise service hooks reject absent or ambiguous anchors instead of applying approximate edits',()=>{
 assert.throws(()=>applyReviewedShadowHooks('none',[{before:'anchor',after:'replacement'}]),/exactly once/);
 assert.throws(()=>applyReviewedShadowHooks('anchor anchor',[{before:'anchor',after:'replacement'}]),/exactly once/);
 assert.equal(applyReviewedShadowHooks('one anchor end',[{before:'anchor',after:'replacement'}]),'one replacement end');
});
