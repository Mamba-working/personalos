import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
const ignored=new Set(['.git','node_modules','.npm-cache','evidence','playwright-report','test-results']);
const blockedParts=new Set(['private-recovery','user-feedback','.artifacts','dream_notes','agent_notes','user_notes']);
// Only this reviewed non-color data texture is exempt from the image extension block.
// It remains subject to all existing credential/private-path/content and symlink checks.
const approvedPNG={path:'experiments/three-weather-r1/public/assets/canopy-wet-stock-rgba8.png',bytes:227080,sha256:'0a24cc230df5a22bfd5cf0ff36c4c0ff39eadf688539dee8f384ca2760f5e5fa'};
function exactApprovedPNG(file,entry){if(!entry.isFile()||file.split(path.sep).join('/')!==approvedPNG.path)return false;const data=fs.readFileSync(file);return data.length===approvedPNG.bytes&&createHash('sha256').update(data).digest('hex')===approvedPNG.sha256;}
const findings=[];let checked=0;
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(entry.name))continue;const file=path.join(dir,entry.name);if(blockedParts.has(entry.name)||(/\.(?:bundle|patch|png|jpe?g|mp4|webm)$/i.test(entry.name)&&!exactApprovedPNG(file,entry))||(/^\.env(?:\.|$)/.test(entry.name)&&entry.name!=='.env.example'))findings.push({file,type:'blockedArtifact'});if(entry.isSymbolicLink()){findings.push({file,type:'symlink'});continue;}if(entry.isDirectory()){scan(file);continue;}if(!entry.isFile())continue;checked++;const text=fs.readFileSync(file,'utf8');for(const [type,pattern]of Object.entries(patterns)){if(pattern.test(text))findings.push({file,type});}}}
scan('.');
if(findings.length){console.error(JSON.stringify({checked,findings},null,2));process.exit(1);}
console.log(`Public source heuristic scan: ${checked} files, no credential/private-path/conversation-pattern matches. This does not certify absence of secrets.`);
