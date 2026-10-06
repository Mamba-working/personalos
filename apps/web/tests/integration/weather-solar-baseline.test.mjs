/** Exact alpha.3 mounted-controller negative control; not a browser/pixel measurement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as alpha3 from './fixtures/alpha3-solar-noop/weather.js';
import {createSolarFixture,solarStop} from './weather-solar-fixture.mjs';

test('frozen alpha.3 solar fixture remains byte-pinned and portable',()=>{
  const path=new URL('./fixtures/alpha3-solar-noop/',import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',path),'utf8'));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('weather.js',path))).digest('hex'),manifest.sha256);
  assert.equal(manifest.sha256,'2d8cc362266dee809a7c82e2e23adc224fee4ca5417f02274d05e034b20f332e');
  assert.equal(manifest.version,'v0.1.0-alpha.3');
});

test('negative alpha.3: actual Wind slider 22→45→75 changes sun vector but field stays byte-identical',()=>{
  const f=createSolarFixture({module:alpha3});
  try {
    f.preset('wind');const samples=[22,45,75].map(altitude=>f.input(altitude));
    for(let i=0;i<samples.length;i++){
      assert.equal(samples[i].state.target.altitude,[22,45,75][i]);assert.equal(samples[i].state.effective.altitude,[22,45,75][i]);
      assert.equal(samples[i].state.atmosphere.mode,'static-fallback');assert.equal(samples[i].state.renderer,'unavailable');
      assert.equal(samples[i].backgroundColor,'rgb(235, 237, 233)');assert.equal(samples[i].state.effective.day,1);
      assert.equal(samples[i].state.effective.solarEnergy,samples[0].state.effective.solarEnergy);
      assert.equal(samples[i].backgroundImage,samples[0].backgroundImage);
    }
    assert.notDeepEqual(samples[0].state.effective.sun,samples[1].state.effective.sun);
    assert.notDeepEqual(samples[1].state.effective.sun,samples[2].state.effective.sun);
    assert.deepEqual(solarStop(samples[0].backgroundImage),{x:39,y:5,alpha:.53,spread:65});
    assert.equal(f.calls.raf,0);assert.equal(f.d.querySelectorAll('canvas').length,0);
  } finally {f.close();}
});
