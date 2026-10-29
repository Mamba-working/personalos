/** Actual Chromium rendering smoke; SwiftShader is software WebGL, not physical GPU acceptance. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startStatic } from '../apps/web/dev-server.mjs';
const require = createRequire(new URL('../.build/browser/package.json', import.meta.url));
const { chromium } = require('playwright');
const staticOnly = process.argv.includes('--static-only');
const out = new URL(staticOnly ? '../test-results/liquid-glass-static/' : '../test-results/liquid-glass/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('RECORDING-NOTES.txt', out), staticOnly
  ? 'Early static screenshots captured directly from the actual Chromium page, with live WebGL, decoded covers and loaded fonts. Desktop hero, desktop reference scroll (Labs top 344 CSS px), mobile hero and mobile reading (Work metadata top 140 CSS px); pointer/non-focused presentation. No video, generated frames or interaction acceptance in this artifact. Renderer: headless Chromium SwiftShader software WebGL, not physical GPU or real-device acceptance. The separate full interaction job step retains its original recording and assertions.\n'
  : 'Original browser video captured by Playwright recordVideo in wall-clock time. No slideshow, generated frames, artificial advancement, frame interpolation or speed-up. Renderer: headless Chromium SwiftShader software WebGL. This evidence verifies behavior and visual continuity, not physical GPU or real-device smoothness. Desktop/mobile are viewport simulations. report.json includes browser-time action markers, failures, and original video names.\n');
const report = { mode: staticOnly ? 'early-static-screenshots' : 'full-interaction-recording', rendererMode: 'Chromium SwiftShader software WebGL; not physical GPU/mobile acceptance', commit: process.env.GITHUB_SHA || null, cases: [], passed: false };
const server = await startStatic({ port: 0 });
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  report.browser = browser.version();
  for (const config of [{ name: 'desktop', width: 1505, height: 1045 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, isMobile: config.name === 'mobile', hasTouch: config.name === 'mobile', reducedMotion: 'no-preference', ...(!staticOnly && { recordVideo: { dir: new URL('video/', out).pathname, size: { width: config.width, height: config.height } } }) });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__qaMotion = [];
      let last = 0;
      function sample(now) {
        const host = window.personalOSHost?.getState();
        if (host && window.__qaMotion.length < 12000) {
          const content = document.querySelector('#content-root');
          const r = content?.getBoundingClientRect();
          window.__qaMotion.push({ time: now, dt: last ? now - last : 0, scroll: document.scrollingElement.scrollTop,
            explore: host.sceneExplore?.phase, card: host.content?.phase, cardProgress: host.content?.progress,
            contentX: r?.x, contentY: r?.y, opacity: content ? getComputedStyle(content).opacity : null });
        }
        last = now;
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    page.setDefaultTimeout(90000);
    const result = { viewport: config, errors: [], failedResponses: [], checks: [], timeline: [], recording: staticOnly ? 'Static screenshots only; full interaction recording is a separate step' : 'Original Playwright WebM, wall-clock speed, Chromium SwiftShader software rendering; not physical GPU performance' };
    const mark = async name => result.timeline.push({ name, browserTimeMs: await page.evaluate(() => performance.now()) });
    const hold = ms => page.waitForTimeout(ms);
    const video = page.video();
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
      // Deterministic setup uses the existing reduced-motion policy/public time API.
      // Restore natural motion before any recorded interaction; never advance scene frames.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => { const s = window.personalOSHost.getState(); return s.reduced && s.scene.reduced && s.scene.paused; });
      await page.evaluate(() => window.personalOSHost.scene().setTime('day'));
      await page.waitForFunction(() => window.personalOSHost.getState().scene.night === false);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => { const s = window.personalOSHost.getState(); return !s.reduced && !s.scene.reduced; });
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
      await page.waitForFunction(() => [...document.querySelectorAll('img.editorial-cover')].every(image => image.complete && image.naturalWidth > 0));
      result.checks.push('all editorial raster covers decode successfully, not merely HTTP 200');
      await page.evaluate(() => document.fonts.ready);
      if (staticOnly) await page.evaluate(() => document.activeElement?.blur());
      await mark('Hero ready');
      await shot('hero');
      await hold(1600);
      if(config.name === 'desktop') {
        await page.locator('[data-id="labs-spring"]').evaluate(node => window.scrollBy(0,node.getBoundingClientRect().top-344));
        await hold(1200);
        result.referenceState = await page.evaluate(() => ({width:innerWidth,height:innerHeight,scrollY, labs:document.querySelector('[data-id="labs-spring"]').getBoundingClientRect().toJSON(),thoughts:document.querySelector('[data-id="thoughts-type"]').getBoundingClientRect().toJSON()}));
        await shot('reference-scroll');
        await page.evaluate(() => window.scrollTo(0,0));
      }

      if (staticOnly) {
        if (config.name === 'mobile') {
          await page.locator('[data-content-id="work-context"] .card-meta').evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 140));
          await hold(1200);
          result.readingState = await page.evaluate(() => ({
            width: innerWidth, height: innerHeight, scrollY,
            workHeader: document.querySelector('[data-content-id="work-context"] .card-meta').getBoundingClientRect().toJSON(),
            thoughts: document.querySelector('[data-id="thoughts-type"]').getBoundingClientRect().toJSON()
          }));
          await mark('Mobile native reading scroll; Work metadata top 140');
          await shot('reading');
          assert.ok(Math.abs(result.readingState.workHeader.top - 140) <= 1, 'mobile Work metadata aligned at 140 CSS px');
        }
        result.categoryGeometry = [];
        for (const category of ['all', 'work', 'thoughts', 'labs']) {
          await page.locator(`[data-filter=${category}]`).click();
          await page.waitForFunction(category => window.personalOSContent.getState().category === category && !window.personalOSContent.getState().reflow.active, category);
          await page.locator('.slot:not(.excluded)').first().evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 140));
          await hold(500);
          const measures = await page.locator('.slot:not(.excluded)').evaluateAll(slots => slots.map(slot => {
            const card = slot.querySelector('.card'); const copy = card.querySelector('.summary');
            return { id: card.dataset.contentId, category: card.dataset.category, slot:slot.getBoundingClientRect().toJSON(), copy:copy.getBoundingClientRect().toJSON() };
          }));
          for (const item of measures.filter(item => item.id !== 'work-context')) {
            assert.ok(item.copy.width >= (config.name === 'desktop' ? 140 : 120), `${category}/${item.id}: readable copy measure`);
            assert.ok(item.copy.right <= item.slot.right + 1, `${category}/${item.id}: copy stays within clipping slot`);
          }
          result.categoryGeometry.push({ category, measures });
          await page.evaluate(() => document.activeElement?.blur());
          await shot(`category-${category}`);
        }
        assert.deepEqual(result.errors, [], 'no uncaught page errors');
        assert.deepEqual(result.failedResponses, [], 'no failed asset responses');
        assert.equal((await state()).scene.failed, null);
        result.checks.push('actual live WebGL screenshot capture only; full interaction assertions run separately');
        result.passed = true;
        continue;
      }

      await page.mouse.move(config.width * .35, config.height * .65);
      await page.mouse.wheel(0, 420);
      await page.waitForFunction(() => document.scrollingElement.scrollTop > 0);
      await hold(1800);
      await mark('Continuous native scroll to editorial content');
      // Exploration and return are captured before the filter/card regression below.
      await verifyExplore({ page, result, config, mark, hold, shot, phase });
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
        await mark('Card expanding through intermediate into detail');
        await phase('content', 'detail');
        await visible('#shell .detail-body');
        assert.equal(await page.locator('#host-explore').isDisabled(), true, 'explore unavailable while card modal owns input');
        assert.equal(await page.evaluate(() => document.querySelector('#shell .card') === window.__qaArticle), true);
        if (!repeat) { await mark('Card detail'); await shot('reader'); await hold(1800); }
        await page.locator('#reader').evaluate(node => { node.scrollTop = 120; });
        await page.locator('#close').click();
        await phase('content', 'preview');
        await mark('Card returned to preview');
        await hold(700);
      }
      result.handoffs = await page.evaluate(() => window.contentStudy.handoffs());
      assert.ok(result.handoffs.length >= 2);
      for (const handoff of result.handoffs.slice(-2)) for (const [before, after] of [['source', 'lift'], ['lastAir', 'native']]) for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(handoff[before][key] - handoff[after][key]) <= 1, `card ${before}/${after} ${key} continuity <=1 CSS px`);
      result.checks.push('same article opens/closes twice at natural speed; real handoff geometry <=1 CSS px');
      await mark('Interrupt/reverse card transition without resetting velocity');
      result.cardReversal = await page.evaluate(async id => {
        window.personalOSContent.select(id);
        await new Promise(resolve => setTimeout(resolve, 100));
        const before = window.contentStudy.snapshot();
        window.personalOSContent.cancel();
        const reversed = window.contentStudy.snapshot();
        window.personalOSContent.select(id);
        const resumed = window.contentStudy.snapshot();
        return { before, reversed, resumed };
      }, id);
      for (const next of ['reversed', 'resumed']) for (const key of ['x', 'y', 'w', 'h', 'progress']) {
        assert.equal(result.cardReversal.before.pose[key], result.cardReversal[next].pose[key], `interrupt preserves card pose ${key}`);
        assert.equal(result.cardReversal.before.velocity[key], result.cardReversal[next].velocity[key], `interrupt preserves card velocity ${key}`);
      }
      await phase('content', 'detail');
      await page.locator('#close').click();
      await phase('content', 'preview');
      assert.equal(await page.locator('#feed').evaluate(node => node.inert), false);
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('open-card')), true);
      result.checks.push('card interruption preserves pose and velocity; feed unlock and focus restoration');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => window.personalOSHost.getState().reduced);
      await page.locator(`.slot .card[data-content-id="${id}"] .open-card`).click();
      await phase('content', 'detail');
      await page.locator('#close').click();
      await phase('content', 'preview');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => !window.personalOSHost.getState().reduced);
      result.checks.push('system reduced-motion card open/close reaches semantic final states');

      for (let repeat = 0; repeat < 2; repeat++) {
        await page.locator('.pos-menu-toggle').click();
        await phase('menu', 'open');
        await visible('.pos-menu-dialog[open] .pos-menu-link');
        assert.equal(await page.locator('#host-explore').isDisabled(), true, 'explore unavailable while menu owns input');
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
      assert.equal(await page.locator('#host-explore').isDisabled(), true, 'explore unavailable while chat owns input');
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
      await page.evaluate(() => window.personalOSHost.scene().setTime('night'));
      await page.waitForFunction(() => window.personalOSHost.getState().scene.night === true);
      await mark('Night palette visual regression');
      await shot('night-content');
      assert.equal(await page.locator('.card .open-label').first().evaluate(node => getComputedStyle(node).color === getComputedStyle(node.closest('.card')).color), true, 'Open action follows readable editorial ink at night');
      result.nightPalette = await page.locator('#content-root').evaluate(node => ({ color: getComputedStyle(node).color, editorialInk: getComputedStyle(node).getPropertyValue('--editorial-ink') }));

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
    } finally {
      result.frameTrace = await page.evaluate(() => window.__qaMotion || []).catch(() => []);
      const intervals = result.frameTrace.map(frame => frame.dt).filter(dt => dt > 0).sort((a, b) => a - b);
      result.observedFrameIntervalsMs = { samples: intervals.length, median: intervals[Math.floor(intervals.length * .5)], p95: intervals[Math.floor(intervals.length * .95)], max: intervals.at(-1), note: 'Observed software-GPU browser RAF timing, not hardware performance acceptance' };
      await context.close();
      if (video) { const original = await video.path(); const destination = new URL(`${config.name}-realtime.webm`, out).pathname; await rename(original, destination); result.video = `${config.name}-realtime.webm`; }
    }
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

async function verifyExplore({ page, result, config, mark, hold, shot, phase }) {
  const inspect = () => page.evaluate(() => {
    const layer = document.querySelector('#content-root'), r = layer.getBoundingClientRect();
    const state = window.personalOSHost.getState();
    return { explore: state.sceneExplore, scene: state.scene, scroll: scrollY,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height }, opacity: Number(getComputedStyle(layer).opacity),
      inert: layer.inert, focus: document.activeElement.id,
      canvasCount: document.querySelectorAll('#motion-scene canvas').length,
      touchAction: getComputedStyle(document.querySelector('#motion-scene canvas')).touchAction };
  });
  const before = await inspect();
  assert.ok(before.scroll > 0, 'exploration begins from a nonzero reading scroll position');
  await mark('Explore: content fades in place, unchanged 3D scene exposed');
  await page.locator('#host-explore').click();
  await phase('sceneExplore', 'exploring');
  const exploring = await inspect();
  result.explore = { before, exploring };
  assert.equal(exploring.inert, true);
  assert.equal(await page.locator('#host-open-chat').evaluate(node => node.inert), true);
  assert.equal(await page.locator('#host-menu').evaluate(node => node.inert), true);
  assert.equal(await page.locator('.open-card').first().evaluate(node => !!node.closest('[inert]')), true);
  assert.equal(exploring.scene.pointerLease, false);
  assert.equal(exploring.explore.inputEnabled, true);
  assert.equal(exploring.opacity, 0);
  assert.equal(exploring.focus, 'scene-explore-return');
  assert.equal(exploring.canvasCount, 1);
  assert.equal(exploring.touchAction, 'none');
  for (const key of Object.keys(before.rect)) assert.ok(Math.abs(before.rect[key] - exploring.rect[key]) <= 1, `fade does not move or reflow content ${key}`);
  await page.mouse.wheel(0, 480);
  await page.keyboard.press('PageDown');
  await hold(800);
  assert.ok(Math.abs((await inspect()).scroll - before.scroll) <= 1, 'wheel/key input cannot change preserved scroll');
  await shot('explore');
  const dragStart = await page.evaluate(() => {
    const r = document.querySelector('#motion-scene canvas').getBoundingClientRect();
    const ball = window.personalOSHost.getState().scene.anchors.ball;
    return { x: r.left + ball.x, y: r.top + ball.y, radius: ball.radius };
  });
  assert.ok(dragStart.radius > 0 && dragStart.x > 0 && dragStart.x < config.width && dragStart.y > 0 && dragStart.y < config.height, 'real ball anchor visible and draggable');
  await mark('Drag original 3D ball left with actual pointer events');
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  for (let step = 1; step <= 18; step++) {
    await page.mouse.move(dragStart.x - Math.min(180, config.width * .24) * step / 18, dragStart.y - 12 * Math.sin(step / 18 * Math.PI));
    await hold(45);
  }
  const dragged = await inspect();
  await page.mouse.up();
  result.explore.drag = { start: dragStart, held: dragged.scene.anchors.ball };
  assert.ok(dragged.scene.anchors.ball.x < exploring.scene.anchors.ball.x - 3, 'existing scene ball genuinely responds to left drag');
  await hold(1400);
  await shot('ball-left');
  const groundBefore = await inspect();
  const ground = { x: groundBefore.scene.anchors.ball.x < config.width / 2 ? config.width * .78 : config.width * .22,
    y: Math.min(config.height - 140, Math.max(config.height * .72, groundBefore.scene.anchors.ground.y + 35)) };
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, ground), 'CANVAS', 'ground click lands on real scene canvas');
  await mark('Click terrain to send the existing ball to a new place');
  await page.mouse.click(ground.x, ground.y);
  // Wait for observed physical movement, not 1.8 seconds that may contain zero
  // software-GPU frames. Keep the same displacement assertion and natural clock.
  await page.waitForFunction(x => Math.abs(window.personalOSHost.getState().scene.anchors.ball.x - x) > 3, groundBefore.scene.anchors.ball.x, { timeout: 180000 });
  const groundAfter = await inspect();
  result.explore.groundClick = { point: ground, before: groundBefore.scene.anchors.ball, after: groundAfter.scene.anchors.ball };
  assert.ok(Math.abs(groundAfter.scene.anchors.ball.x - groundBefore.scene.anchors.ball.x) > 3, 'original ground-click behavior moves the ball');
  await page.evaluate(() => {
    window.__qaOriginalCanvas = document.querySelector('#motion-scene canvas');
    document.querySelector('#scene-explore-return').addEventListener('click', () => {
      window.__qaReturnBoundary = window.personalOSHost.getState().scene;
    }, { once: true });
  });
  await page.locator('#scene-explore-return').click();
  await page.waitForFunction(() => {
    const state = window.personalOSHost.getState();
    if (state.sceneExplore.phase !== 'reading') return false;
    window.__qaReadingBoundary = state.scene;
    return true;
  });
  result.explore.returnBoundary = await page.evaluate(() => ({ paused: window.__qaReturnBoundary, reading: window.__qaReadingBoundary,
    sameCanvas: window.__qaOriginalCanvas === document.querySelector('#motion-scene canvas') }));
  assert.equal(result.explore.returnBoundary.paused.paused, true);
  assert.equal(result.explore.returnBoundary.sameCanvas, true);
  for (const key of ['x', 'y', 'radius']) assert.ok(Math.abs(result.explore.returnBoundary.paused.anchors.ball[key] - result.explore.returnBoundary.reading.anchors.ball[key]) <= 8, `return does not reset ball ${key}; allows one natural simulation frame`);

  await mark('Return content at its original scroll position');
  const returned = await inspect();
  result.explore.returned = returned;
  assert.ok(Math.abs(returned.scroll - before.scroll) <= 1);
  assert.equal(returned.inert, false);
  assert.equal(returned.opacity, 1);
  assert.equal(returned.explore.inputEnabled, false);
  assert.equal(returned.focus, 'host-explore');
  assert.equal(returned.canvasCount, 1);
  assert.equal(returned.touchAction, 'pan-y');
  assert.equal(await page.locator('#scene-explore-controls').isVisible(), false);
  assert.equal(await page.locator('#host-open-chat').evaluate(node => node.inert), false);
  await hold(1200);
  await shot('explore-return');
  // API retargeting occurs in one JS task so geometry/velocity continuity can be compared exactly.
  result.explore.reversal = await page.evaluate(async () => {
    const api = window.personalOSSceneExplore;
    api.enter();
    await new Promise(resolve => setTimeout(resolve, 100));
    const before = api.getState();
    api.exit(); const reversed = api.getState();
    api.enter(); const resumed = api.getState();
    return { before, reversed, resumed };
  });
  for (const next of ['reversed', 'resumed']) for (const key of ['opacity', 'velocity']) assert.equal(result.explore.reversal.before[key], result.explore.reversal[next][key], `explore reversal preserves ${key}`);
  assert.equal(result.explore.reversal.reversed.inputEnabled, false);
  assert.equal(result.explore.reversal.resumed.inputEnabled, false);
  await phase('sceneExplore', 'exploring');
  await page.keyboard.press('Escape');
  await phase('sceneExplore', 'reading');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.personalOSHost.getState().reduced);
  await page.locator('#host-explore').click();
  await phase('sceneExplore', 'exploring');
  assert.equal((await inspect()).inert, true);
  await page.keyboard.press('Escape');
  await phase('sceneExplore', 'reading');
  assert.equal((await inspect()).inert, false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.personalOSHost.getState().reduced);
  result.checks.push('explore fade in place; scroll wheel/key lock; inert/focus restoration; real ball left drag; one original canvas; exact spring reversal continuity; reduced motion enter/exit');
}
