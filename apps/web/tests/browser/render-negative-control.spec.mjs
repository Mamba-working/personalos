import {test, expect, enterFeed} from './guards.fixture.mjs';
import {captureCanvasProof, requireRenderedPixels} from './canvas-proof.mjs';

test('initialized blank WebGL with colored CSS cannot pass @negative-render', async ({page},testInfo) => {
  await enterFeed(page);
  const fixture=await page.evaluate(() => {
    document.querySelector('#world-stage canvas').style.display='none';
    const canvas=document.createElement('canvas');
    canvas.id='blank-render-negative';canvas.width=innerWidth;canvas.height=innerHeight;
    canvas.style.cssText='display:block;width:100%;height:100%;background:linear-gradient(45deg,red,blue)';
    document.querySelector('#world-stage').append(canvas);
    document.documentElement.style.background='linear-gradient(red,blue)';
    document.body.style.background='linear-gradient(red,blue)';
    document.querySelector('#ball-world-root').style.background='linear-gradient(red,blue)';
    const label=document.createElement('div');label.textContent='Colored demo DOM must not count as renderer pixels';
    label.style.cssText='visibility:visible;color:red;background:linear-gradient(red,blue);position:fixed;inset:0;z-index:100';
    document.body.append(label);
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    if(!gl)return {initialized:false};
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT); // Initialized, zero scene draws.
    return {initialized:true,version:gl.getParameter(gl.VERSION),sceneDraws:0,cssAndDomColorsPresent:true};
  });
  expect(fixture.initialized,'NEGATIVE_RENDER_SETUP_BLOCKED: no initialized WebGL canvas; this does not prove blank-canvas rejection').toBe(true);
  const {image,pixels,layout}=await captureCanvasProof(page.locator('#blank-render-negative'));
  await testInfo.attach('canvas-layout-proof', {body:JSON.stringify(layout),contentType:'application/json'});
  await testInfo.attach('blank-canvas-proof', {body:image,contentType:'image/png'});
  await testInfo.attach('blank-canvas-fixture', {body:JSON.stringify({...fixture,pixels}),contentType:'application/json'});
  requireRenderedPixels(pixels); // Must throw this exact criterion's diagnostic.
});
