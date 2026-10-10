import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeatherClock,sampleSun} from '../../public/weather-clock.js';
const original=await fs.readFile(new URL('../../public/app.js',import.meta.url),'utf8');
const source=original.slice(0,original.indexOf('\ninit().catch')).replace(/^import .*;\n/gm,'');
function fixture(ready=true){
 const listeners={document:{},window:{},canvas:{}},nodes=new Map(),queue=new Map();let rafId=0;
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{setProperty(){}},dataset:{},setAttribute(){},addEventListener(type,fn){if(selector==='#scene')listeners.canvas[type]=fn;},getBoundingClientRect(){return{width:900,height:600};},clientWidth:900,clientHeight:600,value:'20261010'});return nodes.get(selector);};
 const document={hidden:false,querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){listeners.document[type]=fn;}};
 const window={devicePixelRatio:1,addEventListener(type,fn){listeners.window[type]=fn;}};
 const model={seed:20261010,enabled:true,ticks:0,counts:{rimGroundHits:0},step(){this.ticks++;},reset(seed){this.seed=seed;this.ticks=0;this.enabled=true;},snapshot(){return{counts:this.counts,recentEvents:[],pools:{},overflow:{}};},dispose(){}};
 const water={sync(){},updateGround(){},setDebug(){},snapshot(){return{};},dispose(){}};
 const renderer={setPixelRatio(){},setSize(){},getPixelRatio(){return 1;},dispose(){},info:{memory:{},render:{}}};
 const context={document,window,THREE,WeatherClock,sampleSun,performance,console,requestAnimationFrame(fn){const id=++rafId;queue.set(id,fn);return id;},cancelAnimationFrame(id){queue.delete(id);},fixtureValues:{model,water,renderer,camera:new THREE.PerspectiveCamera(),sun:new THREE.DirectionalLight(),scene:new THREE.Scene(),environmentScene:new THREE.Scene()},Event:class{constructor(type){this.type=type;}}};
 vm.createContext(context);vm.runInContext(source,context);
 vm.runInContext(`({model,water,renderer,camera,sun,scene,environmentScene}=fixtureValues); state.ready=${ready}; applyLighting=()=>{}; render=()=>{}; globalThis.controls={clock,state,schedule,pause,play,setRain,setState,playSun,dispose};`,context);
 return{context,controls:context.controls,model,queue,document,fire(target,type,event={}){listeners[target][type](event);},runFrame(time){const entry=queue.entries().next().value;if(!entry)return;queue.delete(entry[0]);entry[1](time);}};
}
const results=[],failures=[];
function test(name,fn){try{fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){failures.push({name,error:e.message});console.error('FAIL',name,e.message);}}
test('raf_dedup_pause_resume',()=>{const f=fixture();f.controls.schedule();f.controls.schedule();assert.equal(f.queue.size,1);f.controls.pause();assert.equal(f.queue.size,0);assert.equal(f.controls.clock.running,false);f.controls.play();f.controls.play();assert.equal(f.queue.size,1);});
test('visibility_then_bfcache_keeps_resume_intent',()=>{const f=fixture();f.controls.schedule();f.document.hidden=true;f.fire('document','visibilitychange');f.fire('window','pagehide',{persisted:true});assert.equal(f.queue.size,0);f.document.hidden=false;f.fire('window','pageshow',{persisted:true});f.fire('document','visibilitychange');assert.equal(f.controls.clock.running,true);assert.equal(f.queue.size,1);});
test('manual_pause_survives_visibility_and_bfcache',()=>{const f=fixture();f.controls.pause();f.document.hidden=true;f.fire('document','visibilitychange');f.fire('window','pagehide',{persisted:true});f.document.hidden=false;f.fire('window','pageshow',{persisted:true});f.fire('document','visibilitychange');assert.equal(f.controls.clock.running,false);assert.equal(f.queue.size,0);});
test('startup_hidden_then_visible_schedules',()=>{const f=fixture(false);f.document.hidden=true;f.fire('document','visibilitychange');f.controls.state.ready=true;f.controls.schedule();assert.equal(f.queue.size,0);f.document.hidden=false;f.fire('document','visibilitychange');assert.equal(f.controls.clock.running,true);assert.equal(f.queue.size,1);});
test('persisted_pagehide_before_ready_is_safe',()=>{const f=fixture(false);vm.runInContext('model=undefined;water=undefined;',f.context);f.fire('window','pagehide',{persisted:true});assert.equal(f.queue.size,0);});
test('static_scene_idles_and_rain_wakes',()=>{const f=fixture();f.controls.clock.selectSun('B');f.controls.setRain(false);f.controls.schedule();assert.equal(f.queue.size,0,'No RAF needed when rain off and sun static');f.controls.setRain(true);assert.equal(f.queue.size,1,'Rain re-enable wakes RAF');});
test('static_scene_sun_play_wakes',()=>{const f=fixture();f.controls.clock.selectSun('B');f.controls.setRain(false);f.controls.playSun();assert.equal(f.controls.clock.sunPlaying,true);assert.equal(f.queue.size,1);});
test('context_loss_stops_and_records',()=>{const f=fixture();f.controls.schedule();let prevented=false;f.fire('canvas','webglcontextlost',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(f.queue.size,0);assert.equal(f.controls.clock.running,false);assert.ok(f.controls.state.errors.includes('WebGL context lost'));});
test('disposal_stops_pending_callback',()=>{const f=fixture();f.controls.schedule();f.controls.dispose();f.controls.schedule();assert.equal(f.queue.size,0);assert.equal(f.controls.state.disposed,true);});
const report={passed:failures.length===0,scope:'Actual application functions and registered event callbacks executed in Node VM. DOM, RAF scheduling, renderer and lighting are explicit mocks. This is CPU control-flow regression coverage, not browser lifecycle or GPU verification.',results,failures};
await fs.writeFile(new URL('../results/lifecycle-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failures},null,2));if(failures.length)process.exitCode=1;
