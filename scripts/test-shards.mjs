import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
export const WEB_SHARD_TIMEOUT_MS=60000;
const ignored=new Set(['node_modules','evidence','.git']);
export function discoverWebTests(root){
 const base=path.join(root,'apps/web/tests'),found=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(e.name)||e.name==='fixtures')continue;const p=path.join(dir,e.name);assert(!e.isSymbolicLink(),'Test discovery symlink: '+p);if(e.isDirectory())walk(p);else if(e.name.endsWith('.test.mjs'))found.push(path.relative(root,p).split(path.sep).join('/'));}}
 walk(base);return found.sort();
}
export function assertExactCoverage(planned,discovered){assert.equal(new Set(planned).size,planned.length,'Duplicate test shard');assert.deepEqual([...planned].sort(),[...discovered].sort(),'Test shard coverage differs');}
export function runTestShards({root,files,label,evidenceRoot,timeout=WEB_SHARD_TIMEOUT_MS,execute=spawnSync}){
 assert.equal(new Set(files).size,files.length,'Duplicate test shard');fs.mkdirSync(evidenceRoot,{recursive:true});
 // Preserve the original web runner's fixture-output preparation. The archived
 // temporal-close assertion writes its frame evidence relative to its own file.
 fs.mkdirSync(path.join(root,'apps/web/tests/integration/evidence'),{recursive:true});
 const results=[];
 for(const [i,file] of files.entries()){
  assert(file&&!path.isAbsolute(file)&&file.split('/').every(p=>p&&p!=='.'&&p!=='..'),'Invalid test shard path');
  const startedAt=new Date().toISOString(),begin=Date.now();
  const result=execute(process.execPath,['--test','--test-reporter=tap',file],{cwd:root,encoding:'utf8',timeout,maxBuffer:16*1024*1024});
  const output=(result.stdout||'')+(result.stderr||''),tapFile=`${label}-${String(i+1).padStart(2,'0')}.tap`;
  fs.writeFileSync(path.join(evidenceRoot,tapFile),output);
  const record={file,startedAt,elapsedMs:Date.now()-begin,timeoutMs:timeout,exitCode:result.status??null,signal:result.signal??null,error:result.error?{code:result.error.code??null,message:result.error.message}:null,tapFile,passed:!result.error&&!result.signal&&result.status===0};
  results.push(record);console.log(`\n# verification-shard ${label}: ${file}`);process.stdout.write(output);console.log('# verification-result '+JSON.stringify(record));
  // Persist after each shard, including its original signal/error, before moving on.
  fs.writeFileSync(path.join(evidenceRoot,label+'.json'),JSON.stringify({label,planned:files,completed:results.length,results,passed:results.length===files.length&&results.every(r=>r.passed)},null,2)+'\n');
 }
 return {passed:results.every(r=>r.passed),results};
}
