import {records,graphic,detail} from './content.js';
import {createContentPresentation} from './story/content-presentation.js';
import {feedProfile,previewHeight,balanceEntries} from './feed-layout.js';
import {createSlotReflow} from './feed-reflow.js';
import {createCardProjection} from './card-projection.js';
const $=s=>document.querySelector(s),scroll=document.scrollingElement,feed=$('#feed'),stage=$('#stage'),shell=$('#shell'),canvas=$('#canvas'),reader=$('#reader'),closeButton=$('#close');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),entries=new Map();
// Native reading and its assistant have disjoint viewport regions from selection.
const readingRail=document.createElement('div');readingRail.id='reader-assistant-rail';readingRail.hidden=true;readingRail.setAttribute('aria-hidden','true');stage.append(readingRail);
const readingControls=document.createElement('div');readingControls.id='reader-controls';readingControls.hidden=true;readingControls.setAttribute('aria-hidden','true');closeButton.before(readingControls);
let selectionEpoch=0;let category='all',active=null,pendingFilter=null,pendingOpen=null,frame=0,manual=false,lastNow=null;
// Route writes belong to this content owner. A pending Back is identified by
// its parent entry, and newer user intent is committed only after it arrives.
let routeSequence=0,pendingTraversal=null,pendingScrollOffset=null,deferredChatRoute=null,readerResizeObserver=null;
const routeKey=()=>`content-${Date.now()}-${++routeSequence}`;
const normalizeCategory=value=>['all','work','thoughts','labs'].includes(value)?value:'all';
function resolvedRoute(url=new URL(location.href),entryState=history.state){
 const id=entries.has(url.searchParams.get('item'))?url.searchParams.get('item'):null;
 let next=normalizeCategory(url.searchParams.get('space'));
 if(id&&next!=='all'&&entries.get(id).record.category!==next)next=entries.get(id).record.category;
 return{id,next,offset:entryState?.scrollOffset??null};
}
function writeRoute({id=null,next=category,push=true,saveOffset=true}={}){
 const wanted={id,next,push,saveOffset};
 if(pendingTraversal){pendingTraversal.wanted=wanted;return;}
 const url=new URL(location.href);url.searchParams.delete('item');
 if(id)url.searchParams.set('item',id);
 if(next!=='all'||url.searchParams.has('space'))url.searchParams.set('space',next);
 const previous=history.state||{},parentKey=previous.contentKey||routeKey();
 if(push)history.replaceState({...previous,contentKey:parentKey,scrollOffset:saveOffset?scroll.scrollTop:previous.scrollOffset},'');
 const nextState={...previous,personalos:true,category:next,scrollOffset:scroll.scrollTop,contentId:id,contentKey:push?routeKey():parentKey,contentParentKey:id?(push?parentKey:previous.contentParentKey):null};
 history[push?'pushState':'replaceState'](nextState,'',url);
}
function requestPreviewRoute(){
 if(pendingTraversal){pendingTraversal.wanted=null;return;}
 const current=history.state,url=new URL(location.href);
 if(!url.searchParams.has('item'))return;
 if(current?.contentParentKey){pendingTraversal={parentKey:current.contentParentKey,wanted:null};history.back();}
 else writeRoute({push:false});
}
let keyboardNavigation=false;
document.addEventListener('keydown',event=>{keyboardNavigation=true;if(event.key==='Escape'&&pendingTraversal?.chatOpen)pendingTraversal.chatOpen=null;},true);
document.addEventListener('pointerdown',()=>{keyboardNavigation=false;},true);
const geometryKeys=['x','y','w','h','radius','ix','iy','scale','bx','by','progress','opacity'];
const state={phase:'preview',contentId:null,category:'all',progress:0,targetBounds:null,returnBounds:null};
const trace=[];let instrument=false;
const rect=e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
function announce(text){$('#announcer').textContent=text}
function emit(action){const payload={version:1,action,contentId:active?.record.id||null,category,phase:state.phase,progress:active?.pose.progress||0,targetBounds:active?.layout.bounds||null,displayBounds:active?Object.fromEntries(['x','y','w','h'].map(k=>[k,active.pose[k]])):null,returnBounds:active?rect(active.slot):null,cancelled:action==='cancel-return'};window.dispatchEvent(new CustomEvent('personalos:content-transition',{detail:payload}));state.progress=payload.progress;state.targetBounds=payload.targetBounds;state.returnBounds=payload.returnBounds}
let currentProfile=null;
const reflow=createSlotReflow({feed,entries,reduced:()=>reduced.matches||window.personalOSHost?.getState().reduced===true});
function columnCount(){return currentProfile?.columns||1;}
function arrange(){
 const width=feed.getBoundingClientRect().width||Math.max(1,innerWidth-32),font=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
 currentProfile=feedProfile({viewportWidth:innerWidth,contentWidth:width,rootFontSize:font});feed.dataset.compact=String(currentProfile.compact);feed.dataset.columns=String(currentProfile.columns);feed.dataset.layoutOwned='true';feed.style.columnGap=currentProfile.gap+'px';
 const cols=Array.from({length:currentProfile.columns},()=>{const node=document.createElement('div');node.className='feed-column';return node;});
 for(const e of entries.values()){if(e.record.id!==active?.record.id&&!e.article.dataset.storyOwner){e.article.dataset.previewDensity=currentProfile.compact?'compact':'regular';e.identity.style.width='';e.identity.style.transform='';e.presentationScale=1;}}
 const initial=balanceEntries([...entries.values()],{...currentProfile,category});initial.buckets.forEach((bucket,i)=>bucket.forEach(e=>cols[i].append(e.slot)));feed.replaceChildren(...cols);fitCards();
 const measured=balanceEntries([...entries.values()],{...currentProfile,category});measured.buckets.forEach((bucket,i)=>bucket.forEach(e=>cols[i].append(e.slot)));indicator();
}
for(const r of records){const slot=document.createElement('div');slot.className='slot';slot.dataset.id=r.id;slot.style.setProperty('--height',r.height+'px');const article=document.createElement('article');article.className='card';article.dataset.contentId=r.id;article.dataset.category=r.category;article.setAttribute('aria-labelledby','title-'+r.id);article.innerHTML=`<div class="identity"><div class="card-meta"><span class="category">${r.category.toUpperCase()}</span><span>PLACEHOLDER</span><span class="card-index">${r.index}</span></div><h2 id="title-${r.id}">${r.title}</h2><p class="summary">${r.summary}</p><figure class="card-visual" style="margin-left:0;margin-right:0">${graphic(r.kind)}</figure><div class="card-foot"><span>${r.meta}</span><span class="open-label">Open +</span></div></div><div class="detail-body" aria-hidden="true" inert>${detail(r)}</div><button class="open-card" aria-label="打开 ${r.title}"></button>`;slot.append(article);const entry={record:r,baseHeight:r.height,slot,article,identity:article.querySelector('.identity'),body:article.querySelector('.detail-body'),button:article.querySelector('.open-card')};entries.set(r.id,entry);entry.button.addEventListener('click',()=>{selectionEpoch++;open(r.id)})}
arrange();
function fitCards(){entries.forEach((e)=>{if(e.record.id===active?.record.id||e.article.dataset.storyOwner)return;const required=e.identity.getBoundingClientRect().height+8;const height=previewHeight({...e.record,baseHeight:e.baseHeight},Number(e.record.index)-1,currentProfile,required);e.previewHeight=height;e.record.height=height;e.slot.style.setProperty('--height',height+'px')})}
function indicator(){const b=$(`[data-filter="${category}"]`),i=$('.filter-indicator');i.style.transform=`translateX(${b.offsetLeft}px)`;i.style.width=b.offsetWidth+'px'}
function applyFilter(next,{push=true,anchor=true}={}){if(!['all','work','thoughts','labs'].includes(next))next='all';presentation?.release('category');const before=reflow.capture();if(push&&!pendingTraversal)history.replaceState({...history.state,scrollOffset:scroll.scrollTop},'');category=next;state.category=next;entries.forEach(e=>{const excluded=next!=='all'&&e.record.category!==next;e.slot.classList.toggle('excluded',excluded);e.slot.inert=excluded;e.slot.setAttribute('aria-hidden',String(excluded));});document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===next)));arrange();if(push){if(anchor){const target=$('#category-anchor');scroll.scrollTop=Math.max(0,target.getBoundingClientRect().top+scroll.scrollTop-$('.topbar').getBoundingClientRect().height);}writeRoute({next,saveOffset:false})}announce(`${next==='all'?'全部内容':next}，${next==='all'?18:6} 个示例`);emit('category-select');if(push)reflow.play(before)}
function filter(next,options={}){selectionEpoch++;if(!['all','work','thoughts','labs'].includes(next))return;if(active){pendingFilter={next,options};pendingOpen=null;close('category');}else applyFilter(next,options)}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>filter(b.dataset.filter)));
function layout(entry){const source=rect(entry.slot),mobile=innerWidth<=650,top=Math.max(mobile?76:96,$('.topbar').getBoundingClientRect().bottom+12),margin=mobile?12:Math.max(28,(innerWidth-1040)/2),width=mobile?innerWidth-24:Math.min(1040,innerWidth-56),height=innerHeight-top-Math.max(mobile?12:28,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'))||0),rail=entry.lockedWidth||source.w;const available=Math.max(40,height),assistantHeight=mobile?Math.min(88,Math.max(0,available-116)):0,assistant=assistantHeight>=80?{x:margin,y:top+available-assistantHeight,w:width,h:assistantHeight}:null;if(assistant)assistant.actor={x:assistant.x+(assistant.w-48)/2,y:assistant.y+(assistant.h-68)/2,w:48,h:48};const bodyWidth=Math.min(680,width-(mobile?40:112)),bx=(width-bodyWidth)/2;const headerHeight=entry.projection?.configure(bodyWidth)??entry.identity.offsetHeight,by=headerHeight+40;return{assistant,controlsHeight:64,bounds:{x:margin,y:top,w:width,h:available-(assistant?assistant.h+12:0)},canvasWidth:width,rail,bodyWidth,ix:bx,iy:0,bx,by,mobile}}
function destination(a){const b=a.layout.bounds;return{...b,radius:a.layout.mobile?22:28,scale:1,ix:a.layout.ix,iy:a.layout.iy,bx:a.layout.bx,by:a.layout.by,progress:1,opacity:1}}
function returnDestination(a){const b=rect(a.slot);return{...b,radius:20,scale:1,ix:0,iy:0,bx:a.layout.bx,by:a.layout.by,progress:0,opacity:1}}
let readingAssistantEnabled=false,readingChatActive=false;
function readingAssistantEntry(){
 if(!readingAssistantEnabled||readingChatActive)return null;
 const node=$(document.body.dataset.worldAvailability==='fallback'?'#host-open-chat':'#world-ball-hit');
 return node&&!node.disabled&&!node.closest('[hidden],[inert],[aria-hidden="true"]')?node:null;
}
function syncReadingAssistantOwner(){const entry=readingAssistantEntry(),owner=entry?.id||'';if(owner){if(shell.getAttribute('aria-owns')!==owner)shell.setAttribute('aria-owns',owner);}else shell.removeAttribute('aria-owns');}
window.addEventListener('personalos:host-state',syncReadingAssistantOwner);
window.addEventListener('personalos:chat-state',event=>{readingChatActive=!!event.detail.open||event.detail.phase!=='closed';syncReadingAssistantOwner();});
function configureReadingAssistant(a){
 const shelf=a?.layout.assistant;readingControls.hidden=!a;shell.dataset.readingControls=String(!!a);shell.style.setProperty('--reader-controls-height',(a?.layout.controlsHeight||0)+'px');if(!a)canvas.style.transform='';readingAssistantEnabled=!!shelf;readingRail.hidden=!shelf;document.body.dataset.readingAssistant=String(!!shelf);
 for(const key of ['x','y','w','h']){const name='--reading-assistant-'+key;if(shelf)document.body.style.setProperty(name,shelf[key]+'px');else document.body.style.removeProperty(name);}
 if(shelf)Object.assign(readingRail.style,{left:shelf.x+'px',top:shelf.y+'px',width:shelf.w+'px',height:shelf.h+'px'});syncReadingAssistantOwner();
}
function configureCanvas(a){configureReadingAssistant(a);a.identity.style.width=a.layout.bodyWidth+'px';a.article.style.setProperty('--identity-width',a.layout.bodyWidth+'px');a.article.style.setProperty('--body-width',a.layout.bodyWidth+'px');canvas.style.width=a.layout.canvasWidth+'px';canvas.style.height=Math.max(a.record.height,a.layout.by+a.body.scrollHeight+64)+'px'}
function setTarget(a,target){a.target=target;a.completed=false;state.phase=target.progress===1?'intermediate':'return';manual=false;lastNow=performance.now();ensureFrame()}
let mobileChatHeld=false,pendingMobileResize=false;
function ensureFrame(){if(!frame&&!manual&&!mobileChatHeld&&!document.hidden){if(lastNow===null)lastNow=performance.now();frame=requestAnimationFrame(tick)}}
// Closed-form critical damping remains stable at any visible frame interval.
function tick(now){frame=0;if(!active||manual||mobileChatHeld||document.hidden){lastNow=null;return}const dt=lastNow===null?0:Math.max(0,(now-lastNow)/1000);lastNow=now;advance(dt);if(active&&state.phase!=='detail')ensureFrame()}
// Pause at the last displayed state while hidden; resume without hidden catch-up.
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;lastNow=null;if(!document.hidden&&active&&state.phase!=='detail')ensureFrame()});
function advance(dt){const a=active;if(!a||mobileChatHeld||a.completed&&a.target.progress===1)return;dt=Number.isFinite(dt)?Math.max(0,dt):0;let settled=true;for(const k of geometryKeys){const target=a.target[k];if(reduced.matches||a.instant){a.pose[k]=target;a.velocity[k]=0;continue}const omega=k==='progress'?17:19;const v=a.velocity[k],x=a.pose[k]-target,c=v+omega*x,decay=Math.exp(-omega*dt);a.pose[k]=target+(x+c*dt)*decay;a.velocity[k]=(v-omega*c*dt)*decay;if(Math.abs(a.pose[k]-target)>.08||Math.abs(a.velocity[k])>.3)settled=false}if(a.target.progress===0){const live=returnDestination(a);for(const k of ['x','y','w','h','scale'])a.target[k]=live[k]}paint();if(instrument){trace.push(snapshot());if(trace.length>1800)trace.shift()}if(settled){a.pose={...a.target};for(const k of geometryKeys)a.velocity[k]=0;paint();if(a.target.progress===1)finishOpen();else finishClose()}}
function paint(){const a=active;if(!a)return;const p=a.pose,u=Math.max(0,Math.min(1,p.progress));canvas.style.transform=`translate3d(0,${-a.layout.controlsHeight*(1-u)}px,0)`;readingControls.style.opacity=String(u);shell.style.opacity=String(p.opacity);shell.style.setProperty('--reader-surface-progress',String(u));shell.style.setProperty('--reader-surface-radius',p.radius+'px');Object.assign(shell.style,{transform:`translate3d(${p.x}px,${p.y}px,0)`,width:p.w+'px',height:p.h+'px',borderRadius:p.radius+'px'});a.projection.paint(p);a.body.style.transform=`translate3d(${p.bx}px,${p.by}px,0)`;a.body.style.opacity=String(Math.max(0,Math.min(1,(u-.16)/.5)));$('.backdrop').style.opacity=String(Math.min(.58,Math.max(0,p.progress)*.58));closeButton.style.clipPath=`inset(${p.progress<.04?100:0}% 0 0 0)`;state.phase=a.completed&&a.target.progress===1?'detail':a.target.progress===0?'return':'intermediate';emit('progress')}
function open(id,{push=true,instant=keyboardNavigation}={}){selectionEpoch++;pendingFilter=null;pendingOpen=null;presentation?.release('select');const e=entries.get(id);if(!e||e.slot.classList.contains('excluded'))return;if(active){if(active.record.id===id){pendingOpen=null;active.instant=instant;active.body.inert=true;active.body.setAttribute('aria-hidden','true');setTarget(active,destination(active));if(push&&(pendingTraversal||new URL(location.href).searchParams.get('item')!==id))writeRoute({id});emit('select');return}pendingOpen={id,push};pendingFilter=null;close('replace');return}
 const presented=reflow.take(id),b=presented?.bounds||rect(e.slot),width=e.identity.offsetWidth,originFocus=document.activeElement;active={...e,instant,readerScrollResetPending:true,sourceOpacity:presented?.opacity??1,lockedWidth:width,originFocus,sourceOffset:scroll.scrollTop,pose:{...b,radius:20,scale:e.presentationScale||1,ix:0,iy:0,bx:0,by:0,progress:0,opacity:presented?.opacity??1},velocity:Object.fromEntries(geometryKeys.map(k=>[k,0])),historyPushed:push};const a=active;a.projection=createCardProjection(a);canvas.append(e.article);stage.hidden=false;a.projection.mount();a.layout=layout(a);a.pose.bx=a.layout.bx;a.pose.by=a.layout.by;a.target=destination(a);feed.inert=true;shell.setAttribute('aria-labelledby','title-'+id);shell.style.background=getComputedStyle(e.article).getPropertyValue('background-color'); // CSS category surface is captured below from its native value.
 shell.style.background=e.record.category==='thoughts'?'#211f25':e.record.category==='labs'?'#182526':'#171d29';a.body.inert=true;a.body.setAttribute('aria-hidden','true');configureCanvas(a);reader.scrollTop=0;reader.classList.remove('reading');state.contentId=id;state.phase='intermediate';paint();closeButton.focus({preventScroll:true});if(push)writeRoute({id});emit('select');setTarget(a,a.target);observeReaderSize(a);if(e.record.kind==='late'){setTimeout(()=>{if(a.article.isConnected){const image=a.article.querySelector('[data-late-image]');image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="150"><rect width="360" height="150" fill="#142e2f"/><path d="M0 75 Q60 5 120 75 T240 75 T360 75" stroke="#b1c9be" stroke-width="3" fill="none"/></svg>')}},650)}}
function observeReaderSize(a){
 readerResizeObserver?.disconnect();
 readerResizeObserver=new ResizeObserver(()=>{
  if(active!==a||mobileChatHeld)return;
  a.projection.retargetSource(Math.max(1,rect(a.slot).w-2),currentProfile.compact?'compact':'regular');
  const before=a.layout,next=layout(a);a.layout=next;configureCanvas(a);
  if(before.by!==next.by){
   if(a.completed){a.pose.by=next.by;a.target=destination(a);}
   else setTarget(a,a.target.progress===0?returnDestination(a):destination(a));
  }
  paint();
 });
 readerResizeObserver.observe(a.identity);readerResizeObserver.observe(a.body);
 // Header text keeps intrinsic block heights; observe font/content reflow without
 // feeding the independently animated cover dimensions back into layout.
 for(const node of a.identity.children)if(!node.classList.contains('card-visual'))readerResizeObserver.observe(node);
}
function finishOpen(){if(!active||active.completed)return;cancelAnimationFrame(frame);frame=0;active.completed=true;active.body.inert=false;active.body.setAttribute('aria-hidden','false');state.phase='detail';reader.classList.add('reading');
 // A fresh session resets only after overflow:auto owns a native scrolling box.
 // Resize/same-card retargets keep the user's reading offset and native anchoring.
 if(active.readerScrollResetPending){reader.scrollTop=0;active.readerScrollResetPending=false;}
 emit('detail-ready');}
function compensateReading(a){const offset=reader.scrollTop;
 // Reset before removing .reading: writes with overflow:visible can be ignored,
 // letting this reused element recover an old offset when scrolling returns.
 if(reader.classList.contains('reading'))reader.scrollTop=0;
 reader.classList.remove('reading');if(offset){a.pose.iy-=offset;a.pose.by-=offset;}paint()}
function close(reason='close',{history:useHistory=true}={}){
 selectionEpoch++;
 if(!['replace','category','back'].includes(reason)){pendingOpen=null;pendingFilter=null;if(pendingTraversal){pendingTraversal.wanted=null;pendingTraversal.chatOpen=null;}}
 if(!active)return;
 if(active.target.progress!==0){const a=active;if(reason==='escape')a.instant=true;compensateReading(a);a.body.inert=true;a.body.setAttribute('aria-hidden','true');state.phase='return';emit('cancel-return');setTarget(a,returnDestination(a));}
 if(useHistory)requestPreviewRoute();
 announce('返回内容流');
}
function finishClose(){const a=active;if(!a)return;readerResizeObserver?.disconnect();readerResizeObserver=null;a.projection.release();configureReadingAssistant(null);cancelAnimationFrame(frame);frame=0;a.slot.append(a.article);const entry=entries.get(a.record.id);entry.presentationScale=1;a.identity.style.transform='';a.identity.style.width='';a.article.style.removeProperty('--identity-width');a.article.style.removeProperty('--body-width');a.body.style.transform='';a.body.style.opacity='';a.body.inert=true;a.body.setAttribute('aria-hidden','true');stage.hidden=true;shell.style.removeProperty('--reader-surface-progress');shell.style.removeProperty('--reader-surface-radius');feed.inert=false;canvas.style.height='';state.phase='preview';state.contentId=null;const restoreOffset=pendingScrollOffset;pendingScrollOffset=null;a.button.focus({preventScroll:true});emit('returned');active=null;if(pendingFilter){const f=pendingFilter;pendingFilter=null;applyFilter(f.next,f.options);document.querySelector(`[data-filter="${category}"]`)?.focus({preventScroll:true})}if(restoreOffset!=null)scroll.scrollTop=restoreOffset;if(pendingOpen){const n=pendingOpen;pendingOpen=null;open(n.id,{push:n.push})}}
closeButton.addEventListener('click',()=>close());$('.backdrop').addEventListener('click',()=>close());
document.addEventListener('keydown',e=>{if(!active||readingChatActive||window.personalOSChat?.getState().open)return;if(e.key==='Escape'){e.preventDefault();close('escape')}if(e.key==='Tab'){const assistant=readingAssistantEntry(),focusables=[closeButton,...active.body.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'),...(assistant?[assistant]:[])].filter(x=>!x.disabled&&!x.closest('[hidden],[inert]'));if(!focusables.length)return;const index=focusables.indexOf(document.activeElement);if(assistant){e.preventDefault();const next=index<0?(e.shiftKey?focusables.length-1:0):(index+(e.shiftKey?-1:1)+focusables.length)%focusables.length;const target=focusables[next];if(active.body.contains(target))target.focus();else target.focus({preventScroll:true});}else if(index<0||(e.shiftKey&&index===0)||(!e.shiftKey&&index===focusables.length-1)){e.preventDefault();focusables[e.shiftKey?focusables.length-1:0].focus({preventScroll:true})}}});
document.addEventListener('click',e=>{if(e.target.matches('[data-damping]')){e.target.closest('.spring-demo').querySelector('[data-readout]').textContent='ζ = '+Number(e.target.dataset.damping).toFixed(2)}});
function reconcileRoute(route){
 selectionEpoch++;
 const {id,next,offset}=route;
 pendingOpen=null;pendingFilter=null;pendingScrollOffset=offset;
 if(active){
  if(id===active.record.id){if(next!==category)applyFilter(next,{push:false});pendingScrollOffset=null;setTarget(active,destination(active));return;}
  pendingFilter=next!==category?{next,options:{push:false}}:null;
  pendingOpen=id?{id,push:false}:null;
  close('back',{history:false});
 }else{
  if(next!==category){applyFilter(next,{push:false});document.querySelector(`[data-filter="${category}"]`)?.focus({preventScroll:true});}if(offset!=null)scroll.scrollTop=offset;pendingScrollOffset=null;
  if(id)open(id,{push:false});
 }
}
// Chat retains capture-phase history and its page lease. Save the content part
// before that owner consumes the event, and reconcile after its safe release.
window.addEventListener('popstate',e=>{
 const routed=new URL(location.href).searchParams.get('chat')==='open';
 if(readingChatActive){selectionEpoch++;deferredChatRoute=resolvedRoute(new URL(location.href),e.state);}
 else if(routed){deferredChatRoute=null;reconcileRoute(resolvedRoute(new URL(location.href),e.state));}
},true);
window.addEventListener('popstate',e=>{
 const route=resolvedRoute(new URL(location.href),e.state);
 if(pendingTraversal){
  const pending=pendingTraversal;pendingTraversal=null;
  if(e.state?.contentKey===pending.parentKey){
   if(pending.chatOpen)queueMicrotask(pending.chatOpen);
   if(pending.wanted){writeRoute(pending.wanted);return;}
   // A queued replacement/category will commit after the retained node returns.
   if(pendingOpen||pendingFilter)return;
  }
 }
 reconcileRoute(route);
});
window.addEventListener('personalos:chat-state',e=>{
 if(e.detail.phase==='closed'&&deferredChatRoute){const route=deferredChatRoute;deferredChatRoute=null;reconcileRoute(route);}
});

let resizeTimer;
function resizeContent(){reflow.finish();arrange();if(active){const a=active;let previewHeight=null;if(a.projection){const density=currentProfile.compact?'compact':'regular';a.article.dataset.previewDensity=density;previewHeight=a.projection.retargetSource(Math.max(1,rect(a.slot).w-2),density);}a.layout=layout(a);const required=previewHeight==null?a.identity.offsetHeight*((rect(a.slot).w-2)/a.lockedWidth)+10:previewHeight+10;const height=Math.ceil(Math.max(a.record.height,required)/20)*20;a.slot.style.setProperty('--height',height+'px');configureCanvas(a);setTarget(a,a.target.progress===0?returnDestination(a):destination(a));emit('resize-retarget')}}
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=null;if(mobileChatHeld){pendingMobileResize=true;return;}resizeTimer=setTimeout(()=>{resizeTimer=null;if(mobileChatHeld){pendingMobileResize=true;return;}resizeContent();},80)});
window.addEventListener('personalos:mobile-chat-hold',()=>{mobileChatHeld=true;selectionEpoch++;if(resizeTimer){clearTimeout(resizeTimer);resizeTimer=null;pendingMobileResize=true;}cancelAnimationFrame(frame);frame=0;});
window.addEventListener('personalos:mobile-chat-restoring',()=>{if(pendingMobileResize){pendingMobileResize=false;resizeContent();}});
window.addEventListener('personalos:mobile-chat-restored',()=>{if(active?.target.progress===0)setTarget(active,returnDestination(active));});
window.addEventListener('personalos:mobile-chat-release',()=>{mobileChatHeld=false;if(pendingMobileResize){pendingMobileResize=false;resizeContent();}lastNow=null;if(active&&state.phase!=='detail')ensureFrame();});
reduced.addEventListener('change',()=>{if(active&&reduced.matches){advance(1);}});
const presentation=createContentPresentation({entries,canBorrow:()=>!active&&!mobileChatHeld&&category==='all'&&!reflow.getState().active,onChange:detail=>window.dispatchEvent(new CustomEvent('personalos:content-presentation',{detail}))});
const initial=new URL(location.href),initialRoute=resolvedRoute(initial);applyFilter(initialRoute.next,{push:false});history.scrollRestoration='manual';const previewURL=new URL(location.href);previewURL.searchParams.delete('item');if(previewURL.searchParams.has('space'))previewURL.searchParams.set('space',initialRoute.next);history.replaceState({...history.state,personalos:true,category,scrollOffset:scroll.scrollTop,contentId:null,contentKey:routeKey(),contentParentKey:null},'',previewURL);if(initialRoute.id)open(initialRoute.id,{push:true});
function snapshot(){const a=active;const result={time:performance.now(),phase:state.phase,category,scrollOffset:scroll.scrollTop,readerOffset:reader.scrollTop,contentCount:document.querySelectorAll('article.card').length,absoluteFeedCards:[...feed.querySelectorAll('article')].filter(e=>getComputedStyle(e).position==='absolute').length};if(a){const h=a.identity.querySelector('h2'),r=new Range();r.selectNodeContents(h);const lines=[...r.getClientRects()].map(r=>({x:r.x,y:r.y,w:r.width,h:r.height}));Object.assign(result,{id:a.record.id,pose:{...a.pose},velocity:{...a.velocity},target:{...a.target},shell:rect(shell),origin:rect(a.slot),identity:rect(a.identity),native:{width:a.identity.offsetWidth,height:a.identity.offsetHeight,titleHeight:h.offsetHeight,summaryHeight:a.identity.querySelector('.summary').offsetHeight,font:getComputedStyle(h).fontSize,lines:lines.length},body:rect(a.body),bodyOpacity:getComputedStyle(a.body).opacity,identityOpacity:getComputedStyle(a.identity).opacity,focus:document.activeElement.id||document.activeElement.className,semanticTitleCount:document.querySelectorAll('#title-'+a.record.id).length})}return result}
// Public integration contract: accepts content selection/cancellation; never owns a 3D world.
async function selectContent(id){const entry=entries.get(id);if(!entry)return false;selectionEpoch++;if(entry.slot.classList.contains('excluded')){filter(entry.record.category);const epoch=selectionEpoch,started=performance.now();await new Promise(resolve=>{function ready(){if(epoch!==selectionEpoch||performance.now()-started>2500){resolve();return}if(!active&&category===entry.record.category&&Math.abs(entry.slot.getBoundingClientRect().height-entry.record.height)<.1){resolve();return}requestAnimationFrame(ready)}ready()});if(epoch!==selectionEpoch||active||entry.slot.classList.contains('excluded'))return false}open(id);return true}
window.personalOSContent={version:3,presentation,deferChatOpen(action){if(!pendingTraversal)return false;pendingTraversal.chatOpen=action;return true;},select:selectContent,setCategory:filter,cancel:()=>close('external'),getState:()=>({...state,...snapshot(),feedLayout:currentProfile&&{...currentProfile},reflow:reflow.getState()}),getBounds:id=>entries.has(id)?rect(entries.get(id).slot):null,getReadingAssistant:()=>active?.layout.assistant?{...active.layout.assistant,actor:{...active.layout.assistant.actor}}:null,subscribe(fn){const handler=e=>fn(e.detail);window.addEventListener('personalos:content-transition',handler);return()=>window.removeEventListener('personalos:content-transition',handler)}};
// Local QA controls. Deterministic inspection uses the same paint/advance path as production.
window.contentStudy={ready:true,records:records.map(r=>({id:r.id,category:r.category})),open,close,filter,snapshot,trace:()=>trace,record:enabled=>instrument=enabled,pause(){manual=true;cancelAnimationFrame(frame);frame=0},advance(seconds=1/60){manual=true;cancelAnimationFrame(frame);frame=0;advance(seconds);return snapshot()},settle(){manual=true;for(let i=0;i<220&&active&&state.phase!=='detail';i++)advance(1/60);return snapshot()},seek(p){const a=active;if(!a)return null;manual=true;cancelAnimationFrame(frame);frame=0;const from=returnDestination(a),to=destination(a);for(const k of geometryKeys){a.pose[k]=from[k]+(to[k]-from[k])*p;a.velocity[k]=0}paint();return snapshot()},resume(){manual=false;lastNow=null;ensureFrame()},scrollTo:y=>scroll.scrollTop=y};
