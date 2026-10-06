import test from 'node:test';
import assert from 'node:assert/strict';
import {bootChatWorld,loadLocalModule} from './chat-world-fixture.mjs';
import {read} from './content-fixture.mjs';
async function bootModules(){
 const f=await bootChatWorld(),w=f.w;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.__mountedChat=f.chat;w.__mountChat=async()=>f.chat;
 w.eval(read('world-availability.js').replace(/\bexport /g,'')+';window.__readiness=createWorldReadiness;window.__availabilityEvent=WORLD_AVAILABILITY_EVENT;');
 w.eval('(()=>{const mountChat=window.__mountChat,createWorldReadiness=window.__readiness,WORLD_AVAILABILITY_EVENT=window.__availabilityEvent;'+read('host.js').replace(/^import[^\n]+\n/gm,'')+'})();');await Promise.resolve();await Promise.resolve();
 const menu=loadLocalModule(f,'modules/menu.js'),weather=loadLocalModule(f,'modules/weather.js');w.__mountMenu=menu.mountMenu;w.__mountWeather=weather.mountWeather;
 const metadata=JSON.parse(read('release-meta.json'));w.fetch=async()=>({ok:true,json:async()=>metadata});
 const bootstrap=read('modules/mount.js').replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://candidate.invalid/modules/mount.js'));
 w.eval('(()=>{const mountMenu=window.__mountMenu,mountWeather=window.__mountWeather;'+bootstrap+';window.__mountedModules={menu,weather};})();');
 for(let i=0;i<5;i++)await Promise.resolve();return{...f,host:w.personalOSHost,modules:w.__mountedModules,metadata};
}
test('actual bootstrap mounts real menu/weather against actual host/chat/CPU-world and one content owner',async()=>{
 const f=await bootModules();try{
  assert.equal(f.d.querySelectorAll('.pos-menu').length,1);assert.equal(f.d.querySelectorAll('#host-weather details').length,1);assert.equal(f.host.getState().weather.renderer,'attached');assert.equal(f.study.snapshot().effectCount,1);
  assert.equal(f.$('#product-version').textContent,f.metadata.productVersion);assert.equal(f.d.documentElement.dataset.productVersion,f.metadata.productVersion);
  const before=f.cpu.actor;assert.equal(f.host.setWeather({preset:'rain'}),true);f.study.step(.05);assert.equal(f.cpu.actor,before);assert.equal(f.renderers.length,1);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);
  f.click('.pos-menu-toggle');assert.equal(f.modules.menu.getState().open,true);f.click('[data-menu-category="labs"]');await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(f.w.personalOSContent.getState().category,'labs');assert.equal(f.d.querySelectorAll('.slot:not(.excluded)').length,6);assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(f.cpu.actor,before);assert.deepEqual(f.errors,[]);
 }finally{f.destroy();}
});
test('module weather reacts to actual host chat state and disposes before world without duplicate owner',async()=>{
 const f=await bootModules();try{
  f.chat.show({history:false});f.settleChat();assert.equal(f.host.getState().chat.phase,'open');assert.match(f.$('.weather-status').textContent,/减少动态|安静/);
  f.chat.close({history:false});f.settleChat();assert.equal(f.host.getState().chat.phase,'closed');assert.equal(f.world.getState().world.activity.state,'idle');
  f.modules.menu.dispose();f.modules.weather.dispose();assert.equal(f.d.querySelectorAll('.pos-menu').length,0);assert.equal(f.study.snapshot().effectCount,0);assert.equal(f.d.querySelectorAll('article.card').length,18);
 }finally{f.destroy();}
});
test('viewport weather field keeps one same atmosphere subtree through updates, fallback/recovery and disposal (CPU/DOM)',async()=>{
 const f=await bootModules();try{
  const slot=f.$('#weather-field'),field=slot.querySelector('.weather-atmosphere');assert(field);assert.equal(slot.children.length,1);assert.equal(f.modules.weather.getState().atmosphere.available,true);
  const same=f.w.__mountWeather({host:f.host,container:f.$('#host-weather'),fieldContainer:slot});assert.equal(same,f.modules.weather);assert.equal(slot.children.length,1);
  for(const preset of ['clear','rain','wind','dawn']){assert.equal(f.host.setWeather({preset}),true);f.study.step(.05);assert.equal(slot.firstElementChild,field);assert.equal(slot.children.length,1);assert.equal(f.d.body.style.transform,'');assert.equal(f.$('.app').style.transform,'');}
  f.cpu.renderer.domElement.dispatchEvent(new f.w.Event('webglcontextlost',{cancelable:true}));assert.equal(f.modules.weather.getState().renderer,'unavailable');assert.equal(f.modules.weather.getState().atmosphere.mode,'static-fallback');assert.equal(slot.firstElementChild,field);
  f.cpu.renderer.domElement.dispatchEvent(new f.w.Event('webglcontextrestored'));assert.equal(f.modules.weather.getState().renderer,'attached');assert.equal(slot.firstElementChild,field);assert.equal(slot.children.length,1);
  f.modules.weather.dispose();assert.equal(f.$('#weather-field'),slot);assert.equal(slot.children.length,0);assert.equal(f.study.snapshot().effectCount,0);assert.equal(f.d.body.style.transform,'');assert.equal(f.$('.app').style.transform,'');
 }finally{f.destroy();}
});

