import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../integration/node_modules/jsdom/lib/api.js';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import {createFrameClock} from '../../runtime/story/frame-clock.js';
import {createWeatherModel, createWeatherEffect, mountWeather, WEATHER_BUDGET, WEATHER_PRESETS} from '../../runtime/modules/weather.js';

const near = (a,b,e=1e-9) => assert.ok(Math.abs(a-b)<e, `${a} != ${b}`);
function fixture(weather = {preset:'cloudy'}) {
  const scene = new THREE.Scene(), actor = new THREE.Group(); actor.name = 'Ball / persistent actor'; actor.position.set(2.8,1.177,.1); scene.add(actor);
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(.1,.2), new THREE.MeshBasicMaterial({color:'#252B38'})); actor.add(eye);
  const key = new THREE.DirectionalLight('#FFF7EE',3), sky = new THREE.HemisphereLight('#EEF0F6','#788298',1.5); scene.add(key,sky);
  let state = {phase:'home', reduced:false, hidden:false, placement:{mode:'hero',progress:0}, weather}, requested=0;
  const context = {THREE,scene,actor,getState:()=>state,requestFrame:()=>requested++};
  return {context,scene,actor,eye,key,sky,get state(){return state;},set state(s){state=s;},get requested(){return requested;}};
}
const steps = (effect,n=700) => { for(let i=0;i<n;i++) effect.update(1/60); };

test('presets are source-derived and every public state is explicitly simulated',()=>{
  assert.equal(WEATHER_PRESETS.rain.altitude,-18);assert.equal(WEATHER_PRESETS.rain.rain,.7);
  assert.equal(WEATHER_PRESETS.cloudy.cloud,.58);assert.equal(WEATHER_PRESETS.clear.wind,1.8);assert.equal(WEATHER_PRESETS.dawn.altitude,4);
  assert.equal(createWeatherModel().getState().simulated,true);
  const model=createWeatherModel({preset:'cloud'});assert.equal(model.getState().preset,'cloudy');
  model.setWeather({rain:12,wind:-1,daylight:900});assert.equal(model.getState().target.rain,1);assert.equal(model.getState().target.wind,0);assert.equal(model.getState().target.altitude,75);
  const before=model.getState();assert.equal(model.setWeather({preset:'nonsense',rain:NaN}),false);assert.deepEqual(model.getState(),before);
});

test('retargeting never snaps to a prior preset; repeated interruption converges to latest target',()=>{
  const model=createWeatherModel({preset:'clear'});model.setWeather({preset:'rain'});model.step(.1);
  const partial=model.getState().effective;assert.ok(partial.rain>0&&partial.rain<.7);
  model.setWeather({preset:'wind'});assert.deepEqual(model.getState().effective,partial);
  model.step(.1);assert.ok(model.getState().effective.rain<partial.rain);
  model.setWeather({preset:'dawn'});model.step(.08);model.setWeather({preset:'rain'});
  for(let i=0;i<1100;i++)model.step(1/60);
  assert.equal(model.getState().transitioning,false);
  for(const k of ['altitude','azimuth','cloud','rain','wind','direction'])near(model.getState().effective[k],WEATHER_PRESETS.rain[k]);
});

test('daylight is continuous, bounded and driven solely by shared dt',()=>{
  const model=createWeatherModel({preset:'rain'});model.setWeather({daylight:4});model.step(.1);
  assert.ok(model.getState().effective.altitude>-18&&model.getState().effective.altitude<4);
  assert.equal(model.getState().effective.day,0);
  model.step(0,{reduced:true});assert.ok(model.getState().effective.day>0&&model.getState().effective.day<1);
  model.setWeather({autoSun:true});const before=model.getState().target.altitude;model.step(.1);near(model.getState().target.altitude,before+.0012);
  const time=model.getState().time;model.step(3600);near(model.getState().time,time);
});

