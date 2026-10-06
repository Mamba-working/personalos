import {mountChat} from './chat-host.js';
import {createWorldReadiness,WORLD_AVAILABILITY_EVENT} from './world-availability.js';
// Frozen v2 DOM control proxies are isolated here; public APIs own content transitions.
const worldRoot=document.querySelector('#ball-world-root'),root=document.querySelector('#content-root'),app=document.querySelector('.app');
const fallbackMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const controls={skip:document.querySelector('#host-skip'),replay:document.querySelector('#host-replay'),motion:document.querySelector('#host-motion')};
const modules=new Map();
let navigationIntent=0,stopReplayScroll=null,stopReplayPreparation=null;
let replayPreparation={phase:'idle',startOffset:0};
let pendingChatReserve=false,fallbackActive=false,holdRecoveredHome=false,chatFailed=false,connectedWorld=null,worldCleanups=[],contentCleanup=null;
const fallback=document.createElement('aside');fallback.id='host-chat-fallback';fallback.hidden=true;fallback.setAttribute('aria-label','聊天备用入口');fallback.innerHTML='<p role="status">3D 画面暂时不可用，内容和聊天仍可使用</p><button id="host-open-chat" type="button" aria-controls="ai-canvas" disabled>打开聊天</button>';document.body.append(fallback);
const fallbackButton=fallback.querySelector('button'),fallbackText=fallback.querySelector('p');
const fallbackBounds=()=>{const r=fallbackButton.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
fallbackButton.addEventListener('click',()=>chat?.show());
let chat=null,homeGeometry=null,homeViewportWidth=0,contentPhase='preview',placementIntent=0;let ready=false,entry='intro',pendingReplay=false,reserveTimer=0,pendingFeedFocus=false;const listeners=new Set();
const getState=()=>({version:4,weather:modules.get('weather')?.getState()||null,menu:modules.get('menu')?.getState()||null,ready,entry,pendingReplay,replayPreparation:{...replayPreparation},story:window.personalOSWorld?.story?.getState()||{phase:'home',reduced:fallbackMotionQuery.matches},reduced:fallbackActive?fallbackMotionQuery.matches:window.personalOSWorld?.story?.getState().reduced||false,worldAvailability:{...window.personalOSWorldAvailability,fallback:fallbackActive},chat:chat?.getState()||null,content:window.personalOSContent?.getState()||null,world:window.personalOSWorld?.getState()||null});
function notify(action){const s=getState();for(const fn of listeners)fn({...s,action});window.dispatchEvent(new CustomEvent('personalos:host-state',{detail:{...s,action}}))}
function reserveWorld(){
 if(chat?.isPageLocked()){pendingChatReserve=true;return;}
 pendingChatReserve=false;
 if(fallbackActive||personalOSContent.getState().phase!=='preview'||!window.personalOSWorld)return;
 const projected=personalOSWorld.getState().world.homeScreen||personalOSWorld.getState().world.screen;const b=homeGeometry&&homeViewportWidth===innerWidth?homeGeometry:projected;homeGeometry={...b};homeViewportWidth=innerWidth;const hero=root.querySelector('.intro'),scroller=document.scrollingElement;if(!b)return;
 const eyebrow=hero.querySelector('.eyebrow');hero.style.setProperty('--intro-text-top','0px');hero.style.paddingTop=Math.max(25,eyebrow.offsetHeight+15)+'px';
 const heroTop=hero.getBoundingClientRect().top+scroller.scrollTop,ball={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};
 const textRects=[...hero.children].map(e=>e.getBoundingClientRect());const overlap=textRects.some(r=>r.x<ball.x+ball.w&&r.right>ball.x&&r.y+scroller.scrollTop<ball.y+ball.h&&r.bottom+scroller.scrollTop>ball.y);
 if(overlap){const offset=Math.max(0,Math.ceil(b.y+b.r*1.85+28-heroTop));hero.style.setProperty('--intro-text-top',offset+'px');hero.style.paddingTop=(offset+Math.max(25,eyebrow.offsetHeight+15))+'px'}
 const textBottom=Math.max(...[...hero.children].map(e=>e.getBoundingClientRect().bottom+scroller.scrollTop));
 const wanted=Math.ceil(Math.max(textBottom-heroTop+24,b.y+b.r*2.3+48-heroTop-parseFloat(getComputedStyle(hero).marginBottom)));hero.style.minHeight=wanted+'px';notify('reserve')
}
function setEntry(next){if(entry===next&&app.dataset.entry===next)return;entry=next;app.dataset.entry=next;document.body.dataset.entry=next;document.documentElement.dataset.entry=next;root.inert=next!=='home';controls.skip.hidden=next==='home';if(next==='home'){reserveWorld();if(pendingFeedFocus){pendingFeedFocus=false;document.querySelector('#feed').focus()}}notify('entry-'+next)}
function syncWorld(){if(fallbackActive)return;const lifecycle=window.personalOSWorld?.story?.getState();const s=window.ballStudy?.snapshot();if(!lifecycle&&!s)return;const home=lifecycle?lifecycle.phase==='home':s.mode==='home';if(holdRecoveredHome&&!home)return;holdRecoveredHome=false;setEntry(home?'home':'intro');const reduced=lifecycle?.reduced??(document.querySelector('#world-motion').getAttribute('aria-pressed')==='true');controls.motion.setAttribute('aria-pressed',String(reduced));controls.motion.setAttribute('aria-label',reduced?'恢复动态':'减少动态');controls.replay.setAttribute('aria-label','重播开场')}
function proxy(name){if(!ready||fallbackActive)return false;const story=window.personalOSWorld?.story;if(story){const result=name==='motion'?story.setReduced(!story.getState().reduced):story[name]?.();syncWorld();return result!==false;}const el=document.querySelector('#world-'+name);if(!el)return false;el.click();syncWorld();return true;}
function awaitState(api,predicate,action){if(predicate())return Promise.resolve(true);return new Promise(resolve=>{let timer;const off=api.subscribe(()=>{if(predicate()){off();clearTimeout(timer);resolve(true);}});timer=setTimeout(()=>{off();resolve(false);},4000);action();});}
async function returnOwners(intent){
 if(chat&&chat.getState().phase!=='closed'){const closed=await awaitState(chat,()=>chat.getState().phase==='closed',()=>chat.close());if(!closed||intent!==navigationIntent)return false;}
 if(personalOSContent.getState().phase!=='preview'){const returned=await awaitState(personalOSContent,()=>personalOSContent.getState().phase==='preview',()=>personalOSContent.cancel());if(!returned||intent!==navigationIntent)return false;}
 return intent===navigationIntent;
}
function cancelReplay(reason='cancelled'){
 if(!pendingReplay)return false;navigationIntent++;pendingReplay=false;stopReplayPreparation?.();stopReplayPreparation=null;stopReplayScroll?.();stopReplayScroll=null;replayPreparation={phase:'idle',startOffset:document.scrollingElement.scrollTop};controls.replay.removeAttribute('aria-busy');notify('replay-'+reason);return true;
}
function returnToTop(intent){
 const scroll=document.scrollingElement;if(scroll.scrollTop<=1)return Promise.resolve(true);
 const reduced=fallbackActive?fallbackMotionQuery.matches:window.personalOSWorld?.story?.getState().reduced;
 replayPreparation={phase:'scrolling',startOffset:scroll.scrollTop};notify('replay-preparing');
 return new Promise(resolve=>{
  let settled=false,quietTimer=null,deadline=null;
  const finish=success=>{if(settled)return;settled=true;clearTimeout(quietTimer);clearTimeout(deadline);window.removeEventListener('scroll',scrolling);window.removeEventListener('scrollend',check);document.removeEventListener('scrollend',check);window.removeEventListener('wheel',interrupt);window.removeEventListener('touchstart',interrupt);window.removeEventListener('pointerdown',interrupt);window.removeEventListener('keydown',key);if(stopReplayScroll===stop)stopReplayScroll=null;resolve(success&&intent===navigationIntent);};
  const stop=()=>{window.scrollTo({top:scroll.scrollTop,left:scroll.scrollLeft,behavior:'auto'});finish(false);};
  const check=()=>{if(scroll.scrollTop<=1)finish(true);};
  const scrolling=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(check,120);};
  const interrupt=event=>{if(event?.target?.closest?.('#host-replay'))return;cancelReplay('cancelled');};
  const key=event=>{if(event.key==='Escape')cancelReplay('cancelled');else if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))interrupt(event);};
  stopReplayScroll=stop;window.addEventListener('scroll',scrolling,{passive:true});window.addEventListener('scrollend',check);document.addEventListener('scrollend',check);window.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('touchstart',interrupt,{passive:true});window.addEventListener('pointerdown',interrupt,{passive:true});window.addEventListener('keydown',key);
  deadline=setTimeout(()=>{stop();},4000);
  // Native browser scrolling owns interpolation and interruption. This only observes completion.
  window.scrollTo({top:0,left:scroll.scrollLeft,behavior:reduced?'auto':'smooth'});check();
 });
}
function observeReplayPreparation(){
 const interrupt=event=>{if(!event.target?.closest?.('#host-replay'))cancelReplay('cancelled');};
 const key=event=>{if(event.key==='Escape')cancelReplay('cancelled');else if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))interrupt(event);};
 for(const name of ['wheel','touchstart','pointerdown'])window.addEventListener(name,interrupt,{passive:true});window.addEventListener('keydown',key);
 stopReplayPreparation=()=>{for(const name of ['wheel','touchstart','pointerdown'])window.removeEventListener(name,interrupt);window.removeEventListener('keydown',key);};
}
async function doReplay(){if(!ready||fallbackActive)return false;if(pendingReplay)cancelReplay('replaced');const intent=++navigationIntent;pendingReplay=true;replayPreparation={phase:'returning',startOffset:document.scrollingElement.scrollTop};controls.replay.setAttribute('aria-busy','true');observeReplayPreparation();notify('replay-pending');
 const returned=await returnOwners(intent);
 if(returned&&personalOSContent.getState().category!=='all'){replayPreparation.phase='layout';personalOSContent.setCategory('all',{anchor:false});}
 const layoutReady=returned&&await (personalOSContent.presentation?.ready?.(['work-context','thoughts-type','labs-spring'],()=>intent===navigationIntent)??Promise.resolve(true));
 if(!layoutReady||!await returnToTop(intent)){if(intent===navigationIntent){pendingReplay=false;stopReplayPreparation?.();stopReplayPreparation=null;replayPreparation.phase='idle';controls.replay.removeAttribute('aria-busy');notify('replay-blocked');}return false;}
 if(intent!==navigationIntent)return false;pendingReplay=false;stopReplayPreparation?.();stopReplayPreparation=null;replayPreparation.phase='idle';controls.replay.removeAttribute('aria-busy');const accepted=proxy('replay');syncWorld();notify('replay');return accepted;
}
async function navigate(category){if(!['all','work','thoughts','labs'].includes(category))return false;if(pendingReplay)cancelReplay('navigation');const intent=++navigationIntent;pendingReplay=false;if(!await returnOwners(intent))return false;window.personalOSWorld?.story?.skip('navigation',{immediate:true});window.personalOSContent.presentation?.release('navigation');setEntry('home');personalOSContent.setCategory(category);notify('navigate');return true;}
document.querySelector('.skip').onclick=e=>{e.preventDefault();if(entry==='home')document.querySelector('#feed').focus();else{pendingFeedFocus=true;proxy('skip')}};
controls.skip.onclick=()=>proxy('skip');controls.motion.onclick=()=>proxy('motion');controls.replay.onclick=()=>pendingReplay?cancelReplay():doReplay();
for(const b of Object.values(controls))b.disabled=true;
function connectContent(){if(contentCleanup||!window.personalOSContent)return;
 contentCleanup=personalOSContent.subscribe(e=>{contentPhase=e.phase;if(e.action!=='progress')notify('content-'+e.action);if(e.action==='category-select')placementIntent++;if(e.action==='returned'){{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)}}});
}
let chatLinkRestored=false;
function restoreChatLink(){if(!chatLinkRestored&&ready&&chat&&new URL(location.href).searchParams.get('chat')==='open'){chatLinkRestored=true;chat.show({history:false});}}
function showFallback(reason){if(pendingReplay)cancelReplay('fallback');window.personalOSContent?.presentation?.release('world-fallback');fallbackActive=true;pendingReplay=false;ready=!!(chat&&window.personalOSContent);connectContent();fallback.hidden=false;fallbackButton.disabled=!chat;
 fallbackText.textContent=chatFailed?'聊天模块加载失败，请刷新重试。':!chat?'3D 画面暂时不可用；内容可阅读，聊天正在准备':'3D 画面'+(reason==='startup-timeout'?'尚未准备好':'暂时不可用')+'，内容和聊天仍可使用';
 document.body.dataset.worldAvailability='fallback';worldRoot.inert=true;worldRoot.setAttribute('aria-hidden','true');
 for(const button of Object.values(controls))button.disabled=true;
 setEntry('home');chat?.clockChanged();notify('world-fallback');restoreChatLink();
}
function connect(world){const recovering=fallbackActive;fallbackActive=false;fallback.hidden=true;document.body.dataset.worldAvailability='ready';worldRoot.inert=false;worldRoot.removeAttribute('aria-hidden');
 if(connectedWorld!==world){for(const cleanup of worldCleanups.splice(0))cleanup();connectedWorld?.dispose?.();connectedWorld=world;
  worldCleanups.push(world.connectContent(personalOSContent),world.setPlacementProvider(placement),world.onActivate(()=>chat.show()));
  document.querySelector('#world-ball-hit').setAttribute('aria-label','打开 Ball 聊天；可横向轻拖');document.querySelector('#world-ball-hit').setAttribute('aria-controls','ai-canvas');
  const observer=new MutationObserver(syncWorld);observer.observe(document.querySelector('#world-home-state'),{attributes:true,attributeFilter:['hidden']});observer.observe(document.querySelector('#world-motion'),{attributes:true,attributeFilter:['aria-pressed']});worldCleanups.push(()=>observer.disconnect());if(world.story)worldCleanups.push(world.story.subscribe(syncWorld));
 }
 connectContent();ready=true;reserveWorld();for(const button of Object.values(controls))button.disabled=false;
 // Recovery does not remount chat or replace transcript/input nodes. If content
 // was already released, skip an unfinished intro instead of hiding it again.
 if(recovering&&entry==='home'&&window.ballStudy?.snapshot().mode!=='home'){holdRecoveredHome=true;document.querySelector('#world-skip').click();}
 if(!recovering||window.ballStudy?.snapshot().mode==='home')syncWorld();
 if(['item','space','chat'].some(key=>new URL(location.href).searchParams.has(key)))world.story?.skip('deep-link',{immediate:true});
 chat.clockChanged();notify(recovering?'world-recovered':'ready');restoreChatLink();
}
const readiness=createWorldReadiness({read:()=>({status:window.personalOSWorldAvailability?.status||'starting',reason:window.personalOSWorldAvailability?.reason,world:window.personalOSWorld,usable:!!(chat&&window.personalOSContent&&window.ballStudy)}),onReady:connect,onFallback:showFallback});
const worldAvailabilityChanged=()=>{readiness.check();if(fallbackActive){fallbackButton.disabled=!chat;ready=!!(chat&&window.personalOSContent);if(chat)fallbackText.textContent='3D 画面'+(readiness.getState().reason==='startup-timeout'?'尚未准备好':'暂时不可用')+'，内容和聊天仍可使用';connectContent();restoreChatLink();}};
window.addEventListener(WORLD_AVAILABILITY_EVENT,worldAvailabilityChanged);
const fallbackMotionChanged=()=>{if(fallbackActive)chat?.preferencesChanged();};fallbackMotionQuery.addEventListener('change',fallbackMotionChanged);
window.addEventListener('pagehide',event=>{if(event.persisted)return;readiness.dispose();fallbackMotionQuery.removeEventListener('change',fallbackMotionChanged);window.removeEventListener(WORLD_AVAILABILITY_EVENT,worldAvailabilityChanged);for(const cleanup of worldCleanups.splice(0))cleanup();contentCleanup?.();clearTimeout(reserveTimer);});
// Native resize updates only the hero reserve after the authored camera framing settles.
window.addEventListener('resize',()=>{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)});new ResizeObserver(()=>{clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650)}).observe(root.querySelector('.intro h1'));
new ResizeObserver(es=>{document.documentElement.style.setProperty('--host-header-size',es[0].target.getBoundingClientRect().height+'px')}).observe(document.querySelector('.topbar'));
const nativeScroll=document.scrollingElement;
function dockBounds(){const v=window.visualViewport;const w=v?.width||innerWidth,h=v?.height||innerHeight,x=v?.offsetLeft||0,y=v?.offsetTop||0;return{x:x+w-96,y:y+h-128,w:48,h:48}}
function placement(home,{ignoreChat=false}={}){if(fallbackActive)return null;const cp=ignoreChat?null:chat?.placement();if(cp?.bounds)return cp;const b=homeGeometry||home||personalOSWorld.getState().world.screen;const offset=Math.max(0,chat?.feedOffset()??nativeScroll.scrollTop),progress=Math.min(1,offset/220);const k=progress*progress*(3-2*progress),d=dockBounds();const from={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};if(contentPhase!=='preview')return{mode:'reading',bounds:d,quiet:true,transitionId:placementIntent};return{mode:progress===0?'hero':'dock',progress,transitionId:placementIntent,bounds:Object.fromEntries(['x','y','w','h'].map(key=>[key,from[key]+(d[key]-from[key])*k])),quiet:false}}
mountChat({getPresentation:()=>fallbackActive?'control':'actor',getRestoreFocus:()=>fallbackActive?fallbackButton:(document.querySelector('#world-ball-hit').closest('[inert]')?document.querySelector('.brand'):document.querySelector('#world-ball-hit')),getSourceBounds:()=>fallbackActive?fallbackBounds():null,getReturnBounds:()=>fallbackActive?fallbackBounds():null,getClock:()=>fallbackActive?null:window.personalOSWorld,
 getReturnBall:()=>{const p=placement(homeGeometry,{ignoreChat:true}),b=p.bounds;return{x:b.x+b.w/2,y:b.y+b.h/2,r:b.w/2}},getBall:()=>window.personalOSWorld?.getState().world.screen||{x:innerWidth/2,y:innerHeight/2,r:40},
 // The real text-button bounds seed a lightweight DOM-only morph. There is no
 // actor placement in this mode; unavailable WebGL does not imply reduced motion.
 reduced:()=>fallbackActive?fallbackMotionQuery.matches:document.querySelector('#world-motion').getAttribute('aria-pressed')==='true',onActivity:s=>{if(!fallbackActive)window.personalOSWorld?.setActivity?.(s);}}).then(api=>{chat=api;api.subscribe(state=>{if(state.action==='closed')window.personalOSWorld?.setActivity?.({state:'idle',localDemo:true});notify('chat-'+state.action);if(state.action==='closed'&&pendingChatReserve){clearTimeout(reserveTimer);reserveTimer=setTimeout(reserveWorld,650);}});fallbackButton.disabled=false;worldAvailabilityChanged();notify('chat-ready');}).catch(error=>{chatFailed=true;fallbackButton.disabled=true;fallbackText.textContent='聊天模块加载失败，请刷新重试。';document.querySelector('#announcer').textContent=fallbackText.textContent;console.error(error);});
