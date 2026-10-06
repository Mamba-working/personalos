import test from 'node:test';
import assert from 'node:assert/strict';
import {bootWorld} from './world-cpu-fixture.mjs';
const ids=['work-context','thoughts-type','labs-spring'];
const finite=s=>{for(const n of [...s.position,...s.cameraPosition,s.screen.x,s.screen.y,s.screen.r])assert(Number.isFinite(n));};
test('actual scene controller completes enabled story with one original actor/camera/canvas and same articles (CPU only)',()=>{
 const f=bootWorld();try{
  const identity={actor:f.cpu.actor,camera:f.cpu.camera,canvas:f.cpu.renderer.domElement},nodes=ids.map(id=>f.$(`[data-content-id="${id}"]`));
  assert.equal(f.renderers.length,1);assert.equal(f.study.snapshot().actorCount,1);assert.equal(f.study.snapshot().canvasCount,1);assert.equal(f.world.story.getState().borrowed,true);
  for(let i=0;i<260;i++){f.study.step(.05);finite(f.study.snapshot());}
  assert.equal(f.world.story.getState().phase,'home');assert.equal(f.world.story.getState().borrowed,false);assert.equal(f.cpu.actor,identity.actor);assert.equal(f.cpu.camera,identity.camera);assert.equal(f.cpu.renderer.domElement,identity.canvas);
  nodes.forEach((node,i)=>{assert.equal(f.$(`[data-content-id="${ids[i]}"]`),node);assert.equal(node.parentElement.dataset.id,ids[i]);});
  assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(f.cpu.eyes.length,2);assert.equal(f.renderers.length,1);assert.equal(f.w.personalOSWorldAvailability.status,'ready');assert.deepEqual(f.errors,[]);
 }finally{f.destroy();}
});
test('actual scene skip/replay/reduced/resize/context-loss retains owner identities and returns borrowed DOM (CPU only)',()=>{
 const f=bootWorld();try{
  const actor=f.cpu.actor,canvas=f.cpu.renderer.domElement;for(let i=0;i<70;i++)f.study.step(.05);
  Object.defineProperty(f.w,'innerWidth',{value:390,configurable:true});f.w.dispatchEvent(new f.w.Event('resize'));f.study.step(.05);finite(f.study.snapshot());
  f.world.story.skip();for(let i=0;i<20;i++)f.study.step(.05);assert.equal(f.world.story.getState().phase,'home');assert.equal(f.world.story.replay(),true);assert.equal(f.world.story.getState().borrowed,true);
  f.world.story.setReduced(true);f.study.step(.05);assert.equal(f.world.story.getState().borrowed,false);assert.equal(f.world.story.getState().phase,'home');
  f.world.story.setReduced(false);f.world.story.replay();f.study.step(.05);canvas.dispatchEvent(new f.w.Event('webglcontextlost',{cancelable:true}));assert.equal(f.w.personalOSWorldAvailability.status,'lost');assert.equal(f.world.story.getState().borrowed,false);
  canvas.dispatchEvent(new f.w.Event('webglcontextrestored'));assert.equal(f.w.personalOSWorldAvailability.status,'ready');assert.equal(f.cpu.actor,actor);assert.equal(f.renderers.length,1);assert.equal(f.d.querySelectorAll('article.card').length,18);
 }finally{f.destroy();}
});
test('real scene onFrame subscription wakes idle single clock and releases cleanly (CPU renderer only)',()=>{
 const f=bootWorld({manual:false,reduced:true});try{
  for(let i=0;i<5&&f.frames.size;i++)f.raf();assert.equal(f.frames.size,0);
  let ticks=0;const off=f.world.onFrame(dt=>{assert(dt>0&&dt<=.05);ticks++;f.world.requestFrame();});assert.equal(f.frames.size,1);
  for(let i=0;i<8;i++){assert.equal(f.raf(),1);assert.equal(f.frames.size,1);}assert.equal(ticks,8);off();for(let i=0;i<3&&f.frames.size;i++)f.raf();assert.equal(f.frames.size,0);
 }finally{f.destroy();}
});
test('feature-disabled and deep-link boot do not borrow cards; renderer stays singular (CPU only)',()=>{
 for(const options of [{enabled:false},{query:'?manual=1&item=work-context'}]){const f=bootWorld(options);try{assert.equal(f.w.personalOSContent.presentation.getState().leased,false);assert.equal(f.renderers.length,1);assert.equal(f.study.snapshot().actorCount,1);assert.equal(f.d.querySelectorAll('article.card').length,18);}finally{f.destroy();}}
});
test('actual world render failure returns content and advertises failed availability without extra canvas (CPU fault injection)',()=>{
 const f=bootWorld({manual:false});try{
  assert.equal(f.world.story.getState().borrowed,true);f.cpu.renderer.render=()=>{throw new Error('Injected CPU renderer failure');};
  f.raf();assert.equal(f.w.personalOSWorldAvailability.status,'failed');assert.equal(f.w.personalOSWorldAvailability.reason,'render-error');assert.equal(f.world.story.getState().borrowed,false);assert.equal(f.$('#story-content-layer').children.length,0);assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);assert(f.frames.size<=1,'failure may schedule at most one final no-op notification frame');if(f.frames.size)f.raf();assert.equal(f.frames.size,0);
 }finally{f.destroy();}
});
test('world visibility suspension and effect registration preserve single-owner RAF and dispose effect once (CPU only)',()=>{
 const f=bootWorld({manual:false,reduced:true});try{
  for(let i=0;i<3&&f.frames.size;i++)f.raf();let updates=0,disposed=0;const release=f.world.registerEffect('fixture',({actor,getState})=>{assert.equal(actor,f.cpu.actor);assert.equal(getState().reduced,true);return{update(){updates++;},needsFrame:()=>true,dispose(){disposed++;}};});
  assert.equal(f.frames.size,1);f.raf();assert.equal(updates,1);assert.equal(f.frames.size,1);
  Object.defineProperty(f.d,'hidden',{value:true,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.frames.size,0);f.world.requestFrame();assert.equal(f.frames.size,0);
  Object.defineProperty(f.d,'hidden',{value:false,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(f.frames.size,1);f.raf();assert.equal(updates,2);release();release();assert.equal(disposed,1);f.raf();assert.equal(f.frames.size,0);
 }finally{f.destroy();}
});
test('actual world scroll event requests one future frame without rendering directly or moving canvas by negative scroll (CPU only)',()=>{
 const f=bootWorld({manual:false,reduced:true});try{
  for(let i=0;i<3&&f.frames.size;i++)f.raf();const before=f.cpu.renderer.info.render.calls;
  f.d.scrollingElement.scrollTop=1700;f.w.dispatchEvent(new f.w.Event('scroll'));f.w.dispatchEvent(new f.w.Event('scroll'));assert.equal(f.cpu.renderer.info.render.calls,before);assert.equal(f.frames.size,1);f.raf();assert.equal(f.cpu.renderer.info.render.calls,before+1);
  assert.equal(f.cpu.renderer.domElement.style.transform,'');assert.equal(f.$('#ball-world-root').style.transform,'');
 }finally{f.destroy();}
});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('replay initial pose and first small rewind step stay continuous for original actor/camera (CPU projection)',()=>{
 const f=bootWorld();try{
  for(let i=0;i<260;i++)f.study.step(.05);const home=f.study.snapshot();assert.equal(home.story.phase,'home');
  f.world.story.replay();f.study.step(0);const start=f.study.snapshot();assert.equal(start.story.phase,'rewind');assert.equal(start.story.time,0);assert(distance(home.position,start.position)<1e-8);assert(distance(home.cameraPosition,start.cameraPosition)<1e-8);
  f.study.step(.001);const next=f.study.snapshot();assert(distance(start.position,next.position)<.001);assert(distance(start.cameraPosition,next.cameraPosition)<.001);assert.equal(next.story.time,0);
 }finally{f.destroy();}
});
test('late-handoff skip and mid-rewind skip preserve the currently presented pose before easing home (CPU projection)',()=>{
 for(const phase of ['handoff','rewind']){const f=bootWorld();try{
  for(let i=0;i<(phase==='handoff'?232:260);i++)f.study.step(.05);
  if(phase==='rewind'){f.world.story.replay();for(let i=0;i<6;i++)f.study.step(.05);}
  const before=f.study.snapshot();assert.equal(before.story.phase,phase);f.world.story.skip();f.study.step(0);const start=f.study.snapshot();assert(distance(before.position,start.position)<1e-8,`${phase} actor skipped at zero delta`);assert(distance(before.cameraPosition,start.cameraPosition)<1e-8,`${phase} camera skipped at zero delta`);
  f.study.step(.001);const next=f.study.snapshot();assert(distance(start.position,next.position)<.001);assert(distance(start.cameraPosition,next.cameraPosition)<.001);f.world.story.setReduced(true);f.study.step(0);assert.equal(f.world.story.getState().phase,'home');assert.equal(f.world.story.getState().borrowed,false);
 }finally{f.destroy();}}
});
