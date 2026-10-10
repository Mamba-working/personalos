import test from 'node:test';
import {startApi} from '../apps/api/src/server.mjs';
import {startStatic} from '../apps/web/dev-server.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyProvenance, verifySourcePayload, runtimeInventory, VERSION_FILES} from './check-provenance.mjs';
import {verifyReaderBoundary, READER_RELEASE} from './check-reader-release-boundary.mjs';
import {ALPHA7_HISTORY, alpha7SourceManifest, historicalAlpha7Root, historicalAlpha7Source, regularSource} from './historical-alpha7.mjs';
import {publicSourcePaths} from './check-source-scope.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (dir, relative) => JSON.parse(fs.readFileSync(path.join(dir, relative)));
const edit = (dir, relative, fn) => { const value = json(dir, relative); fn(value); fs.writeFileSync(path.join(dir, relative), JSON.stringify(value, null, 2) + '\n'); };
const append = (dir, relative) => fs.appendFileSync(path.join(dir, relative), '\n// unauthorized change');
function resign(dir) {
  const files = runtimeInventory(dir);
  edit(dir, 'provenance/active-candidate.json', active => { active.files = files; active.runtimeFileCount = files.length; active.runtimeSHA256 = sha(JSON.stringify(files)); });
}
function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personalos-alpha8-negative-'));
  try {
    const generated = alpha7SourceManifest(root).generatedFiles.map(file => file.path);
    for (const relative of [...publicSourcePaths(root), ...generated]) {
      fs.mkdirSync(path.dirname(path.join(dir, relative)), {recursive: true});
      fs.copyFileSync(path.join(root, relative), path.join(dir, relative));
    }
    return fn(dir);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}

test('alpha.8 independently verifies 73 current files and authenticated alpha.7 history', () => {
  const proof = verifyProvenance(root);
  assert.equal(proof.productVersion, 'v0.1.0-alpha.8');
  assert.equal(proof.runtimeFiles, 73);
  assert.equal(proof.browserAcceptance, false);
  assert.equal(proof.historicalRuntimeSHA256, '64922db578b6ab8fb8f40250c9156e957a02e386f56803625f5ebc19389072ad');
  assert.deepEqual(verifyReaderBoundary(root, runtimeInventory(root)).changed, READER_RELEASE.changed);
});

test('every active r3 implementation and asset byte is frozen; only version disclosure changes', () => {
  const input = json(root, READER_RELEASE.inputManifest), active = runtimeInventory(root);
  assert.deepEqual(active.filter(file => file.path !== 'runtime/release-meta.json'), input.files.filter(file => file.path !== 'runtime/release-meta.json'));
  assert.equal(sha(fs.readFileSync(path.join(root, READER_RELEASE.inputManifest))), '7a0f21c2730189d4b906bda90f1bcd76647d58597c023e5bf5e0f015a4ffdcef');
});

test('historical reconstruction authenticates all 310 original paths and unchanged original tests', () => {
  const prior = historicalAlpha7Root(root), manifest = alpha7SourceManifest(root);
  assert.equal(manifest.files.length, 310);
  assert.deepEqual(publicSourcePaths(prior), manifest.files.map(file => file.path));
  for (const file of manifest.files) assert.equal(sha(regularSource(prior, file.path)), file.sha256, file.path);
  assert.equal(json(prior, 'provenance/active-candidate.json').productVersion, 'v0.1.0-alpha.7');
  for (const file of ['scripts/check-provenance.test.mjs', 'scripts/check-weather-elapsed-boundary.test.mjs']) assert.deepEqual(regularSource(root, file), regularSource(prior, file));
  assert.equal(verifyProvenance(prior).runtimeSHA256, ALPHA7_HISTORY.runtimeSHA256);
});

