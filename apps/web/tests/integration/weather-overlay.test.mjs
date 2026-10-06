import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as weather from '../../runtime/modules/weather.js';
import * as before from './fixtures/weather-overlay-before/weather.js';
import {createWeatherOverlayFixture,rect,inside,stackingChain,compareStacking} from './weather-overlay-fixture.mjs';

const frozen=name=>fs.readFileSync(new URL('./fixtures/weather-overlay-before/'+name,import.meta.url),'utf8');
const recorded=JSON.parse(frozen('browser-overlap.json')),manifest=JSON.parse(frozen('manifest.json'));
function assertClipped(bounds,viewport){
  for(const key of ['x','y','width','height','maxHeight'])assert.ok(Number.isFinite(bounds[key]),key+' must be finite');
  assert.ok(bounds.width>0&&bounds.height>0&&bounds.maxHeight>0,'usable nonzero panel');assert.ok(bounds.height<=bounds.maxHeight,'content height stays within scroll budget');assert.ok(bounds.maxHeight<=viewport.height-32,'scroll budget fits usable viewport height');
  assert.ok(bounds.x>=viewport.x+16-1e-8,'left viewport gutter');assert.ok(bounds.y>=viewport.y+16-1e-8,'top viewport gutter');
  assert.ok(bounds.x+bounds.width<=viewport.x+viewport.width-16+1e-8,'right viewport gutter');
  assert.ok(bounds.y+bounds.height<=viewport.y+viewport.height-16+1e-8,'bottom viewport gutter');
}
function assertCurrentClipped(f){const viewport={x:f.w.visualViewport.offsetLeft,y:f.w.visualViewport.offsetTop,width:f.w.visualViewport.width,height:f.w.visualViewport.height};const bounds=f.api.getState().disclosure.bounds;assert.ok(bounds);assertClipped(bounds,viewport);const wrapper=f.overlay.querySelector('.weather-overlay');assert.equal(f.w.getComputedStyle(wrapper).position,'fixed');assert.equal(Number.parseFloat(wrapper.style.left),bounds.x);assert.equal(Number.parseFloat(wrapper.style.top),bounds.y);assert.equal(Number.parseFloat(wrapper.style.width),bounds.width);assert.equal(Number.parseFloat(f.panel.style.maxHeight),bounds.maxHeight);return bounds;}

test('negative control: frozen pre-C3 stacking chain puts weather z40 below fallback z35 through content z1',()=>{
  for(const [name,hash] of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(frozen(name)).digest('hex'),hash,'frozen '+name);
  const f=createWeatherOverlayFixture({module:before,css:frozen('weather.css'),hostCSS:frozen('host.css')});try{
    f.summary.click();assert.equal(f.panel.parentElement,f.root);assert.equal(f.overlay.querySelector('.weather-panel'),null);
    const panelChain=stackingChain(f.w,f.panel),fallbackChain=stackingChain(f.w,f.fallback);
    assert.deepEqual(panelChain,[1,40]);assert.deepEqual(fallbackChain,[35]);assert.equal(compareStacking(panelChain,fallbackChain),-1);
    const point=recorded.windRightHit,wind=recorded.controls.find(control=>control.tag==='INPUT'&&control.field==='wind').rect;
    assert.ok(inside(point,wind));assert.ok(inside(point,recorded.fallbackButton));assert.equal(point.targetId,'host-open-chat');
    assert.equal(manifest.viewport.width,1167);assert.equal(manifest.viewport.height,747);
  }finally{f.close();}
});

test('negative control: pre-C3 panel extends below viewport with no internal scroll range in the recorded browser',()=>{
  assert.ok(recorded.panel.bottom>manifest.viewport.height);assert.equal(recorded.panelScroll.total-recorded.panelScroll.client,0);
  assert.equal(recorded.panelScroll.top,0);assert.ok(recorded.panel.height<manifest.viewport.height*.75,'old 75dvh cap does not account for panel top');
  assert.match(frozen('weather.css'),/max-height:min\(620px,75dvh\);overflow:auto/);
  assert.ok(recorded.panel.bottom-manifest.viewport.height>100,'more than 100px remains beyond viewport despite overflow:auto');
});

