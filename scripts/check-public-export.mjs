import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const moduleProvenance=JSON.parse(fs.readFileSync('modules/motion-ball/SOURCE-PROVENANCE.json','utf8'));
const exactPublicOriginals=new Map(moduleProvenance.files.map(f=>[path.join('modules/motion-ball',f.path),f.sha256]));
const approvedAssets=new Map();
for(const f of moduleProvenance.files.filter(f=>f.path.startsWith('public/'))){approvedAssets.set(path.join('modules/motion-ball',f.path),f.sha256);approvedAssets.set(path.join('apps/web/runtime/motion/assets',f.path.slice(7)),f.sha256);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const patterns={
  privateKey:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  githubToken:/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  providerKey:/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/,
  awsKey:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  slackToken:/\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
  credentialUrl:/https?:\/\/[^\s/<>:"']+:[^\s/<>"']+@/,
  privatePath:/\/(?:workspace|home\/agent|Users|root|opt\/codex|tmp)\//,
  privateChat:/codex:\/\/threads\/|chatgpt\.com\/c\/|thread_[A-Za-z0-9]+|Sentinel_[A-Za-z0-9]+|msg_[A-Za-z0-9]{12,}|session_[A-Za-z0-9]{12,}/,
};
const ignored=new Set(['.git','.build','node_modules','.npm-cache','evidence','playwright-report','test-results']);
const blockedParts=new Set(['private-recovery','user-feedback','.artifacts','dream_notes','agent_notes','user_notes']);
const findings=[];let checked=0;
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(entry.name))continue;const file=path.join(dir,entry.name);const bytes=entry.isFile()?fs.readFileSync(file):null,approvedAsset=bytes&&approvedAssets.get(file)===hash(bytes);if(blockedParts.has(entry.name)||(/\.(?:bundle|patch|png|jpe?g|mp4|webm)$/.test(entry.name)&&!approvedAsset)||(/^\.env(?:\.|$)/.test(entry.name)&&entry.name!=='.env.example'))findings.push({file,type:'blockedArtifact'});if(entry.isSymbolicLink()){findings.push({file,type:'symlink'});continue;}if(entry.isDirectory()){scan(file);continue;}if(!entry.isFile())continue;checked++;if(approvedAsset)continue;const text=bytes.toString('utf8'),exactPublicOriginal=exactPublicOriginals.get(file)===hash(bytes);for(const [type,pattern]of Object.entries(patterns)){if(type==='privatePath'&&exactPublicOriginal)continue;if(pattern.test(text))findings.push({file,type});}}}
scan('.');
if(findings.length){console.error(JSON.stringify({checked,findings},null,2));process.exit(1);}
console.log(`Public source heuristic scan: ${checked} files, no credential/private-path/conversation-pattern matches. This does not certify absence of secrets.`);
