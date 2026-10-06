import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {materializeVendor} from './setup-vendor.mjs';
const sha=data=>createHash('sha256').update(data).digest('hex');
const targets=name=>[`apps/web/runtime/world/vendor/three/${name}`,`apps/web/tests/integration/fixtures/accepted-baseline/world/vendor/three/${name}`];
async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'personalos-vendor-test-'));
  try{
    await mkdir(path.join(root,'node_modules/three/build'),{recursive:true});await mkdir(path.join(root,'provenance'));
    await writeFile(path.join(root,'node_modules/three/package.json'),JSON.stringify({name:'three',version:'0.180.0'}));
    const sources=[];
    for(const name of ['three.core.js','three.module.js']){const data=Buffer.from(`Test-only ${name} bytes; not real Three.js source\n`);await writeFile(path.join(root,'node_modules/three/build',name),data);sources.push({packagePath:'build/'+name,sha256:sha(data),bytes:data.length,destinations:targets(name)});}
    await writeFile(path.join(root,'provenance/vendor-dependencies.json'),JSON.stringify({schemaVersion:1,package:{name:'three',version:'0.180.0'},sources}));
    await run(root,sources);
  }finally{await rm(root,{recursive:true,force:true});}
}
test('copies four exact destinations and is idempotent',()=>fixture(async(root,sources)=>{
  assert.deepEqual(await materializeVendor({root}),{package:'three',version:'0.180.0',files:4,created:4});
  assert.equal((await materializeVendor({root})).created,0);assert.equal((await materializeVendor({root,checkOnly:true})).files,4);
  for(const source of sources)for(const destination of source.destinations)assert.equal(sha(await readFile(path.join(root,destination))),source.sha256);
}));
test('missing package gives the required install/setup instruction',()=>fixture(async root=>{
  await rm(path.join(root,'node_modules/three'),{recursive:true});await assert.rejects(materializeVendor({root}),/Run npm ci.*setup:vendor/);
}));
test('wrong package version fails before creating files',()=>fixture(async root=>{
  await writeFile(path.join(root,'node_modules/three/package.json'),JSON.stringify({version:'0.181.0'}));await assert.rejects(materializeVendor({root}),/version mismatch/);await assert.rejects(readFile(path.join(root,targets('three.core.js')[0])),{code:'ENOENT'});
}));
test('wrong source digest fails before any file is created',()=>fixture(async root=>{
  await writeFile(path.join(root,'node_modules/three/build/three.module.js'),'wrong');await assert.rejects(materializeVendor({root}),/refusing approximate substitution/);await assert.rejects(readFile(path.join(root,targets('three.core.js')[0])),{code:'ENOENT'});
}));
test('check-only missing output and changed existing output fail safely',()=>fixture(async root=>{
  await assert.rejects(materializeVendor({root,checkOnly:true}),/Run npm run setup:vendor/);await materializeVendor({root});
  await writeFile(path.join(root,targets('three.core.js')[0]),'changed generated file');await assert.rejects(materializeVendor({root}),/review\/remove/);
}));
