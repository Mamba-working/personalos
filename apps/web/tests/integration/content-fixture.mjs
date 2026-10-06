/** Actual candidate content.js/app.js executed in JSDOM.
 * Geometry, rAF and observers are bounded doubles. No browser/device/layout claim.
 */
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
export const runtime = new URL('../../runtime/', import.meta.url);
export const read = name => fs.readFileSync(new URL(name, runtime), 'utf8');
export function bootContent({width = 1180, reduced = false, query = '', beforeBoot = null, appSource = read('app.js')} = {}) {
 const errors = [], virtualConsole = new VirtualConsole();
 virtualConsole.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
 const dom = new JSDOM(read('index.html'), {url: `https://candidate.invalid/${query}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole});
 const w = dom.window, d = w.document, $ = s => d.querySelector(s);
 Object.defineProperties(w, {innerWidth: {value: width, configurable: true}, innerHeight: {value: 844, configurable: true}});
 Object.defineProperty(d, 'scrollingElement', {value: d.documentElement});
 let nextFrame = 0; const frames = new Map();
 w.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame; };
 w.cancelAnimationFrame = id => frames.delete(id);
 w.matchMedia = () => ({matches: reduced, addEventListener(){}, removeEventListener(){}});
 Object.defineProperty(w.HTMLElement.prototype,'inert',{get(){return this.hasAttribute('inert');},set(value){this.toggleAttribute('inert',!!value);},configurable:true});
 w.ResizeObserver = class {observe(){} disconnect(){}};
 w.scrollTo = ({top=0}) => { d.scrollingElement.scrollTop = top; };
 const box = (x,y,width,height) => ({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
 w.HTMLElement.prototype.getBoundingClientRect = function() {
  if (this.matches('.topbar')) return box(0,0,width,64);
  if (this.matches('#category-anchor')) return box(0,540-d.scrollingElement.scrollTop,width,1);
  if (this.matches('.slot')) { const i = [...d.querySelectorAll('.slot')].indexOf(this); return box(24+(i%3)*370,600+Math.floor(i/3)*440-d.scrollingElement.scrollTop,width<=650?width-48:350,parseFloat(this.style.getPropertyValue('--height'))||400); }
  if (this.matches('.identity')) return box(0,0,width<=650?width-48:350,280);
  if (this.matches('.travel-shell')) return box(24,96,parseFloat(this.style.width)||1040,parseFloat(this.style.height)||700);
  return box(0,0,350,24);
 };
 Object.defineProperties(w.HTMLElement.prototype, {offsetWidth:{get(){return this.getBoundingClientRect().width;}},offsetHeight:{get(){return this.getBoundingClientRect().height;}},scrollHeight:{get(){return this.matches('.detail-body')?1100:1200;}}});
 w.Range.prototype.getClientRects = () => [box(0,0,220,24)];
 beforeBoot?.({w,d,$,box});
 w.eval(read('content.js').replace(/\bexport /g,'') + ';window.__records = records; window.__graphic = graphic; window.__detail = detail;');
 w.eval(read('story/content-presentation.js').replace(/\bexport /g,'')+';window.__createPresentation=createContentPresentation;');
 w.eval('(()=>{'+read('feed-layout.js').replace(/\bexport /g,'')+';window.__feedLayout={feedProfile,previewHeight,balanceEntries};})();');
 w.eval('(()=>{'+read('feed-reflow.js').replace(/\bexport /g,'')+';window.__createSlotReflow=createSlotReflow;})();');
 w.eval('(()=>{const {feedProfile,previewHeight,balanceEntries}=window.__feedLayout,createSlotReflow=window.__createSlotReflow;const createContentPresentation=window.__createPresentation;const records=window.__records,graphic=window.__graphic,detail=window.__detail;'+appSource.replace(/^import[^\n]+\n/gm,'')+'})();');
 const click = selector => {const node=$(selector); if (!node) throw Error(`Missing candidate control ${selector}`); node.click(); return node;};
 return {dom,w,d,$,click,errors,frames,records:w.__records,settle:()=>w.contentStudy.settle(),close:()=>w.close()};
}