test('hidden and quiet freeze state; reduced/paused settle without decorative time',()=>{
  const model=createWeatherModel({preset:'clear'});model.setWeather({preset:'rain'});
  const before=model.getState();model.step(.1,{hidden:true});assert.deepEqual(model.getState(),before);
  model.step(.1,{quiet:true});assert.deepEqual(model.getState(),before);
  model.step(.1,{reduced:true});assert.equal(model.getState().transitioning,false);near(model.getState().time,0);
  model.setWeather({preset:'clear',paused:true});model.step(.1);near(model.getState().effective.rain,0);near(model.getState().time,0);
});

test('one existing scene receives exactly the declared bounded resources, never another actor',()=>{
  const f=fixture({preset:'rain'}), before=f.scene.children.length;
  const actorData={position:f.actor.position.toArray(),rotation:f.actor.rotation.toArray(),scale:f.actor.scale.toArray(),children:[...f.actor.children],color:f.eye.material.color.getHex()};
  const effect=createWeatherEffect(f.context);steps(effect,60);
  assert.equal(f.scene.children.length,before+1);assert.equal(f.scene.children.filter(o=>o.name==='Ball / persistent actor').length,1);
  const root=f.scene.children.at(-1);assert.equal(root.children.length,WEATHER_BUDGET.drawObjects);
  assert.equal(root.children.filter(c=>c.isLineSegments)[0].geometry.attributes.position.count,64);
  assert.equal(root.children.filter(c=>c.isLineSegments)[1].geometry.attributes.position.count,36);
  assert.deepEqual(f.actor.position.toArray(),actorData.position);assert.deepEqual(f.actor.rotation.toArray(),actorData.rotation);assert.deepEqual(f.actor.scale.toArray(),actorData.scale);
  assert.deepEqual(f.actor.children,actorData.children);assert.equal(f.eye.material.color.getHex(),actorData.color);
  assert.equal(f.requested,1);
  effect.dispose();assert.equal(f.scene.children.length,before);
});

test('clock need sleeps on clear/cloud/static/quiet/hidden, wakes for transition/rain/wind/auto-sun',()=>{
  const f=fixture(),effect=createWeatherEffect(f.context);assert.equal(effect.needsFrame(),false);
  f.state.weather={preset:'rain'};assert.equal(effect.needsFrame(),true);steps(effect);assert.equal(effect.needsFrame(),true);
  for(const change of [{hidden:true},{reduced:true},{readingQuiet:true},{phase:'story'},{placement:{mode:'dock',progress:1}},{activity:{state:'typing'}}]) {
    const before=f.state;f.state={...before,...change};effect.update(1/60);assert.equal(effect.needsFrame(),false,JSON.stringify(change));f.state=before;
  }
  f.state.weather={preset:'rain',paused:true};effect.update(0);assert.equal(effect.needsFrame(),false);
  f.state.weather={preset:'rain',enabled:false};effect.update(0);assert.equal(effect.needsFrame(),false);
  f.state.weather={preset:'clear',enabled:true,paused:false};steps(effect,850);assert.equal(effect.needsFrame(),false);
  f.state.weather={preset:'wind'};steps(effect,850);assert.equal(effect.needsFrame(),true);
  f.state.weather={preset:'clear',autoSun:true};steps(effect,850);assert.equal(effect.needsFrame(),true);
  effect.dispose();assert.equal(effect.needsFrame(),false);
});

test('hidden resume consumes zero shared time and does not fast-forward rain or a pending blend',()=>{
  const f=fixture({preset:'rain'}), effect=createWeatherEffect(f.context);effect.update(.1);
  const before=effect.getState();f.state.hidden=true;effect.update(.1);assert.equal(effect.getState().effect.visible,false);assert.equal(effect.needsFrame(),false);
  f.state.hidden=false;effect.update(.1);near(effect.getState().time,before.time);near(effect.getState().effect.phaseTime,before.effect.phaseTime);
  effect.update(.1);near(effect.getState().time,before.time+.1);effect.dispose();
});

