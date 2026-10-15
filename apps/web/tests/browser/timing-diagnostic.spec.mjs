import os from 'node:os';
import {performance as nodeClock} from 'node:perf_hooks';
import {test, expect, enterFeed} from './guards.fixture.mjs';

test('same card native open/close timing comparison @diagnostic', async ({page},testInfo) => {
  test.setTimeout(180000);
  const light=process.env.PERSONALOS_LIGHTWEIGHT_GUARD==='1';
  const loadBefore=os.loadavg();
  const started=nodeClock.now();
  await enterFeed(page);
  const opener=page.locator('#feed .open-card').first();
  await opener.scrollIntoViewIfNeeded();
  const environment=await page.evaluate(() => {
    const canvas=document.querySelector('#world-stage canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const debug=gl?.getExtension('WEBGL_debug_renderer_info');
    return {availability:window.personalOSWorldAvailability, viewport:{w:innerWidth,h:innerHeight},renderer:gl?(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):null,userAgent:navigator.userAgent};
  });
  const initialized=nodeClock.now();
  const phaseTimes=[];
  await page.evaluate(() => {
    window.__timingDiagnostic=[];
    window.addEventListener('personalos:content-transition',event=>{
      if(['select','detail-ready','cancel-return','returned'].includes(event.detail.action)) window.__timingDiagnostic.push({action:event.detail.action,t:performance.now()});
    });
  });
  const openStarted=nodeClock.now();
  await opener.click();
  await expect.poll(()=>page.evaluate(()=>window.personalOSContent.getState().phase),{timeout:90000}).toBe('detail');
  const opened=nodeClock.now();
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>window.personalOSContent.getState().phase),{timeout:90000}).toBe('preview');
  const closed=nodeClock.now();
  phaseTimes.push(...await page.evaluate(()=>window.__timingDiagnostic));
  const evidence={mode:light?'lightweight':'instrumented',environment,wallMs:{initialize:initialized-started,open:opened-openStarted,close:closed-opened,total:closed-started},phaseTimes,hostLoad:{before:loadBefore,after:os.loadavg(),availableParallelism:os.availableParallelism()},conditions:{cooperativeHeavyLockHeld:true,noOtherCooperatingHeavyJob:true,unrelatedHostCpuNotControlled:true,frameCollector:!light,traceVideo:!light,screenshots:!light},performanceThresholdsEvaluated:false,hardwareOrIPhoneConclusion:false};
  await testInfo.attach('timing-comparison-observation',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
});
