import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root=path.resolve(new URL('../',import.meta.url).pathname);
const source=JSON.parse(fs.readFileSync(path.join(root,'provenance/runtime-files.json'),'utf8'));
const current=[];
function visit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw new Error('Runtime symlinks are not allowed');if(entry.isDirectory())visit(file);else if(entry.isFile())current.push({path:'runtime/'+path.relative(path.join(root,'apps/web/runtime'),file).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}}
visit(path.join(root,'apps/web/runtime'));current.sort((a,b)=>{const aa=a.path.split('/'),bb=b.path.split('/');for(let i=0;i<Math.min(aa.length,bb.length);i++){if(aa[i]!==bb[i])return aa[i]<bb[i]?-1:1;}return aa.length-bb.length;});
if(JSON.stringify(current)!==JSON.stringify(source.files))throw new Error('Frozen imported runtime files differ from recorded source inventory');
// Original algorithm sorts object keys: path, sha256. Both are inserted in that order here.
const digest=crypto.createHash('sha256').update(JSON.stringify(current)).digest('hex');
if(digest!==source.originalRuntimeSHA256)throw new Error('Frozen imported runtime canonical digest mismatch');
console.log(`Imported runtime: ${current.length} exact files, ${digest}`);
