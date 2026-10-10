import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// The oracle is independent of the mutable active candidate and its inventory.
export const ALPHA8_HISTORY = Object.freeze({
  commit: 'ba67a75a2d7bc8b29041bec06ce38cef41a25939',
  manifest: 'provenance/candidates/alpha8-source-ba67a75.json',
  manifestSHA256: '15d13fe3721431828782b4a27a7d53d2d57dc61ab8459eeca10e6473b30e40c4',
  snapshot: 'provenance/snapshots/alpha8-ba67a75',
  runtimeSHA256: 'b11366d758eab93517c0d74c07038167b7fedf45ccb71034b577e6c8af0a2d32'
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
export function alpha8SourceManifest(root) {
  const bytes = regularSource(root, ALPHA8_HISTORY.manifest);
  assert.equal(sha(bytes), ALPHA8_HISTORY.manifestSHA256, 'Frozen alpha.8 source manifest changed');
  return JSON.parse(bytes);
}
function pinnedSource(root, manifest, relative) {
  const entry = [...manifest.files, ...manifest.generatedFiles].find(file => file.path === relative);
  assert(entry, 'Unmapped historical alpha.8 source: ' + relative);
  const location = manifest.snapshots.includes(relative) ? ALPHA8_HISTORY.snapshot + '/' + relative : relative;
  const bytes = regularSource(root, location);
  assert.equal(sha(bytes), entry.sha256, 'Frozen alpha.8 source changed: ' + relative);
  return bytes;
}
export function historicalAlpha8Source(root, relative) {
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.8') return regularSource(root, relative);
  assert.equal(active.productVersion, 'v0.1.0-alpha.9', 'Historical alpha.8 requires an explicit successor');
  return pinnedSource(root, alpha8SourceManifest(root), relative);
}
export function historicalAlpha8Root(root) {
  root = path.resolve(root);
  const active = JSON.parse(regularSource(root, 'provenance/active-candidate.json'));
  if (active.productVersion === 'v0.1.0-alpha.8') return root;
  assert.equal(active.productVersion, 'v0.1.0-alpha.9', 'Historical alpha.8 requires an explicit successor');
  const manifest = alpha8SourceManifest(root);
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'personalos-pinned-alpha8-'));
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
