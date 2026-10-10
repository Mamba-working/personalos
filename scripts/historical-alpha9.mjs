import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// The oracle is independent of the mutable active candidate and its inventory.
export const ALPHA9_HISTORY = Object.freeze({
  commit: 'a6f7af9ea8bf8ec52e71e424c2d503ee2d8affbd',
  manifest: 'provenance/candidates/alpha9-source-a6f7af9.json',
  manifestSHA256: 'e55bfa1d1e00e6df00981de5a6ce9d607dcc34a3eb2526a6349c6a8a0b2de4a1',
  snapshot: 'provenance/snapshots/alpha9-a6f7af9',
  runtimeSHA256: 'b03d2a5931fc8ab7162395e695a873287e69d8bd52c7b92c1c6ab52ba37181c4'
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const roots = new Map();
export function regularSource(root, relative) {
  assert(relative && !path.isAbsolute(relative) && !relative.includes('\\') && relative.split('/').every(p => p && p !== '.' && p !== '..'), 'Invalid source path: ' + relative);
  const rootStat = fs.lstatSync(root);
  assert(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'Source root must be a regular directory');
  const parts = relative.split('/');
  let file = path.resolve(root);
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part);
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Source symlink: ' + relative);
    assert(index === parts.length - 1 ? stat.isFile() : stat.isDirectory(), 'Source must be a regular file: ' + relative);
  }
  return fs.readFileSync(file);
}
export function alpha9SourceManifest(root) {
  const bytes = regularSource(root, ALPHA9_HISTORY.manifest);
  assert.equal(sha(bytes), ALPHA9_HISTORY.manifestSHA256, 'Frozen alpha.9 source manifest changed');
  return JSON.parse(bytes);
}
function pinnedSource(root, manifest, relative) {
  const entry = [...manifest.files, ...manifest.generatedFiles].find(file => file.path === relative);
  assert(entry, 'Unmapped historical alpha.9 source: ' + relative);
  const location = manifest.snapshots.includes(relative) ? ALPHA9_HISTORY.snapshot + '/' + relative : relative;
  const bytes = regularSource(root, location);
  assert.equal(sha(bytes), entry.sha256, 'Frozen alpha.9 source changed: ' + relative);
  return bytes;
}
export function historicalAlpha9Source(root, relative) {
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.9') return regularSource(root, relative);
  assert.equal(active.productVersion, 'v0.1.0-alpha.10', 'Historical alpha.9 requires an explicit successor');
  return pinnedSource(root, alpha9SourceManifest(root), relative);
}
export function historicalAlpha9Root(root) {
  root = path.resolve(root);
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.9') return root;
  assert.equal(active.productVersion, 'v0.1.0-alpha.10', 'Historical alpha.9 requires an explicit successor');
  const manifest = alpha9SourceManifest(root);
  // Revalidate all original inputs on EVERY call, including after a cached read.
  const originals = manifest.files.map(entry => [entry.path, pinnedSource(root, manifest, entry.path)]);
  const generated = manifest.generatedFiles.map(entry => {
    const bytes = regularSource(root, entry.path);
    assert.equal(sha(bytes), entry.sha256, 'Generated historical source changed: ' + entry.path);
    return [entry.path, bytes];
  });
  if (roots.has(root)) {
    const directory = roots.get(root);
    for (const [relative, bytes] of [...originals, ...generated]) assert.deepEqual(regularSource(directory, relative), bytes, 'Reconstructed historical source changed: ' + relative);
    const actual = [];
    function walk(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes: true})) { if (entry.name === '.git') continue; const file = path.join(dir, entry.name); assert(!entry.isSymbolicLink() && (entry.isDirectory() || entry.isFile()), 'Invalid reconstructed source entry'); if (entry.isDirectory()) walk(file); else actual.push(path.relative(directory, file).split(path.sep).join('/')); } }
    walk(directory);
    assert.deepEqual(actual.sort(), [...originals, ...generated].map(([relative]) => relative).sort(), 'Reconstructed historical path set changed');
    return directory;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personalos-pinned-alpha9-'));
  try {
    for (const [relative, bytes] of [...originals, ...generated]) {
      const target = path.join(directory, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, bytes);
    }
    const git = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {cwd: root, encoding: 'utf8'});
    if (git.status === 0) fs.writeFileSync(path.join(directory, '.git'), 'gitdir: ' + git.stdout.trim() + '\n');
    roots.set(root, directory);
    return directory;
  } catch (error) {
    fs.rmSync(directory, {recursive: true, force: true});
    throw error;
  }
}
process.once('exit', () => { for (const directory of roots.values()) fs.rmSync(directory, {recursive: true, force: true}); });
