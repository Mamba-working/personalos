import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ALPHA9_HISTORY, alpha9SourceManifest, historicalAlpha9Root, historicalAlpha9Source, regularSource} from './historical-alpha9.mjs';
import {publicSourcePaths} from './check-source-scope.mjs';

export const READER_R5_RELEASE = Object.freeze({
  version: 'v0.1.0-alpha.10',
  revision: 'split-card-reader-r5',
  documentTitle: 'PersonalOS · Motion reader alpha r5',
  inputCommit: '0acb3673c33c9b19f4292fbbcb89e2b1501ee67a',
  inputTree: '2a79bc12fe0817a0b78006cddebb3026b1f43c8f',
  baselineTree: '20427c18a9df8a4c80b230e23d20bf1289dbaab2',
  inputManifest: 'provenance/candidates/reader-r5-0acb367.json',
  inputManifestSHA256: 'c7eaee7247cf2c98f051a73cea823f993b673c42d4c249562319fc57764ac681',
  activeManifestSHA256: '5b43a6a6248efd960ad7f9e0ac6fcfcf5f1383e2ae07d57241cca2c58fa55640',
  sourceList: 'provenance/alpha10-source-files.json',
  sourceListSHA256: '6750e310b99d4fdbedf841d7ec5ef28727441f8b5a7577f47d37a392bca03631',
  changed: Object.freeze(['runtime/app.js', 'runtime/index.html', 'runtime/material.css', 'runtime/release-meta.json'])
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (root, relative) => JSON.parse(regularSource(root, relative));
function pinnedJSON(root, relative, digest, label) {
  const bytes = regularSource(root, relative);
  assert.equal(sha(bytes), digest, label + ' changed');
  return JSON.parse(bytes);
}
export function verifyReaderR5Identity(root) {
  const html = regularSource(root, 'apps/web/runtime/index.html').toString();
  const meta = json(root, 'apps/web/runtime/release-meta.json');
  assert.equal(html.match(/<title>([^<]+)<\/title>/)?.[1], READER_R5_RELEASE.documentTitle, 'Reader r5 document title differs');
  assert.equal(meta.productVersion, READER_R5_RELEASE.version, 'Reader r5 product identity differs');
  assert.equal(meta.readerCandidate.id, READER_R5_RELEASE.revision, 'Reader r5 revision identity differs');
  const oldHTML = historicalAlpha9Source(root, 'apps/web/runtime/index.html').toString();
  const oldTitle = '<title>PersonalOS · Motion reader alpha r4</title>';
  assert.equal(oldHTML.split(oldTitle).length, 2, 'Historical reader title is not unique');
  assert.equal(html, oldHTML.replace(oldTitle, '<title>' + READER_R5_RELEASE.documentTitle + '</title>'), 'Reader r5 HTML changed beyond title metadata');
}
export function verifyReaderR5Boundary(root, current) {
  verifyReaderR5Identity(root);
  const input = pinnedJSON(root, READER_R5_RELEASE.inputManifest, READER_R5_RELEASE.inputManifestSHA256, 'Frozen reader r5 input');
  assert.deepEqual(input.baseline, {commit: ALPHA9_HISTORY.commit, tree: READER_R5_RELEASE.baselineTree});
  assert.deepEqual(input.source, {commit: READER_R5_RELEASE.inputCommit, tree: READER_R5_RELEASE.inputTree, relationship: 'reviewed local implementation delta; not public Git ancestry'});
  for (const [relative, digest] of Object.entries(input.supportingFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Frozen reader r5 supporting source changed: ' + relative);
  const baseline = JSON.parse(historicalAlpha9Source(root, 'provenance/active-candidate.json'));
  assert.equal(baseline.runtimeSHA256, ALPHA9_HISTORY.runtimeSHA256);
  const before = new Map(baseline.files.map(file => [file.path, file.sha256]));
  const after = new Map(current.map(file => [file.path, file.sha256]));
  assert.deepEqual(current.map(file => file.path), baseline.files.map(file => file.path), 'Reader r5 runtime path set differs');
  const changed = [...before.keys()].filter(p => before.get(p) !== after.get(p)).sort();
  assert.deepEqual(changed, READER_R5_RELEASE.changed, 'Reader r5 runtime scope exceeded');
  assert.deepEqual(input.runtimeFiles.map(file => file.path).sort(), READER_R5_RELEASE.changed.filter(p => !['runtime/index.html', 'runtime/release-meta.json'].includes(p)));
  for (const file of input.runtimeFiles) assert.equal(after.get(file.path), file.sha256, 'Frozen reader r5 runtime changed: ' + file.path);
  for (const file of baseline.files) if (!READER_R5_RELEASE.changed.includes(file.path)) assert.equal(after.get(file.path), file.sha256, 'Unchanged alpha.9 runtime drifted: ' + file.path);
  return {input, baseline, changed};
}
export function verifyAlpha10Provenance(root, {current, verifyHistorical, requiredDeferred}) {
  const paths = pinnedJSON(root, READER_R5_RELEASE.sourceList, READER_R5_RELEASE.sourceListSHA256, 'Reviewed alpha.10 source scope');
  assert.deepEqual(publicSourcePaths(root), paths, 'Unexpected alpha.10 public source path');
  const {baseline, changed} = verifyReaderR5Boundary(root, current);
  // Original predecessor code and assertion files execute unchanged through the
  // historical test runner. Here the dispatcher also validates its exact inputs.
  const historical = verifyHistorical(historicalAlpha9Root(root));
  assert.equal(historical.productVersion, 'v0.1.0-alpha.9');
  assert.equal(historical.runtimeSHA256, ALPHA9_HISTORY.runtimeSHA256);
  const active = pinnedJSON(root, 'provenance/active-candidate.json', READER_R5_RELEASE.activeManifestSHA256, 'Reviewed alpha.10 candidate envelope');
  assert.equal(active.schemaVersion, 2);
  assert.equal(active.kind, 'versioned-reader-candidate');
  assert.equal(active.status, 'unpublished-acceptance-pending');
  assert.equal(active.productVersion, READER_R5_RELEASE.version);
  assert.equal(active.revision, READER_R5_RELEASE.revision);
  assert.deepEqual(active.inputSource, {commit: READER_R5_RELEASE.inputCommit, tree: READER_R5_RELEASE.inputTree, relationship: 'reviewed local implementation delta; not public Git ancestry'});
  assert.equal(active.sourcePayloadBinding, 'current-git-commit');
  assert.equal(active.publicGitCommit, null);
  assert.equal(active.publicGitTag, null);
  assert.equal(active.deployed, false);
  assert.equal(active.browserAcceptance, false);
  assert.equal(active.fullUnifiedAcceptance, false);
  assert.deepEqual(active.previousCandidate, {commit: ALPHA9_HISTORY.commit, inventory: ALPHA9_HISTORY.manifest, runtimeSHA256: baseline.runtimeSHA256});
  assert.equal(active.algorithm, baseline.algorithm);
  assert.deepEqual(active.files, current, 'Active alpha.10 runtime inventory differs');
  assert.equal(active.runtimeFileCount, current.length);
  assert.equal(active.runtimeSHA256, sha(JSON.stringify(current)));
  assert.deepEqual(active.runtimeOnlyAllowlist, changed);
  for (const [relative, digest] of Object.entries(active.versionFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Version surface bytes differ: ' + relative);
  for (const [relative, digest] of Object.entries(active.supportingFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Reader supporting source changed: ' + relative);
  const version = READER_R5_RELEASE.version.slice(1), pkg = json(root, 'package.json'), web = json(root, 'apps/web/package.json'), lock = json(root, 'package-lock.json'), meta = json(root, 'apps/web/runtime/release-meta.json');
  for (const value of [pkg.version, web.version, lock.version, lock.packages[''].version, lock.packages['apps/web'].version]) assert.equal(value, version);
  assert.equal(regularSource(root, 'packages/contracts/index.mjs').toString().match(/export const PRODUCT_VERSION = '([^']+)'/)?.[1], version);
  assert.equal(meta.productVersion, READER_R5_RELEASE.version);
  assert.equal(meta.channel, 'alpha');
  assert.equal(meta.fullUnifiedAcceptance, false);
  assert.equal(meta.readerCandidate.id, READER_R5_RELEASE.revision);
  assert.equal(meta.readerCandidate.browserAcceptance, false);
  assert.equal(meta.readerCandidate.deployedByteParity, 'unverified');
  for (const gate of requiredDeferred) assert(meta.deferredGates.includes(gate), 'Deferred gate removed: ' + gate);
  assert.equal(alpha9SourceManifest(root).files.length, 375);
  return {kind: active.kind, productVersion: active.productVersion, revision: active.revision, runtimeFiles: current.length, runtimeSHA256: active.runtimeSHA256, historicalRuntimeSHA256: historical.runtimeSHA256, sourcePayloadBinding: active.sourcePayloadBinding, browserAcceptance: false};
}
