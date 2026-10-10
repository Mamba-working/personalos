import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const guard=path.join(repo,'scripts/check-public-export.mjs');
const allowed='experiments/three-weather-r1/public/assets/canopy-wet-stock-rgba8.png';
const original=fs.readFileSync(path.join(repo,allowed));
const work=path.join(repo,'test-results');
fs.mkdirSync(work,{recursive:true});
function fixture(files){
 const root=fs.mkdtempSync(path.join(work,'public-export-'));
 try{
  for(const [name,data] of files){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
  return spawnSync(process.execPath,[guard],{cwd:root,encoding:'utf8'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
function rejected(files){const result=fixture(files);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/blockedArtifact/);}
test('only the exact approved PNG bytes at the exact path pass',()=>{const result=fixture([[allowed,original]]);assert.equal(result.status,0,result.stdout+result.stderr);});
test('same approved bytes at a wrong path fail',()=>rejected([['experiments/three-weather-r1/public/assets/other.png',original]]));
test('same length with changed SHA fails',()=>{const changed=Buffer.from(original);changed[100]^=1;rejected([[allowed,changed]]);});
test('changed byte length fails',()=>rejected([[allowed,original.subarray(0,-1)]]));
test('a second PNG fails even when the approved one is present',()=>rejected([[allowed,original],['second.png',original]]));
test('an uppercase PNG is also blocked',()=>rejected([[allowed,original],['second.PNG',original]]));
test('unrelated blocked image types remain blocked',()=>rejected([[allowed,original],['photo.jpg',original]]));
test('approved PNG does not bypass private-path checks elsewhere',()=>{
 const privatePath='/'+['work'+'space','hidden','input'].join('/');
 const result=fixture([[allowed,original],['unsafe.txt',privatePath]]);
 assert.equal(result.status,1);assert.match(result.stderr,/privatePath/);
});
test('approved PNG does not bypass symlink rejection',()=>{
 const root=fs.mkdtempSync(path.join(work,'public-export-'));
 try{
  const exact=path.join(root,allowed);fs.mkdirSync(path.dirname(exact),{recursive:true});
  const data=path.join(root,'source.dat');fs.writeFileSync(data,original);fs.symlinkSync(data,exact);
  const result=spawnSync(process.execPath,[guard],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/symlink/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('approved PNG does not bypass credential checks elsewhere',()=>{
 const syntheticToken='gh'+'p_'+'A'.repeat(24);
 const result=fixture([[allowed,original],['unsafe.txt',syntheticToken]]);
 assert.equal(result.status,1);assert.match(result.stderr,/githubToken/);
});
