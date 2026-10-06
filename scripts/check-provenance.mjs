import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Historical import records are immutable, even when an active composite changes.
export const HISTORICAL_PROVENANCE = Object.freeze({
  "export-policy.json": "0f782049e914df98374f5d06d800e2af54e745002647fd0d90544a07e0e460f5",
  "import-verification.json": "3699baac108d2feaa992e06db0b2e2c6f1d52869ccaacf9815cb92187d94012a",
  "releases.json": "d815c0e81e1549e3f83eaaed8f0d54e5079f4fc280b9fc281c07b1639a1abcd7",
  "runtime-files.json": "a74283e78182bff5fdb16fcb99b6894712c3d2c8840ece76b16429d10de8a7cc",
  "source-allowlist.json": "c1b20944189a33f5368e254d3bce474118318605d442c52eccb82b546e7de408",
  "tooling-verification.json": "c7c898a24a93f57094dd2d0f41c6b13dade9a97b88b53c8e9fb56afc5178d764",
  "vendor-dependencies.json": "0fbe77a79547705a4b50de50505ae86ae305b8341fe2713d8d617a95e8502c83"
});
export const VERSION_FILES = ['package.json','package-lock.json','apps/web/package.json','packages/contracts/index.mjs','apps/web/runtime/release-meta.json'];
export const REQUIRED_DEFERRED = ['final-user-signoff','measured-performance','physical-device','rendered-visual-motion','assembled-weather-motion-review'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=(root,rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const order=(a,b)=>{const aa=a.path.split('/'),bb=b.path.split('/');for(let i=0;i<Math.min(aa.length,bb.length);i++)if(aa[i]!==bb[i])return aa[i]<bb[i]?-1:1;return aa.length-bb.length;};
export function runtimeInventory(root){
 const current=[],runtime=path.join(root,'apps/web/runtime');
 function visit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);assert(!entry.isSymbolicLink(),'Runtime symlinks are not allowed');if(entry.isDirectory())visit(file);else if(entry.isFile())current.push({path:'runtime/'+path.relative(runtime,file).split(path.sep).join('/'),sha256:hash(fs.readFileSync(file))});}}
 visit(runtime);return current.sort(order);
}
export function verifyProvenance(root){
 for(const [name,expected] of Object.entries(HISTORICAL_PROVENANCE))assert.equal(hash(fs.readFileSync(path.join(root,'provenance',name))),expected,`Historical provenance changed: ${name}`);
 const current=runtimeInventory(root),digest=hash(JSON.stringify(current)),original=json(root,'provenance/runtime-files.json');
 const activePath=path.join(root,'provenance/active-candidate.json');
 if(!fs.existsSync(activePath)){
  assert.equal(json(root,'package.json').version,'0.1.0-alpha.4','New version requires an explicit active-candidate inventory');
  assert.deepEqual(current,original.files,'Frozen imported runtime inventory differs');assert.equal(digest,original.originalRuntimeSHA256,'Frozen runtime digest differs');return{kind:'historical-alpha4',runtimeFiles:current.length,runtimeSHA256:digest};
 }
 const active=json(root,'provenance/active-candidate.json');
 assert.equal(active.schemaVersion,1);assert.equal(active.kind,'local-composite-candidate');assert.equal(active.status,'unpublished-acceptance-pending');
 assert.equal(active.productVersion,'v0.1.0-alpha.5');assert.equal(active.publicGitCommit,null);assert.equal(active.publicGitTag,null);assert.equal(active.deployed,false);
 assert.match(active.sourcePayloadCommit,/^[a-f0-9]{40}$/);assert.notEqual(active.sourcePayloadCommit,'0'.repeat(40));
 assert.deepEqual(active.historicalProvenance,HISTORICAL_PROVENANCE,'Historical hash map differs');
 assert.equal(active.algorithm,original.algorithm);assert.deepEqual(active.files,current,'Active candidate inventory differs');assert.equal(active.runtimeSHA256,digest,'Active candidate digest differs');
 assert.equal(active.revision,'world-layers-r3','Reading revision identity missing');
 {
  assert.equal(active.initialCandidate.commit,'0fc929ff0b602ac3b2769804ef7a447c61d30afa');
  assert.equal(active.initialCandidate.runtimeSHA256,'27331c3bf03ad15b5225384f28d12acea1babd5e2bf2a72c989e7f5f9ae59e75');
  assert.equal(active.initialCandidate.inventory,'provenance/candidates/alpha5-0fc929f.json');
  assert.equal(hash(fs.readFileSync(path.join(root,active.initialCandidate.inventory))),'945d3617cd25ac364f1d51b20f9916b4de07479ea007785a10b0d4b80f4c6ff3','Initial alpha.5 inventory changed');
  assert.equal(active.readingShelfCandidate.commit,'b917dda0cb003824de6a5eb73b360fcffd72f4e3');
  assert.equal(active.readingShelfCandidate.runtimeSHA256,'4093f9e8e45bf53fe9150757e78cc59f280232152d7df4c1e86e370562d1aeea');
  assert.equal(active.readingShelfCandidate.inventory,'provenance/candidates/alpha5-reading-b917dda.json');
  assert.equal(hash(fs.readFileSync(path.join(root,active.readingShelfCandidate.inventory))),'77cd914657ebbbc111619205dd68c0281b805bb0979a2e8a809e731673d9b96e','Reading r1 inventory changed');
  assert.equal(active.previousCandidate.commit,'984814b3c465d0400356d1e9ba6b0e1bd2a244b2');
  assert.equal(active.previousCandidate.runtimeSHA256,'9ecf5860822a3a5dcf0d940c517588c649152091bac3c88002e4353da21b49bf');
  assert.equal(active.previousCandidate.inventory,'provenance/candidates/alpha5-controls-984814b.json');
  assert.equal(hash(fs.readFileSync(path.join(root,active.previousCandidate.inventory))),'f39847f261c7d86ad5a6b2bff476fea6c1240350fb96eefa54218cce1ccb5253','Reading r2 inventory changed');
 }
 const version=active.productVersion.slice(1),rootPackage=json(root,'package.json'),web=json(root,'apps/web/package.json'),lock=json(root,'package-lock.json'),meta=json(root,'apps/web/runtime/release-meta.json');
 for(const [label,value]of Object.entries({root:rootPackage.version,web:web.version,lock:lock.version,lockRoot:lock.packages[''].version,lockWeb:lock.packages['apps/web'].version}))assert.equal(value,version,`Version mismatch: ${label}`);
 const contract=fs.readFileSync(path.join(root,'packages/contracts/index.mjs'),'utf8').match(/export const PRODUCT_VERSION = '([^']+)'/);assert.equal(contract?.[1],version,'Contract product version differs');
 assert.equal(meta.productVersion,active.productVersion);assert.equal(meta.channel,'alpha');assert.equal(meta.fullUnifiedAcceptance,false);assert(meta.reviewLabel.includes('Local alpha.5 candidate'),'Candidate disclosure missing');
 for(const gate of REQUIRED_DEFERRED)assert(meta.deferredGates.includes(gate),`Deferred gate removed: ${gate}`);
 for(const rel of ['apps/api/package.json','packages/contracts/package.json'])assert.equal(json(root,rel).version,'0.0.1',`Scaffold version changed: ${rel}`);
 assert.equal(active.inputs.publicAlpha4Commit,'64c36696dcc54ba2fa108437a3be49ac830100ef');assert.equal(active.inputs.localSnapshotCommit,'5772029008e613d737ab40fad1667e1dafdb59d0');assert.equal(active.inputs.clockCommit,'fef46540fc31fb8bb85b8f987b28348fc6604f11');assert.equal(active.inputs.weatherPatchSHA256,'a713d0fc83b01c8fe2353bfed22dc70adda00694fe511a765778f8be48d1e3fb');
 return{kind:active.kind,productVersion:active.productVersion,sourcePayloadCommit:active.sourcePayloadCommit,runtimeFiles:current.length,runtimeSHA256:digest};
}
export function verifySourcePayload(root){
 const active=json(root,'provenance/active-candidate.json'),commit=active.sourcePayloadCommit;
 const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:null});assert.equal(r.status,0,`Source payload object unavailable or invalid: ${r.stderr?.toString()}`);return r.stdout;};
 const tracked=git(['ls-tree','-r','--name-only',commit,'--','apps/web/runtime']).toString().trim().split('\n');
 const paths=[...new Set([...tracked,...VERSION_FILES])];for(const rel of paths)assert.deepEqual(git(['show',`${commit}:${rel}`]),fs.readFileSync(path.join(root,rel)),`Mapped payload differs: ${rel}`);
 return{sourcePayloadCommit:commit,verifiedTrackedFiles:paths.length};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const root=path.resolve(new URL('../',import.meta.url).pathname);console.log(JSON.stringify(verifyProvenance(root),null,2));
 if(process.argv.includes('--verify-source-commit'))console.log(JSON.stringify(verifySourcePayload(root),null,2));
}
