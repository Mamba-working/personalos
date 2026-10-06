import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFrameClock} from '../../runtime/story/frame-clock.js';
import {createStoryLifecycle} from '../../runtime/story/lifecycle.js';
import {createChatMotion} from '../../runtime/chat-motion.js';
import {bootContent,read} from './content-fixture.mjs';
import {bootWorld} from './world-cpu-fixture.mjs';
import {bootChatWorld} from './chat-world-fixture.mjs';
const before=new URL('./fixtures/motion-clock-before/',import.meta.url);
const oldRead=name=>fs.readFileSync(new URL(name,before),'utf8');
const moduleFrom=async name=>import('data:text/javascript;base64,'+Buffer.from(oldRead(name)).toString('base64'));
const near=(a,b,epsilon=1e-8)=>assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const rates=[60,30,10,2];
const descriptor={target:{x:8,y:8,w:386,h:650},actorTarget:{x:295,y:13,w:28,h:28},seed:{x:180,y:570,w:60,h:60}};
function chat(make=createChatMotion){const m=make();m.configure(descriptor);m.reset(descriptor.seed);m.setWanted(true);return m;}
function clockHarness(make=createFrameClock){
 let stamp=0,id=0,visible=true,need=true;const pending=new Map(),samples=[];
 const clock=make({now:()=>stamp,request:fn=>{pending.set(++id,fn);return id;},cancel:id=>pending.delete(id),visible:()=>visible,needsFrame:()=>need,step:(dt)=>samples.push(dt)});
 return{clock,samples,pending,setNeed:v=>need=v,elapse(ms){stamp+=ms;},hide(){visible=false;clock.suspend();},show(){visible=true;clock.wake();},frame(ms){stamp+=ms;assert.equal(pending.size,1);const [[id,fn]]=pending;pending.delete(id);fn(stamp);}};
}
function content(appSource){
 let stamp=0;const f=bootContent({appSource,beforeBoot:({w})=>{w.performance.now=()=>stamp;}});
 return{...f,elapse(ms){stamp+=ms;},frame(ms){stamp+=ms;const pending=[...f.frames];f.frames.clear();for(const [,fn]of pending)fn(stamp);return pending.length;},visible(value){Object.defineProperty(f.d,'hidden',{value:!value,configurable:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));}};
}
function until(f,phase,hz,limit=30){let seconds=0;while(f.w.contentStudy.snapshot().phase!==phase&&seconds<limit){f.frame(1000/hz);seconds+=1/hz;}assert.equal(f.w.contentStudy.snapshot().phase,phase);return seconds;}