test('weather light changes are bounded and original light values restore exactly on quiet/disable/dispose',()=>{
  const f=fixture({preset:'rain'}),color=f.key.color.clone(),intensity=f.key.intensity,effect=createWeatherEffect(f.context);
  assert.ok(f.key.intensity<intensity);assert.ok(f.key.intensity>intensity*.65);
  f.state.readingQuiet=true;effect.update(0);assert.equal(f.key.intensity,intensity);assert.deepEqual(f.key.color,color);
  f.state.readingQuiet=false;effect.update(0);assert.notEqual(f.key.intensity,intensity);
  f.state.weather={preset:'rain',enabled:false};effect.update(0);assert.equal(f.key.intensity,intensity);assert.deepEqual(f.key.color,color);
  f.state.weather={preset:'rain',enabled:true};effect.update(0);effect.dispose();assert.equal(f.key.intensity,intensity);assert.deepEqual(f.key.color,color);
});

test('each owned geometry/material is disposed once and no scene resources accumulate after re-register',()=>{
  const f=fixture({preset:'rain'}),baseline=f.scene.children.length;
  for(let cycle=0;cycle<6;cycle++) {
    const effect=createWeatherEffect(f.context),root=f.scene.children.at(-1),counts=[];
    root.traverse(o=>{for(const resource of [o.geometry,o.material].filter(Boolean)){const count={value:0};resource.addEventListener('dispose',()=>count.value++);counts.push(count);}});
    const materials=root.children.map(o=>o.material);const versions=materials.map(m=>m.version);
    f.state.weather={preset:cycle%2?'rain':'wind'};steps(effect,12);
    assert.deepEqual(materials.map(m=>m.version),versions,'weather must not trigger shader recompilation');
    effect.dispose();effect.dispose();effect.update(.1);assert.equal(f.scene.children.length,baseline);assert.equal(counts.length,6);assert.ok(counts.every(c=>c.value===1));
  }
});

function hostFixture() {
  const dom=new JSDOM('<!doctype html><body><button id="outside">unchanged</button><div id="slot"></div></body>');
  const f=fixture();const listeners=new Set(),effects=new Map();let available=null,changes=0;
  const world={registerEffect(name,factory){assert.ok(!effects.has(name),'duplicate effect');const effect=factory(f.context);effects.set(name,effect);return()=>{if(effects.get(name)===effect){effects.delete(name);effect.dispose();}};},requestFrame(){f.context.requestFrame();}};
  const host={world:()=>available,getState:()=>({...f.state,worldAvailability:{status:available?'ready':'failed'}}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},moduleChanged(){changes++;for(const fn of listeners)fn(host.getState());}};
  return {dom,host,f,effects,listeners,slot:dom.window.document.querySelector('#slot'),world,get changes(){return changes;},emit(action,next=world){available=next;for(const fn of listeners)fn({...host.getState(),action});}};
}

test('container-only UI works without WebGL, uses source controls, and reports simulated fallback honestly',()=>{
  const h=hostFixture(),outside=h.dom.window.document.querySelector('#outside').outerHTML,api=mountWeather({host:h.host,container:h.slot});
  assert.equal(api.getState().renderer,'unavailable');assert.match(h.slot.textContent,/不读取位置或实时天气/);assert.match(h.slot.textContent,/模拟参数仍可调整/);
  h.slot.querySelector('[data-weather-preset=rain]').click();assert.equal(api.getState().preset,'rain');assert.equal(h.changes,1);
  const slider=h.slot.querySelector('[data-weather-field=altitude]');slider.value='8';slider.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));assert.equal(api.getState().target.altitude,8);
  assert.equal(h.dom.window.document.querySelector('#outside').outerHTML,outside);assert.equal(h.dom.window.document.querySelectorAll('canvas').length,0);
  const details=h.slot.firstChild;details.open=true;details.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(details.open,false);assert.equal(h.dom.window.document.activeElement,details.querySelector('summary'));
  api.dispose();assert.equal(h.slot.children.length,0);assert.equal(h.listeners.size,0);h.dom.window.close();
});

