/** Actual Chromium rendering smoke; SwiftShader is software WebGL, not physical GPU acceptance. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startStatic } from '../apps/web/dev-server.mjs';
const require = createRequire(new URL('../.build/browser/package.json', import.meta.url));
const { chromium } = require('playwright');
const out = new URL('../test-results/liquid-glass/', import.meta.url);
await mkdir(out, { recursive: true });
const report = { rendererMode: 'Chromium SwiftShader software WebGL; not physical GPU/mobile acceptance', commit: process.env.GITHUB_SHA || null, cases: [], passed: false };
const server = await startStatic({ port: 0 });
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  report.browser = browser.version();
  for (const config of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, isMobile: config.name === 'mobile', hasTouch: config.name === 'mobile', reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    const result = { viewport: config, errors: [], failedResponses: [], checks: [] };
    report.cases.push(result);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) result.failedResponses.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const shot = async name => page.screenshot({ path: new URL(`${config.name}-${name}.png`, out).pathname, animations: 'allow', timeout: 90000 });
    const state = () => page.evaluate(() => window.personalOSHost.getState());
    const phase = (part, value) => page.waitForFunction(({ part, value }) => window.personalOSHost?.getState()[part]?.phase === value, { part, value });
    const visible = async selector => {
      const node = page.locator(selector).first();
      await node.waitFor({ state: 'visible' });
      const bounds = await node.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0 && bounds.x < config.width && bounds.y < config.height && bounds.x + bounds.width > 0 && bounds.y + bounds.height > 0, `${selector} intersects viewport`);
      return node;
    };
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.personalOSHost?.getState().ready && window.personalOSHost.getState().scene?.ready, null, { timeout: 60000 });
      result.scene = (await state()).scene;
      assert.equal(result.scene.failed, null);
      assert.equal(result.scene.canvasCount, 1);
      result.webgl = await page.locator('#motion-scene canvas').evaluate(canvas => {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl || gl.isContextLost()) throw new Error('A live real WebGL context is required; no fallback pass');
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
      });
      assert.ok(result.webgl.width > 0 && result.webgl.height > 0);
      await visible('#motion-scene canvas');
      await shot('hero');
      result.checks.push('live WebGL scene, one canvas, hero screenshot');
      for (const category of ['work', 'labs', 'all', 'thoughts', 'all']) {
        await page.locator(`[data-filter=${category}]`).click();
        await page.waitForFunction(category => window.personalOSContent.getState().category === category && !window.personalOSContent.getState().reflow.active, category);
        const selected = page.locator(`[data-filter=${category}]`);
        assert.equal(await selected.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.slot:not(.excluded)').count(), category === 'all' ? 18 : 6);
      }
      await visible('.slot:not(.excluded) .card');
      assert.ok(await page.evaluate(() => document.scrollingElement.scrollTop > 0));
      await shot('feed');
      result.checks.push('five real filter clicks, selected semantics/counts, native scroll');
      const first = page.locator('.slot:not(.excluded) .open-card').first();
      const id = await first.evaluate(node => node.closest('.card').dataset.contentId);
      await first.evaluate(node => { window.__qaArticle = node.closest('.card'); });
      for (let repeat = 0; repeat < 2; repeat++) {
        await page.locator(`.slot .card[data-content-id="${id}"] .open-card`).click();
        await phase('content', 'detail');
        await visible('#shell .detail-body');
        assert.equal(await page.evaluate(() => document.querySelector('#shell .card') === window.__qaArticle), true);
        if (!repeat) await shot('reader');
        await page.locator('#reader').evaluate(node => { node.scrollTop = 120; });
        await page.locator('#close').click();
        await phase('content', 'preview');
      }
      result.handoffs = await page.evaluate(() => window.contentStudy.handoffs());
      assert.ok(result.handoffs.length >= 2);
      for (const handoff of result.handoffs.slice(-2)) for (const [before, after] of [['source', 'lift'], ['lastAir', 'native']]) for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(handoff[before][key] - handoff[after][key]) <= 1, `card ${before}/${after} ${key} continuity <=1 CSS px`);
      result.checks.push('same article opens/closes twice at natural speed; real handoff geometry <=1 CSS px');
      for (let repeat = 0; repeat < 2; repeat++) {
        await page.locator('.pos-menu-toggle').click();
        await phase('menu', 'open');
        await visible('.pos-menu-dialog[open] .pos-menu-link');
        assert.equal(await page.locator('.pos-menu-toggle').getAttribute('aria-expanded'), 'true');
        if (!repeat) await shot('menu');
        await page.keyboard.press('Escape');
        await phase('menu', 'closed');
        assert.equal(await page.locator('.pos-menu-dialog').evaluate(node => node.open), false);
      }
      result.checks.push('menu visible/open and Escape-close twice');
      await page.locator('#host-open-chat').click();
      await phase('chat', 'open');
      await visible('#question');
      await page.locator('#question').fill('公开项目示例');
      await page.locator('#send-button').click();
      await page.waitForFunction(() => window.personalOSHost.getState().chat.messageCount === 1);
      await visible('#messages .message.user');
      await shot('chat');
      await page.locator('#ai-close').click();
      await phase('chat', 'closed');
      await page.locator('#host-open-chat').click();
      await phase('chat', 'open');
      assert.equal((await state()).chat.messageCount, 1);
      await visible('#messages .message.user');
      await page.locator('#ai-close').click();
      await phase('chat', 'closed');
      result.checks.push('chat real open/send/close/reopen, visible retained user message');
      assert.deepEqual(result.errors, [], 'no uncaught page errors');
      assert.deepEqual(result.failedResponses, [], 'no failed asset responses');
      assert.equal((await state()).scene.failed, null);
      result.passed = true;
    } catch (error) {
      result.failure = error.message;
      result.failureStack = error.stack;
      result.failureState = await state().catch(() => null);
      result.failureAnimations = await page.evaluate(() => document.getAnimations().map(a => ({ playState: a.playState, currentTime: a.currentTime, timing: a.effect?.getComputedTiming(), target: a.effect?.target?.className }))).catch(() => null);
      await shot('failure').catch(() => {});
      result.passed = false;
    } finally { await context.close(); }
  }
  report.passed = report.cases.every(result => result.passed);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify(report, null, 2));
