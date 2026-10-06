/** Real weather controller/model/ambient consumer; JSDOM and Three CPU objects only.
 * The fixture never creates a renderer, canvas, independent timer, or browser claim.
 */
import {JSDOM} from '../integration/node_modules/jsdom/lib/api.js';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import * as candidate from '../../runtime/modules/weather.js';

export function createSolarFixture({module=candidate,attached=false,reduced=false,quiet=false}={}) {
  const dom=new JSDOM('<!doctype html><body><div id="field"></div><div id="settings"></div></body>',{url:'https://candidate.invalid/'});
  const w=dom.window,d=w.document,field=d.querySelector('#field'),settings=d.querySelector('#settings');
  let state={phase:'home',hidden:false,reduced,readingQuiet:quiet,story:{phase:'home'},chat:{phase:'closed'},content:{phase:'preview'},placement:{mode:'hero',progress:0}};
  const listeners=new Set(),effects=new Map(),calls={raf:0,timer:0,frameRequests:0,changes:0};
  w.requestAnimationFrame=()=>{calls.raf++;throw new Error('Weather must not own RAF');};
  w.setInterval=()=>{calls.timer++;throw new Error('Weather must not own an interval');};
  const scene=new THREE.Scene(),actor=new THREE.Group();actor.position.set(2.8,1.177,.1);scene.add(actor);
  const key=new THREE.DirectionalLight('#FFF7EE',3),sky=new THREE.HemisphereLight('#EEF0F6','#788298',1.5);scene.add(key,sky);
  const context={THREE,scene,actor,getState:()=>state,requestFrame(){calls.frameRequests++;}};
  const world={registerEffect(name,factory){if(effects.has(name))throw new Error('duplicate effect');const effect=factory(context);effects.set(name,effect);return()=>{if(effects.get(name)===effect){effects.delete(name);effect.dispose();}};},requestFrame:context.requestFrame};
  let available=attached?world:null;
  const host={getState:()=>({...state,worldAvailability:{status:available?'ready':'failed'}}),world:()=>available,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},moduleChanged(){calls.changes++;for(const fn of [...listeners])fn(host.getState());}};
  const api=module.mountWeather({host,container:settings,fieldContainer:field});
  const element=field.querySelector('.weather-atmosphere'),root=settings.firstElementChild;
  function emit(patch={},next=available){state={...state,...patch};available=next;for(const fn of [...listeners])fn(host.getState());}
  function input(altitude){const slider=root.querySelector('[data-weather-field="altitude"]');slider.value=String(altitude);slider.dispatchEvent(new w.Event('input',{bubbles:true}));return snapshot();}
  function flag(name,value){const box=root.querySelector(`[data-weather-flag="${name}"]`);box.checked=value;box.dispatchEvent(new w.Event('input',{bubbles:true}));return snapshot();}
  function preset(name){root.querySelector(`[data-weather-preset="${name}"]`).click();return snapshot();}
  function step(dt=1/60,count=1){for(let i=0;i<count;i++)effects.get('weather')?.update(dt);return snapshot();}
  function settle(){return step(.1,110);}
  function snapshot(){return {state:api.getState(),backgroundColor:element.style.backgroundColor,backgroundImage:element.style.backgroundImage,hidden:element.hidden};}
  return {dom,w,d,api,host,root,element,field,settings,scene,actor,key,sky,listeners,effects,calls,world,
    input,flag,preset,step,settle,snapshot,emit,attach(){emit({},world);},fallback(){emit({},null);},
    close(){api.dispose();dom.window.close();}};
}

export function solarStop(backgroundImage){
  const match=backgroundImage.match(/radial-gradient\((?:ellipse )?(?:(?<radiusX>[\d.-]+)% (?<radiusY>[\d.-]+)% )?at (?<x>[\d.-]+)% (?<y>[\d.-]+)%, rgba\(255,\s*249,\s*237,\s*(?<alpha>[\d.]+)\) 0%, transparent (?<spread>[\d.]+)%\)/);
  if(!match)throw new Error(`Solar stop absent from actual DOM backgroundImage: ${backgroundImage}`);
  return Object.fromEntries(Object.entries(match.groups).filter(([,value])=>value!==undefined).map(([key,value])=>[key,Number(value)]));
}
