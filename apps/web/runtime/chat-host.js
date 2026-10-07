import {createMobileFlowPage,mobileFlowEligible,mobileFlowPreview} from './chat/chat-mobile-flow-page.js';
import {installContextualChatLayout,describeChatLayout,readChatViewport} from './chat/contextual-chat-layout.js';
import {installReadingInterior} from './chat/chat-reading-interior.js';
import {createReadingChatFlow} from './chat/chat-reading-flow.js';
import {createChatMotion} from './chat-motion.js';
import {createChatPageLock} from './chat/chat-page-lock.js';
import {chatHeaderReservation,createKeyboardViewportObserver} from './chat/chat-viewport.js';
import {describeChatContour,chatContourPath} from './chat-contour.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const copy=x=>JSON.parse(JSON.stringify(x));
const rectangle=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
const usableBounds=b=>!!b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
export async function mountChat({getBall,getReturnBall=getBall,getSourceBounds=null,getReturnBounds=null,getRestoreFocus=()=>null,getPresentation=()=> 'actor',getClock=()=>window.personalOSWorld,reduced,onActivity=()=>{}}){
 const panel=document.createElement('section');panel.id='ai-canvas';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','chat-title');
 panel.innerHTML='<header class="canvas-head"><div class="canvas-identity"><strong id="chat-title">Ball · 一起聊聊</strong><span id="agent-status" role="status">本地演示已就绪</span></div><button id="ai-close" type="button" aria-label="关闭聊天">×</button></header><div id="canvas-scroll" class="canvas-scroll"><div class="canvas-intro"><h2>有什么想了解的？</h2><p>问一个问题，或从这里开始。</p><div class="prompt-list"><button data-prompt="公开项目示例">了解项目</button><button data-prompt="聊聊一个想法">聊聊想法</button><button data-prompt="看看实验">看看实验</button></div></div><div id="messages" aria-live="off"></div></div><div class="canvas-composer"><div class="composer-wrap"><textarea id="question" rows="1" placeholder="输入问题…" aria-label="聊天问题"></textarea><button id="send-button" type="button" aria-label="发送消息">发送</button></div><div class="composer-note"><span>本地演示 · 未接入 AI</span><button id="simulate-error">模拟错误</button></div></div>';
 const backdrop=document.createElement('div');backdrop.className='chat-backdrop';backdrop.hidden=true;document.body.append(backdrop,panel);
 const ui=await installReadingInterior({document});if(!ui)throw new Error('Chat reading stylesheet failed to load');
 const disclosure=document.createElement('span');disclosure.className='mobile-chat-disclosure';disclosure.textContent=mobileFlowPreview(window)?'布局预览 · 未接入 AI':'本地演示 · 未接入 AI';if(mobileFlowPreview(window))document.title='普通文档聊天布局预览（非设备模拟）';panel.querySelector('.canvas-identity').append(disclosure);
 const layout=installContextualChatLayout(panel),gsap=window.gsap,timers=new Set(),listeners=new Set();
 let testPaused=false,open=false,ticking=false,closingHistory=false,originFocus=null,savedFeed=0,scheduled=false,releaseTick=null,lastViewportKey=null,commits=0,flow,descriptor,activity='idle',inputLimit=120;
 const flowPage=createMobileFlowPage(document),pageLock=createChatPageLock(document),motion=createChatMotion(),{pose,velocity}=motion;
 const ns='http://www.w3.org/2000/svg',edge=document.createElementNS(ns,'svg'),edgePath=document.createElementNS(ns,'path');edge.classList.add('chat-contour-edge');edge.setAttribute('aria-hidden','true');edge.append(edgePath);panel.prepend(edge);
 let contour=null;let actorFrom=null,actorTarget=null,focusPending=false,pendingCategory=null;
 const core={panel,chatWanted:false,chatPhase:'closed',canvas:{p:0,g:0,v:0,target:null,presented:null,pendingSettle:false,segment:null,warp:null,contextSpring:null},ctx:{layout,requestedMode:'empty',composerPin:false,responsive:false,alpha:{p:1,segment:null},regions:[{n:layout.messages,alpha:1}],handoff:null,radiusWarp:null,contourWarp:null,contourPose:null,viewportRebase:null},
  conversationScrollHost:()=>layout.scroll,shapeActive:()=>ticking,
  prepareConversationSend(){core.ctx.requestedMode='reader';const anchor=flow.scroll.captureReadingAnchor();flow.sendProjection?.beforeLayout();flow.sendProjection?.prepareNativeCommit();layout.applyMode('reader');commitLayout('first-message',anchor);},
 };
 function state(){return{version:2,ready:true,open,phase:core.chatPhase,choreography:motion.state(),contour:contour&&{kind:contour.kind,bounds:contour.bounds,body:contour.body,source:contour.source,radius:contour.radius,softness:contour.softness,neckActive:contour.neckActive,path:contour.path},activity,pose:{...pose},velocity:{...velocity},target:core.canvas.target&&{...core.canvas.target},actorBounds:actorBounds(),viewport:readChatViewport(),keyboard:panel.dataset.chatViewport==='keyboard',layoutCommits:commits,feedOffset:flowPage.owned?flowPage.offset():pageLock.offset(),pageLocked:flowPage.owned||pageLock.locked,mobileFlow:flowPage.phase,closingBackground:flowPage.backgroundShown,nativeFeedOffset:document.scrollingElement.scrollTop,savedFeedOffset:savedFeed,messageCount:layout.messages.querySelectorAll('.message.user').length,scroll:flow?.scroll.state(),send:flow?.sendProjection?.state()};}
 function notify(action){const s={...state(),action};for(const fn of listeners)fn(s);window.dispatchEvent(new CustomEvent('personalos:chat-state',{detail:s}));}
 function source(){if(getSourceBounds){const box=getSourceBounds();if(box)return {...box};}const b=getBall();return{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};}
 function actorBounds(){return actorFrom?{...motion.actor}:null;}
 function returnBounds(){if(flowPage.owned&&flowPage.siteRemoved&&getPresentation()==='control'&&usableBounds(actorFrom))return {...actorFrom};if(getReturnBounds){const box=getReturnBounds();if(box&&(!flowPage.owned||usableBounds(box)))return {...box};}if(flowPage.owned&&getPresentation()==='control'&&usableBounds(actorFrom))return {...actorFrom};const b=getReturnBall();return{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};}
 function flowHandoffReady(m){const r=core.canvas.target;return m.phase==='open'&&r&&['x','y','w','h'].every(k=>Math.abs(pose[k]-r[k])<.03);}
 function paint(){
  let m=motion.state();
  if(open&&flowPage.owned&&!flowPage.active&&flowPage.phase==='opening'&&flowHandoffReady(m)){
   keyboardObserver.stop();flowPage.stage(()=>pageLock.unlock({restoreScroll:false}));
   // Native flow is measured before reparenting. A changed frame retargets the
   // existing spring while input stays disabled; it never snaps at the handoff.
   const r=flowPage.measure(),metrics=layout.measure({width:r.w,height:r.h,mode:core.ctx.requestedMode});descriptor=mobileDescriptor(r,metrics);core.canvas.target={...r};Object.assign(layout.plane.style,{width:r.w+'px',height:r.h+'px'});motion.configure(descriptor,{presentation:getPresentation()});m=motion.state();
  }
  if(open&&flowPage.phase==='handoff'&&flowHandoffReady(m)){flowPage.commit();backdrop.hidden=true;commitMobileLayout('handoff',null,false);m=motion.state();}

  if(flowPage.active){
   Object.assign(panel.style,{left:'0px',top:'0px',width:'100%',height:'100%',borderRadius:'24px',clipPath:'none',webkitClipPath:'none',opacity:'1'});
   Object.assign(layout.plane.style,{left:'0px',top:'0px',width:'100%',height:'100%',transform:'none',opacity:'1',visibility:'visible',filter:'none'});
   panel.inert=false;ui.input.disabled=false;panel.dataset.motionPhase='open';panel.dataset.material='native-flow';panel.setAttribute('aria-busy','false');
   core.ctx.alpha.p=1;core.ctx.contentBlur=0;core.ctx.contourPose=null;core.canvas.p=1;core.canvas.v=0;core.canvas.presented={...core.canvas.target};flow?.sendProjection?.paintPresented();focusPending=false;return;
  }
  if(!open&&flowPage.owned&&m.phase==='returning')flowPage.restoreSite();
  contour=describeChatContour(pose,m.actor);const box=contour.bounds;
  Object.assign(panel.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px',borderRadius:'0px',clipPath:`path("${contour.path}")`,webkitClipPath:`path("${contour.path}")`,opacity:m.shellVisible?String(clamp(pose.p*35)):'0'});
  edge.setAttribute('viewBox',`0 0 ${box.w} ${box.h}`);edgePath.setAttribute('d',contour.path);
  // Only the material outline deforms. Native text and composer stay at their
  // final dimensions and fixed viewport position throughout every phase.
  const target=core.canvas.target;if(target)layout.plane.style.transform=`translate(${target.x-box.x}px,${target.y-box.y}px)`;
  layout.plane.style.opacity=String(m.content.opacity);layout.plane.style.visibility=m.content.visible?'visible':'hidden';layout.plane.style.filter=m.content.blur<.01?'none':`blur(${m.content.blur}px)`;
  const interactive=m.interactive&&!flowPage.owned;panel.inert=!interactive;ui.input.disabled=!interactive;panel.dataset.motionPhase=m.phase;panel.dataset.material=m.material;panel.dataset.chatContour=contour.kind;panel.setAttribute('aria-busy',String(!interactive));
  core.ctx.alpha.p=m.content.opacity;core.ctx.contentBlur=m.content.blur;core.ctx.morphology={path:chatContourPath};core.ctx.contourPose={rect:core.canvas.target||{...pose},contour:contour.points};
  core.canvas.p=pose.p;core.canvas.v=velocity.p;core.canvas.presented={x:pose.x,y:pose.y,w:pose.w,h:pose.h};backdrop.style.backgroundColor=`rgba(40,51,72,${.12*clamp(pose.p)})`;
  flow?.sendProjection?.paintPresented();
  if(interactive&&focusPending){focusPending=false;layout.close.focus({preventScroll:true});}
 }
 function step(_time,delta=16.7){const settled=motion.advance(delta/1000,returnBounds(),reduced());paint();if(settled&&(!open||!flowPage.owned||flowPage.active)){stopTick();ticking=false;core.canvas.segment=null;core.chatPhase=open?'open':'closed';if(!open){panel.hidden=true;backdrop.hidden=true;document.body.dataset.chatOpen='false';document.querySelector('.app').inert=false;document.querySelector('.topbar').inert=false;document.querySelector('#stage').inert=false;keyboardObserver.stop();flowPage.finish();pageLock.unlock();const canFocus=node=>node?.isConnected&&!node.closest('[hidden],[inert]')&&node.getClientRects().length;const focusTarget=canFocus(originFocus)?originFocus:getRestoreFocus();if(canFocus(focusTarget))focusTarget.focus({preventScroll:true});if(pendingCategory){const category=pendingCategory;pendingCategory=null;window.personalOSContent.setCategory(category);}}else if(!flowPage.active){flow.layoutCommitted();}notify(open?'opened':'closed');}}
 // GSAP may lag-smooth its delta; only the fallback delivery uses its ticker.
 // Read elapsed wall time ourselves and exclude hidden intervals without changing
 // global GSAP settings (Send keeps its existing independent behavior).
 let fallbackStamp=null,intentStamp=null;
 function markMotionIntent(){intentStamp=performance.now();fallbackStamp=intentStamp;}
 // Target changes keep pose/velocity, and start their elapsed interval now.
 const configureMotion=motion.configure;
 motion.configure=(...args)=>{markMotionIntent();return configureMotion(...args);};
 function worldStep(dt,stamp){if(Number.isFinite(stamp)&&intentStamp!==null){dt=Math.min(dt,Math.max(0,(stamp-intentStamp)/1000));if(stamp>=intentStamp)intentStamp=null;}step(0,dt*1000);}
 function fallbackStep(){const stamp=performance.now();if(document.hidden){fallbackStamp=null;return;}const dt=fallbackStamp===null?0:Math.max(0,(stamp-fallbackStamp)/1000);fallbackStamp=stamp;step(0,dt*1000);}
 document.addEventListener('visibilitychange',()=>{fallbackStamp=document.hidden?null:performance.now();});
 function stopTick(){releaseTick?.();releaseTick=null;gsap.ticker.remove(fallbackStep);fallbackStamp=null;}
 function startTick(){markMotionIntent();const clock=getClock();if(clock?.onFrame)releaseTick=clock.onFrame(worldStep);else{fallbackStamp=performance.now();gsap.ticker.add(fallbackStep);}}
 function animate(){markMotionIntent();motion.setWanted(open);core.canvas.g=open?1:0;core.canvas.segment={active:true};core.chatPhase=open?'opening':'closing';if(!ticking&&!testPaused){ticking=true;startTick();}if(reduced())step(0,16.7);}
 function viewportKey(v){return JSON.stringify([v.x,v.y,v.w,v.h,innerWidth,innerHeight,layout.head.getBoundingClientRect().height,document.querySelector('.topbar').getBoundingClientRect().height,layout.composer.getBoundingClientRect().height]);}
 function mobileDescriptor(r,metrics){if(!usableBounds(actorFrom))throw new RangeError('Mobile chat requires its captured entry bounds');return describeChatLayout({mode:core.ctx.requestedMode,viewport:r,containerRect:r,sourceBody:actorFrom,mobile:true,keyboardViewport:true,edge:0,bodySize:28,guttersAt64:{left:26,right:26,top:0,bottom:24},maxWidth:r.w,metrics});}
 function mobileViewportKey(){const r=flowPage.active?rectangle(panel):flowPage.measure();return JSON.stringify([r.x,r.y,r.w,r.h,layout.composer.getBoundingClientRect().height]);}
 function commitMobileLayout(reason,anchor=null,paintNow=true){
  if(!open)return;commits++;delete panel.dataset.chatViewport;panel.dataset.chatOverflow='transcript';inputLimit=120;ui.input.style.maxHeight='120px';
  const r=flowPage.active?rectangle(panel):flowPage.measure();panel.dataset.mobileWriting=String(document.activeElement===ui.input||r.h<=480);
  const metrics=layout.measure(flowPage.active?{mode:core.ctx.requestedMode}:{width:r.w,height:r.h,mode:core.ctx.requestedMode});descriptor=mobileDescriptor(r,metrics);core.canvas.target={...r};actorTarget={...descriptor.actorTarget};
  if(!flowPage.active)Object.assign(layout.plane.style,{width:r.w+'px',height:r.h+'px'});
  const previous={...pose};motion.configure(descriptor,{nativeCommit:flowPage.active&&(reason==='viewport'||reason==='handoff'),presentation:getPresentation()});if(reason==='viewport')core.ctx.viewportRebase={dy:pose.y-previous.y};
  if(flowPage.active){core.canvas.presented={...r};core.ctx.contourPose=null;}
  if(paintNow)paint();flow?.layoutCommitted(anchor);core.ctx.viewportRebase=null;lastViewportKey=mobileViewportKey();notify('layout-'+reason);
 }
 function commitLayout(reason,anchor=null){if(!open)return;if(flowPage.owned){commitMobileLayout(reason,anchor);return;}commits++;const v=readChatViewport();pageLock.syncViewport(v);const mobile=v.w<=650,header=document.querySelector('.topbar').getBoundingClientRect().height,keyboard=mobile&&(innerHeight-v.h>100||v.h<=480);
  if(keyboard)panel.dataset.chatViewport='keyboard';else delete panel.dataset.chatViewport;
  const containerFor=metrics=>{const reserve=chatHeaderReservation({height:v.h,header:mobile?header:header+16,head:metrics.headHeight||64,composer:metrics.composerHeight||91,bottom:mobile?8:24});return mobile?{x:v.x,y:v.y+reserve,w:v.w,h:v.h-reserve}:{x:v.x+v.w-444,y:v.y+reserve,w:420,h:Math.min(600,v.h-reserve-24)};};
  const container=containerFor({headHeight:64,composerHeight:layout.composer.getBoundingClientRect().height});
  const args={mode:core.ctx.requestedMode,viewport:v,sourceBody:getPresentation()==='control'?source():actorFrom||source(),mobile:true,keyboardViewport:true,edge:mobile?8:0,containerRect:container,bodySize:28,guttersAt64:{left:26,right:26,top:0,bottom:24},maxWidth:420,metrics:{headHeight:64}};
  descriptor=describeChatLayout(args);let metrics=layout.measure({width:descriptor.target.w,height:descriptor.target.h,mode:core.ctx.requestedMode});inputLimit=Math.max(44,Math.min(120,descriptor.target.h-metrics.headHeight-(metrics.composerHeight-ui.input.offsetHeight)-48));ui.input.style.maxHeight=inputLimit+'px';if(ui.input.offsetHeight>inputLimit)ui.input.style.height=inputLimit+'px';metrics=layout.measure({width:descriptor.target.w,height:descriptor.target.h,mode:core.ctx.requestedMode});descriptor=describeChatLayout({...args,containerRect:containerFor(metrics),metrics});
  core.canvas.target={...descriptor.target};actorTarget={...descriptor.actorTarget};Object.assign(layout.plane.style,{width:descriptor.target.w+'px',height:descriptor.target.h+'px'});panel.dataset.chatOverflow='transcript';
  // A keyboard/viewport event is a single native commit. Retarget only shell geometry.
  const previous={...pose};motion.configure(descriptor,{nativeCommit:reason==='viewport',presentation:getPresentation()});if(reason==='viewport')core.ctx.viewportRebase={dy:pose.y-previous.y};
  paint();flow?.layoutCommitted(anchor);core.ctx.viewportRebase=null;lastViewportKey=viewportKey(v);notify('layout-'+reason);
 }
 function viewportCommit(){const observingKeyboard=keyboardObserver.pending;if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(flowPage.owned){if(!open)return;const key=mobileViewportKey();if(key===lastViewportKey)return;const anchor=flow.inputChanging();flow.sendProjection?.prepareNativeCommit();commitMobileLayout('viewport',anchor);flow.viewportSettled();return;}const v=readChatViewport();pageLock.syncViewport(v);if(!open)return;const key=viewportKey(v);if(key===lastViewportKey)return;const anchor=flow.inputChanging();flow.sendProjection?.prepareNativeCommit();commitLayout('viewport',anchor);if(!observingKeyboard)flow.viewportSettled();});}
 const keyboardObserver=createKeyboardViewportObserver(window,viewportCommit,()=>{queueMicrotask(()=>{if(open)flow.viewportSettled();});});
 function setAgent(next,label){activity=next;document.querySelector('#agent-status').textContent=label;onActivity({state:next,localDemo:true});}
 const answers={work:'这里展示的是公开示例，不代表任何人的真实项目或经历。一个项目可以从问题、方案与验证三个部分来理解。先明确希望改变的行为，再用具体证据检查结果。',thoughts:'这是本地演示回复。整理想法时，可以先写下目前的观察，再区分事实与假设，最后选择一个能验证假设的小动作。你可以停下来阅读，新的内容不会抢走当前位置。',labs:'这是一个本地实验示例。你可以在 Labs 中改变弹簧阻尼，观察系统如何从当前状态继续运动。实验强调可以调整、可以取消，也可以回到原来的位置。'};
 flow=createReadingChatFlow({ui,core,gsap,reduced,fluidSend:true,getOpen:()=>open,toggleCanvas:v=>{if(v&&!open)show();},setAgent,resolveTopic:q=>/想|调度|react|并发/.test(q.toLowerCase())?'thoughts':/实验|labs|弹簧/.test(q.toLowerCase())?'labs':'work',answers,
  component:topic=>'<p>公开示例 / Placeholder · 本地交互演示</p>',evidence:topic=>`<button type="button" data-open-category="${topic}">查看 ${topic[0].toUpperCase()+topic.slice(1)}</button>`,later(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);return id;},cancelTimers(){for(const id of timers)clearTimeout(id);timers.clear();},onState:s=>{panel.dataset.generating=String(s.generating);notify('conversation');}});
 function chatInteractive(){return flowPage.owned?flowPage.active:motion.state().interactive;}
 function show({history:push=true}={}){if(open){if(chatInteractive())layout.close.focus({preventScroll:true});return true;}const fresh=core.chatPhase==='closed';if(fresh){originFocus=document.activeElement;savedFeed=document.scrollingElement.scrollTop;actorFrom=source();if(mobileFlowEligible(window))flowPage.prepare(panel,savedFeed);pageLock.lock();}else if(flowPage.owned&&!flowPage.active){flowPage.prepare(panel,savedFeed);if(!flowPage.siteRemoved)pageLock.lock();}panel.hidden=false;backdrop.hidden=false;open=true;core.chatWanted=true;focusPending=true;pendingCategory=null;document.body.dataset.chatOpen='true';document.querySelector('.app').inert=true;document.querySelector('.topbar').inert=true;document.querySelector('#stage').inert=true;
  flow.setOpen(true);commitLayout('open');if(fresh)motion.reset(actorFrom,window.ballStudy?.snapshot().hostPlacement?.velocity);animate();paint();if(push){history.replaceState({...history.state,scrollOffset:savedFeed},'');const u=new URL(location.href);u.searchParams.set('chat','open');history.pushState({...history.state,personalosChat:true,chatFeedOffset:savedFeed},'',u);}setAgent('listening','本地演示 · 正在聆听');notify('open');return true;}
 function close({history:back=true}={}){if(!open)return false;focusPending=false;panel.inert=true;if(panel.contains(document.activeElement))document.activeElement.blur();if(flowPage.active){const r=flowPage.beginExit();descriptor=mobileDescriptor(r,layout.measure({mode:core.ctx.requestedMode}));core.canvas.target={...r};motion.configure(descriptor,{nativeCommit:true,presentation:getPresentation()});Object.assign(layout.plane.style,{width:r.w+'px',height:r.h+'px'});backdrop.hidden=false;}if(flowPage.owned)flowPage.showBackground();open=false;core.chatWanted=false;flow.setOpen(false);flow.cancel();animate();if(back&&history.state?.personalosChat){closingHistory=true;history.back();}notify('close');return true;}
 // This capture owner consumes only the chat entry; content history keeps its own owner.
 window.addEventListener('popstate',e=>{const routed=new URL(location.href).searchParams.get('chat')==='open';if(open||closingHistory||routed){e.stopImmediatePropagation();closingHistory=false;if(routed)show({history:false});else close({history:false});}},true);
 document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}if(e.key==='Tab'){if(panel.dataset.manualPreview==='true')return;if(!chatInteractive()){e.preventDefault();return;}const nodes=[...panel.querySelectorAll('button,textarea,a,summary'),document.querySelector('#world-ball-hit')].filter(n=>!n.disabled&&!n.closest('[hidden]')&&!n.closest('[inert]')&&n.getClientRects().length),index=nodes.indexOf(document.activeElement);if(index<0||(!e.shiftKey&&index===nodes.length-1)||(e.shiftKey&&index===0)){e.preventDefault();nodes[e.shiftKey?nodes.length-1:0]?.focus({preventScroll:true});}}},true);
 layout.close.addEventListener('click',()=>close());backdrop.addEventListener('click',()=>close());
 ui.input.addEventListener('input',()=>{const anchor=flow.inputChanging();flow.sendProjection?.prepareNativeCommit();ui.input.style.height='auto';ui.input.style.height=Math.min(ui.input.scrollHeight,inputLimit)+'px';flow.inputChanged(anchor);});
 ui.input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(panel.dataset.generating!=='true')flow.send();}});
 ui.send.addEventListener('click',()=>flow.send());document.querySelector('#simulate-error').addEventListener('click',()=>flow.send(null,true));panel.addEventListener('click',e=>{const retry=e.target.closest('[data-retry]');if(retry)flow.retry(retry.closest('.message.assistant'));const prompt=e.target.closest('[data-prompt]');if(prompt)flow.send(prompt.dataset.prompt);const category=e.target.closest('[data-open-category]');if(category){pendingCategory=category.dataset.openCategory;close();}});
 window.addEventListener('resize',viewportCommit);window.addEventListener('scroll',()=>{if(flowPage.active)viewportCommit();},{passive:true});window.visualViewport?.addEventListener('resize',viewportCommit);window.visualViewport?.addEventListener('scroll',viewportCommit);panel.addEventListener('focusin',event=>{if(flowPage.owned){panel.dataset.mobileWriting='true';return;}if(event.target===ui.input)keyboardObserver.start();else viewportCommit();});panel.addEventListener('focusout',event=>{if(flowPage.owned){panel.dataset.mobileWriting=String(flowPage.measure().h<=480);return;}if(event.target===ui.input)keyboardObserver.start();});const composerObserver=new ResizeObserver(()=>{if(open)viewportCommit();});composerObserver.observe(layout.composer);window.addEventListener('pagehide',event=>{keyboardObserver.stop();if(!event.persisted)composerObserver.disconnect();});window.addEventListener('pageshow',event=>{if(event.persisted&&open){if(flowPage.owned){if(core.chatWanted){flow.setOpen(true);viewportCommit();}}else keyboardObserver.start();}});
 const api={show,close,feedOffset:()=>flowPage.owned?flowPage.offset():pageLock.offset(),isPageLocked:()=>flowPage.owned||pageLock.locked,getState:()=>copy(state()),placement:()=>core.chatPhase!=='closed'&&motion.state().actorVisible?{mode:'chat',bounds:actorBounds(),quiet:activity!=='listening'}:null,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},clockChanged(){if(ticking&&!testPaused){stopTick();startTick();}},preferencesChanged(){flow.preferencesChanged();if(ticking&&reduced())step(0,16.7);},send:(...a)=>flow.send(...a)};
 if(new URLSearchParams(location.search).has('manual')){
  let stopManual=()=>{};
  api.testing={pause(){stopManual();testPaused=true;stopTick();ticking=false;},advance(seconds){step(0,seconds*1000);return copy(state());},resume(){stopManual();testPaused=false;if(core.chatPhase==='opening'||core.chatPhase==='closing')animate();}};
  // Preview-only controls use the existing GSAP ticker and testing API. Nothing
  // is mounted and no extra frame callback exists without the ?manual flag.
  panel.dataset.manualPreview='true';panel.setAttribute('aria-modal','false');
  const controls=document.createElement('details');controls.className='chat-motion-controls';controls.open=true;controls.setAttribute('aria-label','聊天动效预览');
  controls.innerHTML='<summary>动效预览 · 可收起工具</summary><div class="chat-motion-buttons"><button type="button" data-preview="open" data-rate="0.2">展开 0.2×</button><button type="button" data-preview="close" data-rate="0.2">收起 0.2×</button><button type="button" data-preview="open" data-rate="1">展开 1×</button><button type="button" data-preview="close" data-rate="1">收起 1×</button><button type="button" data-preview="pause">暂停</button><button type="button" data-preview="play">继续</button><button type="button" data-preview="step">单帧 +1/60s</button></div><output aria-label="动效播放状态" aria-live="off">已就绪 · 展开或收起会自动播放</output>';
  document.body.append(controls);const status=controls.querySelector('output');let rate=.2,playing=false;
  const report=()=>{const s=motion.state();status.textContent=`${playing?'播放':'暂停'} ${rate}× · ${s.phase} · 轮廓 ${s.pose.p.toFixed(3)} · 内容 ${s.content.opacity.toFixed(3)}`;};
  const tick=(_time,delta=16.7)=>{const s=api.testing.advance(Math.min(.04,Math.max(0,delta/1000))*rate);if(s.phase==='open'||s.phase==='closed')stopManual();report();};
  stopManual=()=>{gsap.ticker.remove(tick);playing=false;};
  const play=()=>{stopManual();api.testing.pause();playing=true;gsap.ticker.add(tick);report();};
  controls.addEventListener('click',event=>{const button=event.target.closest('button[data-preview]');if(!button)return;
    const action=button.dataset.preview;
    if(action==='open'||action==='close'){api.testing.pause();rate=Number(button.dataset.rate);if(action==='open')api.show();else api.close();play();}
    else if(action==='pause'){api.testing.pause();report();}
    else if(action==='play')play();
    else if(action==='step'){api.testing.pause();api.testing.advance(1/60);report();}
  });
 }
 window.personalOSChat=api;return api;
}
