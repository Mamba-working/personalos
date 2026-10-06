/** Source, pure-model and synthetic DOM contracts. Not real-browser layout acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {feedProfile,previewHeight,balanceEntries} from '../../runtime/feed-layout.js';
import {records,detail,graphic} from '../../runtime/content.js';
import {bootCompactFeed} from './compact-feed-fixture.mjs';
import {read} from './content-fixture.mjs';
const turn=(ms=35)=>new Promise(resolve=>setTimeout(resolve,ms));
const historyTurn=(f,method)=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{f.w.removeEventListener('popstate',done);reject(new Error('Expected history popstate within 2000ms'));},2000);f.w.addEventListener('popstate',done,{once:true});f.w.history[method]();});
const copy=value=>JSON.parse(JSON.stringify(value));
const sameNodes=(f,originals)=>{assert.equal(f.d.querySelectorAll('article.card').length,18);for(const[id,{article,slot,subtree}]of originals){assert.equal(f.$(`[data-content-id="${id}"]`),article);assert.equal(f.$(`.slot[data-id="${id}"]`),slot);assert.deepEqual([...article.querySelectorAll('*')],subtree);assert.equal(f.d.querySelectorAll('#title-'+id).length,1);}};
const originals=f=>new Map([...f.d.querySelectorAll('article.card')].map(article=>[article.dataset.contentId,{article,slot:article.parentElement,subtree:[...article.querySelectorAll('*')]}]));

test('compact profile uses actual available feed width and root rem width, with deliberate narrow/large-font fallback',()=>{
 for(const width of [360,390,430,650]){const p=feedProfile({viewportWidth:width,contentWidth:width-32,rootFontSize:16});assert.equal(p.compact,true);assert.equal(p.columns,2);assert.equal(p.gap,12);}
 for(const width of [240,280,300])assert.equal(feedProfile({viewportWidth:width,contentWidth:width-24,rootFontSize:16}).columns,1);
 assert.equal(feedProfile({viewportWidth:390,contentWidth:280,rootFontSize:16}).columns,1);
 assert.equal(feedProfile({viewportWidth:390,contentWidth:358,rootFontSize:32}).columns,1);
 assert.equal(feedProfile({viewportWidth:768,contentWidth:708,rootFontSize:16}).columns,2);
 assert.equal(feedProfile({viewportWidth:1180,contentWidth:1084,rootFontSize:16}).columns,3);
 for(const rootFontSize of [NaN,0,-1])assert.equal(feedProfile({viewportWidth:390,contentWidth:358,rootFontSize}).rootFontSize,16);
});

test('compact authored heights are unequal 200–280px bases while measured text and enlarged fonts can grow them without mutation',()=>{
 const before=copy(records),p=feedProfile({viewportWidth:390,contentWidth:358,rootFontSize:16});
 const heights=records.map((r,i)=>previewHeight(r,i,p));
 assert.ok(heights.every(h=>h>=200&&h<=280));assert.ok(new Set(heights).size>=8);
 assert.ok(previewHeight(records[10],10,p,427)>=427);assert.ok(previewHeight(records[10],10,p,427)>280);
 const enlarged={...p,rootFontSize:32};assert.ok(previewHeight(records[0],0,enlarged)>previewHeight(records[0],0,p));
 const desktop=feedProfile({viewportWidth:1180,contentWidth:1084,rootFontSize:16});assert.equal(previewHeight({height:888,baseHeight:400},0,desktop),400);
 assert.deepEqual(records,before);
});

test('visible-category weighted balancing retains every entry exactly once, restores mixed All, and rejects old 5/1 distribution',()=>{
 const p=feedProfile({viewportWidth:390,contentWidth:358,rootFontSize:16});
 const entries=records.map((record,index)=>({record,previewHeight:previewHeight(record,index,p),slot:{id:record.id}}));
 for(const columns of [2,3])for(const category of ['all','work','thoughts','labs']){
  const {buckets,weights}=balanceEntries(entries,{columns,category,gap:p.gap});
  assert.equal(buckets.length,columns);assert.deepEqual(new Set(buckets.flat()),new Set(entries));
  const included=buckets.map(bucket=>bucket.filter(e=>category==='all'||e.record.category===category));
  if(category!=='all')assert.deepEqual(included.map(c=>c.length),Array(columns).fill(6/columns));
  assert.deepEqual(weights,included.map(bucket=>bucket.reduce((sum,e)=>sum+e.previewHeight+p.gap,0)));
 }
});

test('all 18 authored article contents remain unchanged, including long Chinese text and detail actions',()=>{
 const baseline=fs.readFileSync(new URL('./fixtures/alpha2-compact-feed/content.js',import.meta.url),'utf8');
 const old=new Function(baseline.replace(/\bexport /g,'')+';return {records,detail,graphic};')();
 assert.deepEqual(records,old.records);for(const record of records){assert.equal(detail(record),old.detail(record));assert.equal(graphic(record.kind),old.graphic(record.kind));}
 const css=read('feed-compact.css');
 assert.match(css,/h2\{font-size:1\.125rem/);assert.doesNotMatch(css,/(?:line-clamp|text-overflow|white-space\s*:\s*nowrap)/);
 assert.doesNotMatch(css,/(?:h2|\.summary)\s*\{[^}]*overflow\s*:\s*hidden/);
 assert.ok(read('index.html').indexOf('feed-compact.css')>read('index.html').indexOf('host.css'));
});

for(const width of [360,390,430])test(`actual controller composes two native columns and multiple candidates at ${width}px injected phone width`,()=>{
 const f=bootCompactFeed({width});try{
  assert.equal(f.$('#feed').dataset.columns,'2');assert.equal(f.columnIds().length,2);
  f.d.scrollingElement.scrollTop=550;const bounds=f.bounds();
  const xs=[...new Set(bounds.map(b=>b.x))];assert.equal(xs.length,2);
  for(const b of bounds){assert.ok(b.width>0);assert.ok(b.x>=16);assert.ok(b.right<=width-16+.1);}
  for(const x of xs){const column=bounds.filter(b=>b.x===x).sort((a,b)=>a.y-b.y);for(let i=1;i<column.length;i++)assert.ok(column[i].y>=column[i-1].bottom);}
  assert.ok(bounds.filter(b=>b.bottom>64&&b.y<844).length>=4,'injected viewport has several simultaneous candidates');
  const top=bounds.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,6);assert.equal(new Set(top.map(b=>b.category)).size,3);assert.ok(new Set(top.map(b=>b.height)).size>=3);
  assert.ok([...f.d.querySelectorAll('#feed article')].every(a=>a.style.position!=='absolute'));
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});

test('actual filters rebalance 6 visible cards to 3/3, preserve original slots/subtrees, and clean all transient absolute exits',()=>{
 const f=bootCompactFeed();try{
  const original=originals(f);
  for(const category of ['work','thoughts','labs','all']){
   f.click(`[data-filter="${category}"]`);sameNodes(f,original);
   if(category!=='all')assert.deepEqual(f.columnIds().map(c=>c.length),[3,3]);
   f.finishAnimations();assert.equal(f.w.personalOSContent.getState().reflow.active,false);
   assert.equal(f.$('#feed').children.length,2);
   for(const {article,slot}of original.values()){assert.equal(article.parentElement,slot);assert.equal(slot.parentElement.className,'feed-column');assert.notEqual(slot.style.position,'absolute');assert.equal(slot.style.transform,'');}
  }
 }finally{f.close();}
});

test('long Chinese measured identity grows past the compact base and a 200% rem resize falls back then recovers',async()=>{
 const f=bootCompactFeed({identityHeights:{'thoughts-long':427}});try{
  const slot=f.$('[data-id="thoughts-long"]'),article=slot.firstElementChild,title=article.querySelector('h2');
  assert.equal(title.textContent,records.find(r=>r.id==='thoughts-long').title);assert.ok(parseFloat(slot.style.getPropertyValue('--height'))>=427);
  f.setRootFont(32);f.w.dispatchEvent(new f.w.Event('resize'));await turn(110);
  assert.equal(f.columnIds().length,1);assert.ok(parseFloat(slot.style.getPropertyValue('--height'))>=854);
  f.setRootFont(16);f.w.dispatchEvent(new f.w.Event('resize'));await turn(110);
  assert.equal(f.columnIds().length,2);assert.equal(slot.firstElementChild,article);assert.ok(parseFloat(slot.style.getPropertyValue('--height'))<854);
  f.setFeedWidth(260);f.w.dispatchEvent(new f.w.Event('resize'));await turn(110);assert.equal(f.columnIds().length,1);
 }finally{f.close();}
});


test('native tablet/desktop columns stay 2/3 and mobile measured growth does not become the later desktop base',async()=>{
 for(const [width,count]of [[280,1],[768,2],[1180,3]]){const f=bootCompactFeed({width,feedWidth:width-60});try{assert.equal(f.columnIds().length,count);assert.equal(f.$('#feed').dataset.compact,String(width<=650));}finally{f.close();}}
 const f=bootCompactFeed({rootFont:32});try{
  const card=f.$('[data-content-id="work-context"]'),slot=card.parentElement;assert.ok(parseFloat(slot.style.getPropertyValue('--height'))>400);
  Object.defineProperty(f.w,'innerWidth',{value:1180,configurable:true});f.setFeedWidth(1084);f.setRootFont(16);f.w.dispatchEvent(new f.w.Event('resize'));await turn(110);
  assert.equal(f.columnIds().length,3);assert.equal(card.dataset.previewDensity,'regular');assert.equal(parseFloat(slot.style.getPropertyValue('--height')),400);assert.equal(card.parentElement,slot);
 }finally{f.close();}
});

test('scroll events do not remeasure, rearrange, or animate the feed controller',()=>{
 const f=bootCompactFeed();try{
  const initial={reads:f.metrics.feedReads,writes:f.metrics.feedWrites,animations:f.metrics.animations.length,columns:[...f.$('#feed').children],ids:f.columnIds()};
  for(const top of [300,800,1200,1800,700]){f.d.scrollingElement.scrollTop=top;f.w.dispatchEvent(new f.w.Event('scroll'));f.d.dispatchEvent(new f.w.Event('scroll'));f.flushFrames();}
  assert.equal(f.metrics.feedReads,initial.reads);assert.equal(f.metrics.feedWrites,initial.writes);assert.equal(f.metrics.animations.length,initial.animations);assert.deepEqual([...f.$('#feed').children],initial.columns);assert.deepEqual(f.columnIds(),initial.ids);
 }finally{f.close();}
});

test('same compact article survives sampled opening/reading/closing frames, retained slot, focus, offset and Back/Forward',async()=>{
 const f=bootCompactFeed();try{
  const original=originals(f),{article,slot}=original.get('thoughts-long'),button=article.querySelector('.open-card');
  f.d.scrollingElement.scrollTop=1270;button.focus();button.click();
  for(const time of [.016,.024,.04,.07]){const s=f.w.contentStudy.advance(time);assert.equal(s.phase,'intermediate');assert.ok(s.pose.progress>0&&s.pose.progress<1);assert.ok(Object.values(s.pose).every(Number.isFinite));assert.equal(f.$('#canvas').firstElementChild,article);sameNodes(f,original);}
  f.settle();assert.equal(f.d.activeElement,f.$('#close'));assert.equal(f.$('#feed').inert,true);
  f.$('#reader').scrollTop=315;await historyTurn(f,'back');
  for(const time of [.016,.025,.04]){const s=f.w.contentStudy.advance(time);assert.equal(s.phase,'return');assert.equal(f.$('#canvas').firstElementChild,article);sameNodes(f,original);}
  f.settle();assert.equal(article.parentElement,slot);assert.equal(f.d.activeElement,button);assert.equal(f.d.scrollingElement.scrollTop,1270);assert.equal(f.$('#stage').hidden,true);
  await historyTurn(f,'forward');f.settle();assert.equal(f.$('#canvas').firstElementChild,article);assert.equal(f.w.personalOSContent.getState().phase,'detail');sameNodes(f,original);
 }finally{f.close();}
});

test('opening during filter transport captures presented geometry and opacity before releasing only that slot track',()=>{
 const f=bootCompactFeed();try{
  const original=originals(f);f.click('[data-filter="work"]');
  const selected=f.$('.slot[data-id="work-identity"]'),track=f.metrics.animations.findLast(a=>a.node===selected&&!a.cancelled);
  assert.ok(track,'the retained Work slot has a live reflow track');
  f.presentSlot('work-identity',{x:73,y:291,w:173,h:248,opacity:.42});
  const unrelated=f.metrics.animations.filter(a=>a.node!==selected&&!a.cancelled);
  f.w.contentStudy.open('work-identity',{push:false});const state=f.w.personalOSContent.getState();
  assert.deepEqual(Object.fromEntries(['x','y','w','h'].map(k=>[k,state.pose[k]])),{x:73,y:291,w:173,h:248});assert.equal(Number(f.$('#shell').style.opacity),.42);
  assert.equal(track.cancelled,true);assert.ok(unrelated.some(a=>!a.cancelled));sameNodes(f,original);
  const s=f.w.contentStudy.advance(.035);assert.ok(s.pose.progress>0&&s.pose.progress<1);assert.ok(Number(f.$('#shell').style.opacity)>.42);f.settle();
  f.w.contentStudy.close('test',{history:false});f.settle();f.finishAnimations();assert.equal(original.get('work-identity').article.parentElement,selected);sameNodes(f,original);
 }finally{f.close();}
});


test('filter-open to immediate mid-open close keeps presented opacity, pose and velocity continuous before reaching an opaque original slot',()=>{
 const f=bootCompactFeed();try{
  const original=originals(f),{article,slot}=original.get('work-identity');f.click('[data-filter="work"]');
  f.presentSlot('work-identity',{x:78,y:287,w:173,h:248,opacity:.22});f.w.contentStudy.open('work-identity',{push:false});
  assert.equal(f.w.personalOSContent.getState().pose.opacity,.22);f.w.contentStudy.advance(.035);
  const before=copy(f.w.personalOSContent.getState());assert.ok(before.pose.opacity>.22&&before.pose.opacity<1);
  f.w.contentStudy.close('interrupt-fading-open',{history:false});const after=copy(f.w.personalOSContent.getState());
  assert.equal(after.phase,'return');assert.deepEqual(after.pose,before.pose);assert.deepEqual(after.velocity,before.velocity);assert.equal(Number(f.$('#shell').style.opacity),before.pose.opacity);sameNodes(f,original);
  f.w.contentStudy.advance(.016);assert.ok(f.w.personalOSContent.getState().pose.opacity>=before.pose.opacity);f.settle();f.finishAnimations();
  assert.equal(article.parentElement,slot);assert.equal(f.$('#stage').hidden,true);assert.equal(Number(f.$('#shell').style.opacity),1);sameNodes(f,original);
 }finally{f.close();}
});

test('filter interruption captures current nodes, cancels prior tracks, and newest reader/filter intent wins without duplicates',async()=>{
 const f=bootCompactFeed();try{
  const original=originals(f);f.click('[data-filter="work"]');const old=f.metrics.animations.slice();
  f.click('[data-filter="labs"]');assert.ok(old.every(a=>a.cancelled));assert.deepEqual(f.columnIds().map(c=>c.length),[3,3]);
  f.w.contentStudy.open('labs-spring',{push:false});f.w.contentStudy.advance(.04);f.w.contentStudy.filter('thoughts',{push:false});f.settle();f.finishAnimations();
  assert.equal(f.w.personalOSContent.getState().category,'thoughts');assert.equal(f.$('#stage').hidden,true);assert.equal(f.d.activeElement,f.$('[data-filter="thoughts"]'));assert.deepEqual(f.columnIds().map(c=>c.length),[3,3]);sameNodes(f,original);
  await f.w.personalOSContent.select('work-context');f.settle();assert.equal(f.w.personalOSContent.getState().id,'work-context');assert.equal(f.w.personalOSContent.getState().category,'work');sameNodes(f,original);
 }finally{f.close();}
});


test('visible departing slots block their prior hit surface, disable only their opener, and stale cleanup cannot override a newer filter',()=>{
 const f=bootCompactFeed();try{
  const slot=f.$('.slot[data-id="labs-spring"]'),button=slot.querySelector('.open-card'),article=slot.firstElementChild;
  slot.style.outline='1px solid red';const originalStyle=slot.getAttribute('style');assert.equal(button.disabled,false);
  f.click('[data-filter="work"]');const track=f.metrics.animations.findLast(a=>a.node===slot&&!a.cancelled),staleFinish=track.animation.onfinish;
  assert.equal(slot.style.position,'absolute');assert.equal(slot.style.pointerEvents,'auto');assert.equal(slot.inert,false);assert.equal(slot.getAttribute('aria-hidden'),'true');assert.equal(button.disabled,true);assert.equal(article.querySelector('.detail-body').inert,true);
  button.click();assert.equal(f.w.personalOSContent.getState().phase,'preview');
  f.click('[data-filter="labs"]');assert.equal(track.cancelled,true);assert.equal(slot.inert,false);assert.equal(button.disabled,false);assert.equal(slot.classList.contains('excluded'),false);assert.notEqual(slot.style.position,'absolute');
  staleFinish();assert.equal(slot.inert,false);assert.equal(button.disabled,false);assert.equal(slot.getAttribute('aria-hidden'),'false');
  f.click('[data-filter="work"]');f.finishAnimations();assert.equal(slot.inert,true);assert.equal(button.disabled,false);assert.equal(slot.getAttribute('style'),originalStyle);assert.equal(slot.parentElement.className,'feed-column');assert.equal(slot.firstElementChild,article);
 }finally{f.close();}
});

test('story acquisition and readiness wait for actual filter transport completion before borrowing original articles',async()=>{
 const f=bootCompactFeed();try{
  const ids=['work-context','thoughts-type','labs-spring'],api=f.w.personalOSContent.presentation,original=originals(f);
  f.click('[data-filter="work"]');f.finishAnimations();f.click('[data-filter="all"]');assert.equal(f.w.personalOSContent.getState().reflow.active,true);
  assert.equal(api.acquire(ids),null);let ready=false;const pending=api.ready(ids).then(value=>{ready=value;return value;});await Promise.resolve();assert.equal(ready,false);
  f.finishAnimations();assert.equal(f.w.personalOSContent.getState().reflow.active,false);f.flushFrames();assert.equal(await pending,true);
  const lease=api.acquire(ids);assert.ok(lease);for(const item of lease.items){assert.equal(item.article,original.get(item.id).article);assert.equal(item.slot,original.get(item.id).slot);}lease.release('test');sameNodes(f,original);
 }finally{f.close();}
});

test('reduced motion returns native slots immediately and mobile chat hold freezes compact reader motion across resize',async()=>{
 const reduced=bootCompactFeed({reduced:true});try{reduced.click('[data-filter="labs"]');assert.equal(reduced.metrics.animations.length,0);assert.equal(reduced.$('#feed').children.length,2);}finally{reduced.close();}
 const f=bootCompactFeed();try{
  const article=f.$('[data-content-id="work-context"]');f.w.contentStudy.open('work-context');f.w.contentStudy.advance(.04);const pose=copy(f.w.personalOSContent.getState().pose);
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-hold'));f.setFeedWidth(260);f.w.dispatchEvent(new f.w.Event('resize'));await turn(100);f.w.contentStudy.advance(1);
  assert.deepEqual(copy(f.w.personalOSContent.getState().pose),pose);assert.equal(f.columnIds().length,2);assert.equal(f.$('#canvas').firstElementChild,article);
  f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-restoring'));assert.equal(f.columnIds().length,1);f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-restored'));f.w.dispatchEvent(new f.w.CustomEvent('personalos:mobile-chat-release'));f.settle();assert.equal(f.w.personalOSContent.getState().phase,'detail');assert.equal(f.$('#canvas').firstElementChild,article);
 }finally{f.close();}
});
