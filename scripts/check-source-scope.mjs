import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
export const SOURCE_SCOPE_SHA256='7d92bee3f6f4fdc1065d812a2f0ba5741ffa5eeb1b5e641ec4087ab515261344';
const ignored=new Set(['.git','node_modules','.npm-cache','evidence','playwright-report','test-results']);
const generated=new Set(['apps/web/runtime/world/vendor/three/three.core.js','apps/web/runtime/world/vendor/three/three.module.js','apps/web/tests/integration/fixtures/accepted-baseline/world/vendor/three/three.core.js','apps/web/tests/integration/fixtures/accepted-baseline/world/vendor/three/three.module.js']);
export function publicSourcePaths(root){
 const files=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(e.name))continue;const p=path.join(dir,e.name),rel=path.relative(root,p).split(path.sep).join('/');assert(!e.isSymbolicLink(),'Public source symlink: '+rel);if(e.isDirectory())walk(p);else if(e.isFile()&&!generated.has(rel))files.push(rel);}}
 walk(root);return files.sort();
}
export function verifySourceScope(root){
 const text=fs.readFileSync(path.join(root,'provenance/alpha7-source-files.json'),'utf8');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),SOURCE_SCOPE_SHA256,'Reviewed public source scope changed');
 const files=JSON.parse(text);assert.deepEqual(publicSourcePaths(root),files,'Unexpected public source path');return files;
}
