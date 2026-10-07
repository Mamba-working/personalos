import {test, expect} from './guards.fixture.mjs';
import {captureCanvasProof, requireRenderedPixels} from './canvas-proof.mjs';
import {installIntroEvidence, observeStartedProgress, readIntroEvidence, readCurrentRendererSnapshot, requireNativeControlClick} from './intro-evidence.mjs';

test('Ball/book replay render coverage @render requires actual native playback and nonblank canvas', async ({page}, testInfo) => {
  test.setTimeout(180000);
  await installIntroEvidence(page);
  try {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.personalOSWorldAvailability?.status || 'starting'), {timeout:10000}).not.toBe('starting');
    const availability = await page.evaluate(() => window.personalOSWorldAvailability);
    await testInfo.attach('render-availability', {body:JSON.stringify(availability),contentType:'application/json'});
    expect(availability.status, `RENDER_COVERAGE_BLOCKED: ${availability.reason || availability.status}; fallback/zero canvas never qualifies`).toBe('ready');
    const canvas = page.locator('#world-stage canvas');
    await expect(canvas).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.personalOSHost?.getState().ready)).toBe(true);
    const initial = await readCurrentRendererSnapshot(page);
    expect(initial.actorCount).toBe(1);
    expect(initial.canvasCount).toBe(1);
    expect(initial.triangles).toBeGreaterThan(0);
    expect(initial.calls).toBeGreaterThan(0);
    expect(initial.story.enabled).toBe(true);

    // Fresh autoplay has its own independent @entry gate. Native Replay
    // prepares the finite intro without altering elapsed time or app state.
    await page.locator('#host-replay').click();
    const intro = await observeStartedProgress(page, 'replay');
    const before = intro.before, observations = intro.observations;
    expect(before.story.active).toBe(true);
    expect(before.actorUUID).toBe(initial.actorUUID);
    expect(before.canvasIdentity).toBe(initial.canvasIdentity);
    expect(observations.every(row => row.actorUUID === before.actorUUID)).toBe(true);
    // Screenshot/GL probes come later. They can naturally outlast a 12.7s
    // intro, so they must not hide the real visible Skip control being tested.
    await page.locator('#host-skip').click();
    await expect.poll(() => page.evaluate(() => window.ballStudy.snapshot().story.phase), {timeout:30000}).toBe('home');
    const skipEvidence = await readIntroEvidence(page, 'replay');
    const skipClick = requireNativeControlClick(skipEvidence, '#host-skip', {afterSequence:intro.started.sequence, storySerial:intro.started.serial});
    expect(skipEvidence.events.some(event => event.action === 'skip' && event.phase === 'bridge' && event.serial === intro.started.serial && event.sequence > skipClick.sequence)).toBe(true);
    const after = await readCurrentRendererSnapshot(page);
    expect(after.actorUUID).toBe(before.actorUUID);
    expect(after.canvasIdentity).toBe(before.canvasIdentity);
    expect(after.triangles).toBeGreaterThan(0);

    const {image, pixels, layout} = await captureCanvasProof(canvas);
    await testInfo.attach('canvas-layout-proof', {body:JSON.stringify(layout),contentType:'application/json'});
    await testInfo.attach('0-replay-isolated-canvas', {body:image,contentType:'image/png'});
    const captureAfter = await readCurrentRendererSnapshot(page);
    expect(captureAfter.actorUUID).toBe(before.actorUUID);
    expect(captureAfter.canvasIdentity).toBe(before.canvasIdentity);
    expect(captureAfter.canvasCount).toBe(1);
    expect(captureAfter.triangles).toBeGreaterThan(0);
    expect(captureAfter.calls).toBeGreaterThan(0);
    await testInfo.attach('renderer-observation', {body:JSON.stringify({initial, before, observations, intro, skipEvidence, captureBefore:after, captureAfter, pixels, renderer:await page.evaluate(() => {
      const node = document.querySelector('#world-stage canvas'), gl = node.getContext('webgl2') || node.getContext('webgl');
      if (!gl) return null;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {version:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),hardwareProven:false};
    })}),contentType:'application/json'});
    requireRenderedPixels(pixels);
    await testInfo.attach('1-home-ui', {body:await page.screenshot(),contentType:'image/png'});
    await page.locator('#world-ball-hit').click();
    await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('open');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('closed');
    await page.mouse.move(100, Math.min(500, (await page.viewportSize()).height-100));
    await page.mouse.wheel(0, 650);
    await expect.poll(() => page.evaluate(() => document.scrollingElement.scrollTop)).toBeGreaterThan(100);
    await expect.poll(() => page.evaluate(() => window.ballStudy.snapshot().hostPlacement?.mode)).toBe('dock');
    const dock = await page.evaluate(() => window.ballStudy.snapshot());
    expect(dock.actorUUID).toBe(before.actorUUID);
    expect(dock.canvasCount).toBe(1);
    expect(dock.triangles).toBeGreaterThan(0);
    await testInfo.attach('2-restored-scroll-dock-ui', {body:await page.screenshot(),contentType:'image/png'});
    await testInfo.attach('final-dock-observation', {body:JSON.stringify(dock),contentType:'application/json'});
  } finally {
    if (!page.isClosed()) {
      const evidence = await readIntroEvidence(page, 'replay').catch(error => ({captureError:error.message}));
      await testInfo.attach('replay-intro-evidence', {body:JSON.stringify(evidence),contentType:'application/json'});
    }
  }
});

