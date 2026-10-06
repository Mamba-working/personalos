import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repository=fileURLToPath(new URL('../',import.meta.url));
const supportedSources=new Set(['build/three.core.js','build/three.module.js']);
const supportedDestinations=new Set([
  'apps/web/runtime/world/vendor/three/three.core.js',
  'apps/web/runtime/world/vendor/three/three.module.js',
  'apps/web/tests/integration/fixtures/accepted-baseline/world/vendor/three/three.core.js',
  'apps/web/tests/integration/fixtures/accepted-baseline/world/vendor/three/three.module.js',
]);
const digest=data=>createHash('sha256').update(data).digest('hex');
async function readOrMissing(file){try{return await readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function materializeVendor({root=repository,checkOnly=false}={}) {
  const manifest=JSON.parse(await readFile(path.join(root,'provenance/vendor-dependencies.json'),'utf8'));
  if(manifest.schemaVersion!==1||manifest.package.name!=='three'||manifest.package.version!=='0.180.0')throw new Error('Unsupported vendor dependency manifest');
  const pkgRoot=path.join(root,'node_modules/three');
  const pkgBytes=await readOrMissing(path.join(pkgRoot,'package.json'));
  if(!pkgBytes)throw new Error('Pinned Three.js package is missing. Run npm ci --ignore-scripts --no-audit --no-fund, then npm run setup:vendor');
  const pkg=JSON.parse(pkgBytes.toString('utf8'));
  if(pkg.version!==manifest.package.version)throw new Error(`Three.js version mismatch: expected ${manifest.package.version}`);
  const plans=[],destinations=new Set();
  for(const entry of manifest.sources){
    if(!supportedSources.has(entry.packagePath)||!/^[0-9a-f]{64}$/.test(entry.sha256))throw new Error('Unsupported vendor source');
    const data=await readFile(path.join(pkgRoot,entry.packagePath));
    if(data.length!==entry.bytes||digest(data)!==entry.sha256)throw new Error(`Official dependency bytes differ: ${entry.packagePath}; refusing approximate substitution`);
    for(const destination of entry.destinations){
      if(!supportedDestinations.has(destination)||destinations.has(destination))throw new Error('Unsupported or duplicate vendor destination');
      destinations.add(destination);const current=await readOrMissing(path.join(root,destination));
      if(current&&digest(current)!==entry.sha256)throw new Error(`Generated dependency differs: ${destination}; review/remove this generated file before rebuilding`);
      if(checkOnly&&!current)throw new Error(`Generated dependency is missing: ${destination}. Run npm run setup:vendor before checking/testing/serving the web app`);
      plans.push({destination,data,alreadyPresent:!!current});
    }
  }
  if(destinations.size!==supportedDestinations.size)throw new Error('Expected all four exact vendor destinations');
  // Validate every package file/destination before writing anything.
  if(!checkOnly)for(const plan of plans){if(plan.alreadyPresent)continue;const output=path.join(root,plan.destination);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,plan.data,{flag:'wx'});}
  for(const plan of plans)if(digest(await readFile(path.join(root,plan.destination)))!==digest(plan.data))throw new Error('Vendor reconstruction verification failed');
  return {package:'three',version:pkg.version,files:plans.length,created:checkOnly?0:plans.filter(plan=>!plan.alreadyPresent).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const result=await materializeVendor({checkOnly:process.argv.includes('--check')});console.log(`Exact Three.js ${result.version}: ${result.files} generated paths verified, ${result.created} created`);}catch(error){console.error(error.message);process.exitCode=1;}
}