test('overlay bounds remain finite and viewport-clipped for reported desktop, mobile, landscape and offset visual viewports (geometry model)',()=>{
  assert.equal(typeof weather.weatherOverlayBounds,'function');
  const viewports=[{x:0,y:0,width:1167,height:747},{x:0,y:0,width:1180,height:844},{x:0,y:0,width:1440,height:900},{x:0,y:0,width:390,height:844},{x:0,y:0,width:320,height:568},{x:0,y:0,width:844,height:390},{x:23,y:107,width:390,height:352}];
  for(const viewport of viewports)for(const anchor of [rect(674,249.375,151,40),rect(24,viewport.height-60,150,40),rect(-600,-800,151,40),rect(viewport.width+50,viewport.height+600,151,40)]){
    assertClipped(weather.weatherOverlayBounds({anchor,viewport,naturalHeight:556.140625}),viewport);
  }
  for(let i=0;i<160;i++){const viewport={x:i%31,y:i%97,width:240+(i*137)%1680,height:180+(i*67)%900},anchor=rect((i*179)%2300-600,(i*113)%1800-500,120+(i%160),40);assertClipped(weather.weatherOverlayBounds({anchor,viewport,naturalHeight:180+(i*71)%640}),viewport);}
});

test('overlay chooses below when useful, flips above near viewport bottom and caps oversized natural content (geometry model)',()=>{
  const viewport={x:0,y:0,width:1167,height:747};
  const below=weather.weatherOverlayBounds({anchor:rect(674,249.375,151,40),viewport,naturalHeight:556.140625});assert.equal(below.side,'below');assert.ok(below.y>=289.375);assert.ok(below.maxHeight<556.140625);assertClipped(below,viewport);
  const above=weather.weatherOverlayBounds({anchor:rect(674,680,151,40),viewport,naturalHeight:620});assert.equal(above.side,'above');assert.ok(above.y+above.height<=680);assertClipped(above,viewport);
});

test('host-supplied overlay leases the exact panel and controls, above fallback without disabling either pointer target (DOM/CSS contract)',()=>{
  const f=createWeatherOverlayFixture();try{
    const panel=f.panel,controls=[...panel.querySelectorAll('button,input,output')],summary=f.summary;
    f.summary.click();const wrapper=f.overlay.querySelector('.weather-overlay.weather-module');assert.ok(wrapper);assert.equal(wrapper.hidden,false);assert.equal(panel.parentElement,wrapper);assert.equal(f.api.getState().disclosure.overlay,true);assert.equal(f.root.querySelector('.weather-panel'),null);assert.equal(f.d.querySelectorAll('.weather-panel').length,1);assert.equal(f.root.querySelector('summary'),summary);
    assert.deepEqual([...panel.querySelectorAll('button,input,output')],controls);const bounds=assertCurrentClipped(f);assert.ok(bounds.height<panel.scrollHeight,'reported viewport constrains the original offscreen content');assert.equal(f.w.getComputedStyle(panel).overflow,'auto');assert.equal(f.w.getComputedStyle(panel).overscrollBehavior,'contain');
    assert.equal(f.overlay.parentElement,f.d.body);assert.ok(!f.d.querySelector('#content-root').contains(f.overlay));
    assert.equal(f.w.getComputedStyle(f.overlay).position,'fixed');assert.equal(f.w.getComputedStyle(f.overlay).pointerEvents,'none');assert.equal(f.w.getComputedStyle(panel).pointerEvents,'auto');assert.equal(f.w.getComputedStyle(wrapper).pointerEvents,'auto');
    assert.equal(compareStacking(stackingChain(f.w,panel),stackingChain(f.w,f.fallback)),1);assert.equal(f.fallback.disabled,false);assert.equal(f.fallback.closest('[inert]'),null);assert.equal(f.fallback.closest('[hidden]'),null);assert.notEqual(f.w.getComputedStyle(f.fallback).pointerEvents,'none');
    panel.querySelector('[data-weather-preset=rain]').click();assert.equal(f.api.getState().preset,'rain');assert.equal(f.changes,1);
    const wind=panel.querySelector('[data-weather-field=wind]');wind.value='8.4';wind.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.api.getState().target.wind,8.4);assert.equal(f.changes,2);assert.equal(f.fallbackClicks,0);
    const enabled=panel.querySelector('[data-weather-flag=enabled]');enabled.checked=false;enabled.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.api.getState().enabled,false);assert.equal(f.changes,3);
    assert.deepEqual([...panel.querySelectorAll('button,input,output')],controls);
  }finally{f.close();}
});

