/** Alpha.4 solar signal gates. This is source/model/DOM evidence, never pixel/GPU evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as weather from '../../runtime/modules/weather.js';
import {createSolarFixture,solarStop} from './weather-solar-fixture.mjs';

const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected} within ${tolerance}`);
const signature=s=>`${s.backgroundColor}|${s.backgroundImage}`;
const representative=[-20,-12,-8,-3,0,4,7,15,22,33,45,60,75];

function validateFinite(s){
  assert.ok(s.backgroundImage.length>100,'browser CSS parser retained a complete field');
  assert.doesNotMatch(signature(s),/NaN|Infinity|undefined/);
  const stop=solarStop(s.backgroundImage);
  assert.ok(stop.x>=0&&stop.x<=100);assert.ok(stop.y>=-6&&stop.y<=107);assert.ok(stop.spread>0&&stop.spread<=100);
  assert.ok(stop.alpha>=0&&stop.alpha<=1);assert.ok(stop.radiusX>0&&stop.radiusX<=100);assert.ok(stop.radiusY>0&&stop.radiusY<=100);return stop;
}

test('Wind actual range input reaches model and paint consumer at 22→45→75 in static no-WebGL fallback',()=>{
  const f=createSolarFixture();
  try {
    f.preset('wind');const samples=[22,45,75].map(altitude=>f.input(altitude));
    for(let i=0;i<samples.length;i++){
      const s=samples[i],altitude=[22,45,75][i];
      assert.equal(s.state.target.altitude,altitude);assert.equal(s.state.effective.altitude,altitude);assert.equal(s.state.effective.day,1);
      assert.equal(f.root.querySelector('[data-weather-field="altitude"]').min,'-20');assert.equal(f.root.querySelector('[data-weather-field="altitude"]').max,'75');
      assert.equal(s.state.renderer,'unavailable');assert.equal(s.state.atmosphere.mode,'static-fallback');assert.equal(s.state.time,0);validateFinite(s);
    }
    assert.equal(new Set(samples.map(signature)).size,3,'high-altitude UI cannot be a state-only change');
    const stops=samples.map(s=>solarStop(s.backgroundImage));
    assert.ok(stops[0].y>stops[1].y&&stops[1].y>stops[2].y,'higher physical sun must move the wash upward');
    assert.ok(stops[0].y-stops[2].y>10,'22→75 must produce meaningful geometric range, not RGB noise');
    assert.ok(stops[0].radiusX>stops[1].radiusX&&stops[1].radiusX>stops[2].radiusX,'horizontal haze narrows as sun rises');
    assert.ok(stops[0].radiusY<stops[1].radiusY&&stops[1].radiusY<stops[2].radiusY,'low-sun flat haze becomes more circular overhead');
    assert.ok(stops[0].alpha<stops[1].alpha&&stops[1].alpha<stops[2].alpha,'solar energy remains altitude-sensitive above 15°');
    assert.notDeepEqual(samples[0].state.effective.sun,samples[2].state.effective.sun);
  } finally {f.close();}
});

test('every integer control value −20..75 produces finite bounded model/consumer output; daytime never plateaus',()=>{
  const f=createSolarFixture();
  try {
    f.preset('wind');let previous=null;const snapshots=[];
    for(let altitude=-20;altitude<=75;altitude++){
      const sample=f.input(altitude);validateFinite(sample);snapshots.push(sample);
      assert.equal(sample.state.target.altitude,altitude);assert.equal(sample.state.effective.altitude,altitude);
      near(Math.hypot(...sample.state.effective.sun),1);assert.ok(sample.state.effective.solarEnergy>=0&&sample.state.effective.solarEnergy<=1);
      if(previous&&altitude>=8)assert.notEqual(signature(sample),signature(previous),`ambient plateau at ${altitude-1}→${altitude}°`);
      previous=sample;
    }
    for(const altitude of representative)assert.ok(snapshots.some(s=>s.state.target.altitude===altitude));
    assert.equal(f.root.querySelector('[data-weather-output="altitude"]').textContent,'75°');
    assert.equal(f.calls.raf,0);assert.equal(f.calls.timer,0);assert.equal(f.d.querySelectorAll('canvas').length,0);
  } finally {f.close();}
});

test('day/twilight/night and shared solar energy are continuous over representative boundaries and high angles',()=>{
  const model=weather.createWeatherModel({preset:'wind'}),samples=[];
  for(let altitude=-20;altitude<=75;altitude+=.25){model.setWeather({altitude});model.step(0,{reduced:true});samples.push(model.getState().effective);}
  for(let i=0;i<samples.length;i++){
    const s=samples[i];near(Math.hypot(...s.sun),1);assert.ok(s.day>=0&&s.day<=1);assert.ok(s.solarEnergy>=0&&s.solarEnergy<=1);
    if(s.altitude<=-8)assert.equal(s.day,0);if(s.altitude>=7)assert.equal(s.day,1);
    if(i){assert.ok(s.day>=samples[i-1].day);assert.ok(s.solarEnergy>=samples[i-1].solarEnergy);assert.ok(s.solarEnergy-samples[i-1].solarEnergy<.025,'no artificial energy jump');}
  }
  for(const [a,b] of [[15,22],[22,45],[45,60],[60,75]])assert.ok(samples.find(s=>s.altitude===a).solarEnergy<samples.find(s=>s.altitude===b).solarEnergy,`energy plateau ${a}..${b}`);
  for(const altitude of [-8,-3,0,7,15,22,45,75]){
    const left=weather.createWeatherModel({altitude:altitude-.00001,cloud:.42}).getState().effective;
    const right=weather.createWeatherModel({altitude:altitude+.00001,cloud:.42}).getState().effective;
    assert.ok(Math.abs(left.solarEnergy-right.solarEnergy)<.00001,`solar discontinuity near ${altitude}`);
  }
});

test('cloud attenuates the same mounted solar wash without moving the physical projection',()=>{
  const f=createSolarFixture();
  try {
    f.preset('wind');
    for(const altitude of [4,22,45,75]){
      f.input(altitude);let prior=null;
      for(const cloud of [0,.25,.5,.75,1]){
        f.api.setWeather({cloud});const s=f.snapshot(),stop=validateFinite(s);
        if(prior){near(stop.x,prior.stop.x);near(stop.y,prior.stop.y);assert.ok(stop.alpha<=prior.stop.alpha);assert.ok(s.state.effective.solarEnergy<=prior.energy);}
        prior={stop,energy:s.state.effective.solarEnergy};
      }
      f.api.setWeather({cloud:0});const clear=solarStop(f.snapshot().backgroundImage);f.api.setWeather({cloud:1});const overcast=solarStop(f.snapshot().backgroundImage);
      assert.ok(overcast.alpha<clear.alpha,`cloud attenuation visible in consumer at ${altitude}°`);
    }
  } finally {f.close();}
});

test('attached shared-frame path blends altitude then reaches the identical static fallback field',()=>{
  const attached=createSolarFixture({attached:true}),fallback=createSolarFixture();
  try {
    attached.preset('wind');attached.settle();fallback.preset('wind');
    const start=attached.snapshot();attached.input(75);assert.equal(attached.snapshot().state.target.altitude,75);near(attached.snapshot().state.effective.altitude,22);
    assert.equal(signature(attached.snapshot()),signature(start),'input only retargets attached source until shared frame');
    const halfway=attached.step(.1);assert.ok(halfway.state.effective.altitude>22&&halfway.state.effective.altitude<75);assert.notEqual(signature(halfway),signature(start));
    const end=attached.settle(),staticEnd=fallback.input(75);
    assert.equal(end.state.transitioning,false);assert.equal(signature(end),signature(staticEnd));
    assert.equal(end.state.atmosphere.mode,'shared-climate');assert.equal(staticEnd.state.atmosphere.mode,'static-fallback');
    assert.equal(attached.calls.raf,0);assert.equal(attached.calls.timer,0);assert.equal(attached.d.querySelectorAll('canvas').length,0);
  } finally {attached.close();fallback.close();}
});

test('interrupted shared altitude transitions retarget current sun and retain latest control intent',()=>{
  const f=createSolarFixture({attached:true});
  try {
    f.preset('wind');f.settle();f.input(75);const partial=f.step(.1,3);f.input(4);
    assert.deepEqual(f.snapshot().state.effective,partial.state.effective,'latest input does not jump effective climate');
    f.step(.1,2);f.input(45);const end=f.settle();assert.equal(end.state.target.altitude,45);assert.equal(end.state.effective.altitude,45);assert.equal(end.state.transitioning,false);
    const compare=createSolarFixture();try{compare.preset('wind');compare.input(45);assert.equal(signature(end),signature(compare.snapshot()));}finally{compare.close();}
  } finally {f.close();}
});

test('reading quiet attenuates solar wash and freezes frames while explicit static-fallback controls stay usable',()=>{
  const f=createSolarFixture({attached:true});
  try {
    f.preset('wind');f.input(75);f.settle();const active=f.snapshot(),activeStop=solarStop(active.backgroundImage);
    f.emit({readingQuiet:true});f.step(0);const quiet=f.snapshot(),stop=solarStop(quiet.backgroundImage);
    assert.equal(quiet.state.atmosphere.mode,'quiet-static');near(stop.x,activeStop.x);near(stop.y,activeStop.y);assert.ok(stop.alpha<activeStop.alpha*.3);
    const count=quiet.state.atmosphere.writes,time=quiet.state.time;f.input(22);f.step(.1,30);
    assert.equal(signature(f.snapshot()),signature(quiet));assert.equal(f.snapshot().state.time,time);assert.equal(f.snapshot().state.atmosphere.writes,count);assert.equal(f.effects.get('weather').needsFrame(),false);
    f.fallback();const fallback=f.snapshot();assert.equal(fallback.state.atmosphere.mode,'static-fallback');assert.equal(fallback.state.effective.altitude,22);assert.notEqual(signature(fallback),signature(quiet));
    assert.ok(solarStop(fallback.backgroundImage).alpha<activeStop.alpha*.3);
  } finally {f.close();}
});

test('reduced/paused control changes settle statically and never advance decorative or solar time',()=>{
  for(const mode of ['reduced','paused']){
    const f=createSolarFixture({attached:true,reduced:mode==='reduced'});
    try {
      f.preset('wind');if(mode==='paused')f.flag('paused',true);f.step(0);const time=f.snapshot().state.time,phase=f.snapshot().state.effect.phaseTime;
      const seen=[];for(const altitude of [22,45,75]){f.input(altitude);const s=f.step(.1);assert.equal(s.state.effective.altitude,altitude);assert.equal(s.state.transitioning,false);assert.equal(s.state.atmosphere.mode,'static');seen.push(signature(s));}
      assert.equal(new Set(seen).size,3);assert.equal(f.snapshot().state.time,time);assert.equal(f.snapshot().state.effect.phaseTime,phase);assert.equal(f.effects.get('weather').needsFrame(),false);
      const writes=f.snapshot().state.atmosphere.writes;f.step(.1,20);assert.equal(f.snapshot().state.atmosphere.writes,writes);
    } finally {f.close();}
  }
});

test('hidden mode with pending altitude consumes no frame time; fallback/recovery preserve one field and disable hides it',()=>{
  const f=createSolarFixture({attached:true});
  try {
    f.preset('wind');f.settle();const element=f.element,before=f.snapshot();f.emit({hidden:true});f.input(75);f.step(.1,10);
    assert.equal(signature(f.snapshot()),signature(before));assert.equal(f.snapshot().state.time,before.state.time);assert.equal(f.effects.get('weather').needsFrame(),false);
    f.emit({hidden:false});f.step(.1);assert.equal(f.snapshot().state.time,before.state.time);f.settle();
    f.fallback();const fallback=f.snapshot();f.attach();assert.equal(signature(f.snapshot()),signature(fallback));assert.equal(f.field.firstElementChild,element);assert.equal(f.field.children.length,1);
    f.flag('enabled',false);f.step(0);assert.equal(element.hidden,true);f.flag('enabled',true);f.step(0);assert.equal(element.hidden,false);assert.equal(f.d.querySelectorAll('canvas').length,0);
    f.api.dispose();assert.equal(f.field.children.length,0);assert.equal(f.listeners.size,0);assert.equal(f.effects.size,0);
  } finally {f.close();}
});

test('solar fix adds no independent renderer/canvas/RAF/timer and retains bounded weather geometry',()=>{
  const source=fs.readFileSync(new URL('../../runtime/modules/weather.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|new\s+(?:THREE\.)?WebGLRenderer|createElement\(\s*['"]canvas['"]/);
  assert.deepEqual(weather.WEATHER_BUDGET,{rainStrokes:32,windStrokes:18,drawObjects:3,geometries:3,materials:3,textures:0,addedLights:0});
  const f=createSolarFixture({attached:true});
  try{for(const altitude of representative){f.input(altitude);f.settle();}assert.equal(f.scene.children.length,4);assert.equal(f.scene.children.at(-1).children.length,3);assert.equal(f.calls.raf,0);assert.equal(f.calls.timer,0);assert.equal(f.d.querySelectorAll('canvas').length,0);}finally{f.close();}
});

test('projection is a single actual-sun-vector authority and the mounted field consumes its center/radii/energy',()=>{
  const f=createSolarFixture();
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const quantized=v=>Math.round(v*10)/10;
  try {
    f.preset('wind');
    for(const altitude of representative)for(const azimuth of [-70,0,20,70])for(const cloud of [0,.42,1]){
      f.api.setWeather({azimuth,cloud});const s=f.input(altitude),effective=s.state.effective,p=effective.solarProjection;
      const a=altitude*Math.PI/180,z=azimuth*Math.PI/180;
      const sun=[Math.cos(a)*Math.sin(z),Math.sin(a),-Math.cos(a)*Math.cos(z)];
      effective.sun.forEach((value,i)=>near(value,sun[i]));
      const h=Math.hypot(sun[0],sun[2]),height=Math.max(0,sun[1]);
      const expected={x:50+42*sun[0],y:78-84*sun[1],radiusX:46+18*h+8*cloud,radiusY:30+18*height+8*cloud,energy:smooth(-3,15,Math.asin(sun[1])*180/Math.PI)*height*(1-.67*cloud)};
      for(const [key,value] of Object.entries(expected))near(p[key],value);
      assert.deepEqual(weather.projectSolarAtmosphere(effective.sun,cloud),p);
      near(effective.solarEnergy,p.energy);
      const stop=solarStop(s.backgroundImage);
      for(const key of ['x','y','radiusX','radiusY'])near(stop[key],quantized(p[key]),1e-8);
      near(stop.alpha,Math.round((.14+.54*p.energy)*100)/100);
      assert.equal(effective.wind,6.5);assert.equal(effective.rain,0);assert.equal(effective.direction,62);
    }
  } finally {f.close();}
});

test('solar projection moves coherently with azimuth and altitude, clouds broaden both axes and returned state is detached',()=>{
  const solar=(altitude,azimuth,cloud=0)=>weather.createWeatherModel({altitude,azimuth,cloud}).getState().effective.solarProjection;
  for(const altitude of [-20,0,22,45,75]){
    const left=solar(altitude,-70),center=solar(altitude,0),right=solar(altitude,70);
    assert.ok(left.x<center.x&&center.x<right.x);near(left.x+right.x,100);near(left.y,right.y);near(left.radiusX,right.radiusX);near(left.energy,right.energy);
    const cloudy=solar(altitude,0,1);assert.ok(cloudy.radiusX>center.radiusX);assert.ok(cloudy.radiusY>center.radiusY);near(cloudy.x,center.x);near(cloudy.y,center.y);assert.ok(cloudy.energy<=center.energy);
  }
  const a=solar(22,20),b=solar(75,20);assert.ok(Math.abs(b.x-50)<Math.abs(a.x-50));assert.ok(b.y<a.y);assert.ok(b.radiusX<a.radiusX);assert.ok(b.radiusY>a.radiusY);
  const model=weather.createWeatherModel({altitude:45}),snapshot=model.getState();snapshot.effective.solarProjection.x=-999;snapshot.effective.sun[1]=-999;assert.notEqual(model.getState().effective.solarProjection.x,-999);assert.notEqual(model.getState().effective.sun[1],-999);
});
