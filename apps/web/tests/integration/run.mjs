import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {discoverWebTests,assertExactCoverage,runTestShards} from '../../../../scripts/test-shards.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),runtime=path.join(root,'apps/web/runtime'),evidence=path.join(root,'evidence/verification');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sources=Object.fromEntries(files(runtime).sort().map(p=>[path.relative(runtime,p),hash(p)]));
const coverage=JSON.parse(fs.readFileSync(path.join(root,'provenance/verification-coverage.json'))),tests=discoverWebTests(root);assertExactCoverage(coverage.currentWebFiles,tests);
const result=runTestShards({root,files:tests,label:'current-web',evidenceRoot:evidence});
const changed=Object.keys(sources).filter(p=>!fs.existsSync(path.join(runtime,p))||sources[p]!==hash(path.join(runtime,p)));
fs.writeFileSync(path.join(evidence,'current-runtime.json'),JSON.stringify({runtimeFiles:Object.keys(sources).length,sources,sourceChangedDuringRun:changed,boundary:'Source/JSDOM only; no browser/device acceptance'},null,2)+'\n');
if(changed.length)console.error('Runtime changed during verification:',changed);
process.exitCode=result.passed&&!changed.length?0:1;