test('negative fixtures are exact public-alpha.4 source bytes, independently SHA-256 pinned',()=>{
 const hashes=JSON.parse(oldRead('sha256.json'));for(const [file,hash]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(oldRead(file)).digest('hex'),hash,file);
});
for(const hz of rates){
 test(`${hz} Hz visible clock loses no elapsed time, story skip settles once within one delivery interval`,()=>{
  const f=clockHarness();const events=[],returns=[];const s=createStoryLifecycle({onReturn:why=>returns.push(why)});s.subscribe(e=>events.push(e.action));s.skip();f.clock.wake();let elapsed=0;
  while(s.getState().active&&elapsed<2){f.frame(1000/hz);elapsed+=1/hz;s.advance(f.samples.at(-1));}
  assert.equal(s.getState().phase,'home');assert(elapsed<=.8+1/hz+1e-8);near(f.samples.reduce((a,b)=>a+b,0),elapsed);assert.deepEqual(returns,['skipped']);assert.equal(events.filter(x=>x==='settled').length,1);s.advance(10);assert.equal(returns.length,1);f.clock.dispose();
 });
 test(`${hz} Hz replay consumes rewind/handoff boundaries without per-phase frame delays`,()=>{
  const events=[];const s=createStoryLifecycle({bypass:true});s.subscribe(e=>events.push(e.action));s.replay();let elapsed=0;while(s.getState().active&&elapsed<15){s.advance(1/hz);elapsed+=1/hz;}assert.equal(s.getState().phase,'home');assert(elapsed<=13.6+1/hz+1e-8);assert.deepEqual(events,['started','rewound','handoff','settled']);s.advance(1);assert.equal(events.length,4);
 });
 test(`${hz} Hz actual card RAF opens/closes on time, exact terminal state and original native nodes`,()=>{
  const f=content();try{
   const actions=[];f.w.personalOSContent.subscribe(e=>actions.push(e.action));const article=f.$('[data-content-id="work-context"]'),identity=article.querySelector('.identity'),body=article.querySelector('.detail-body');
   f.w.contentStudy.open('work-context',{push:false});const opened=until(f,'detail',hz,2);assert(opened<=.9+1/hz);
   const s=f.w.contentStudy.snapshot();assert.deepEqual(s.pose,s.target);assert(Object.values(s.velocity).every(v=>v===0));assert.equal(f.$('#canvas').firstElementChild,article);assert.equal(article.querySelector('.identity'),identity);assert.equal(article.querySelector('.detail-body'),body);
   f.w.contentStudy.close('test',{history:false});const closed=until(f,'preview',hz,2);assert(closed<=.9+1/hz);assert.equal(article.parentElement.dataset.id,'work-context');assert.equal(f.d.querySelectorAll('article.card').length,18);assert.equal(actions.filter(x=>x==='detail-ready').length,1);assert.equal(actions.filter(x=>x==='returned').length,1);assert.equal(f.frames.size,0);
  }finally{f.close();}
 });
 test(`${hz} Hz chat gates follow the 60 Hz choreography without discarded time`,()=>{
  const m=chat(),reference=chat();let opened=0;
  for(;opened<3&&m.state().phase!=='open';opened+=1/hz){m.advance(1/hz,descriptor.seed);for(let n=0;n<60/hz;n++)reference.advance(1/60,descriptor.seed);for(const k of ['x','y','w','h','p'])near(m.pose[k],reference.pose[k]);}
  assert.equal(m.state().phase,'open');assert(opened<=1.5+1/hz);assert.deepEqual(m.state().pose,{...descriptor.target,radius:24,p:1});assert(Object.values(m.velocity).every(v=>v===0));
  m.setWanted(false);let closed=0;for(;closed<3&&m.state().phase!=='closed';closed+=1/hz)m.advance(1/hz,descriptor.seed);
  assert.equal(m.state().phase,'closed');assert(closed<=1.5+1/hz);assert.equal(m.pose.p,0);assert.equal(m.state().content.p,0);assert.deepEqual(m.actor,descriptor.seed);assert(Object.values(m.actorVelocity).every(v=>v===0));
 });
}

test('old source negative proof: 2 Hz clocks discard time; card and chat take multiple seconds',async()=>{
 const oldClock=(await moduleFrom('story/frame-clock.js')).createFrameClock,f=clockHarness(oldClock);f.clock.wake();for(let i=0;i<4;i++)f.frame(500);assert(f.samples.reduce((a,b)=>a+b,0)<.2);f.clock.dispose();
 const oldStory=(await moduleFrom('story/lifecycle.js')).createStoryLifecycle,s=oldStory();s.skip();for(let i=0;i<2;i++)s.advance(.5);assert.equal(s.getState().phase,'bridge');
 const c=content(oldRead('app.js'));try{c.w.contentStudy.open('work-context',{push:false});assert(until(c,'detail',2)>5);}finally{c.close();}
 const m=chat((await moduleFrom('chat-motion.js')).createChatMotion);for(let i=0;i<4;i++)m.advance(.5,descriptor.seed);assert.notEqual(m.state().phase,'open');
});

test('visible long stalls consume timeline boundaries exactly once, including rewind overflow',()=>{
 const actions=[],returns=[];const s=createStoryLifecycle({onReturn:r=>returns.push(r)});s.skip('initial',{immediate:true});s.subscribe(e=>actions.push(e.action));s.replay();s.advance(1);near(s.getState().time,.1);assert.equal(s.getState().phase,'story');s.advance(30);assert.equal(s.getState().phase,'home');assert.equal(s.getState().time,12.7);assert.deepEqual(actions,['started','rewound','handoff','settled']);assert.deepEqual(returns,['initial','completed']);s.advance(30);assert.equal(returns.length,2);
});

test('clock pause excludes hidden/idle time and schedules no catch-up burst or duplicate callbacks',()=>{
 const f=clockHarness();f.clock.wake();f.clock.wake();f.frame(100);near(f.samples[0],.1);f.hide();f.elapse(600000);f.clock.wake();assert.equal(f.pending.size,0);f.show();f.frame(20);near(f.samples.at(-1),.02);f.setNeed(false);f.frame(20);assert.equal(f.pending.size,0);f.elapse(600000);f.clock.wake();f.frame(10);near(f.samples.at(-1),.01);assert.equal(f.pending.size,0);assert.equal(f.samples.length,4);f.clock.dispose();
});

