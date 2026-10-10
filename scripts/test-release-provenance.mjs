import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {historicalAlpha7Root} from './historical-alpha7.mjs';
import {historicalAlpha8Root} from './historical-alpha8.mjs';
import {historicalAlpha9Root} from './historical-alpha9.mjs';
import {readCoverage,verifyHistoricalCoverage} from './verification-coverage.mjs';
import {runTestShards} from './test-shards.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),coverage=readCoverage(root),evidenceRoot=path.join(root,'evidence/verification');let passed=true;
// Authenticate each original source and invoke exact assertion files directly.
// Never invoke an archived npm pipeline or archived whole-web runner.
for(const [version,resolve] of [['alpha7',historicalAlpha7Root],['alpha8',historicalAlpha8Root],['alpha9',historicalAlpha9Root]]){
 const historical=resolve(root),plan=version==='alpha7'?coverage.historical.alpha7:verifyHistoricalCoverage(root,historical,version,coverage);
 const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),`personalos-flat-${version}-`));
 try{
  fs.cpSync(historical,testRoot,{recursive:true});
  for(const dependencies of ['node_modules','apps/web/tests/integration/node_modules'])fs.symlinkSync(fs.realpathSync(path.join(root,dependencies)),path.join(testRoot,dependencies),'dir');
  for(const [kind,files] of [['assertions',plan.unitFiles],['web',plan.webFiles||[]]])if(files.length){const result=runTestShards({root:testRoot,files,label:version+'-'+kind,evidenceRoot});passed=result.passed&&passed;}
 }finally{fs.rmSync(testRoot,{recursive:true,force:true});}
}
const current=runTestShards({root,files:['scripts/check-reader-r5-release-boundary.test.mjs'],label:'current-provenance',evidenceRoot});
process.exitCode=passed&&current.passed?0:1;