test('close restores same panel, original inline styles and summary focus, leaving fallback action operable (DOM actions only)',()=>{
  const original='color: rgb(12, 34, 56); --lease-marker: original;';const f=createWeatherOverlayFixture({inlineStyle:original});try{
    const prior=f.panel.getAttribute('style'),children=[...f.panel.children];f.summary.click();f.panel.querySelector('[data-weather-close]').click();
    assert.equal(f.panel.parentElement,f.root);assert.equal(f.panel.getAttribute('style'),prior);assert.deepEqual([...f.panel.children],children);assert.equal(f.root.open,false);assert.equal(f.panel.inert,true);assert.equal(f.summary.getAttribute('aria-expanded'),'false');assert.equal(f.d.activeElement,f.summary);assert.deepEqual(f.focusCalls.at(-1),{preventScroll:true});assert.equal(f.api.getState().disclosure.overlay,false);assert.equal(f.api.getState().disclosure.bounds,null);assert.equal(f.overlay.querySelector('.weather-overlay').hidden,true);
    f.fallback.click();assert.equal(f.fallbackClicks,1);assert.equal(f.fallback.disabled,false);assert.notEqual(f.w.getComputedStyle(f.fallback).pointerEvents,'none');
    f.summary.click();assert.equal(f.panel.parentElement,f.overlay.querySelector('.weather-overlay'));f.panel.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.panel.parentElement,f.root);assert.equal(f.panel.getAttribute('style'),prior);assert.equal(f.fallbackClicks,1);
  }finally{f.close();}
});

test('live portal repositions same controls on resize, native scroll and visual-viewport movement (synthetic geometry)',()=>{
  const f=createWeatherOverlayFixture();try{
    f.summary.click();const controls=[...f.panel.querySelectorAll('button,input')],initial=assertCurrentClipped(f);
    f.resize(390,844);let next=assertCurrentClipped(f);assert.notDeepEqual(next,initial);assert.equal(next.width,338);
    f.resize(320,568);next=assertCurrentClipped(f);assert.ok(next.width<=288);
    f.scrollTo(640);next=assertCurrentClipped(f);assert.equal(f.root.open,true);
    f.visualViewport({offsetLeft:21,offsetTop:96,width:290,height:280},'resize');next=assertCurrentClipped(f);assert.ok(next.maxHeight<=248);
    f.visualViewport({offsetTop:145},'scroll');assertCurrentClipped(f);assert.deepEqual([...f.panel.querySelectorAll('button,input')],controls);assert.equal(f.d.querySelectorAll('.weather-panel').length,1);
  }finally{f.close();}
});

test('opening/closing/reopening retains one 200ms track and one portal lease until latest endpoint wins (WAAPI double)',()=>{
  const f=createWeatherOverlayFixture({waapi:true});try{
    const style=f.panel.getAttribute('style'),children=[...f.panel.children];f.summary.click();const wrapper=f.panel.parentElement,animation=f.animations[0];assert.equal(animation.element,f.panel);assert.equal(animation.options.duration,200);animation.currentTime=73;
    f.panel.querySelector('[data-weather-close]').click();assert.equal(f.panel.parentElement,wrapper);assert.equal(f.panel.inert,true);assert.equal(f.api.getState().disclosure.phase,'closing');assert.equal(f.w.getComputedStyle(wrapper).pointerEvents,'auto','visible closing shell still intercepts its rectangle');assert.equal(animation.currentTime,73);assert.equal(animation.reverseCount,1);
    f.summary.click();assert.equal(f.panel.parentElement,wrapper);assert.equal(f.panel.inert,false);assert.equal(animation.reverseCount,2);assert.equal(animation.currentTime,73);assert.equal(f.animations.length,1);f.resize(390,500);assertCurrentClipped(f);animation.finish();assert.equal(f.api.getState().disclosure.phase,'open');assert.equal(f.panel.parentElement,wrapper);
    f.panel.querySelector('[data-weather-close]').click();assert.equal(f.panel.parentElement,wrapper);assert.equal(f.root.open,true);f.animations.at(-1).finish();assert.equal(f.panel.parentElement,f.root);assert.equal(f.panel.getAttribute('style'),style);assert.equal(f.root.open,false);assert.deepEqual([...f.panel.children],children);assert.equal(wrapper.hidden,true);
  }finally{f.close();}
});

