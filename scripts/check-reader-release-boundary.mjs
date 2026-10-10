import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ALPHA7_HISTORY, alpha7SourceManifest, historicalAlpha7Root, historicalAlpha7Source, regularSource} from './historical-alpha7.mjs';
import {publicSourcePaths} from './check-source-scope.mjs';

export const READER_RELEASE = Object.freeze({
  version: 'v0.1.0-alpha.8',
  revision: 'split-card-reader-r3',
  inputCommit: '649023a02beefc1d94ca43e191602da64a75abd4',
  inputTree: 'b309f593050f9136a42a530b2b2db4def2a277d4',
  inputManifest: 'provenance/card-reader-candidate.json',
  inputManifestSHA256: '7a0f21c2730189d4b906bda90f1bcd76647d58597c023e5bf5e0f015a4ffdcef',
  activeManifestSHA256: '56726616febe205e57847e92218dbe0bc937ac83287331b8f86f874904b591a6',
  sourceList: 'provenance/alpha8-source-files.json',
  sourceListSHA256: '05ad5eda152de7e332a2c969722392253370a4f30749ce3c2719760be8c7cf44',
  changed: Object.freeze(['runtime/app.js', 'runtime/card-projection.css', 'runtime/card-projection.js', 'runtime/chat-host.js', 'runtime/index.html', 'runtime/release-meta.json', 'runtime/vendor/motion/NOTICE.md'])
});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (root, relative) => JSON.parse(regularSource(root, relative));
function pinnedJSON(root, relative, digest, label) {
  const bytes = regularSource(root, relative);
  assert.equal(sha(bytes), digest, label + ' changed');
  return JSON.parse(bytes);
}
export function verifyReaderBoundary(root, current) {
  const input = pinnedJSON(root, READER_RELEASE.inputManifest, READER_RELEASE.inputManifestSHA256, 'Frozen reader r3 input');
  for (const [relative, digest] of Object.entries(input.supportingFiles)) {
    if (['scripts/check-card-reader-candidate.mjs', 'scripts/test-card-reader-candidate.mjs'].includes(relative)) continue;
    assert.equal(sha(regularSource(root, relative)), digest, 'Frozen reader r3 supporting source changed: ' + relative);
  }
  const baseline = JSON.parse(historicalAlpha7Source(root, 'provenance/active-candidate.json'));
  assert.equal(baseline.runtimeSHA256, ALPHA7_HISTORY.runtimeSHA256);
  assert.equal(input.baselineGitHubCommit, ALPHA7_HISTORY.commit);
  assert.equal(input.baselineRuntimeSHA256, baseline.runtimeSHA256);
  const before = new Map(baseline.files.map(file => [file.path, file.sha256]));
  const after = new Map(current.map(file => [file.path, file.sha256]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(p => before.get(p) !== after.get(p)).sort();
  assert.deepEqual(changed, READER_RELEASE.changed, 'Reader runtime scope exceeded');
  assert.deepEqual(current.map(file => file.path), input.files.map(file => file.path), 'Reader runtime path set differs');
  // r3 implementation is frozen; only this successor's version disclosure differs.
  for (const file of input.files) if (file.path !== 'runtime/release-meta.json') assert.equal(after.get(file.path), file.sha256, 'Frozen reader r3 runtime changed: ' + file.path);
  const chat = regularSource(root, 'apps/web/runtime/chat-host.js').toString();
  assert.equal(chat.split(input.chatHistoryGate).length - 1, 1, 'Exact chat history hook must occur once');
  assert.equal(sha(chat.replace(input.chatHistoryGate, '')), before.get('runtime/chat-host.js'), 'Chat changes exceed the reviewed history hook');
  return {input, baseline, changed};
}
export function verifyAlpha8Provenance(root, {current, verifyHistorical, requiredDeferred}) {
  const paths = pinnedJSON(root, READER_RELEASE.sourceList, READER_RELEASE.sourceListSHA256, 'Reviewed alpha.8 source scope');
  assert.deepEqual(publicSourcePaths(root), paths, 'Unexpected alpha.8 public source path');
  const {input, baseline, changed} = verifyReaderBoundary(root, current);
  // Validate the original envelope against authenticated original inputs, then
  // enforce the successor. The original verifier/tests themselves also execute
  // unchanged through test-release-provenance.mjs in the normal aggregate.
  const historical = verifyHistorical(historicalAlpha7Root(root));
  assert.equal(historical.productVersion, 'v0.1.0-alpha.7');
  assert.equal(historical.runtimeSHA256, ALPHA7_HISTORY.runtimeSHA256);
  const active = pinnedJSON(root, 'provenance/active-candidate.json', READER_RELEASE.activeManifestSHA256, 'Reviewed alpha.8 candidate envelope');
  assert.equal(active.schemaVersion, 2);
  assert.equal(active.kind, 'versioned-reader-candidate');
  assert.equal(active.status, 'unpublished-acceptance-pending');
  assert.equal(active.productVersion, READER_RELEASE.version);
  assert.equal(active.revision, READER_RELEASE.revision);
  assert.deepEqual(active.inputSource, {commit: READER_RELEASE.inputCommit, tree: READER_RELEASE.inputTree, relationship: 'public r3 input; new candidate metadata is separate'});
  assert.equal(active.sourcePayloadBinding, 'current-git-commit');
  assert.equal(active.publicGitCommit, null);
  assert.equal(active.publicGitTag, null);
  assert.equal(active.deployed, false);
  assert.equal(active.browserAcceptance, false);
  assert.equal(active.fullUnifiedAcceptance, false);
  assert.deepEqual(active.previousCandidate, {commit: ALPHA7_HISTORY.commit, inventory: ALPHA7_HISTORY.manifest, runtimeSHA256: baseline.runtimeSHA256});
  assert.equal(active.algorithm, baseline.algorithm);
  assert.deepEqual(active.files, current, 'Active alpha.8 runtime inventory differs');
  assert.equal(active.runtimeFileCount, current.length);
  assert.equal(active.runtimeSHA256, sha(JSON.stringify(current)));
  assert.deepEqual(active.runtimeOnlyAllowlist, changed);
  for (const [relative, digest] of Object.entries(active.versionFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Version surface bytes differ: ' + relative);
  for (const [relative, digest] of Object.entries(active.supportingFiles)) assert.equal(sha(regularSource(root, relative)), digest, 'Reader supporting source changed: ' + relative);
  const version = READER_RELEASE.version.slice(1), pkg = json(root, 'package.json'), web = json(root, 'apps/web/package.json'), lock = json(root, 'package-lock.json'), meta = json(root, 'apps/web/runtime/release-meta.json');
  for (const value of [pkg.version, web.version, lock.version, lock.packages[''].version, lock.packages['apps/web'].version]) assert.equal(value, version);
  assert.equal(regularSource(root, 'packages/contracts/index.mjs').toString().match(/export const PRODUCT_VERSION = '([^']+)'/)?.[1], version);
  assert.equal(meta.productVersion, READER_RELEASE.version);
  assert.equal(meta.channel, 'alpha');
  assert.equal(meta.fullUnifiedAcceptance, false);
  assert.equal(meta.readerCandidate.id, READER_RELEASE.revision);
  assert.equal(meta.readerCandidate.browserAcceptance, false);
  assert.equal(meta.readerCandidate.deployedByteParity, 'unverified');
  for (const gate of requiredDeferred) assert(meta.deferredGates.includes(gate), 'Deferred gate removed: ' + gate);
  assert.deepEqual(input.runtimeAllowlist, READER_RELEASE.changed);
  assert.equal(alpha7SourceManifest(root).files.length, 310);
  return {kind: active.kind, productVersion: active.productVersion, revision: active.revision, runtimeFiles: current.length, runtimeSHA256: active.runtimeSHA256, historicalRuntimeSHA256: historical.runtimeSHA256, sourcePayloadBinding: active.sourcePayloadBinding, browserAcceptance: false};
}