test('card hidden pause preserves presentation/velocity and visible resume excludes the gap',()=>{
 const f=content();try{f.w.contentStudy.open('work-context',{push:false});f.frame(100);const before=f.w.contentStudy.snapshot();f.visible(false);assert.equal(f.frames.size,0);f.elapse(600000);assert.deepEqual(f.w.contentStudy.snapshot().pose,before.pose);f.visible(true);f.frame(10);const after=f.w.contentStudy.snapshot();assert.equal(after.phase,'intermediate');assert(after.pose.progress>before.pose.progress);assert(after.pose.progress<.9);until(f,'detail',10,2);}finally{f.close();}
});

test('card retarget/reverse retains current presentation and velocity in early/middle/late phases',()=>{
 for(const elapsed of [16.667,100,300,500]){const f=content();try{f.w.contentStudy.open('work-context',{push:false});f.frame(elapsed);const shown=f.w.contentStudy.snapshot();f.w.contentStudy.close('test',{history:false});assert.deepEqual(f.w.contentStudy.snapshot().pose,shown.pose);assert.deepEqual(f.w.contentStudy.snapshot().velocity,shown.velocity);f.frame(20);const returning=f.w.contentStudy.snapshot();f.w.contentStudy.open('work-context',{push:false});assert.deepEqual(f.w.contentStudy.snapshot().pose,returning.pose);assert.deepEqual(f.w.contentStudy.snapshot().velocity,returning.velocity);until(f,'detail',2,2);f.w.contentStudy.close('test',{history:false});until(f,'preview',2,2);assert.equal(f.d.querySelectorAll('article.card').length,18);}finally{f.close();}}
});

test('chat baseline is numerically identical at 60 Hz, including interrupted reversals and retargets',async()=>{
 const old=chat((await moduleFrom('chat-motion.js')).createChatMotion),next=chat();
 for(let i=0;i<250;i++){if([5,20,60,95,155].includes(i)){const wanted=i===20||i===95;old.setWanted(wanted);next.setWanted(wanted);}if(i===120){const d={...descriptor,target:{...descriptor.target,h:580}};old.configure(d);next.configure(d);}old.advance(1/60,descriptor.seed);next.advance(1/60,descriptor.seed);assert.deepEqual(next.state(),old.state(),`60 Hz frame ${i}`);}
});

test('chat reversal at every phase preserves position/velocity and long active stalls settle in bounded work',()=>{
 for(const count of [1,12,25,40,60,85]){const m=chat();for(let i=0;i<count;i++)m.advance(1/60,descriptor.seed);const before=m.state();m.setWanted(false);assert.deepEqual(m.pose,before.pose);assert.deepEqual(m.velocity,before.velocity);m.advance(.1,descriptor.seed);const reversing=m.state();m.setWanted(true);assert.deepEqual(m.pose,reversing.pose);assert.deepEqual(m.velocity,reversing.velocity);m.advance(600,descriptor.seed);assert.equal(m.state().phase,'open');assert(Object.values(m.pose).every(Number.isFinite));m.setWanted(false);m.advance(600,descriptor.seed);assert.equal(m.state().phase,'closed');assert.deepEqual(m.actor,descriptor.seed);}
 // Count exact analytical work; no unbounded while-loop proportional to the gap.
 const m=chat(),exp=Math.exp;let calls=0;Math.exp=x=>{calls++;return exp(x);};try{m.advance(600,descriptor.seed);}finally{Math.exp=exp;}assert(calls<=120*11);assert.equal(m.state().phase,'open');
});

test('fallback GSAP ticker uses raw visible elapsed time, not lag-smoothed delta or hidden gap',()=>{
 const src=read('chat-host.js'),begin=src.indexOf(' let fallbackStamp='),end=src.indexOf(' function animate(',begin),listeners=new Map(),ticks=new Set(),samples=[];let stamp=0;
 const doc={hidden:false,addEventListener:(type,fn)=>listeners.set(type,fn)};const api=new Function('performance','document','gsap','getClock','step',`let releaseTick=null;const motion={configure(){}};${src.slice(begin,end)};return{startTick,stopTick,fallbackStep};`)({now:()=>stamp},doc,{ticker:{add:fn=>ticks.add(fn),remove:fn=>ticks.delete(fn)}},()=>null,(_time,delta)=>samples.push(delta));
 api.startTick();stamp=500;api.fallbackStep(.033,33);assert.deepEqual(samples,[500]);doc.hidden=true;listeners.get('visibilitychange')();stamp=600000;api.fallbackStep(1,33);assert.equal(samples.length,1);doc.hidden=false;listeners.get('visibilitychange')();stamp+=20;api.fallbackStep(1,33);assert.deepEqual(samples,[500,20]);api.stopTick();assert.equal(ticks.size,0);
});