test('actual bootstrap supplies the host-owned overlay above content and retains weather control identity through fallback and close (DOM/CPU)',async()=>{
 const f=await bootModules();try{
  const overlay=f.$('#host-overlays'),root=f.$('#host-weather details'),summary=root.querySelector('summary'),panel=root.querySelector('.weather-panel');assert.ok(overlay);assert.equal(overlay.parentElement,f.d.body);assert.equal(f.$('#content-root').contains(overlay),false);
  const controls=[...panel.querySelectorAll('button,input')];f.cpu.renderer.domElement.dispatchEvent(new f.w.Event('webglcontextlost',{cancelable:true}));assert.equal(f.modules.weather.getState().renderer,'unavailable');assert.equal(f.$('#host-chat-fallback').hidden,false);assert.equal(f.$('#host-open-chat').disabled,false);
  summary.click();assert.equal(f.modules.weather.getState().disclosure.overlay,true);assert.equal(overlay.querySelector('.weather-panel'),panel);assert.equal(root.querySelector('.weather-panel'),null);assert.deepEqual([...panel.querySelectorAll('button,input')],controls);assert.equal(f.d.querySelectorAll('.weather-panel').length,1);
  panel.querySelector('[data-weather-preset=wind]').click();assert.equal(f.host.getState().weather.preset,'wind');assert.equal(f.chat.getState().phase,'closed');
  const slider=panel.querySelector('[data-weather-field=wind]');slider.value='8.7';slider.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.host.getState().weather.target.wind,8.7);assert.equal(f.chat.getState().phase,'closed');
  panel.querySelector('[data-weather-close]').click();assert.equal(panel.parentElement,root);assert.equal(f.modules.weather.getState().disclosure.overlay,false);assert.deepEqual([...panel.querySelectorAll('button,input')],controls);
  f.$('#host-open-chat').click();f.settleChat();assert.equal(f.chat.getState().phase,'open');assert.equal(f.$('#host-open-chat').disabled,false);assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(f.renderers.length,1);assert.deepEqual(f.errors,[]);f.chat.close({history:false});f.settleChat();await Promise.resolve();
 }finally{f.destroy();}
});

test('actual host chat notification dismisses portaled weather and teardown removes only the owned wrapper (DOM/CPU)',async()=>{
 const f=await bootModules();try{
  const overlay=f.$('#host-overlays'),root=f.$('#host-weather details'),summary=root.querySelector('summary'),panel=root.querySelector('.weather-panel');summary.click();assert.equal(f.modules.weather.getState().disclosure.open,true);
  assert.equal(await f.host.navigate('labs'),true);assert.equal(f.modules.weather.getState().disclosure.open,false);assert.equal(panel.parentElement,root);assert.equal(f.w.personalOSContent.getState().category,'labs');summary.click();assert.equal(f.modules.weather.getState().disclosure.open,true);
  f.chat.show({history:false});f.settleChat();assert.equal(f.modules.weather.getState().disclosure.open,false);assert.equal(panel.parentElement,root);assert.equal(f.host.getState().chat.phase,'open');
  f.modules.weather.dispose();assert.equal(f.$('#host-overlays'),overlay);assert.equal(overlay.children.length,0);assert.equal(f.$('#host-weather').children.length,0);assert.equal(f.$('#host-open-chat').disabled,false);f.chat.close({history:false});f.settleChat();await Promise.resolve();
 }finally{f.destroy();}
});
