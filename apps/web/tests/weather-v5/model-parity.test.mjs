import assert from 'node:assert/strict';
import test from 'node:test';
import * as candidate from '../../runtime/modules/weather.js';
import * as baseline from './fixtures/alpha4-weather.mjs';
test('alpha.5 weather model retains 2,502 exact alpha.4 policy and solar snapshots',()=>{
let snapshots=0;
const same=(a,b)=>{assert.deepEqual(b,a);snapshots++;};
same(baseline.WEATHER_PRESETS,candidate.WEATHER_PRESETS);same(baseline.WEATHER_BUDGET,candidate.WEATHER_BUDGET);
for(const preset of Object.keys(baseline.WEATHER_PRESETS)){
 const a=baseline.createWeatherModel({preset}),b=candidate.createWeatherModel({preset});same(a.getState(),b.getState());
 for(const altitude of [-20,-8,-3,0,4,7,15,22,33,45,60,75])for(const azimuth of [-70,0,70])for(const cloud of [0,.42,1]){
  const patch={altitude,azimuth,cloud};same(a.setWeather(patch),b.setWeather(patch));same(a.step(.1),b.step(.1));same(a.step(0,{reduced:true}),b.step(0,{reduced:true}));
 }
 for(const patch of [{preset:'rain'},{preset:'clear',autoSun:true},{preset:'wind',paused:true},{paused:false,wind:9,direction:-180},{enabled:false},{enabled:true}]){
  same(a.setWeather(patch),b.setWeather(patch));for(const dt of [0,.01,.1,.5,1,-1,NaN])for(const policy of [{},{quiet:true},{hidden:true},{reduced:true}])same(a.step(dt,policy),b.step(dt,policy));
 }
 a.dispose();b.dispose();same(a.getState(),b.getState());
}
assert.equal(snapshots,2502);
});
