import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {historicalAlpha8Root} from './historical-alpha8.mjs';

// The oracle is independent of the mutable active candidate and its inventory.
export const ALPHA7_HISTORY = Object.freeze({
  commit: '15a5967b775dec5e1224c224a5e36f07ddbbb76b',
  manifest: 'provenance/candidates/alpha7-source-15a5967.json',
  manifestSHA256: 'fdc3867354324c20562fb05e9b5f76997b6b9b0516b8810d8c5bbf94fe649a3d',
  snapshot: 'provenance/snapshots/alpha7-15a5967',
  runtimeSHA256: '64922db578b6ab8fb8f40250c9156e957a02e386f56803625f5ebc19389072ad'
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
export function alpha7SourceManifest(root) {
  const bytes = regularSource(root, ALPHA7_HISTORY.manifest);
  assert.equal(sha(bytes), ALPHA7_HISTORY.manifestSHA256, 'Frozen alpha.7 source manifest changed');
  return JSON.parse(bytes);
}
function pinnedSource(root, manifest, relative) {
  const entry = [...manifest.files, ...manifest.generatedFiles].find(file => file.path === relative);
  assert(entry, 'Unmapped historical alpha.7 source: ' + relative);
  const location = manifest.snapshots.includes(relative) ? ALPHA7_HISTORY.snapshot + '/' + relative : relative;
  const bytes = regularSource(root, location);
  assert.equal(sha(bytes), entry.sha256, 'Frozen alpha.7 source changed: ' + relative);
  return bytes;
}
export function historicalAlpha7Source(root, relative) {
  if (JSON.parse(regularSource(root, 'provenance/active-candidate.json')).productVersion === 'v0.1.0-alpha.9') return historicalAlpha7Source(historicalAlpha8Root(root), relative);
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.7') return regularSource(root, relative);
  assert.equal(active.productVersion, 'v0.1.0-alpha.8', 'Historical alpha.7 requires an explicit successor');
  return pinnedSource(root, alpha7SourceManifest(root), relative);
}
export function historicalAlpha7Root(root) {
  if (JSON.parse(regularSource(root, 'provenance/active-candidate.json')).productVersion === 'v0.1.0-alpha.9') return historicalAlpha7Root(historicalAlpha8Root(root));
  root = path.resolve(root);
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.7') return root;
  assert.equal(active.productVersion, 'v0.1.0-alpha.8', 'Historical alpha.7 requires an explicit successor');
  const manifest = alpha7SourceManifest(root);
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personalos-pinned-alpha7-'));
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
