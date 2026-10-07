import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {inspectPng} from './png-check.mjs';
import {requireRenderedPixels} from './canvas-proof.mjs';

const executable = '/opt/google/chrome/chrome';
const output = new URL('../../../../evidence/browser-run/stock-chrome-preflight.json', import.meta.url);
const imageOutput = new URL('./stock-chrome-synthetic-webgl.png', output);
const evidence = {schemaVersion: 1, channel: 'chrome', sandbox: true, customArguments: [], executable, productTestsEvaluated: false, previousChromium141ResultsReused: false};
let browser;
try {
  assert.equal(process.platform, 'linux', 'Linux hosted runner required');
  assert.notEqual(process.getuid(), 0, 'Browser must run as the unprivileged runner');
  assert.equal(process.env.CHROME_DEVEL_SANDBOX, undefined, 'Do not substitute a sandbox helper');
  const stat = lstatSync(executable);
  assert.equal(stat.isFile(), true, 'Installed Chrome executable required');
  assert.equal(stat.uid, 0, 'Installed package executable must be root-owned');
  evidence.executableMetadata = {uid: stat.uid, gid: stat.gid, mode: (stat.mode & 0o7777).toString(8)};
  const exec = (command, args) => execFileSync(command, args, {encoding: 'utf8', timeout: 5000}).trim();
  assert.equal(exec('dpkg-query', ['-S', executable]), 'google-chrome-stable: '+executable, 'Installed official Chrome package required');
  const status = exec('dpkg-query', ['-W', '-f=${Status}\n${Version}', 'google-chrome-stable']).split('\n');
  assert.equal(status[0], 'install ok installed', 'Chrome package must already be installed');
  const sums = readFileSync('/var/lib/dpkg/info/google-chrome-stable.md5sums', 'utf8').split('\n');
  const sum = sums.find(line => line.trim().split(/\s+/)[1] === executable.slice(1))?.trim().split(/\s+/)[0];
  assert.match(sum || '', /^[a-f0-9]{32}$/, 'Installed executable checksum required');
  assert.equal(createHash('md5').update(readFileSync(executable)).digest('hex'), sum, 'Chrome executable differs from installed package metadata');
  const installedVersion = exec(executable, ['--product-version']);
  const playwrightVersion = JSON.parse(readFileSync(new URL('./node_modules/@playwright/test/package.json', import.meta.url))).version;
  assert.equal(playwrightVersion, '1.56.1', 'Playwright remains pinned');
  Object.assign(evidence, {package: 'google-chrome-stable', packageVersion: status[1], installedVersion, installedPackageChecksumMatched: true, playwrightVersion});
  const {chromium} = await import('@playwright/test');
  browser = await chromium.launch({channel: 'chrome', headless: true, chromiumSandbox: true, timeout: 30000});
  assert.equal(browser.version(), installedVersion, 'Launched browser must be the installed package version');
  evidence.browserVersion = browser.version();
  const session = await browser.newBrowserCDPSession();
  const {arguments: launchArguments} = await session.send('Browser.getBrowserCommandLine');
  assert.equal(launchArguments[0], executable, 'Chrome channel must use the official installed executable');
  const disabledSandbox = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-seccomp-filter-sandbox', '--disable-namespace-sandbox', '--single-process'];
  assert.equal(launchArguments.some(arg => disabledSandbox.includes(arg.split('=')[0])), false, 'Sandbox-disabling arguments forbidden');
  evidence.sandboxArgumentAuditPassed = true;
  const context = await browser.newContext({serviceWorkers: 'block', viewport: {width: 160, height: 160}});
  context.setDefaultTimeout(10000);
  await context.route('**/*', route => route.abort('blockedbyclient'));
  const page = await context.newPage();
  await page.goto('about:blank');
  assert.equal(await page.evaluate(() => 6 * 7), 42, 'Blank-page renderer must execute');
  evidence.rendererExecuted = true;
  evidence.graphics = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    document.body.style.margin = '0'; document.body.append(canvas);
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('STOCK_CHROME_GRAPHICS: default WebGL unavailable');
    const shader = (type, source) => {
      const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error('STOCK_CHROME_GRAPHICS: '+gl.getShaderInfoLog(value));
      return value;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 position; attribute vec3 color; varying vec3 shade; void main(){gl_Position=vec4(position,0.0,1.0);shade=color;}'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec3 shade; void main(){gl_FragColor=vec4(shade,1.0);}'));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('STOCK_CHROME_GRAPHICS: '+gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.8,-0.8,1,0,0, 0.8,-0.8,0,1,0, 0,0.8,0,0,1]), gl.STATIC_DRAW);
    for (const [name, size, offset] of [['position',2,0],['color',3,8]]) {
      const location = gl.getAttribLocation(program,name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,20,offset);
    }
    gl.viewport(0,0,128,128);
    const draw = () => {gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);window.__stockChromeSmokeRaf=requestAnimationFrame(draw);};
    draw();
    if (gl.getError() !== gl.NO_ERROR) throw new Error('STOCK_CHROME_GRAPHICS: GL error');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {version: gl.getParameter(gl.VERSION), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), syntheticTriangle: true};
  });
  const image = await page.locator('canvas').screenshot({omitBackground: true});
  const pixels = inspectPng(image);
  requireRenderedPixels(pixels);
  Object.assign(evidence.graphics, {pixels, status: 'passed', existingPixelCriterionUnchanged: true});
  mkdirSync(new URL('./', output), {recursive: true}); writeFileSync(imageOutput, image);
  evidence.status = 'passed';
  console.log('STOCK_CHROME_PREFLIGHT: '+JSON.stringify({browserVersion: evidence.browserVersion, sandbox: true, rendererExecuted: true, graphics: evidence.graphics}));
} catch (error) {
  evidence.status = 'failed'; evidence.error = error.message;
  console.error('STOCK_CHROME_PREFLIGHT: '+error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  mkdirSync(new URL('./', output), {recursive: true});
  writeFileSync(output, JSON.stringify(evidence, null, 2)+'\n');
}
