import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ALPHA8_HISTORY, alpha8SourceManifest, historicalAlpha8Root, historicalAlpha8Source, regularSource} from './historical-alpha8.mjs';
import {publicSourcePaths} from './check-source-scope.mjs';

export const READER_R4_RELEASE = Object.freeze({
  version: 'v0.1.0-alpha.9',
  revision: 'split-card-reader-r4',
  documentTitle: 'PersonalOS · Motion reader alpha r4',
  inputCommit: 'fc1e7d9b00540fcd8a77fed66b645578a580c767',
  inputTree: 'ac393f61dfb6fb53b0d35e8361ee7461b6daef4d',
  baselineTree: 'cdfa952c2283b22028e85142cbe169d28bf5ee7b',
  inputManifest: 'provenance/candidates/reader-r4-fc1e7d9.json',
  inputManifestSHA256: '1ce50cd988dd88875145b03ff820f89c8ce0fe673740c3a887967e8474b27bcd',
  activeManifestSHA256: '91d1ac84cf2935176a968d71cfe554895f350636fd3157b37b9cfd08fd77c6ae',
  sourceList: 'provenance/alpha9-source-files.json',
  sourceListSHA256: '1c7822ed927ff3e88b37d6a220dd2472d8101d57e31ed611c6cbc593b131f43d',
  changed: Object.freeze(['runtime/app.js', 'runtime/card-projection.css', 'runtime/card-projection.js', 'runtime/index.html', 'runtime/release-meta.json'])
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (root, relative) => JSON.parse(regularSource(root, relative));
function pinnedJSON(root, relative, digest, label) {
  const bytes = regularSource(root, relative);
  assert.equal(sha(bytes), digest, label + ' changed');
  return JSON.parse(bytes);
}
export function verifyReaderR4Identity(root) {
  const html = regularSource(root, 'apps/web/runtime/index.html').toString();
  const meta = json(root, 'apps/web/runtime/release-meta.json');
  assert.equal(html.match(/<title>([^<]+)<\/title>/)?.[1], READER_R4_RELEASE.documentTitle, 'Reader r4 document title differs');
  assert.equal(meta.productVersion, READER_R4_RELEASE.version, 'Reader r4 product identity differs');
  assert.equal(meta.readerCandidate.id, READER_R4_RELEASE.revision, 'Reader r4 revision identity differs');
  const oldHTML = historicalAlpha8Source(root, 'apps/web/runtime/index.html').toString();
  const oldTitle = '<title>PersonalOS · Motion reader alpha r3</title>';
  assert.equal(oldHTML.split(oldTitle).length, 2, 'Historical reader title is not unique');
  assert.equal(html, oldHTML.replace(oldTitle, '<title>' + READER_R4_RELEASE.documentTitle + '</title>'), 'Reader r4 HTML changed beyond title metadata');
}
export function verifyReaderR4Boundary(root, current) {
  verifyReaderR4Identity(root);
  const input = pinnedJSON(root, READER_R4_RELEASE.inputManifest, READER_R4_RELEASE.inputManifestSHA256, 'Frozen reader r4 input');
  assert.deepEqual(input.baseline, {commit: ALPHA8_HISTORY.commit, tree: READER_R4_RELEASE.baselineTree});
  assert.deepEqual(input.source, {commit: READER_R4_RELEASE.inputCommit, tree: READER_R4_RELEASE.inputTree, relationship: 'reviewed local implementation delta; not public Git ancestry'});
  for (const [relative, digest] of Object.entries(input.supportingFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Frozen reader r4 supporting source changed: ' + relative);
  const baseline = JSON.parse(historicalAlpha8Source(root, 'provenance/active-candidate.json'));
  assert.equal(baseline.runtimeSHA256, ALPHA8_HISTORY.runtimeSHA256);
  const before = new Map(baseline.files.map(file => [file.path, file.sha256]));
  const after = new Map(current.map(file => [file.path, file.sha256]));
  assert.deepEqual(current.map(file => file.path), baseline.files.map(file => file.path), 'Reader r4 runtime path set differs');
  const changed = [...before.keys()].filter(p => before.get(p) !== after.get(p)).sort();
  assert.deepEqual(changed, READER_R4_RELEASE.changed, 'Reader r4 runtime scope exceeded');
  assert.deepEqual(input.runtimeFiles.map(file => file.path).sort(), READER_R4_RELEASE.changed.filter(p => !['runtime/index.html', 'runtime/release-meta.json'].includes(p)));
  for (const file of input.runtimeFiles) assert.equal(after.get(file.path), file.sha256, 'Frozen reader r4 runtime changed: ' + file.path);
  for (const file of baseline.files) if (!READER_R4_RELEASE.changed.includes(file.path)) assert.equal(after.get(file.path), file.sha256, 'Unchanged alpha.8 runtime drifted: ' + file.path);
  return {input, baseline, changed};
}
export function verifyAlpha9Provenance(root, {current, verifyHistorical, requiredDeferred}) {
  const paths = pinnedJSON(root, READER_R4_RELEASE.sourceList, READER_R4_RELEASE.sourceListSHA256, 'Reviewed alpha.9 source scope');
  assert.deepEqual(publicSourcePaths(root), paths, 'Unexpected alpha.9 public source path');
  const {baseline, changed} = verifyReaderR4Boundary(root, current);
  // Original predecessor code and assertion files execute unchanged through the
  // historical test runner. Here the dispatcher also validates its exact inputs.
  const historical = verifyHistorical(historicalAlpha8Root(root));
  assert.equal(historical.productVersion, 'v0.1.0-alpha.8');
  assert.equal(historical.runtimeSHA256, ALPHA8_HISTORY.runtimeSHA256);
  const active = pinnedJSON(root, 'provenance/active-candidate.json', READER_R4_RELEASE.activeManifestSHA256, 'Reviewed alpha.9 candidate envelope');
  assert.equal(active.schemaVersion, 2);
  assert.equal(active.kind, 'versioned-reader-candidate');
  assert.equal(active.status, 'unpublished-acceptance-pending');
  assert.equal(active.productVersion, READER_R4_RELEASE.version);
  assert.equal(active.revision, READER_R4_RELEASE.revision);
  assert.deepEqual(active.inputSource, {commit: READER_R4_RELEASE.inputCommit, tree: READER_R4_RELEASE.inputTree, relationship: 'reviewed local implementation delta; not public Git ancestry'});
  assert.equal(active.sourcePayloadBinding, 'current-git-commit');
  assert.equal(active.publicGitCommit, null);
  assert.equal(active.publicGitTag, null);
  assert.equal(active.deployed, false);
  assert.equal(active.browserAcceptance, false);
  assert.equal(active.fullUnifiedAcceptance, false);
  assert.deepEqual(active.previousCandidate, {commit: ALPHA8_HISTORY.commit, inventory: ALPHA8_HISTORY.manifest, runtimeSHA256: baseline.runtimeSHA256});
  assert.equal(active.algorithm, baseline.algorithm);
  assert.deepEqual(active.files, current, 'Active alpha.9 runtime inventory differs');
  assert.equal(active.runtimeFileCount, current.length);
  assert.equal(active.runtimeSHA256, sha(JSON.stringify(current)));
  assert.deepEqual(active.runtimeOnlyAllowlist, changed);
  for (const [relative, digest] of Object.entries(active.versionFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Version surface bytes differ: ' + relative);
  for (const [relative, digest] of Object.entries(active.supportingFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Reader supporting source changed: ' + relative);
  const version = READER_R4_RELEASE.version.slice(1), pkg = json(root, 'package.json'), web = json(root, 'apps/web/package.json'), lock = json(root, 'package-lock.json'), meta = json(root, 'apps/web/runtime/release-meta.json');
  for (const value of [pkg.version, web.version, lock.version, lock.packages[''].version, lock.packages['apps/web'].version]) assert.equal(value, version);
  assert.equal(regularSource(root, 'packages/contracts/index.mjs').toString().match(/export const PRODUCT_VERSION = '([^']+)'/)?.[1], version);
  assert.equal(meta.productVersion, READER_R4_RELEASE.version);
  assert.equal(meta.channel, 'alpha');
  assert.equal(meta.fullUnifiedAcceptance, false);
  assert.equal(meta.readerCandidate.id, READER_R4_RELEASE.revision);
  assert.equal(meta.readerCandidate.browserAcceptance, false);
  assert.equal(meta.readerCandidate.deployedByteParity, 'unverified');
  for (const gate of requiredDeferred) assert(meta.deferredGates.includes(gate), 'Deferred gate removed: ' + gate);
  assert.equal(alpha8SourceManifest(root).files.length, 348);
  return {kind: active.kind, productVersion: active.productVersion, revision: active.revision, runtimeFiles: current.length, runtimeSHA256: active.runtimeSHA256, historicalRuntimeSHA256: historical.runtimeSHA256, sourcePayloadBinding: active.sourcePayloadBinding, browserAcceptance: false};
}
