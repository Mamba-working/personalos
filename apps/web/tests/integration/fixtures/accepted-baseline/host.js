import {mountChat} from './chat-host.js';
import {createWorldReadiness,WORLD_AVAILABILITY_EVENT} from './world-availability.js';
// Frozen v2 DOM control proxies are isolated here; public APIs own content transitions.
const worldRoot=document.querySelector('#ball-world-root'),root=document.querySelector('#content-root'),app=document.querySelector('.app');
const fallbackMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const controls={skip:document.querySelector('#host-skip'),replay:document.querySelector('#host-replay'),motion:document.querySelector('#host-motion')};
let pendingChatReserve=false,fallbackActive=false,holdRecoveredHome=false,chatFailed=false,connectedWorld=null,worldCleanups=[],contentCleanup=null;
const fallback=document.createElement('aside');fallback.id='host-chat-fallback';fallback.hidden=true;fallback.setAttribute('aria-label','聊天备用入口');fallback.innerHTML='<p role="status">3D 画面暂时不可用，内容和聊天仍可使用</p><button id="host-open-chat" type="button" aria-controls="ai-canvas" disabled>打开聊天</button>';document.body.append(fallback);
const fallbackButton=fallback.querySelector('button'),fallbackText=fallback.querySelector('p');
const fallbackBounds=()=>{const r=fallbackButton.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
fallbackButton.addEventListener('click',()=>chat?.show());
let chat=null,homeGeometry=null,contentPhase='preview',placementIntent=0;let ready=false,entry='intro',pendingReplay=false,reserveTimer=0,pendingFeedFocus=false;const listeners=new Set();
const getState=()=>({version:3,ready,entry,pendingReplay,worldAvailability:{...window.personalOSWorldAvailability,fallback:fallbackActive},chat:chat?.getState()||null,content:window.personalOSContent?.getState()||null,world:window.personalOSWorld?.getState()||null});
function notify(action){const s=getState();for(const fn of listeners)fn({...s,action});window.dispatchEvent(new CustomEvent('personalos:host-state',{detail:{...s,action}}))}
function reserveWorld(){
 if(chat?.isPageLocked()){pendingChatReserve=true;return;}
 pendingChatReserve=false;
 if(fallbackActive||entry!=='home'||personalOSContent.getState().phase!=='preview'||!window.personalOSWorld)return;
 const b=personalOSWorld.getState().world.homeScreen||personalOSWorld.getState().world.screen;homeGeometry={...b};const hero=root.querySelector('.intro'),scroller=document.scrollingElement;if(!b)return;
 const eyebrow=hero.querySelector('.eyebrow');hero.style.setProperty('--intro-text-top','0px');hero.style.paddingTop=Math.max(25,eyebrow.offsetHeight+15)+'px';
 const heroTop=hero.getBoundingClientRect().top+scroller.scrollTop,ball={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};
 const textRects=[...hero.children].map(e=>e.getBoundingClientRect());const overlap=textRects.some(r=>r.x<ball.x+ball.w&&r.right>ball.x&&r.y+scroller.scrollTop<ball.y+ball.h&&r.bottom+scroller.scrollTop>ball.y);
 if(overlap){const offset=Math.max(0,Math.ceil(b.y+b.r*1.85+28-heroTop));hero.style.setProperty('--intro-text-top',offset+'px');hero.style.paddingTop=(offset+Math.max(25,eyebrow.offsetHeight+15))+'px'}
 const textBottom=Math.max(...[...hero.children].map(e=>e.getBoundingClientRect().bottom+scroller.scrollTop));
 const wanted=Math.ceil(Math.max(textBottom-heroTop+24,b.y+b.r*2.3+48-heroTop-parseFloat(getComputedStyle(hero).marginBottom)));hero.style.minHeight=wanted+'px';notify('reserve')
}
function setEntry(next){if(entry===next&&app.dataset.entry===next)return;entry=next;app.dataset.entry=next;document.body.dataset.entry=next;document.documentElement.dataset.entry=next;root.inert=next!=='home';controls.skip.hidden=next==='home';if(next==='home'){reserveWorld();if(pendingFeedFocus){pendingFeedFocus=false;document.querySelector('#feed').focus()}}notify('entry-'+next)}
function syncWorld(){if(fallbackActive)return;const s=window.ballStudy?.snapshot();if(!s)return;if(holdRecoveredHome&&s.mode!=='home')return;holdRecoveredHome=false;setEntry(s.mode==='home'?'home':'intro');const reduced=document.querySelector('#world-motion').getAttribute('aria-pressed')==='true';controls.motion.setAttribute('aria-pressed',String(reduced));controls.motion.setAttribute('aria-label',reduced?'恢复动态':'减少动态');controls.replay.setAttribute('aria-label',document.querySelector('#world-replay').getAttribute('aria-label')||'重播开场')}
function proxy(name){const el=document.querySelector('#world-'+name);if(!ready||fallbackActive||!el)return false;el.click();syncWorld();return true}
function doReplay(){chat?.close();document.scrollingElement.scrollTop=0;pendingReplay=false;root.inert=true;setEntry('intro');proxy('replay');notify('replay')}
document.querySelector('.skip').onclick=e=>{e.preventDefault();if(entry==='home')document.querySelector('#feed').focus();else{pendingFeedFocus=true;proxy('skip')}};
controls.skip.onclick=()=>proxy('skip');controls.motion.onclick=()=>proxy('motion');controls.replay.onclick=()=>{if(!ready)return;if(personalOSContent.getState().phase!=='preview'){pendingReplay=true;personalOSContent.cancel()}else doReplay()};
for(const b of Object.values(controls))b.disabled=true;
function connectContent(){if(contentCleanup||!window.personalOSContent)return;
 contentCleanup=personalOSContent.subscribe(e=>{contentPhase=e.phase;if(e.action==='category-select')placementIntent++;if(e.action==='returned'){if(pendingReplay)doReplay();else{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)}}});
}
function showFallback(reason){fallbackActive=true;pendingReplay=false;ready=!!(chat&&window.personalOSContent);connectContent();fallback.hidden=false;fallbackButton.disabled=!chat;
 fallbackText.textContent=chatFailed?'聊天模块加载失败，请刷新重试。':!chat?'3D 画面暂时不可用；内容可阅读，聊天正在准备':'3D 画面'+(reason==='startup-timeout'?'尚未准备好':'暂时不可用')+'，内容和聊天仍可使用';
 document.body.dataset.worldAvailability='fallback';worldRoot.inert=true;worldRoot.setAttribute('aria-hidden','true');
 for(const button of Object.values(controls))button.disabled=true;
 setEntry('home');chat?.clockChanged();notify('world-fallback');
}
function connect(world){const recovering=fallbackActive;fallbackActive=false;fallback.hidden=true;document.body.dataset.worldAvailability='ready';worldRoot.inert=false;worldRoot.removeAttribute('aria-hidden');
 if(connectedWorld!==world){for(const cleanup of worldCleanups.splice(0))cleanup();connectedWorld?.dispose?.();connectedWorld=world;
  worldCleanups.push(world.connectContent(personalOSContent),world.setPlacementProvider(placement),world.onActivate(()=>chat.show()));
  document.querySelector('#world-ball-hit').setAttribute('aria-label','打开 Ball 聊天；可横向轻拖');document.querySelector('#world-ball-hit').setAttribute('aria-controls','ai-canvas');
  const observer=new MutationObserver(syncWorld);observer.observe(document.querySelector('#world-home-state'),{attributes:true,attributeFilter:['hidden']});observer.observe(document.querySelector('#world-motion'),{attributes:true,attributeFilter:['aria-pressed']});worldCleanups.push(()=>observer.disconnect());
 }
 connectContent();ready=true;for(const button of Object.values(controls))button.disabled=false;
 // Recovery does not remount chat or replace transcript/input nodes. If content
 // was already released, skip an unfinished intro instead of hiding it again.
 if(recovering&&entry==='home'&&window.ballStudy?.snapshot().mode!=='home'){holdRecoveredHome=true;document.querySelector('#world-skip').click();}
 if(!recovering||window.ballStudy?.snapshot().mode==='home')syncWorld();
 if(new URL(location.href).searchParams.has('item')||new URL(location.href).searchParams.has('space'))proxy('skip');
 chat.clockChanged();notify(recovering?'world-recovered':'ready');
}
const readiness=createWorldReadiness({read:()=>({status:window.personalOSWorldAvailability?.status||'starting',reason:window.personalOSWorldAvailability?.reason,world:window.personalOSWorld,usable:!!(chat&&window.personalOSContent&&window.ballStudy)}),onReady:connect,onFallback:showFallback});
const worldAvailabilityChanged=()=>{readiness.check();if(fallbackActive){fallbackButton.disabled=!chat;ready=!!(chat&&window.personalOSContent);if(chat)fallbackText.textContent='3D 画面'+(readiness.getState().reason==='startup-timeout'?'尚未准备好':'暂时不可用')+'，内容和聊天仍可使用';connectContent();}};
window.addEventListener(WORLD_AVAILABILITY_EVENT,worldAvailabilityChanged);
const fallbackMotionChanged=()=>{if(fallbackActive)chat?.preferencesChanged();};fallbackMotionQuery.addEventListener('change',fallbackMotionChanged);
window.addEventListener('pagehide',event=>{if(event.persisted)return;readiness.dispose();fallbackMotionQuery.removeEventListener('change',fallbackMotionChanged);window.removeEventListener(WORLD_AVAILABILITY_EVENT,worldAvailabilityChanged);for(const cleanup of worldCleanups.splice(0))cleanup();contentCleanup?.();clearTimeout(reserveTimer);});
// Native resize updates only the hero reserve after the authored camera framing settles.
window.addEventListener('resize',()=>{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)});new ResizeObserver(()=>{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)}).observe(root.querySelector('.intro h1'));
new ResizeObserver(es=>{document.documentElement.style.setProperty('--host-header-size',es[0].target.getBoundingClientRect().height+'px')}).observe(document.querySelector('.topbar'));
const nativeScroll=document.scrollingElement;
function dockBounds(){const v=window.visualViewport;const w=v?.width||innerWidth,h=v?.height||innerHeight,x=v?.offsetLeft||0,y=v?.offsetTop||0;return{x:x+w-96,y:y+h-128,w:48,h:48}}
function placement(home,{ignoreChat=false}={}){if(fallbackActive)return null;const cp=ignoreChat?null:chat?.placement();if(cp?.bounds)return cp;const b=home||homeGeometry||personalOSWorld.getState().world.screen;const offset=Math.max(0,chat?.feedOffset()??nativeScroll.scrollTop),progress=Math.min(1,offset/220);const k=progress*progress*(3-2*progress),d=dockBounds();const from={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};if(contentPhase!=='preview')return{mode:'reading',bounds:d,quiet:true,transitionId:placementIntent};return{mode:progress===0?'hero':'dock',progress,transitionId:placementIntent,bounds:Object.fromEntries(['x','y','w','h'].map(key=>[key,from[key]+(d[key]-from[key])*k])),quiet:false}}
mountChat({getPresentation:()=>fallbackActive?'control':'actor',getRestoreFocus:()=>fallbackActive?fallbackButton:(document.querySelector('#world-ball-hit').closest('[inert]')?document.querySelector('.brand'):document.querySelector('#world-ball-hit')),getSourceBounds:()=>fallbackActive?fallbackBounds():null,getReturnBounds:()=>fallbackActive?fallbackBounds():null,getClock:()=>fallbackActive?null:window.personalOSWorld,
 getReturnBall:()=>{const p=placement(homeGeometry,{ignoreChat:true}),b=p.bounds;return{x:b.x+b.w/2,y:b.y+b.h/2,r:b.w/2}},getBall:()=>window.personalOSWorld?.getState().world.screen||{x:innerWidth/2,y:innerHeight/2,r:40},
 // The real text-button bounds seed a lightweight DOM-only morph. There is no
 // actor placement in this mode; unavailable WebGL does not imply reduced motion.
 reduced:()=>fallbackActive?fallbackMotionQuery.matches:document.querySelector('#world-motion').getAttribute('aria-pressed')==='true',onActivity:s=>{if(!fallbackActive)window.personalOSWorld?.setActivity?.(s);}}).then(api=>{chat=api;api.subscribe(state=>{if(state.action==='closed'&&pendingChatReserve){clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650);}});fallbackButton.disabled=false;worldAvailabilityChanged();notify('chat-ready');}).catch(error=>{chatFailed=true;fallbackButton.disabled=true;fallbackText.textContent='聊天模块加载失败，请刷新重试。';document.querySelector('#announcer').textContent=fallbackText.textContent;console.error(error);});
readiness.check();
window.personalOSHost={version:2,getState:()=>JSON.parse(JSON.stringify(getState())),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},world:()=>fallbackActive?null:window.personalOSWorld,chat:()=>chat,select:id=>!fallbackActive&&window.personalOSWorld?.select(id)||personalOSContent.select(id),cancel:()=>!fallbackActive&&window.personalOSWorld?.cancel()||personalOSContent.cancel(),setCategory:c=>!fallbackActive&&window.personalOSWorld?.setCategory(c)||personalOSContent.setCategory(c),skip:()=>proxy('skip'),replay:()=>controls.replay.click(),setReduced(v){const s=document.querySelector('#world-motion').getAttribute('aria-pressed')==='true';return s===!!v||proxy('motion')},chatBoundary:Object.freeze({status:'mounted',owner:'chat-thread',coordinateSpace:'layout CSS viewport pixels',api:'personalOSChat'})};