test('mount-before-ready, repeated ready, fallback, re-register and repeated disposal have one effect',()=>{
  const h=hostFixture(),baseline=h.f.scene.children.length,api=mountWeather({host:h.host,container:h.slot});
  assert.equal(mountWeather({host:h.host,container:h.slot}),api);assert.equal(h.slot.children.length,1);
  api.setWeather({preset:'rain'});h.emit('ready');assert.equal(h.effects.size,1);assert.equal(api.getState().renderer,'attached');assert.equal(h.f.scene.children.length,baseline+1);
  h.emit('ready');h.emit('world-recovered');assert.equal(h.effects.size,1);assert.equal(h.f.scene.children.length,baseline+1);
  h.effects.get('weather').update(.1);const partial=api.getState().effective.rain;
  h.emit('world-fallback',null);assert.equal(h.effects.size,0);assert.equal(h.f.scene.children.length,baseline);assert.equal(api.getState().preset,'rain');
  h.emit('world-recovered');near(api.getState().effective.rain,partial);assert.equal(h.effects.size,1);
  api.dispose();api.dispose();assert.equal(h.effects.size,0);assert.equal(h.f.scene.children.length,baseline);assert.equal(h.listeners.size,0);
  h.emit('ready');assert.equal(h.effects.size,0);assert.equal(api.setWeather({preset:'clear'}),false);
  const again=mountWeather({host:h.host,container:h.slot});assert.notEqual(again,api);assert.equal(h.effects.size,1);again.dispose();h.dom.window.close();
});

