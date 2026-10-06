import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from './content-fixture.mjs';
test('world source binds scroll only to frame request, without negative-scroll viewport compensation',()=>{
 const source=read('world/scene.js');assert.match(source,/window\.addEventListener\('scroll',requestWorldFrame,\{passive:true\}\)/);
 assert.doesNotMatch(source,/\boffsetY\s*=\s*-\s*(?:window\.)?scrollY/);
 assert.doesNotMatch(source,/addEventListener\(['"]scroll['"][^\n]*\brender\s*\(/);
});
