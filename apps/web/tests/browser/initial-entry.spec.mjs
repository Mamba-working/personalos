import {test, expect} from './guards.fixture.mjs';
import {captureCanvasProof, requireRenderedPixels} from './canvas-proof.mjs';
import {installIntroEvidence, observeStartedProgress, readIntroEvidence, readCurrentRendererSnapshot} from './intro-evidence.mjs';

test('Fresh autoplay entry @render @entry requires actual active intro progress and renderer pixels', async ({page}, testInfo) => {
  test.setTimeout(180000);
  await installIntroEvidence(page);
  try {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.personalOSWorldAvailability?.status || 'starting'), {timeout: 10000}).not.toBe('starting');
    const availability = await page.evaluate(() => window.personalOSWorldAvailability);
    await testInfo.attach('entry-render-availability', {body: JSON.stringify(availability), contentType: 'application/json'});
    expect(availability.status, `RENDER_COVERAGE_BLOCKED: ${availability.reason || availability.status}; fallback/zero canvas never qualifies`).toBe('ready');
    const intro = await observeStartedProgress(page, 'autoplay');
    const canvas = page.locator('#world-stage canvas');
    await expect(canvas).toHaveCount(1);
    // Entry is already proven by the retained early active frames. Pixel capture
    // may naturally occur after the finite intro completes on a slow runner.
    // It never supplies substitute intro evidence and never invokes Replay.
    const captureBefore = await readCurrentRendererSnapshot(page);
    const {image, pixels, layout} = await captureCanvasProof(canvas);
    requireRenderedPixels(pixels);
    await testInfo.attach('entry-isolated-canvas', {body: image, contentType: 'image/png'});
    await testInfo.attach('entry-canvas-layout-proof', {body: JSON.stringify(layout), contentType: 'application/json'});
    const after = await readCurrentRendererSnapshot(page);
    expect(after.actorUUID).toBe(intro.before.actorUUID);
    expect(after.actorCount).toBe(1);
    expect(after.canvasCount).toBe(1);
    expect(after.domCanvasCount).toBe(1);
    expect(after.canvasIdentity).toBe(intro.before.canvasIdentity);
    expect(after.canvasConnected).toBe(true);
    expect(after.triangles).toBeGreaterThan(0);
    expect(after.calls).toBeGreaterThan(0);
    expect(after.availability.status).toBe('ready');
    const evidence = await readIntroEvidence(page, 'autoplay');
    expect(evidence.events.some(event => event.action === 'started' && event.reason === 'replay')).toBe(false);
    expect(evidence.controlClicks.some(click => click.target === '#host-replay')).toBe(false);
    await testInfo.attach('entry-renderer-proof', {body: JSON.stringify({intro, captureBefore, after, pixels,
      pixelCaptureScope: 'Actual canvas pixels bracketed by public state reads; capture is not claimed to remain in intro'}), contentType: 'application/json'});
  } finally {
    if (!page.isClosed()) {
      const evidence = await readIntroEvidence(page, 'autoplay').catch(error => ({captureError: error.message}));
      await testInfo.attach('fresh-entry-intro-evidence', {body: JSON.stringify(evidence), contentType: 'application/json'});
    }
  }
});
