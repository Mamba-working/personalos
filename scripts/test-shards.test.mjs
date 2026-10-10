import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverWebTests,assertExactCoverage,runTestShards,WEB_SHARD_TIMEOUT_MS} from './test-shards.mjs';
import {readCoverage,verifyHistoricalCoverage} from './verification-coverage.mjs';
import {historicalAlpha8Root} from './historical-alpha8.mjs';
import {historicalAlpha9Root} from './historical-alpha9.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'verification-shard-test-'));try{return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('every current web test file is scheduled exactly once, with no name filters',()=>{
 const files=discoverWebTests(root);assert.equal(files.length,43);assertExactCoverage(readCoverage(root).currentWebFiles,files);assert.equal(WEB_SHARD_TIMEOUT_MS,60000);
 assert.throws(()=>assertExactCoverage(files.slice(1),files),/coverage differs/);assert.throws(()=>assertExactCoverage([...files,files[0]],files),/Duplicate/);
});
test('a failed shard stays fatal, is not retried, and cannot conceal later results',()=>fixture(evidenceRoot=>{
 const calls=[],result=runTestShards({root:evidenceRoot,files:['first.test.mjs','second.test.mjs'],label:'failure-control',evidenceRoot,execute:(exe,args,options)=>{calls.push({args,options});return{status:calls.length===1?1:0,stdout:'controlled output\n',stderr:'',signal:null};}});
 assert.equal(result.passed,false);assert(fs.statSync(path.join(evidenceRoot,'apps/web/tests/integration/evidence')).isDirectory());assert.equal(calls.length,2);assert.deepEqual(calls[0].args,['--test','--test-reporter=tap','first.test.mjs']);assert.equal(calls[0].options.timeout,60000);
 const record=JSON.parse(fs.readFileSync(path.join(evidenceRoot,'failure-control.json')));assert.equal(record.passed,false);assert.deepEqual(record.results.map(r=>r.exitCode),[1,0]);assert.equal(record.completed,2);
}));
test('the original timeout error and signal are persisted and printed, never converted to success',()=>fixture(evidenceRoot=>{
 const error=Object.assign(new Error('spawnSync ETIMEDOUT'),{code:'ETIMEDOUT'}),result=runTestShards({root,files:['timeout.test.mjs'],label:'timeout-control',evidenceRoot,execute:()=>({status:null,signal:'SIGTERM',error,stdout:'partial TAP\n',stderr:''})});
 assert.equal(result.passed,false);const record=JSON.parse(fs.readFileSync(path.join(evidenceRoot,'timeout-control.json'))).results[0];assert.equal(record.error.code,'ETIMEDOUT');assert.equal(record.signal,'SIGTERM');assert.equal(record.exitCode,null);assert.equal(record.timeoutMs,60000);assert.equal(fs.readFileSync(path.join(evidenceRoot,record.tapFile),'utf8'),'partial TAP\n');
}));
for(const [version,resolve,expected] of [['alpha8',historicalAlpha8Root,23],['alpha9',historicalAlpha9Root,24]])test(`${version} classifies every original web file and proves all deduplicated inputs equal`,()=>{
 const plan=verifyHistoricalCoverage(root,resolve(root),version);assert.equal(plan.webFiles.length,expected);assert.equal(plan.deduplicatedWebFiles.length,18);
 const corrupt=structuredClone(readCoverage(root));corrupt.historical[version].webFiles=corrupt.historical[version].webFiles.filter(p=>!p.endsWith('/card-projection.test.mjs'));assert.throws(()=>verifyHistoricalCoverage(root,resolve(root),version,corrupt),/coverage differs/);
 const identity=structuredClone(readCoverage(root));identity.historical[version].sourceCommit='0'.repeat(40);assert.throws(()=>verifyHistoricalCoverage(root,resolve(root),version,identity),/Historical coverage source identity differs/);
 const input=structuredClone(readCoverage(root));input.deduplication.commonInputFiles.push('apps/web/runtime/app.js');assert.throws(()=>verifyHistoricalCoverage(root,resolve(root),version,input),/Deduplicated test input differs/);
});
test('historical dispatch is flat and current orchestration preserves every group failure',()=>{
 const historic=fs.readFileSync(new URL('./test-release-provenance.mjs',import.meta.url),'utf8');assert.doesNotMatch(historic,/spawnSync|\['test'\]|integration\/run\.mjs/);assert.match(historic,/plan\.unitFiles/);assert.match(historic,/plan\.webFiles/);
 const aggregate=fs.readFileSync(new URL('./test-all.mjs',import.meta.url),'utf8');assert.match(aggregate,/results\.some/);assert.doesNotMatch(aggregate,/continue-on-error|test-skip-pattern|test-name-pattern/);
});