for (const relative of ['app.js', 'card-projection.js', 'card-projection.css', 'chat-host.js', 'index.html', 'modules/weather.js', 'world/scene.js', 'world/shadow-cache.js', 'world/vendor/three/three.core.js', 'vendor/motion/NOTICE.md']) {
  test(`active runtime mutation ${relative} fails even with inventory/count/digest re-signing`, () => fixture(dir => {
    append(dir, 'apps/web/runtime/' + relative); resign(dir);
    assert.throws(() => verifyReaderBoundary(dir, runtimeInventory(dir)), /Frozen reader r3 runtime changed|Reader runtime scope exceeded/);
    assert.throws(() => verifyProvenance(dir));
  }));
}
for (const mutation of ['extra', 'removed', 'leaf-symlink', 'directory-symlink', 'special-file']) test(`active runtime ${mutation} is rejected`, () => fixture(dir => {
  const runtime = path.join(dir, 'apps/web/runtime');
  if (mutation === 'extra') fs.writeFileSync(path.join(runtime, 'unapproved.js'), '');
  if (mutation === 'removed') fs.unlinkSync(path.join(runtime, 'card-projection.js'));
  if (mutation === 'leaf-symlink') { fs.unlinkSync(path.join(runtime, 'card-projection.js')); fs.symlinkSync('app.js', path.join(runtime, 'card-projection.js')); }
  if (mutation === 'directory-symlink') { fs.renameSync(path.join(runtime, 'vendor/motion'), path.join(dir, 'motion-original')); fs.symlinkSync(path.join(dir, 'motion-original'), path.join(runtime, 'vendor/motion')); }
  if (mutation === 'special-file') assert.equal(spawnSync('mkfifo', [path.join(runtime, 'unexpected.pipe')]).status, 0);
  if (['extra', 'removed'].includes(mutation)) resign(dir);
  assert.throws(() => verifyProvenance(dir));
}));
for (const mutation of ['missing-entry', 'extra-entry', 'duplicate-entry', 'reordered', 'digest', 'count', 'allowlist', 'source-commit', 'source-tree', 'payload-binding', 'predecessor', 'unsupported-version', 'public-commit', 'public-tag', 'deployed', 'acceptance', 'historical-pin']) test(`candidate ${mutation} cannot reauthorize itself`, () => fixture(dir => {
  edit(dir, 'provenance/active-candidate.json', active => {
    if (mutation === 'missing-entry') active.files.pop();
    if (mutation === 'extra-entry') active.files.push({path: 'runtime/unapproved.js', sha256: '0'.repeat(64)});
    if (mutation === 'duplicate-entry') active.files.push(active.files[0]);
    if (mutation === 'reordered') active.files.reverse();
    if (mutation === 'digest') active.runtimeSHA256 = '0'.repeat(64);
    if (mutation === 'count') active.runtimeFileCount++;
    if (mutation === 'allowlist') active.runtimeOnlyAllowlist.push('runtime/host.js');
    if (mutation === 'source-commit') active.inputSource.commit = '1'.repeat(40);
    if (mutation === 'source-tree') active.inputSource.tree = '1'.repeat(40);
    if (mutation === 'payload-binding') active.sourcePayloadBinding = 'inherited-alpha7-commit';
    if (mutation === 'predecessor') active.previousCandidate.commit = '1'.repeat(40);
    if (mutation === 'unsupported-version') active.productVersion = 'v0.1.0-alpha.9';
    if (mutation === 'public-commit') active.publicGitCommit = '1'.repeat(40);
    if (mutation === 'public-tag') active.publicGitTag = 'v0.1.0-alpha.8';
    if (mutation === 'deployed') active.deployed = true;
    if (mutation === 'acceptance') active.fullUnifiedAcceptance = true;
    if (mutation === 'historical-pin') active.previousCandidate.runtimeSHA256 = '0'.repeat(64);
  });
  assert.throws(() => verifyProvenance(dir));
}));
for (const relative of VERSION_FILES) for (const mode of ['version-drift', 'same-version-extra-bytes']) test(`${relative} ${mode} cannot be concealed by re-signing`, () => fixture(dir => {
  const file = path.join(dir, relative), original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, mode === 'version-drift' ? original.replaceAll('0.1.0-alpha.8', '0.1.0-alpha.7') : original + '\n');
  resign(dir);
  assert.throws(() => verifyProvenance(dir));
}));
for (const mutation of ['full-acceptance', 'remove-gate', 'browser-acceptance', 'deployment-parity']) test(`release disclosure ${mutation} remains rejected after re-signing`, () => fixture(dir => {
  edit(dir, 'apps/web/runtime/release-meta.json', meta => {
    if (mutation === 'full-acceptance') meta.fullUnifiedAcceptance = true;
    if (mutation === 'remove-gate') meta.deferredGates.pop();
    if (mutation === 'browser-acceptance') meta.readerCandidate.browserAcceptance = true;
    if (mutation === 'deployment-parity') meta.readerCandidate.deployedByteParity = 'verified';
  }); resign(dir);
  assert.throws(() => verifyProvenance(dir));
}));
for (const relative of [ALPHA7_HISTORY.manifest, ALPHA7_HISTORY.snapshot + '/provenance/active-candidate.json', ALPHA7_HISTORY.snapshot + '/apps/web/runtime/app.js', ALPHA7_HISTORY.snapshot + '/scripts/check-provenance.mjs', 'scripts/check-weather-elapsed-boundary.test.mjs', 'apps/web/runtime/host.js', READER_RELEASE.inputManifest]) test(`historical/input corruption ${relative} is rejected`, () => fixture(dir => {
  historicalAlpha7Root(dir);
  append(dir, relative);
  assert.throws(() => verifyProvenance(dir));
}));
test('reconstruction never conceals a changed cached historical file or extra path', () => fixture(dir => {
  const prior = historicalAlpha7Root(dir);
  fs.writeFileSync(path.join(prior, 'unexpected.txt'), 'extra');
  assert.throws(() => historicalAlpha7Root(dir), /path set changed/);
  fs.unlinkSync(path.join(prior, 'unexpected.txt'));
  append(prior, 'apps/web/runtime/app.js');
  assert.throws(() => historicalAlpha7Root(dir), /Reconstructed historical source changed/);
}));
for (const mutation of ['extra-public', 'source-list', 'source-symlink', 'baseline-directory-symlink']) test(`public scope ${mutation} is rejected`, () => fixture(dir => {
  if (mutation === 'extra-public') fs.writeFileSync(path.join(dir, 'extra-note.txt'), 'unreviewed');
  if (mutation === 'source-list') edit(dir, READER_RELEASE.sourceList, list => list.push('extra-note.txt'));
  if (mutation === 'source-symlink') fs.symlinkSync('README.md', path.join(dir, 'extra-link'));
  if (mutation === 'baseline-directory-symlink') { const p = path.join(dir, ALPHA7_HISTORY.snapshot, 'apps'); fs.renameSync(p, p + '-original'); fs.symlinkSync(p + '-original', p); }
  assert.throws(() => verifyProvenance(dir));
}));
for (const relative of ['../package.json', '/package.json', 'apps/../package.json', 'apps\\package.json']) test(`historical path ${relative} is rejected`, () => assert.throws(() => regularSource(root, relative), /Invalid source path/));

