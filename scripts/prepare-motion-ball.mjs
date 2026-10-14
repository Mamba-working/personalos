import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = path.join(root, 'modules/motion-ball');
const stage = path.join(root, '.build/motion-ball');
mkdirSync(stage, { recursive: true });
// Effective source must remain exactly upstream; remove withdrawn overlay files.
rmSync(path.join(stage, 'src'), { recursive: true, force: true });
cpSync(original, stage, { recursive: true, filter: p => !p.includes('/node_modules') && !p.includes('/dist-lib') && !p.endsWith('/SOURCE-PROVENANCE.json') });
// Cloud-only build mirror. Upstream lock/source remain byte-identical. npm verifies
// each original integrity value; only the private-company registry endpoint changes.
const lockPath = path.join(stage, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
let mirrored = 0;
for (const p of Object.values(lock.packages)) {
  const prefix = 'https://artifactory.release.ctripcorp.com/artifactory/api/npm/trip-npm-prod/';
  if (p.resolved?.startsWith(prefix)) { p.resolved = 'https://registry.npmjs.org/' + p.resolved.slice(prefix.length); mirrored++; }
}
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log(JSON.stringify({ stage, mirrored, upstreamSourceUnchanged: true }));
