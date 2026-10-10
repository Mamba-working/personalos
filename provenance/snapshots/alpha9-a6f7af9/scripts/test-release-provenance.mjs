import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {historicalAlpha8Root} from './historical-alpha8.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Authenticate the complete predecessor first. Tests get a disposable copy so
// installing their unchanged locked dependencies never changes the cached oracle.
const historical=historicalAlpha8Root(root);
const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),'personalos-alpha8-tests-'));
try{
 fs.cpSync(historical,testRoot,{recursive:true});
 for(const dependencies of ['node_modules','apps/web/tests/integration/node_modules']) fs.symlinkSync(fs.realpathSync(path.join(root,dependencies)),path.join(testRoot,dependencies),'dir');
 // The original runner executes all original alpha.6/alpha.7/alpha.8 assertions.
 for(const [cwd,command,args] of [[testRoot,'npm',['test']],[root,process.execPath,['--test','scripts/check-reader-r4-release-boundary.test.mjs']]]){
  const result=spawnSync(command,args,{cwd,stdio:'inherit'});
  if(result.status!==0)process.exitCode=result.status??1;
  if(result.status!==0)break;
 }
}finally{fs.rmSync(testRoot,{recursive:true,force:true});}
