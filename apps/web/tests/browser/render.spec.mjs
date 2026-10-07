import {test, expect} from './guards.fixture.mjs';
import {captureCanvasProof, requireRenderedPixels} from './canvas-proof.mjs';

test('Ball/book render coverage @render requires real nonblank canvas, never fallback PASS', async ({page}, testInfo) => {
  test.setTimeout(180000);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.personalOSWorldAvailability?.status || 'starting'), {timeout:10000}).not.toBe('starting');
  const availability = await page.evaluate(() => window.personalOSWorldAvailability);
  await testInfo.attach('render-availability', {body:JSON.stringify(availability),contentType:'application/json'});
  expect(availability.status, `RENDER_COVERAGE_BLOCKED: ${availability.reason || availability.status}; fallback/zero canvas never qualifies`).toBe('ready');
  const canvas=page.locator('#world-stage canvas');
  await expect(canvas).toHaveCount(1);
  const before=await page.evaluate(() => window.ballStudy.snapshot());
  expect(before.actorCount).toBe(1);
  expect(before.canvasCount).toBe(1);
  expect(before.triangles).toBeGreaterThan(0);
  expect(before.calls).toBeGreaterThan(0);
  expect(before.story.enabled).toBe(true);
  expect(before.story.active).toBe(true);
  const observations=[];
  for(let i=0;i<3;i++) {
    await page.waitForTimeout(500);
    observations.push(await page.evaluate(() => window.ballStudy.snapshot()));
  }
  await expect.poll(() => page.evaluate(() => window.ballStudy.snapshot().story.time), {timeout:30000}).toBeGreaterThan(before.story.time+.2);
  observations.push(await page.evaluate(() => window.ballStudy.snapshot()));
  expect(observations.every(s=>s.actorUUID===before.actorUUID)).toBe(true);
  const {image,pixels,layout}=await captureCanvasProof(canvas);
  await testInfo.attach('canvas-layout-proof', {body:JSON.stringify(layout),contentType:'application/json'});
  await testInfo.attach('0-intro-isolated-canvas', {body:image,contentType:'image/png'});
  await testInfo.attach('renderer-observation', {body:JSON.stringify({before,observations,pixels,renderer:await page.evaluate(() => {
    const node=document.querySelector('#world-stage canvas'), gl=node.getContext('webgl2')||node.getContext('webgl');
    if(!gl)return null;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {version:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),hardwareProven:false};
  })}),contentType:'application/json'});
  requireRenderedPixels(pixels);
  await page.locator('#host-skip').click();
  await expect.poll(()=>page.evaluate(()=>window.ballStudy.snapshot().story.phase),{timeout:30000}).toBe('home');
  const after=await page.evaluate(()=>window.ballStudy.snapshot());
  expect(after.actorUUID).toBe(before.actorUUID);
  expect(after.triangles).toBeGreaterThan(0);
  await testInfo.attach('1-home-ui', {body:await page.screenshot(),contentType:'image/png'});
  // Real pointer activation belongs to the same actor. Hardware GPU remains unclaimed.
  await page.locator('#world-ball-hit').click();
  await expect.poll(()=>page.evaluate(()=>window.personalOSChat.getState().phase)).toBe('open');
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>window.personalOSChat.getState().phase)).toBe('closed');
  await page.mouse.move(100, Math.min(500, (await page.viewportSize()).height-100));
  await page.mouse.wheel(0, 650);
  await expect.poll(()=>page.evaluate(()=>document.scrollingElement.scrollTop)).toBeGreaterThan(100);
  await expect.poll(()=>page.evaluate(()=>window.ballStudy.snapshot().hostPlacement?.mode)).toBe('dock');
  const dock=await page.evaluate(()=>window.ballStudy.snapshot());
  expect(dock.actorUUID).toBe(before.actorUUID);
  expect(dock.canvasCount).toBe(1);
  expect(dock.triangles).toBeGreaterThan(0);
  await testInfo.attach('2-restored-scroll-dock-ui', {body:await page.screenshot(),contentType:'image/png'});
  await testInfo.attach('final-dock-observation', {body:JSON.stringify(dock),contentType:'application/json'});
});
