import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = path.join(root, 'evidence/browser-run');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function files(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (['node_modules', '.npm-cache'].includes(entry.name)) return [];
    return entry.isDirectory() ? files(file) : [file];
  });
}
function pin(dir) {
  const entries = files(path.join(root, dir)).sort().map(file => ({path: path.relative(root, file), sha256: digest(readFileSync(file))}));
  return {sha256: digest(JSON.stringify(entries)), files: entries};
}
export default class RunManifest {
  results = [];
  onBegin(config) {
    mkdirSync(output, {recursive: true});
    this.manifest = {
      schemaVersion: 1,
      baselineCommit: '15a5967b775dec5e1224c224a5e36f07ddbbb76b',
      baselineRuntimeGitTree: '8a6163d69c32606950daea961cc07081d6cd068c',
      baselineCanonicalRuntimeSHA256: '64922db578b6ab8fb8f40250c9156e957a02e386f56803625f5ebc19389072ad',
      baselineRuntimeFileCount: 70,
      checkoutCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
      checkoutDirty: !!execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim(),
      startedAt: new Date().toISOString(),
      environment: {node: process.version, platform: process.platform, arch: process.arch, kernel: os.release(), playwright: JSON.parse(readFileSync(new URL('./node_modules/@playwright/test/package.json', import.meta.url))).version},
      instrumentation: {lightweight: process.env.PERSONALOS_LIGHTWEIGHT_GUARD === '1', frameCollector: process.env.PERSONALOS_LIGHTWEIGHT_GUARD !== '1', traceAndVideo: process.env.PERSONALOS_LIGHTWEIGHT_GUARD !== '1'},
      launch: {browserName: 'chromium', channel: 'chrome', browserBaseline: 'hosted-stock-branded-version-recorded-per-run', sandbox: true, customArguments: [], headless: true, softwareRendererPossible: true},
      runtime: pin('apps/web/runtime'),
      candidate: pin('apps/web/tests/browser'),
      ciAndDocumentation: ['.github/workflows/browser-guards.yml', 'docs/BROWSER_GUARDS.md'].map(file => ({path: file, sha256: digest(readFileSync(path.join(root,file)))})),
      renderCoverage: {status: 'not-run', fallbackNeverPasses: true},
      scopes: {observed: [], blocked: [], unclaimed: ['hardware GPU', 'physical iPhone/iOS/Safari', 'native keyboard/IME', 'real-user/auth data', 'performance thresholds', 'final visual/product acceptance']},
      projects: config.projects.map(p => ({name: p.name, viewport: p.use.viewport})),
    };
  }
  onTestEnd(test, result) {
    const relative = path.relative(root, test.location.file);
    const errors = result.errors.map(error => (error.message || '').replaceAll(root, '<repo>/').replace(/\u001b\[[0-9;]*m/g, ''));
    const artifactDir = path.join(output, 'observations', test.parent.project()?.name || 'unknown', test.title.replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,100));
    mkdirSync(artifactDir, {recursive:true});
    const artifacts = [];
    for (const attachment of result.attachments) {
      if (!['application/json','image/png'].includes(attachment.contentType)) continue;
      if (!['process-timeline','render-availability','0-intro-isolated-canvas','0-replay-isolated-canvas','renderer-observation','1-home-ui','2-restored-scroll-dock-ui','final-dock-observation','blank-canvas-proof','blank-canvas-fixture','canvas-layout-proof','timing-comparison-observation','entry-render-availability','entry-isolated-canvas','entry-canvas-layout-proof','entry-renderer-proof','fresh-entry-intro-evidence','replay-intro-evidence'].includes(attachment.name)) continue;
      const suffix = attachment.contentType === 'image/png' ? '.png' : '.json';
      const destination = path.join(artifactDir,attachment.name+suffix);
      try {
        writeFileSync(destination, attachment.body || readFileSync(attachment.path));
        artifacts.push({name:attachment.name,path:path.relative(root,destination)});
      } catch(error) {artifacts.push({name:attachment.name,captureError:error.message.replaceAll(root,'<repo>/')});}
    }
    const timeline = result.attachments.find(item => item.name === 'process-timeline');
    let environment = null;
    try {
      const capture = JSON.parse(timeline.body || readFileSync(timeline.path));
      environment = {browserVersion: capture.browserVersion, userAgent: capture.userAgent, availability: capture.availability};
    } catch {}
    this.results.push({environment, artifacts, title: test.title, project: test.parent.project()?.name, file: relative, status: result.status, expectedStatus: test.expectedStatus, durationMs: result.duration, errors});
  }
  onEnd(result) {
    this.manifest.completedAt = new Date().toISOString();
    this.manifest.status = result.status;
    this.manifest.tests = this.results;
    const render = this.results.filter(test => test.title.includes('@render'));
    if (render.length) this.manifest.renderCoverage.status = render.every(test => test.status === 'passed') ? 'observed-default-engine' : 'blocked-or-failed';
    for (const result of this.results) {
      if (result.status === 'passed' && result.expectedStatus === 'passed') this.manifest.scopes.observed.push(`${result.project}: ${result.title}`);
      else if (result.title.includes('@render')) this.manifest.scopes.blocked.push(`${result.project}: ${result.title} (${result.status}); see exact error, never count as render PASS`);
    }
    writeFileSync(path.join(output, 'run-manifest.json'), JSON.stringify(this.manifest, null, 2)+'\n');
  }
}