test('normal aggregate has no test filters and active behavior still reads active Motion code', () => {
  const runner = regularSource(root, 'apps/web/tests/integration/run.mjs').toString();
  assert.doesNotMatch(runner, /test-skip-pattern|test-name-pattern/);
  const compatibility = regularSource(root, 'scripts/test-card-reader-candidate.mjs').toString();
  assert.match(compatibility, /\['test'\]/); assert.doesNotMatch(compatibility, /test-skip-pattern/);
  const content = regularSource(root, 'apps/web/tests/integration/content-fixture.mjs').toString();
  assert.match(content, /runtime/); assert.match(content, /card-projection/); assert.doesNotMatch(content, /historicalAlpha/);
  for (const relative of ['apps/web/tests/integration/card-projection.test.mjs', 'apps/web/tests/integration/reader-visible-text.test.mjs', 'apps/web/tests/integration/reader-scroll-ownership.test.mjs']) assert.doesNotMatch(regularSource(root, relative).toString(), /historicalAlpha/);
  const active = regularSource(root, 'apps/web/runtime/app.js').toString(), historical = historicalAlpha7Source(root, 'apps/web/runtime/app.js').toString();
  assert.match(active, /createCardProjection/); assert.doesNotMatch(historical, /createCardProjection/);
});

for (const mutation of ['missing-runtime', 'extra-runtime', 'changed-runtime', 'changed-version', 'changed-supporting', 'force-tracked-ignored-file']) test(`current Git payload ${mutation} is rejected`, () => fixture(dir => {
  const git = (...args) => { const result = spawnSync('git', args, {cwd: dir, encoding: 'utf8'}); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  const app = path.join(dir, 'apps/web/runtime/app.js'), original = fs.readFileSync(app), extra = path.join(dir, 'apps/web/runtime/unapproved.js'), pkg = path.join(dir, 'package.json'), originalPackage = fs.readFileSync(pkg), supporting = path.join(dir, 'scripts/check-reader-release-boundary.test.mjs'), originalSupporting = fs.readFileSync(supporting);
  if (mutation === 'missing-runtime') fs.unlinkSync(app);
  if (mutation === 'extra-runtime') fs.writeFileSync(extra, '');
  if (mutation === 'changed-runtime') append(dir, 'apps/web/runtime/app.js');
  if (mutation === 'changed-version') append(dir, 'package.json');
  if (mutation === 'changed-supporting') append(dir, 'scripts/check-reader-release-boundary.test.mjs');
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@localhost'); git('add', '.');
  if (mutation === 'force-tracked-ignored-file') { fs.mkdirSync(path.join(dir, 'evidence')); fs.writeFileSync(path.join(dir, 'evidence/unreviewed.txt'), ''); git('add', '-f', 'evidence/unreviewed.txt'); }
  git('commit', '-q', '-m', 'Negative payload fixture');
  fs.writeFileSync(app, original); fs.writeFileSync(pkg, originalPackage); fs.writeFileSync(supporting, originalSupporting); if (fs.existsSync(extra)) fs.unlinkSync(extra);
  assert.throws(() => verifySourcePayload(dir), /Mapped payload differs|runtime path set differs|public source path set differs|Mapped public source blob differs/);
}));


test('an active Motion regression fails on mutated current runtime, independently of byte gates', () => fixture(dir => {
  fs.symlinkSync(fs.realpathSync(path.join(root, 'apps/web/tests/integration/node_modules')), path.join(dir, 'apps/web/tests/integration/node_modules'), 'dir');
  // This is an intentionally separate runner, not recursive node:test discovery.
  const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
  const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'apps/web/tests/integration/reader-visible-text.test.mjs'], {cwd: dir, env, encoding: 'utf8', timeout: 10000});
  const clean = run();
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.match(clean.stdout, /# pass 4/);
  const file = path.join(dir, 'apps/web/runtime/card-projection.js');
  const source = fs.readFileSync(file, 'utf8');
  assert(source.includes("preview.style.visibility = 'hidden';"));
  fs.writeFileSync(file, source.replace("preview.style.visibility = 'hidden';", "preview.style.visibility = 'visible';"));
  const result = run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /preview geometry probe must never draw a second glyph layout/);
  assert.match(result.stdout, /# fail 4/);
}));


test('real API status and served metadata both report the independent exact alpha.8 identity', async () => {
  const servers = [];
  try {
    const api = await startApi({port: 0}); servers.push(api);
    const web = await startStatic({port: 0}); servers.push(web);
    const status = await fetch(`http://127.0.0.1:${api.address().port}/api/v1/status`);
    const metadata = await fetch(`http://127.0.0.1:${web.address().port}/release-meta.json`);
    assert.equal(status.status, 200); assert.equal(metadata.status, 200);
    const body = await status.json(), meta = await metadata.json();
    assert.equal(READER_RELEASE.version, 'v0.1.0-alpha.8');
    assert.equal(body.productVersion, READER_RELEASE.version.slice(1));
    assert.equal(meta.productVersion, READER_RELEASE.version);
    assert.equal(meta.fullUnifiedAcceptance, false);
    assert.deepEqual(body.capabilities, {health:true,status:true,contentApi:false,chatApi:false,authentication:false,persistence:false});
    assert.equal(body.frontendConnected, false);
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
