import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';

// Chromium's documented existing-Chrome-helper route for Ubuntu 23.10+.
// This preflight never installs, replaces or changes permissions on a helper.
const helper = '/opt/google/chrome/chrome-sandbox';
const output = new URL('../../../../evidence/browser-run/sandbox-preflight.json', import.meta.url);
const evidence = {schemaVersion: 1, helper, sandbox: true, customArguments: [], productTestsEvaluated: false};
let browser;
try {
  assert.equal(process.platform, 'linux', 'Linux hosted runner required');
  assert.notEqual(process.getuid(), 0, 'Browser must run as the unprivileged runner');
  assert.equal(process.env.CHROME_DEVEL_SANDBOX, helper, 'Only the stock helper path is allowed');
  for (const name of ['/', '/opt', '/opt/google', '/opt/google/chrome', helper]) {
    const stat = lstatSync(name);
    assert.equal(stat.uid, 0, 'Helper and parents must be root-owned');
    assert.equal(stat.gid, 0, 'Helper and parents must be root-group-owned');
    assert.equal(stat.mode & 0o022, 0, 'Helper and parents must not be group/world writable');
    assert.equal(stat.isSymbolicLink(), false, 'Helper path must not contain symlinks');
    assert.equal(name === helper ? stat.isFile() : stat.isDirectory(), true, 'Unexpected helper path type');
    if (name === helper) assert.equal(stat.mode & 0o7777, 0o4755, 'Stock helper must already be mode 4755');
  }
  const exec = (command, args) => execFileSync(command, args, {encoding: 'utf8', timeout: 5000}).trim();
  assert.equal(exec('dpkg-query', ['-S', helper]), 'google-chrome-stable: '+helper, 'Official installed Chrome package required');
  const status = exec('dpkg-query', ['-W', '-f=${Status}\n${Version}', 'google-chrome-stable']).split('\n');
  assert.equal(status[0], 'install ok installed', 'Chrome package must already be installed');
  const sums = readFileSync('/var/lib/dpkg/info/google-chrome-stable.md5sums', 'utf8').split('\n');
  const sum = sums.find(line => line.trim().split(/\s+/)[1] === helper.slice(1))?.trim().split(/\s+/)[0];
  assert.match(sum || '', /^[a-f0-9]{32}$/, 'Installed package helper checksum required');
  assert.equal(createHash('md5').update(readFileSync(helper)).digest('hex'), sum, 'Helper differs from installed package metadata');
  const api = exec(helper, ['--get-api']);
  assert.equal(api, '1', 'Helper API must match pinned Chromium 141 API 1');
  const playwrightVersion = JSON.parse(readFileSync(new URL('./node_modules/@playwright/test/package.json', import.meta.url))).version;
  assert.equal(playwrightVersion, '1.56.1', 'Playwright version must remain pinned');
  Object.assign(evidence, {package: 'google-chrome-stable', packageVersion: status[1], helperMode: '4755', helperApi: api, installedPackageChecksumMatched: true, playwrightVersion});
  const {chromium} = await import('@playwright/test');
  browser = await chromium.launch({headless: true, chromiumSandbox: true, timeout: 30000});
  assert.equal(browser.version(), '141.0.7390.37', 'Browser version must remain pinned');
  const session = await browser.newBrowserCDPSession();
  const {arguments: launchArguments} = await session.send('Browser.getBrowserCommandLine');
  const disabledSandbox = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-seccomp-filter-sandbox', '--disable-namespace-sandbox', '--single-process'];
  assert.equal(launchArguments.some(arg => disabledSandbox.includes(arg.split('=')[0])), false, 'Sandbox-disabling launch arguments forbidden');
  const context = await browser.newContext({serviceWorkers: 'block'});
  await context.route('**/*', route => route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.goto('about:blank');
  assert.equal(await page.evaluate(() => 6 * 7), 42, 'Sandboxed renderer must execute');
  Object.assign(evidence, {browserVersion: browser.version(), sandboxArgumentAuditPassed: true, rendererExecuted: true, status: 'passed'});
  console.log('SANDBOX_PREFLIGHT: stock package helper verified; pinned Chromium sandboxed launch and blank-page renderer passed');
} catch (error) {
  evidence.status = 'failed';
  evidence.error = error.message;
  console.error('SANDBOX_PREFLIGHT: '+error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  mkdirSync(new URL('./', output), {recursive: true});
  writeFileSync(output, JSON.stringify(evidence, null, 2)+'\n');
}