test('actual chat host emits terminal events once on sparse world frames and preserves native identities',async()=>{
 const f=await bootChatWorld();try{const input=f.$('#question'),actor=f.cpu.actor,events=[];input.value='保留草稿';f.chat.subscribe(s=>events.push(s.action));f.chat.show({history:false});for(let i=0;i<8;i++)f.study.step(.5);assert.equal(f.chat.getState().phase,'open');assert.equal(events.filter(x=>x==='opened').length,1);f.chat.close({history:false});for(let i=0;i<8;i++)f.study.step(.5);assert.equal(f.chat.getState().phase,'closed');assert.equal(events.filter(x=>x==='closed').length,1);assert.equal(f.$('#question'),input);assert.equal(input.value,'保留草稿');assert.equal(f.cpu.actor,actor);assert.equal(f.d.querySelectorAll('article.card').length,18);}finally{f.destroy();}
});

test('actual world Skip starts at its input epoch, excluding the earlier part of a long frame',()=>{
 const f=bootWorld({manual:false});try{f.raf(10);f.w.performance.now=()=>490;f.world.story.skip();f.raf(490);near(f.world.story.getState().bridge.elapsed,.01);f.raf(500);near(f.world.story.getState().bridge.elapsed,.51);f.raf(300);assert.equal(f.world.story.getState().phase,'home');}finally{f.destroy();}
});

test('chat clock clips new/reversed/retargeted intent to its RAF epoch, including same-frame input',()=>{
 const src=read('chat-host.js'),begin=src.indexOf(' let fallbackStamp='),end=src.indexOf(' function animate(',begin),samples=[];let stamp=490,callback;
 const motion={configure:()=>{}},api=new Function('performance','document','gsap','getClock','step','motion',`let releaseTick=null;${src.slice(begin,end)};return{startTick,stopTick,worldStep,markMotionIntent};`)({now:()=>stamp},{addEventListener(){}},{ticker:{add(){},remove(){}}},()=>({onFrame:fn=>{callback=fn;return()=>{};}}),(_time,delta)=>samples.push(delta),motion);
 api.startTick();callback(.5,500);near(samples.at(-1),10);
 stamp=750;api.markMotionIntent();callback(.5,700);assert.equal(samples.at(-1),0);callback(.5,1000);near(samples.at(-1),250);
 stamp=1490;motion.configure({});callback(.5,1500);near(samples.at(-1),10);
 callback(.5,2000);near(samples.at(-1),500);api.stopTick();
});

test('repeated card close is idempotent and cannot keep postponing the elapsed-time epoch',()=>{
 const f=content();try{const actions=[];f.w.personalOSContent.subscribe(e=>actions.push(e.action));f.w.contentStudy.open('work-context',{push:false});f.frame(100);f.w.contentStudy.close('first',{history:false});let elapsed=0;while(f.w.contentStudy.snapshot().phase!=='preview'&&elapsed<2){f.elapse(90);f.w.contentStudy.close('duplicate',{history:false});f.frame(10);elapsed+=.1;}assert.equal(f.w.contentStudy.snapshot().phase,'preview');assert(elapsed<1);assert.equal(actions.filter(x=>x==='cancel-return').length,1);assert.equal(actions.filter(x=>x==='returned').length,1);assert.equal(f.frames.size,0);}finally{f.close();}
});

test('same-frame story restart does not inherit old rewind overflow; listeners see stable phase snapshots',()=>{
 const s=createStoryLifecycle({bypass:true}),events=[];let restarted=false;
 s.subscribe(e=>{if(e.action==='rewound'&&!restarted){restarted=true;s.start('autoplay');}});s.subscribe(e=>events.push(e));s.replay();s.advance(10);assert.equal(s.getState().phase,'story');assert.equal(s.getState().time,0);assert.equal(s.getState().serial,2);const rewound=events.find(e=>e.action==='rewound');assert.equal(rewound.serial,1);assert.equal(rewound.phase,'story');assert.equal(rewound.time,0);s.advance(.1);near(s.getState().time,.1);
 const b=createStoryLifecycle(),seen=[];b.subscribe(e=>{if(e.action==='handoff')b.skip('listener');});b.subscribe(e=>seen.push(e));b.advance(20);assert.equal(b.getState().phase,'bridge');assert.equal(b.getState().bridge.elapsed,0);assert.equal(seen.find(e=>e.action==='handoff').phase,'handoff');b.advance(.8);assert.equal(b.getState().phase,'home');assert.equal(seen.filter(e=>e.action==='settled').length,1);
});