test('module source owns no network, canvas, renderer, independent clock, app/history or actor-placement writes',()=>{
  const source=fs.readFileSync(new URL('../../runtime/modules/weather.js',import.meta.url),'utf8');
  for(const pattern of [/\brequestAnimationFrame\s*\(/,/\bset(?:Interval|Timeout)\s*\(/,/\bnew\s+THREE\.(?:WebGLRenderer|Scene|PerspectiveCamera)\s*\(/,/\bfetch\s*\(/,/\b(?:localStorage|history|geolocation)\b/,/document\.body/,/actor\.(?:position|scale|rotation|quaternion)\.(?:set|copy|add|multiply)/])assert.doesNotMatch(source,pattern);
  const css=fs.readFileSync(new URL('../../runtime/modules/weather.css',import.meta.url),'utf8');assert.doesNotMatch(css,/(?:^|\})\s*(?:body|html|:root|\.app|\.feed-card)\s*[{,]/m);
});


test('candidate shared frame clock really sleeps, resumes and cancels with weather as its only consumer',()=>{
  const f=fixture({preset:'cloudy'}),pending=new Map();let id=0,clock,effect;
  clock=createFrameClock({request:fn=>{pending.set(++id,fn);return id;},cancel:id=>pending.delete(id),visible:()=>!f.state.hidden,step:dt=>effect.update(dt),needsFrame:()=>effect.needsFrame()});
  effect=createWeatherEffect({...f.context,requestFrame:()=>clock.wake()});
  const frame=stamp=>{assert.equal(pending.size,1);const [id,fn]=pending.entries().next().value;pending.delete(id);fn(stamp);};
  frame(0);assert.equal(clock.getState().running,false);assert.equal(pending.size,0);
  f.state.weather={preset:'rain'};clock.wake();frame(16);assert.equal(pending.size,1);
  f.state.readingQuiet=true;frame(32);assert.equal(pending.size,0);
  f.state.readingQuiet=false;clock.wake();frame(48);assert.equal(pending.size,1);
  f.state.reduced=true;frame(64);assert.equal(pending.size,0);assert.equal(effect.getState().transitioning,false);
  f.state.reduced=false;clock.wake();frame(80);assert.equal(pending.size,1);
  f.state.hidden=true;clock.suspend();assert.equal(pending.size,0);clock.wake();assert.equal(pending.size,0);
  f.state.hidden=false;clock.wake();frame(96);assert.equal(pending.size,1);
  effect.dispose();frame(112);assert.equal(pending.size,0);clock.dispose();
});

test('one viewport atmosphere shares effective climate and changes only on supplied world frames',()=>{
  const h=hostFixture(),field=h.dom.window.document.createElement('div');field.id='weather-field';h.dom.window.document.body.prepend(field);
  h.emit('ready');const api=mountWeather({host:h.host,container:h.slot,fieldContainer:field});
  const element=field.querySelector('.weather-atmosphere');assert.ok(element);assert.equal(field.children.length,1);assert.equal(api.getState().atmosphere.available,true);
  const initial=element.style.backgroundColor;api.setWeather({preset:'rain'});assert.equal(element.style.backgroundColor,initial,'target selection is not an immediate field swap');
  h.effects.get('weather').update(.1);assert.notEqual(element.style.backgroundColor,initial);
  assert.ok(api.getState().effective.rain>0&&api.getState().effective.rain<.7);
  const writes=api.getState().atmosphere.writes;steps(h.effects.get('weather'),60);assert.ok(api.getState().atmosphere.writes-writes<=11,'field paint is capped at about 10 Hz on the shared clock');
  steps(h.effects.get('weather'),1000);const rain=element.style.backgroundColor,stable=api.getState().atmosphere.writes;steps(h.effects.get('weather'),120);assert.equal(api.getState().atmosphere.writes,stable,'settled rain does not continuously repaint the field');
  api.setWeather({preset:'clear'});steps(h.effects.get('weather'),1000);assert.notEqual(element.style.backgroundColor,rain);
  assert.equal(field.firstElementChild,element);assert.equal(h.dom.window.document.querySelectorAll('canvas').length,0);
  api.dispose();assert.equal(field.children.length,0);assert.equal(field.parentElement,h.dom.window.document.body);h.dom.window.close();
});

test('viewport atmosphere is attenuated and static in quiet/reduced/hidden modes',()=>{
  const h=hostFixture(),field=h.dom.window.document.createElement('div');h.dom.window.document.body.prepend(field);h.emit('ready');
  const api=mountWeather({host:h.host,container:h.slot,fieldContainer:field});api.setWeather({preset:'rain'});const effect=h.effects.get('weather');steps(effect,1000);
  const element=field.firstElementChild,activePaint=element.style.backgroundImage;
  h.f.state.readingQuiet=true;effect.update(0);assert.equal(api.getState().atmosphere.mode,'quiet-static');assert.notEqual(element.style.backgroundImage,activePaint);assert.match(element.style.backgroundImage,/rgba\(98,\s*123,\s*159,\s*0(?:\.00)?\)/);
  const quietPaint=element.style.cssText,quietWrites=api.getState().atmosphere.writes;steps(effect,120);assert.equal(element.style.cssText,quietPaint);assert.equal(api.getState().atmosphere.writes,quietWrites);assert.equal(effect.needsFrame(),false);
  h.f.state.hidden=true;api.setWeather({preset:'clear'});steps(effect,120);assert.equal(element.style.cssText,quietPaint);
  h.f.state.hidden=false;h.f.state.readingQuiet=false;h.f.state.reduced=true;effect.update(.1);assert.equal(api.getState().atmosphere.mode,'static');assert.equal(effect.needsFrame(),false);assert.equal(api.getState().transitioning,false);
  api.setWeather({enabled:false});effect.update(0);assert.equal(element.hidden,true);api.dispose();h.dom.window.close();
});

test('no-WebGL viewport fallback uses static target weather and labels it honestly, retaining it through recovery',()=>{
  const h=hostFixture(),field=h.dom.window.document.createElement('div');h.dom.window.document.body.prepend(field);
  const rootStyle=h.dom.window.document.documentElement.getAttribute('style'),bodyStyle=h.dom.window.document.body.getAttribute('style');
  const api=mountWeather({host:h.host,container:h.slot,fieldContainer:field});assert.equal(api.getState().renderer,'unavailable');assert.equal(api.getState().atmosphere.mode,'static-fallback');assert.match(h.slot.textContent,/静态模拟天光/);
  const element=field.firstElementChild,initial=element.style.backgroundColor;api.setWeather({preset:'rain'});assert.notEqual(element.style.backgroundColor,initial);assert.equal(api.getState().effective.rain,.7);assert.equal(api.getState().time,0);
  const shown=element.style.cssText;h.emit('ready');assert.equal(field.firstElementChild,element);assert.equal(element.style.cssText,shown);assert.equal(api.getState().atmosphere.mode,'shared-climate');
  h.emit('world-fallback',null);assert.equal(api.getState().atmosphere.mode,'static-fallback');assert.equal(field.firstElementChild,element);
  assert.equal(h.dom.window.document.documentElement.getAttribute('style'),rootStyle);assert.equal(h.dom.window.document.body.getAttribute('style'),bodyStyle);
  api.dispose();assert.equal(field.children.length,0);h.dom.window.close();
});

function disclosureFixture({waapi=true,reduced=false}={}) {
  const h=hostFixture(),animations=[],listeners=new Set(),focusCalls=[];
  const query={matches:reduced,addEventListener(type,fn){assert.equal(type,'change');listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);}};
  h.dom.window.matchMedia=()=>query;
  if(waapi)h.dom.window.Element.prototype.animate=function(keyframes,options){
    const animation={element:this,keyframes,options,currentTime:0,playbackRate:1,playState:'running',reverseCount:0,cancelCount:0,onfinish:null,
      reverse(){this.playbackRate*=-1;this.reverseCount++;this.playState='running';},
      cancel(){this.cancelCount++;this.playState='idle';this.currentTime=null;},
      finish(){this.currentTime=this.playbackRate<0?0:options.duration;this.playState='finished';this.onfinish?.();}};
    animations.push(animation);return animation;
  };
  const api=mountWeather({host:h.host,container:h.slot}),root=h.slot.firstElementChild,summary=root.querySelector('summary'),panel=root.querySelector('.weather-panel');
  const focus=summary.focus.bind(summary);summary.focus=options=>{focusCalls.push(options);focus(options);};
  return {...h,api,root,summary,panel,animations,listeners,focusCalls,setSystemReduced(value){query.matches=value;for(const fn of listeners)fn({matches:value});},close(){api.dispose();h.dom.window.close();}};
}

test('disclosure rapidly reverses one finite paint track without resetting current presentation or inner layout',()=>{
  const f=disclosureFixture(),children=[...f.panel.children];f.summary.click();
  assert.equal(f.root.open,true);assert.equal(f.api.getState().disclosure.phase,'opening');assert.equal(f.animations.length,1);
  const animation=f.animations[0];assert.equal(animation.element,f.panel);assert.equal(animation.options.duration,200);assert.deepEqual(Object.keys(animation.keyframes[0]).sort(),['opacity','transform']);assert.deepEqual(Object.keys(animation.keyframes[1]).sort(),['opacity','transform']);
  animation.currentTime=73;f.root.querySelector('[data-weather-close]').click();assert.equal(f.root.open,true,'details remains mounted through exit');assert.equal(f.panel.inert,true);assert.equal(animation.currentTime,73);assert.equal(animation.reverseCount,1);
  f.summary.click();assert.equal(f.root.open,true);assert.equal(f.panel.inert,false);assert.equal(animation.currentTime,73);assert.equal(animation.reverseCount,2);assert.equal(f.animations.length,1);assert.equal(f.api.getState().disclosure.phase,'opening');
  assert.deepEqual([...f.panel.children],children);animation.finish();assert.equal(f.root.open,true);assert.equal(f.api.getState().disclosure.animating,false);assert.equal(f.api.getState().disclosure.phase,'open');assert.equal(animation.cancelCount,1);
  f.summary.click();assert.equal(f.animations.length,2);const exit=f.animations[1];assert.equal(exit.currentTime,200);assert.equal(exit.playbackRate,-1);assert.equal(f.root.open,true);exit.finish();assert.equal(f.root.open,false);assert.equal(f.api.getState().disclosure.phase,'closed');f.close();
});

test('Close and Escape restore summary focus with preventScroll while waiting for exit completion',()=>{
  const f=disclosureFixture();f.dom.window.document.documentElement.scrollTop=321;
  f.summary.click();f.animations[0].finish();f.root.querySelector('[data-weather-close]').focus();f.root.querySelector('[data-weather-close]').click();
  assert.deepEqual(f.focusCalls.at(-1),{preventScroll:true});assert.equal(f.dom.window.document.activeElement,f.summary);assert.equal(f.dom.window.document.documentElement.scrollTop,321);assert.equal(f.root.open,true);
  f.animations.at(-1).finish();assert.equal(f.root.open,false);
  f.summary.click();f.animations.at(-1).currentTime=110;
  const event=new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});f.panel.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.deepEqual(f.focusCalls.at(-1),{preventScroll:true});assert.equal(f.root.open,true);assert.equal(f.panel.getAttribute('aria-hidden'),'true');assert.equal(f.summary.getAttribute('aria-expanded'),'false');
  const count=f.animations.length;f.panel.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.animations.length,count);f.animations.at(-1).finish();assert.equal(f.root.open,false);f.close();
});

