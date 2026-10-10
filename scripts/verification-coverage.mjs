import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ALPHA8_HISTORY} from './historical-alpha8.mjs';
import {ALPHA9_HISTORY} from './historical-alpha9.mjs';
import {discoverWebTests,assertExactCoverage} from './test-shards.mjs';
export function readCoverage(root){return JSON.parse(fs.readFileSync(path.join(root,'provenance/verification-coverage.json')));}
export function verifyHistoricalCoverage(root,historical,version,coverage=readCoverage(root)){
 const plan=coverage.historical[version],dedup=plan.deduplicatedWebFiles.map(x=>x.file);
 assert.equal(plan.sourceCommit,version==='alpha8'?ALPHA8_HISTORY.commit:ALPHA9_HISTORY.commit,'Historical coverage source identity differs');
 assertExactCoverage([...plan.webFiles,...dedup],discoverWebTests(historical));
 assert.equal(new Set([...plan.webFiles,...dedup]).size,plan.webFiles.length+dedup.length,'Historical shard classified twice');
 for(const file of [...dedup,...coverage.deduplication.commonInputFiles,coverage.deduplication.vendorTest,...coverage.deduplication.vendorInputs])assert.deepEqual(fs.readFileSync(path.join(historical,file)),fs.readFileSync(path.join(root,file)),'Deduplicated test input differs: '+file);
 const body=dir=>fs.readFileSync(path.join(dir,coverage.deduplication.documentStructureFile),'utf8').replace(/<title>[^<]*<\/title>/,'<title>VERSIONED TITLE</title>');
 assert.equal(body(historical),body(root),'Deduplicated HTML structure differs beyond version title');
 for(const file of plan.unitFiles)assert(fs.statSync(path.join(historical,file)).isFile(),'Missing historical assertion file: '+file);
 // The exact known failures are permanently retained, not silently classified as duplicates.
 assert(plan.webFiles.includes('apps/web/tests/integration/card-projection.test.mjs'),'Historical history/intent assertions omitted');
 const gate=version==='alpha8'?'scripts/check-reader-release-boundary.test.mjs':'scripts/check-reader-r4-release-boundary.test.mjs';assert(plan.unitFiles.includes(gate),'Historical negative-control assertions omitted');
 return plan;
}
