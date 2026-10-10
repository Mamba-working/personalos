import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {historicalAlpha7Root} from './historical-alpha7.mjs';

// Independent historical oracles; never derive these from active-candidate.json.
export const ALPHA6_HISTORY = Object.freeze({
  commit: 'b4fe3cc3b1e663bec4930a20bf7b7cdb5bc59326',
  inventory: 'provenance/candidates/alpha6-b4fe3cc.json',
  inventorySHA256: 'ccfe9580a6a9d375f79ea8bf0d628ef05f5a29a16a696ab5702d3bcb0a828549',
  snapshot: 'provenance/snapshots/alpha6-b4fe3cc',
  files: Object.freeze({
    "package.json": "b367764ced80cc1afb23fcebb5bb057f40e53de679b85d0975517bb9a44e0869",
    "package-lock.json": "cd2ec2719a1191838137ff7cbe2720ece71f32faca234cabbec508889e918ead",
    "apps/web/package.json": "0eba139bfd7374c31c1625e9d0194cec1d41ce6f891cefb68216c71e89a1bf78",
    "packages/contracts/index.mjs": "5b095260feae7858234956d6b24872837ecbb77afa4a6648c8c78943af2b0759",
    "apps/web/runtime/release-meta.json": "b299a9872645319c16d195a196645f9bf1d92769e7d183d6bd9baa8c3bf9bcaa",
    "apps/web/runtime/modules/weather.js": "cad38afb17e2934e33133e805f2973dfed98779777a540aa2c467283492553f3",
    "apps/web/runtime/world/scene.js": "823a25d68a0e52d0b20f44ef436a99fbaa202d4dfdb1daf6be941d067187de3a"
})
});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(root,rel)=>{const file=path.join(root,rel);assert(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'Historical input must be a regular file: '+rel);return fs.readFileSync(file);};
export function alpha6Inventory(root){
 const bytes=read(root,ALPHA6_HISTORY.inventory);assert.equal(sha(bytes),ALPHA6_HISTORY.inventorySHA256,'Frozen alpha.6 inventory changed');return JSON.parse(bytes);
}
export function alpha6Source(root,rel){
 if(Object.hasOwn(ALPHA6_HISTORY.files,rel)){
  const bytes=read(root,ALPHA6_HISTORY.snapshot+'/'+rel);assert.equal(sha(bytes),ALPHA6_HISTORY.files[rel],'Frozen alpha.6 snapshot changed: '+rel);return bytes.toString();
 }
 assert(rel.startsWith('apps/web/runtime/'),'Unmapped historical source: '+rel);
 const expected=alpha6Inventory(root).files.find(x=>x.path===rel.slice('apps/web/'.length));assert(expected,'Historical source not in pinned inventory: '+rel);
 const bytes=read(root,rel);assert.equal(sha(bytes),expected.sha256,'Unchanged historical source drifted: '+rel);return bytes.toString();
}
const roots=new Set();
export function historicalAlpha6Root(root){
 root=path.resolve(root);
  if(['v0.1.0-alpha.8','v0.1.0-alpha.9'].includes(JSON.parse(read(root,'provenance/active-candidate.json')).productVersion))root=historicalAlpha7Root(root);
 const active=JSON.parse(read(root,'provenance/active-candidate.json'));
 if(active.productVersion==='v0.1.0-alpha.6')return root;
 assert.equal(active.productVersion,'v0.1.0-alpha.7','Historical alpha.6 resolver requires an explicit successor');
 alpha6Inventory(root);for(const rel of Object.keys(ALPHA6_HISTORY.files))alpha6Source(root,rel);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'personalos-pinned-alpha6-'));
 try{
  for(const rel of ['provenance','apps/web/runtime','package.json','package-lock.json','apps/web/package.json','apps/api/package.json','packages/contracts/package.json','packages/contracts/index.mjs']){
   const target=path.join(directory,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,rel),target,{recursive:true});
  }
  for(const rel of Object.keys(ALPHA6_HISTORY.files))fs.writeFileSync(path.join(directory,rel),alpha6Source(root,rel));
  fs.writeFileSync(path.join(directory,'provenance/active-candidate.json'),read(root,ALPHA6_HISTORY.inventory));
  // Reuse local Git object access for the historical payload assertion when
  // history exists. This pointer is not an isolation boundary; tests only read.
  const git=spawnSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'});
  if(git.status===0)fs.writeFileSync(path.join(directory,'.git'),'gitdir: '+git.stdout.trim()+'\n');
  roots.add(directory);return directory;
 }catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
process.once('exit',()=>{for(const root of roots)fs.rmSync(root,{recursive:true,force:true});});
