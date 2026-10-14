import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'apps/web/runtime');
const input = path.join(root, '.build/motion-ball');
const bridge = path.join(root, 'integrations/motion-ball');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// Current native shell is canonical source, not a deleted historical 3D page.
rmSync(target,{recursive:true,force:true});
cpSync(path.join(root,'integrations/native-shell'),target,{recursive:true});
for (const [from, to] of [['host.js','host.js'],['host.css','host.css'],['motion-scene.js','modules/motion-scene.js'],['weather.js','modules/weather.js'],['mount.js','modules/mount.js']]) cpSync(path.join(bridge,from),path.join(target,to));
// Native card layout has its own canonical source, independent of 3D adapters.
cpSync(path.join(root,'integrations/native-card/app.js'),path.join(target,'app.js'));
mkdirSync(path.join(target,'native-card'),{recursive:true});
for(const file of ['layout.js','reader.css']) cpSync(path.join(root,'integrations/native-card',file),path.join(target,'native-card',file));
const motion = path.join(target,'motion'); rmSync(motion,{recursive:true,force:true}); mkdirSync(motion,{recursive:true});
for (const file of readdirSync(path.join(input,'dist-lib'))) if (file.endsWith('.js')) cpSync(path.join(input,'dist-lib',file),path.join(motion,file));
cpSync(path.join(root,'modules/motion-ball/public'),path.join(motion,'assets'),{recursive:true,filter:p=>!path.basename(p).startsWith('.')});
const three = path.join(input,'node_modules/three');
const version = JSON.parse(readFileSync(path.join(three,'package.json'),'utf8')).version;
if (version !== '0.186.1') throw new Error('Incorrect Three peer: '+version);
const vendor = path.join(motion,'vendor/three'); mkdirSync(vendor,{recursive:true});
for (const file of ['three.module.js','three.core.js']) cpSync(path.join(three,'build',file),path.join(vendor,file));
cpSync(path.join(three,'LICENSE'),path.join(vendor,'LICENSE'));
const jsm = path.join(three,'examples/jsm'), queued = [], copied = new Set();
const imports = text => [...text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(x=>x[1]);
for (const file of readdirSync(motion)) if (file.endsWith('.js')) for (const ref of imports(readFileSync(path.join(motion,file),'utf8'))) if (ref.startsWith('three/addons/')) queued.push(ref.slice(13));
while (queued.length) {
  const relative = queued.pop(); if (copied.has(relative)) continue;
  const source = path.join(jsm,relative); if (!source.startsWith(jsm+path.sep)||!existsSync(source)) throw new Error('Missing Three addon '+relative);
  const destination = path.join(vendor,'addons',relative); mkdirSync(path.dirname(destination),{recursive:true}); cpSync(source,destination); copied.add(relative);
  for (const ref of imports(readFileSync(source,'utf8'))) if (ref.startsWith('.')) queued.push(path.posix.normalize(path.posix.join(path.posix.dirname(relative),ref)));
}
const metadata={product:'PersonalOS',productVersion:'v0.1.0-alpha.8',channel:'alpha',reviewLabel:'Public-API-only motion-ball integration preview; real GPU acceptance pending',fullUnifiedAcceptance:false,
 source:{siteVersion:117,siteCommit:'995f664cec19a6214aec3a069b90ef3032535788',motionBallCommit:'957cec0acf327ef5a79f754c94b70142792b0133',three:version},
 limitations:['CPU/source/build checks are separate from real GPU, pixels, normal-speed motion and physical-device acceptance','Native chat is a local demonstration, not connected to AI','WeatherProvider currently loads asynchronous mock data, without network or geolocation','Original upstream module is used without internal patches; one scene per page, no in-page re-instantiation','Old renderer/story/actor placement removed; native chat uses its own stable DOM button']};
writeFileSync(path.join(target,'release-meta.json'),JSON.stringify(metadata,null,2)+'\n');
const files=[]; function walk(dir){for(const name of readdirSync(dir)){const p=path.join(dir,name);if(name.startsWith('.'))continue;try{const b=readFileSync(p);files.push({path:path.relative(target,p),bytes:b.length,sha256:sha256(b)});}catch(error){if(error.code==='EISDIR')walk(p);else throw error;}}} walk(target);
writeFileSync(path.join(root,'.build/alpha8-runtime-manifest.json'),JSON.stringify({source:metadata.source,files},null,2)+'\n');
console.log(JSON.stringify({target,three:version,addons:copied.size,files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),legacyRendererRemoved:true}));