test('host ownership transitions close the portal without stealing focus, and retire its lease after exit (controller events)',()=>{
  const transitions=[['chat-show',{chat:{phase:'opening',open:true}}],['content-select',{content:{phase:'opening'}}],['replay-pending',{pendingReplay:true}],['story-start',{entry:'intro',story:{phase:'story'}}],['navigate',{action:'navigate'}],['content-category-select',{content:{phase:'preview',category:'labs'}}]];
  for(const [action,patch] of transitions){const f=createWeatherOverlayFixture({waapi:true});try{
    f.summary.click();f.animations[0].finish();const destination=f.d.querySelector('#destination');destination.focus();const calls=f.focusCalls.length;
    f.emit(patch,action);assert.equal(f.api.getState().disclosure.open,false,action+' closes weather');assert.equal(f.panel.inert,true);assert.equal(f.d.activeElement,destination,action+' retains destination focus');assert.equal(f.focusCalls.length,calls);assert.equal(f.panel.parentElement,f.overlay.querySelector('.weather-overlay'));f.animations.at(-1).finish();assert.equal(f.panel.parentElement,f.root);assert.equal(f.api.getState().disclosure.bounds,null);
  }finally{f.close();}}
});

test('reduced-motion changes and disposal settle or release the same portal, ignoring stale callbacks (controller events)',()=>{
  const f=createWeatherOverlayFixture({waapi:true});try{
    f.summary.click();const first=f.animations[0];first.currentTime=81;f.setReduced(true);assert.equal(f.api.getState().disclosure.phase,'open');assert.equal(first.cancelCount,1);assert.equal(f.panel.parentElement,f.overlay.querySelector('.weather-overlay'));
    f.setReduced(false);f.panel.querySelector('[data-weather-close]').click();const exit=f.animations.at(-1);f.setReduced(true);assert.equal(f.root.open,false);assert.equal(f.panel.parentElement,f.root);assert.equal(exit.cancelCount,1);
    f.setReduced(false);f.summary.click();const pending=f.animations.at(-1),stale=pending.onfinish;f.api.dispose();assert.equal(f.slot.children.length,0);assert.equal(f.overlay.children.length,0);assert.equal(f.listeners.size,0);assert.equal(f.mediaListeners.size,0);assert.equal(pending.cancelCount,1);stale();f.resize(390,480);f.scrollTo(900);f.visualViewport({offsetTop:100},'scroll');assert.equal(f.overlay.children.length,0);assert.equal(f.slot.children.length,0);assert.equal(f.fallback.disabled,false);f.fallback.click();assert.equal(f.fallbackClicks,1);
  }finally{f.close();}
});

test('portaled keyboard entry and edge traversal preserve one summary/control set (synthetic key events)',()=>{
  const f=createWeatherOverlayFixture();try{
    f.summary.focus();f.summary.click();const close=f.panel.querySelector('[data-weather-close]'),last=f.panel.querySelector('[data-weather-flag=autoSun]');assert.equal(f.d.activeElement,close);
    last.focus();const tab=new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});last.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);assert.equal(f.d.activeElement,f.summary);assert.equal(f.root.open,true);
    close.focus();const back=new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});close.dispatchEvent(back);assert.equal(back.defaultPrevented,true);assert.equal(f.d.activeElement,f.summary);assert.equal(f.root.open,true);
    const leave=new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});f.summary.dispatchEvent(leave);assert.equal(leave.defaultPrevented,false,'summary keeps ordinary onward tab navigation');
  }finally{f.close();}
});
