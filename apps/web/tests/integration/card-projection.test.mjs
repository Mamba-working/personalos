import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent,read} from './content-fixture.mjs';
import {bootCompactFeed} from './compact-feed-fixture.mjs';
import {bootChatWorld} from './chat-world-fixture.mjs';
const turn=()=>new Promise(resolve=>setTimeout(resolve,30));
const traverse=(f,delta)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('No popstate')),2000);
 f.w.addEventListener('popstate',()=>{clearTimeout(timer);resolve();},{once:true,capture:true});
 f.w.history.go(delta);
});
const assertRoute=(f,id)=>{assert.equal(new URL(f.w.location).searchParams.get('item'),id);assert.equal(f.w.personalOSContent.getState().contentId,id);};
for(const width of [360,390,1180])for(const reduced of [false,true]){
 test(`split projection retains semantic nodes and native text at ${width}px reduced=${reduced}`,()=>{
  const f=bootContent({width,reduced});try{
   const article=f.$('[data-content-id="thoughts-long"]'),identity=article.querySelector('.identity'),title=identity.querySelector('h2'),body=article.querySelector('.detail-body'),original=[...article.querySelectorAll('*')];
   f.w.contentStudy.open('thoughts-long',{push:false});const width=body.style.getPropertyValue('width')||article.style.getPropertyValue('--body-width');
   for(const p of [0,.12,.5,.9,1,.6,.1]){f.w.contentStudy.seek(p);assert.doesNotMatch(identity.style.transform,/scale/);assert.doesNotMatch(title.style.transform,/scale/);assert.doesNotMatch(body.style.transform,/scale/);assert.equal(article.style.getPropertyValue('--body-width'),width);assert.equal(f.d.querySelectorAll('#title-thoughts-long').length,1);assert.equal(f.$('#canvas .projection-preview').getAttribute('aria-hidden'),'true');assert.equal(f.$('#canvas .projection-preview').inert,true);}
   f.w.contentStudy.open('thoughts-long',{push:false});f.settle();assert.equal(article.querySelector('.identity'),identity);assert.equal(article.querySelector('h2'),title);assert.equal(article.querySelector('.detail-body'),body);assert.equal(f.$('#reader').classList.contains('reading'),true);
   f.w.contentStudy.close('test',{history:false});f.settle();assert.deepEqual([...article.querySelectorAll('*')],original);assert.equal(f.$('#canvas .projection-preview'),null);assert.equal(article.dataset.cardProjection,undefined);assert.deepEqual(f.errors,[]);
  }finally{f.close();}
 });
 test(`latest intent cancels queued category/replacement at ${width}px reduced=${reduced}`,async()=>{
  const f=bootContent({width,reduced});try{
   f.w.contentStudy.open('work-context');f.settle();f.w.contentStudy.filter('labs');f.w.contentStudy.open('work-context');await turn();f.settle();f.w.contentStudy.close('escape');await turn();f.settle();assert.equal(f.w.personalOSContent.getState().category,'all');assertRoute(f,null);
   f.w.contentStudy.open('work-context');f.settle();f.w.contentStudy.open('labs-spring');f.w.contentStudy.close('escape');await turn();f.settle();assertRoute(f,null);
  }finally{f.close();}
 });
 test(`queued traversal cannot strand a newly opened URL at ${width}px reduced=${reduced}`,async()=>{
  const f=bootContent({width,reduced});try{
   f.w.contentStudy.open('work-context');f.settle();f.w.contentStudy.close();f.settle();f.w.contentStudy.open('labs-spring');await turn();f.settle();assertRoute(f,'labs-spring');
   f.w.contentStudy.close();await turn();f.settle();assertRoute(f,null);
  }finally{f.close();}
 });
}
test('Back across category entries restores route offset and normalizes invalid historical category',async()=>{
 for(const query of ['', '?space=invalid']){const f=bootContent({query});try{
  f.d.scrollingElement.scrollTop=120;f.w.contentStudy.filter('work');f.d.scrollingElement.scrollTop=850;f.w.contentStudy.open('work-context');f.settle();await traverse(f,-2);f.settle();assertRoute(f,null);assert.equal(f.w.personalOSContent.getState().category,'all');assert.equal(f.d.scrollingElement.scrollTop,120);assert.deepEqual(f.errors,[]);
 }finally{f.close();}}
});
test('valid deep-linked item wins a conflicting category and Back has a same-page target',async()=>{
 const f=bootContent({query:'?space=work&item=labs-spring'});try{f.settle();assertRoute(f,'labs-spring');assert.equal(f.w.personalOSContent.getState().category,'labs');assert.equal(new URL(f.w.location).searchParams.get('space'),'labs');await traverse(f,-1);f.settle();assertRoute(f,null);assert.equal(f.w.personalOSContent.getState().category,'labs');}finally{f.close();}
});
test('rapid Back/Forward during projection follows the final route',async()=>{
 const f=bootContent();try{f.w.contentStudy.open('work-context');f.w.contentStudy.advance(.05);await traverse(f,-1);f.w.contentStudy.advance(.02);await traverse(f,1);f.settle();assertRoute(f,'work-context');assert.equal(f.w.personalOSContent.getState().phase,'detail');}finally{f.close();}
});
test('chat multi-entry Back reconciles through the existing content owner after page release',async()=>{
 const f=await bootChatWorld({width:390});try{f.w.contentStudy.open('work-context');f.settle();const article=f.$('[data-content-id="work-context"]');f.chat.show();f.settleChat();f.w.history.go(-2);await turn();f.settleChat();f.settle();assertRoute(f,null);assert.equal(article.parentElement.dataset.id,'work-context');assert.equal(f.chat.getState().phase,'closed');f.w.history.go(2);await turn();f.settleChat();assert.equal(f.w.personalOSContent.getState().contentId,'work-context');assert.equal(f.chat.getState().open,true);}finally{f.destroy();}
});
test('split projection introduces no wheel/touch interception, body scale, library or extra frame loop',()=>{
 const module=read('card-projection.js');assert.doesNotMatch(module,/requestAnimationFrame|setInterval|addEventListener\(['"](?:wheel|touchmove)/);assert.doesNotMatch(read('card-projection.css'),/overflow-y:\s*hidden/);// Assert the behavior, rather than the old per-child scale implementation.
 const f=bootContent();try{
  const article=f.$('[data-content-id="work-context"]'),label=article.querySelector('.visual-label'),svg=article.querySelector('svg'),aspect=svg.getAttribute('preserveAspectRatio');
  f.w.contentStudy.open('work-context',{push:false});
  for(const progress of [0,.2,.7,1,.4,0]){f.w.contentStudy.seek(progress);assert.doesNotMatch(label.style.transform,/scale/);assert.equal(svg.getAttribute('preserveAspectRatio'),aspect);assert.doesNotMatch(article.querySelector('.detail-body').style.transform,/scale/);}
 }finally{f.close();}
});


test('chat push waits for an in-flight content Back instead of canceling its route transaction',async()=>{
 const f=await bootChatWorld({width:390});try{
  f.w.contentStudy.open('work-context');f.settle();f.w.contentStudy.close();f.settle();f.chat.show();await turn();f.settleChat();assert.equal(f.chat.getState().open,true);assert.equal(f.w.personalOSContent.getState().contentId,null);assert.equal(new URL(f.w.location).searchParams.get('item'),null);
  f.chat.close();await turn();f.settleChat();f.settle();assert.equal(f.chat.getState().phase,'closed');assertRoute(f,null);
  f.w.contentStudy.open('work-context');f.settle();f.w.contentStudy.close();f.settle();f.chat.show();f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await turn();f.settleChat();assert.equal(f.chat.getState().phase,'closed');assertRoute(f,null);
 }finally{f.destroy();}
});


test('restore category layout before applying an offset that would clamp in the short feed',async()=>{
 let offset=0;
 const f=bootContent({beforeBoot:({d})=>Object.defineProperty(d.scrollingElement,'scrollTop',{configurable:true,get:()=>offset,set:value=>{offset=Math.min(value,d.querySelectorAll('.slot:not(.excluded)').length===18?6000:1200);}})});
 try{f.d.scrollingElement.scrollTop=5000;f.w.contentStudy.filter('work');f.w.contentStudy.open('work-context');f.settle();await traverse(f,-2);f.settle();assert.equal(f.w.personalOSContent.getState().category,'all');assert.equal(f.d.scrollingElement.scrollTop,5000);}finally{f.close();}
});
test('source preview retargets native column width on resize and leaves the exact article subtree',async()=>{
 const f=bootCompactFeed();try{const article=f.$('[data-content-id="work-context"]'),subtree=[...article.querySelectorAll('*')];f.w.contentStudy.open('work-context',{push:false});f.settle();f.setFeedWidth(250);f.w.dispatchEvent(new f.w.Event('resize'));await new Promise(resolve=>setTimeout(resolve,110));f.settle();const slot=f.$('.slot[data-id="work-context"]');assert.equal(parseFloat(f.$('#canvas .projection-preview').style.width),slot.getBoundingClientRect().width-2);assert.deepEqual([...article.querySelectorAll('*')],subtree);f.w.contentStudy.close('test',{history:false});f.settle();assert.equal(article.parentElement,slot);assert.equal(article.querySelector('.identity').style.transform,'');}finally{f.close();}
});
test('long CJK body remains native semantic nodes through interrupted reading',()=>{
 const f=bootContent({width:360});try{const article=f.$('[data-content-id="thoughts-long"]'),body=article.querySelector('.detail-body'),p=f.d.createElement('p');p.textContent='中文阅读，保持连续。'.repeat(400);body.append(p);const original=[...body.querySelectorAll('*')];f.w.contentStudy.open('thoughts-long',{push:false});for(const t of [.04,.1,.15]){f.w.contentStudy.advance(t);assert.equal(p.textContent.length,4000);assert.deepEqual([...body.querySelectorAll('*')],original);assert.doesNotMatch(body.style.transform,/scale/);}f.settle();f.$('#reader').scrollTop=1800;f.w.contentStudy.close('test',{history:false});f.w.contentStudy.advance(.05);f.w.contentStudy.open('thoughts-long',{push:false});f.settle();assert.equal(article.querySelector('.detail-body'),body);assert.equal(p.parentElement,body);}finally{f.close();}
});


test('keyboard open and Escape preserve the same route/identity with no intermediate animation',async()=>{
 const f=bootContent();try{const article=f.$('[data-content-id="work-context"]');f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));article.querySelector('.open-card').click();f.w.contentStudy.advance(1/60);assert.equal(f.w.personalOSContent.getState().phase,'detail');f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));f.w.contentStudy.advance(1/60);await turn();assertRoute(f,null);assert.equal(article.parentElement.dataset.id,'work-context');assert.equal(f.d.activeElement,article.querySelector('.open-card'));}finally{f.close();}
});

test('Back invalidates a selection waiting for category layout',async()=>{
 const f=bootContent();try{
  f.w.contentStudy.filter('labs');f.w.contentStudy.filter('work');const slot=f.$('.slot[data-id="labs-spring"]'),rect=slot.getBoundingClientRect.bind(slot);let expanding=true;
  slot.getBoundingClientRect=()=>{const r=rect();return expanding?{...r,height:0,bottom:r.top}:r;};
  const pending=f.w.personalOSContent.select('labs-spring');await traverse(f,-2);assertRoute(f,null);expanding=false;
  for(const[id,callback]of [...f.frames]){f.frames.delete(id);callback(f.w.performance.now()+400);}
  assert.equal(await pending,false);f.settle();assert.equal(f.w.personalOSContent.getState().category,'labs');assertRoute(f,null);
 }finally{f.close();}
});
