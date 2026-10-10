import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),directory=path.join(root,'evidence/verification');fs.mkdirSync(directory,{recursive:true});
const results=[];
// Every independent group runs once. Historical failures remain fatal, but no
// longer hide the result of the current product's complete regression suite.
for(const script of ['test:harness','test:vendor','test:provenance','test:contracts','test:api','test:static','test:web']){
 const startedAt=new Date().toISOString(),begin=Date.now(),result=spawnSync('npm',['run',script],{cwd:root,stdio:'inherit'});
 results.push({script,startedAt,elapsedMs:Date.now()-begin,exitCode:result.status??null,signal:result.signal??null,error:result.error?{code:result.error.code??null,message:result.error.message}:null});
 fs.writeFileSync(path.join(directory,'aggregate.json'),JSON.stringify({results,passed:results.every(r=>r.exitCode===0&&!r.error&&!r.signal)},null,2)+'\n');
}
process.exitCode=results.some(r=>r.exitCode!==0||r.error||r.signal)?1:0;
