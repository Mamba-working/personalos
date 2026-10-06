/** Weather overlay fixture: real controller/CSS, synthetic rectangles and WAAPI.
 * No layout engine, elementFromPoint, compositor, keyboard-device or GPU claim.
 */
import {JSDOM} from 'jsdom';
import * as currentWeather from '../../runtime/modules/weather.js';
import {read} from './content-fixture.mjs';

export const rect = (x,y,width,height) => ({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
export const inside = (point,bounds) => point.x >= bounds.left && point.x < bounds.right && point.y >= bounds.top && point.y < bounds.bottom;
export function stackingChain(window,node) {
  const chain=[];
  for(let current=node;current;current=current.parentElement){
    const css=window.getComputedStyle(current),z=Number(css.zIndex);
    if(css.zIndex!==''&&css.zIndex!=='auto'&&Number.isFinite(z)&&css.position!=='static')chain.unshift(z);
  }
  return chain;
}
export function compareStacking(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return Math.sign(diff);}return 0;}
export function createWeatherOverlayFixture({module=currentWeather,css=read('modules/weather.css'),hostCSS=read('host.css'),waapi=false,reduced=false,width=1167,height=747,anchor=rect(674,249.375,151,40),viewport=null,inlineStyle=null}={}) {
  const dom=new JSDOM('<!doctype html><html><head></head><body><div class="app" data-entry="home"><main id="content-root"><span id="host-weather"></span></main></div><div id="host-overlays"></div><aside id="host-chat-fallback"><button id="host-open-chat">打开聊天</button></aside><button id="destination">destination</button></body>',{pretendToBeVisual:true,url:'https://candidate.invalid/'});
  const w=dom.window,d=w.document;
  const style=d.createElement('style');style.textContent=hostCSS+'\n'+css;d.head.append(style);
  Object.defineProperty(w.HTMLElement.prototype,'inert',{get(){return this.hasAttribute('inert');},set(value){this.toggleAttribute('inert',!!value);},configurable:true});
  const slot=d.querySelector('#host-weather'),overlay=d.querySelector('#host-overlays'),fallback=d.querySelector('#host-open-chat');
  const listeners=new Set(),mediaListeners=new Set(),animations=[],focusCalls=[],events=[];
  let state={entry:'home',reduced,story:{phase:'home',reduced},chat:{phase:'closed',open:false},content:{phase:'preview'},worldAvailability:{status:'failed',fallback:true}},scroll=0,anchorBox={...anchor},size={width,height};
  const visualViewport=new w.EventTarget();Object.assign(visualViewport,viewport||{offsetLeft:0,offsetTop:0,width,height});
  if(viewport){visualViewport.offsetLeft=viewport.x??viewport.offsetLeft??0;visualViewport.offsetTop=viewport.y??viewport.offsetTop??0;}
  w.visualViewport=visualViewport;
  Object.defineProperties(w,{innerWidth:{get:()=>size.width,configurable:true},innerHeight:{get:()=>size.height,configurable:true},scrollY:{get:()=>scroll,configurable:true},pageYOffset:{get:()=>scroll,configurable:true}});
  Object.defineProperties(d.documentElement,{clientWidth:{get:()=>size.width,configurable:true},clientHeight:{get:()=>size.height,configurable:true}});
  Object.defineProperty(d,'scrollingElement',{value:d.documentElement});
  const media={matches:reduced,addEventListener(type,fn){mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}};w.matchMedia=()=>media;
  const originalRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.matches('.weather-summary'))return rect(anchorBox.x,anchorBox.y-scroll,anchorBox.width,anchorBox.height);
    if(this.matches('.weather-panel')){
      const width=(this.style.width.endsWith('%')?Number.parseFloat(this.parentElement.style.width):Number.parseFloat(this.style.width))||338,natural=width<320?630:556.140625,max=Number.parseFloat(this.style.maxHeight)||natural;
      return rect(Number.parseFloat(this.style.left)||anchorBox.x,Number.parseFloat(this.style.top)||anchorBox.y+anchorBox.height+10,Math.min(width,size.width-32),Math.min(natural,max));
    }
    return originalRect.call(this);
  };
  Object.defineProperties(w.HTMLElement.prototype,{scrollHeight:{get(){return this.matches('.weather-panel')?((this.style.width.endsWith('%')?Number.parseFloat(this.parentElement.style.width):Number.parseFloat(this.style.width))<320?630:556.140625):0;},configurable:true},offsetHeight:{get(){return this.getBoundingClientRect().height;},configurable:true},offsetWidth:{get(){return this.getBoundingClientRect().width;},configurable:true}});
  if(waapi)w.Element.prototype.animate=function(keyframes,options){
    const animation={element:this,keyframes,options,currentTime:0,playbackRate:1,playState:'running',reverseCount:0,cancelCount:0,onfinish:null,
      reverse(){this.playbackRate*=-1;this.reverseCount++;this.playState='running';},cancel(){this.cancelCount++;this.playState='idle';this.currentTime=null;},
      finish(){this.currentTime=this.playbackRate<0?0:options.duration;this.playState='finished';this.onfinish?.();}};
    animations.push(animation);return animation;
  };
  let changes=0,fallbackClicks=0;fallback.addEventListener('click',()=>fallbackClicks++);
  const host={getState:()=>state,world:()=>null,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},moduleChanged(){changes++;for(const fn of [...listeners])fn(state);}};
  const api=module.mountWeather({host,container:slot,overlayContainer:overlay}),root=slot.firstElementChild,summary=root.querySelector('summary'),panel=root.querySelector('.weather-panel');
  if(inlineStyle!==null)panel.setAttribute('style',inlineStyle);
  const focus=summary.focus.bind(summary);summary.focus=options=>{focusCalls.push(options);focus(options);};
  function emit(patch={},action='test'){state={...state,...patch,action};events.push(action);for(const fn of [...listeners])fn(state);}
  return {dom,w,d,api,host,slot,overlay,fallback,root,summary,panel,animations,listeners,mediaListeners,focusCalls,events,
    get changes(){return changes;},get fallbackClicks(){return fallbackClicks;},get state(){return state;},
    emit,setReduced(value){media.matches=value;for(const fn of mediaListeners)fn({matches:value});},
    resize(nextWidth,nextHeight,{visual=true}={}){size={width:nextWidth,height:nextHeight};if(visual){visualViewport.width=nextWidth;visualViewport.height=nextHeight;}w.dispatchEvent(new w.Event('resize'));},
    scrollTo(top){scroll=top;d.documentElement.scrollTop=top;w.dispatchEvent(new w.Event('scroll'));},
    setAnchor(next){anchorBox={...next};},
    visualViewport(next,type='resize'){Object.assign(visualViewport,next);visualViewport.dispatchEvent(new w.Event(type));},
    close(){api.dispose();dom.window.close();}};
}