test('reduced preference at mount or during a reversible disclosure settles its intended endpoint',()=>{
  const f=disclosureFixture({reduced:true});f.summary.click();assert.equal(f.root.open,true);assert.equal(f.animations.length,0);f.root.querySelector('[data-weather-close]').click();assert.equal(f.root.open,false);assert.deepEqual(f.focusCalls.at(-1),{preventScroll:true});
  f.setSystemReduced(false);f.summary.click();const opening=f.animations.at(-1);opening.currentTime=90;f.setSystemReduced(true);assert.equal(f.root.open,true);assert.equal(opening.cancelCount,1);assert.equal(f.api.getState().disclosure.animating,false);
  f.setSystemReduced(false);f.root.querySelector('[data-weather-close]').click();const closing=f.animations.at(-1);closing.currentTime=120;f.f.state.reduced=true;f.emit('preferences',null);assert.equal(f.root.open,false);assert.equal(closing.cancelCount,1);assert.equal(f.api.getState().disclosure.phase,'closed');f.close();assert.equal(f.listeners.size,0);
});

test('disclosure without WAAPI remains operable and restores focus without scrolling',()=>{
  const f=disclosureFixture({waapi:false});assert.equal(typeof f.panel.animate,'undefined');f.summary.click();assert.equal(f.root.open,true);assert.equal(f.api.getState().disclosure.phase,'open');assert.equal(f.api.getState().disclosure.animating,false);
  f.panel.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.root.open,false);assert.deepEqual(f.focusCalls.at(-1),{preventScroll:true});assert.equal(f.animations.length,0);f.close();
});

test('disclosure disposal cancels animation and preference listener, ignoring stale finish callbacks',()=>{
  const f=disclosureFixture();f.summary.click();const animation=f.animations[0],staleFinish=animation.onfinish;assert.equal(f.listeners.size,1);f.api.dispose();assert.equal(animation.cancelCount,1);assert.equal(f.listeners.size,0);assert.equal(f.slot.children.length,0);assert.equal(f.root.open,false);
  staleFinish();assert.equal(f.root.open,false);f.summary.click();f.setSystemReduced(true);assert.equal(f.slot.children.length,0);assert.equal(f.animations.length,1);f.api.dispose();assert.equal(animation.cancelCount,1);f.dom.window.close();
});