readiness.check();
window.personalOSHost={version:4,cancelReplay,setAtmosphere:paint=>window.personalOSSceneBridge?.paint(paint)||false,registerModule(name,api){if(modules.has(name))return false;modules.set(name,api);notify('module-'+name);return true;},moduleChanged:name=>notify('module-'+name),setWeather:patch=>modules.get('weather')?.setWeather?.(patch)||false,navigate,story:()=>window.personalOSWorld?.story||null,getState:()=>JSON.parse(JSON.stringify(getState())),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},world:()=>fallbackActive?null:window.personalOSWorld,chat:()=>chat,select:id=>!fallbackActive&&window.personalOSWorld?.select(id)||personalOSContent.select(id),cancel:()=>!fallbackActive&&window.personalOSWorld?.cancel()||personalOSContent.cancel(),setCategory:c=>!fallbackActive&&window.personalOSWorld?.setCategory(c)||personalOSContent.setCategory(c),skip:()=>proxy('skip'),replay:()=>doReplay(),setReduced(v){if(fallbackActive){chat?.preferencesChanged();return false;}window.personalOSWorld?.story?.setReduced(!!v);syncWorld();return true;},chatBoundary:Object.freeze({status:'mounted',owner:'chat-thread',coordinateSpace:'layout CSS viewport pixels',api:'personalOSChat'})};
