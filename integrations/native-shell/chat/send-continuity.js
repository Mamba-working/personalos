import {createSendPath,SEND_PATH} from './send-path.js';
import {sameTextLayout,sendLayoutBlend,paintedTextWindow,outgoingWindowClearsComposer} from './send-text-layout.js';
import {SEND_CONTINUITY,clamp,smooth,sampleSendContinuity,sampleSendRetarget,initialSendFrame,sendScalePivot} from './send-continuity-model.js';
/** One semantic native message, one transient aria-hidden visual carrier.
 * Native rows stay in flow. A committed destination is frozen per transaction;
 * explicit layout changes retarget from current paint, never from the input.
 * Conceptual reference: BlueBubbles staged send overlay/native-row ownership.
 * This is original DOM code; no Flutter code or Apple physics is copied. */
const rect=r=>({x:r.x??r.left,y:r.y??r.top,w:r.width??r.w,h:r.height??r.h});
const valid=r=>r&&['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.w>0&&r.h>0;
const px=v=>parseFloat(v)||0;
const fontKeys=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','lineHeight','letterSpacing','wordSpacing','textAlign','direction','textTransform','tabSize','overflowWrap','wordBreak','unicodeBidi','fontKerning','fontFeatureSettings','fontVariationSettings','hyphens','lineBreak'];
const rgba=value=>{const n=String(value).match(/[\d.]+/g)?.map(Number);return n?.length>=3?[n[0],n[1],n[2],n[3]??1]:[255,255,255,1];};
const blendColor=(from,to,p)=>`rgba(${from.map((v,i)=>v+(to[i]-v)*p).join(',')})`;
const intersect=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);return{x,y,w:Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h:Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y)}};
function saveProperty(node,name){return{value:node.style.getPropertyValue(name),priority:node.style.getPropertyPriority(name)}}
function restoreProperty(node,name,saved){if(saved.value)node.style.setProperty(name,saved.value,saved.priority);else node.style.removeProperty(name)}
const PAINT_CSS=`
.send-continuity-flight{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;border:0!important;background:none!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;pointer-events:none!important;z-index:55;contain:layout style}
.send-continuity-flight::backdrop{background:transparent;pointer-events:none}
.send-continuity-surface{position:absolute;inset:0;pointer-events:none;will-change:transform}
.send-continuity-material,.send-continuity-edge,.send-continuity-clip,.send-continuity-text{position:absolute;box-sizing:border-box;pointer-events:none}
.send-continuity-edge{inset:0;border-radius:inherit}
.send-continuity-clip{overflow:hidden}
#ai-canvas .composer-field textarea::placeholder{opacity:var(--send-placeholder-alpha,1)!important}
.send-continuity-text{margin:0;padding:0;border:0;white-space:pre-wrap;transform:none;overflow:visible}
`;
export function createSendContinuity({ui,core,scroll,gsap,reduced,duration=SEND_CONTINUITY.duration}){
 const doc=ui.panel.ownerDocument,win=doc.defaultView,flights=new Set(),wellOwners=new WeakMap(),placeholderOwners=new WeakMap();let current=null,serial=0,destroyed=false,composing=false,lastReason='initial';
 const style=doc.createElement('style');style.dataset.sendContinuity='';style.textContent=PAINT_CSS;doc.head.append(style);
 const isLive=a=>!destroyed&&flights.has(a),each=()=>[...flights];
 const compositionStart=()=>{composing=true;},compositionEnd=()=>{composing=false;};ui.input.addEventListener('compositionstart',compositionStart);ui.input.addEventListener('compositionend',compositionEnd);
 function restorePlaceholder(a){if(placeholderOwners.get(ui.input)===a){restoreProperty(ui.input,'--send-placeholder-alpha',a.source.placeholderStyle);placeholderOwners.delete(ui.input);}}
 function holdPlaceholder(a){placeholderOwners.set(ui.input,a);ui.input.style.setProperty('--send-placeholder-alpha','0');a.placeholderAge=0;a.placeholderBudget=(a.variant==='D'?SEND_PATH.duration:duration)*a.durationScale*.45;}
 function restoreWell(a){if(wellOwners.get(a.source.field)===a){restoreProperty(a.source.field,'--send-well-alpha',a.source.wellStyle);wellOwners.delete(a.source.field);}}
 function paintWell(a,alpha){if(wellOwners.get(a.source.field)===a)a.source.field.style.setProperty('--send-well-alpha',String(alpha));}
 function clear(a,reason='complete'){
  if(!flights.delete(a))return;a.tween?.kill();a.node?.remove();restoreProperty(a.user,'visibility',a.visibility);if(a.turn)delete a.turn.dataset.sendInFlight;restoreWell(a);restorePlaceholder(a);if(current===a)current=null;lastReason=reason;
 }
 function release(reason='release'){for(const a of each())clear(a,reason);}
 function measureText(text,css,width){
  const mirror=doc.createElement('div');Object.assign(mirror.style,css,{position:'fixed',left:'-100000px',top:'0px',width:width+'px',padding:'0',border:'0',margin:'0',height:'auto',whiteSpace:'pre-wrap',visibility:'hidden',pointerEvents:'none'});mirror.setAttribute('aria-hidden','true');mirror.inert=true;mirror.textContent=text;doc.body.append(mirror);
  const range=doc.createRange();range.selectNodeContents(mirror);const lines=[...range.getClientRects()].filter(r=>r.width>.01);const maxLine=lines.length?Math.max(...lines.map(r=>r.width)):width;const height=mirror.getBoundingClientRect().height;mirror.remove();return{lines:lines.length,lineWidths:lines.map(r=>r.width),maxLine,height};
 }
 function capture({text=ui.input.value}={}){
  if(destroyed||composing||ui.panel.hidden||text!==ui.input.value||!text.trim())return null;
  const field=ui.input.closest('.composer-field');if(!field)return null;for(const flight of each())if(flight.source.field===field){restoreWell(flight);restorePlaceholder(flight);}
  const box=rect(field.getBoundingClientRect()),inputBox=rect(ui.input.getBoundingClientRect());if(!valid(box)||!valid(inputBox))return null;
  const css=win.getComputedStyle(ui.input),surface=win.getComputedStyle(field,'::before'),font=Object.fromEntries(fontKeys.map(k=>[k,css[k]]).filter(([,value])=>typeof value==='string'));font.whiteSpace='pre-wrap';
  const widthFraction=inputBox.w-(ui.input.offsetWidth||inputBox.w),heightFraction=inputBox.h-(ui.input.offsetHeight||inputBox.h);
  const viewport={x:inputBox.x+px(css.borderLeftWidth)+px(css.paddingLeft),y:inputBox.y+px(css.borderTopWidth)+px(css.paddingTop),w:ui.input.clientWidth+widthFraction-px(css.paddingLeft)-px(css.paddingRight),h:ui.input.clientHeight+heightFraction-px(css.paddingTop)-px(css.paddingBottom)};if(!valid(viewport))return null;
  const metrics=measureText(text,font,viewport.w);
  return{animate:!reduced()&&!doc.hidden,field,box,textViewport:viewport,text,font,metrics,ink:rgba(css.color),scrollTop:ui.input.scrollTop||0,scrollLeft:ui.input.scrollLeft||0,radius:px(surface.borderTopLeftRadius)||24,fill:rgba(surface.backgroundColor),border:rgba(surface.borderTopColor),borderWidth:px(surface.borderTopWidth),shadow:surface.boxShadow,wellStyle:saveProperty(field,'--send-well-alpha'),placeholderStyle:saveProperty(ui.input,'--send-placeholder-alpha')};
 }
 function prepareMessage(user,source){
  if(!source)return;
  Object.assign(user.style,source.font);
  // Native content shrink-wraps its longest line, bounded by the reading width.
  // The source's independent fixed visual layout handles any wrapping change.
  user.style.width='fit-content';user.style.maxWidth='84%';user.dataset.sendTextLayout='intrinsic';
 }
 function layer(a,width,height,opacity=1,metrics=null){const clip=doc.createElement('div'),text=doc.createElement('div');clip.className='send-continuity-clip';text.className='send-continuity-text';text.textContent=a.source.text;Object.assign(text.style,a.source.font,{width:width+'px',height:height+'px',color:a.ink});clip.append(text);(a.surface||a.node).append(clip);const result={clip,text,width,height,metrics,opacity,startOpacity:opacity,destination:true};a.layers.push(result);return result;}
 function measureTarget(a){
  const native=rect(a.user.getBoundingClientRect()),plane=rect(core.ctx.layout.plane.getBoundingClientRect()),host=core.conversationScrollHost(),hostRect=rect(host.getBoundingClientRect()),state=scroll.state(),css=win.getComputedStyle(a.user);if(!valid(native)||!valid(plane)||!valid(hostRect))return false;
  a.composerWindow=rect(ui.input.getBoundingClientRect());
  a.local={x:native.x-plane.x,y:native.y-plane.y};a.measuredScroll=host.scrollTop;a.targetScroll=state.turnId===a.id?(state.geometry?.target??state.top):state.top;
  a.native=native;a.plane=plane;a.hostLocal={x:hostRect.x-plane.x+(host.clientLeft||0),y:hostRect.y-plane.y+(host.clientTop||0),w:host.clientWidth||hostRect.w,h:host.clientHeight||hostRect.h};
  a.padding={x:px(css.paddingLeft)||SEND_CONTINUITY.paddingX,y:px(css.paddingTop)||SEND_CONTINUITY.paddingY};a.contentWidth=Math.max(1,native.w-a.padding.x-(px(css.paddingRight)||SEND_CONTINUITY.paddingX));a.contentHeight=Math.max(1,native.h-a.padding.y-(px(css.paddingBottom)||SEND_CONTINUITY.paddingY));
  a.align=css.textAlign==='center'?.5:(css.textAlign==='right'||css.textAlign==='end'&&css.direction!=='rtl'||css.textAlign==='start'&&css.direction==='rtl')?1:0;a.ink=css.color;a.fill=rgba(css.backgroundColor);a.border=rgba(css.borderTopColor);a.borderWidth=px(css.borderTopWidth);a.radius=px(css.borderTopLeftRadius)||18;
  if(!a.destinationMetrics||Math.abs(a.measuredTextWidth-a.contentWidth)>.25){a.destinationMetrics=measureText(a.source.text,a.source.font,a.contentWidth);a.measuredTextWidth=a.contentWidth;}
  return true;
 }
 function targetFrame(a){
  const basis=core.canvas.target||a.plane,state=scroll.state(),top=a.kind==='launch'?a.targetScroll:state.top;
  const native={x:basis.x+a.local.x,y:basis.y+a.local.y-(top-a.measuredScroll),w:a.native.w,h:a.native.h};
  const host={x:basis.x+a.hostLocal.x,y:basis.y+a.hostLocal.y,w:a.hostLocal.w,h:a.hostLocal.h};const clip=intersect(native,host);
  return{...native,bodyClipX:clip.x,bodyClipY:clip.y,bodyClipW:clip.w,bodyClipH:clip.h,radius:a.radius,anchorX:native.x+a.padding.x+a.contentWidth*a.align,textY:native.y+a.padding.y,clipX:clip.x,clipY:clip.y,clipW:clip.w,clipH:clip.h,material:1,well:1,blend:1};
 }
 function reconcileLayers(a){
  let destination=a.layers.find(l=>sameTextLayout(l.metrics,a.destinationMetrics));
  if(!destination)destination=layer(a,a.contentWidth,a.contentHeight,0,a.destinationMetrics);
  for(const l of a.layers){l.destination=l===destination;l.startOpacity=l.opacity;}
  for(const l of [...a.layers])if(!l.destination&&l.opacity<.01){l.clip.remove();a.layers.splice(a.layers.indexOf(l),1);}
  while(a.layers.length>3){const removable=a.layers.filter(l=>!l.destination).sort((x,y)=>x.opacity-y.opacity)[0];removable.clip.remove();a.layers.splice(a.layers.indexOf(removable),1);}
 }
 function makeCarrier(a){
  const node=doc.createElement('div');node.className='send-continuity-flight';node.setAttribute('aria-hidden','true');node.inert=true;node.setAttribute('popover','manual');const material=doc.createElement('div'),edge=doc.createElement('div');material.className='send-continuity-material';edge.className='send-continuity-edge';material.append(edge);if(a.variant==='A'){const surface=doc.createElement('div');surface.className='send-continuity-surface';surface.append(material);node.append(surface);a.surface=surface;}else node.append(material);doc.body.append(node);a.node=node;a.material=material;a.edge=edge;a.layers=[];
  // Top layer is visual-only. Its failure leaves the same fixed overlay path.
  try{if(typeof node.showPopover==='function'){node.showPopover();if(!node.matches(':popover-open'))node.removeAttribute('popover');}else node.removeAttribute('popover');}catch{node.removeAttribute('popover');}
  a.user.style.setProperty('visibility','hidden');const sourceLayer=layer(a,a.source.textViewport.w,a.source.metrics.height,1,a.source.metrics);a.launchRewrap=!sameTextLayout(a.source.metrics,a.destinationMetrics);if(a.launchRewrap){sourceLayer.destination=false;layer(a,a.contentWidth,a.contentHeight,0,a.destinationMetrics);}
  wellOwners.set(a.source.field,a);paintWell(a,0);holdPlaceholder(a);return true;
 }
 function paint(a){
  if(!isLive(a)||!a.node)return;
  const target=targetFrame(a),p=a.proxy.p,frame=a.kind==='launch'?sampleSendContinuity(a.origin,target,p,a.variant,a.path):sampleSendRetarget(a.start,a.startVelocity,target,p,a.duration);
  const elapsed=p*a.duration,dt=elapsed-(a.elapsed??elapsed);if(dt>1e-5&&a.frame)a.velocity=Object.fromEntries(Object.keys(frame).filter(k=>typeof frame[k]==='number').map(k=>[k,(frame[k]-a.frame[k])/dt]));a.elapsed=elapsed;a.frame=frame;const ownsPlaceholder=placeholderOwners.get(ui.input)===a;if(ownsPlaceholder&&dt>0)a.placeholderAge+=dt;
  if(ownsPlaceholder&&(ui.input.value!==''||outgoingWindowClearsComposer(frame,a.composerWindow)||a.placeholderAge>=a.placeholderBudget))restorePlaceholder(a);
  // Scale one shared visual plane so glyphs, their window and material agree.
  // The outer carrier's panel/contour clip deliberately stays unscaled.
  if(a.surface){const pivot=sendScalePivot(frame);a.surface.style.transformOrigin=`${pivot.x}px ${pivot.y}px`;a.surface.style.transform=`scale(${frame.scale??1})`;}
  const m=clamp(frame.material);Object.assign(a.material.style,{left:frame.x+'px',top:frame.y+'px',width:frame.w+'px',height:frame.h+'px',borderRadius:frame.radius+'px',backgroundColor:blendColor(a.source.fill,a.fill,m),borderStyle:'solid',borderWidth:(a.source.borderWidth+(a.borderWidth-a.source.borderWidth)*m)+'px',borderColor:blendColor(a.source.border,a.border,m)});a.material.style.opacity=String(frame.materialOpacity);const bodyClip=intersect({x:frame.x,y:frame.y,w:frame.w,h:frame.h},{x:frame.bodyClipX,y:frame.bodyClipY,w:frame.bodyClipW,h:frame.bodyClipH});a.material.style.clipPath=`inset(${Math.max(0,bodyClip.y-frame.y)}px ${Math.max(0,frame.x+frame.w-bodyClip.x-bodyClip.w)}px ${Math.max(0,frame.y+frame.h-bodyClip.y-bodyClip.h)}px ${Math.max(0,bodyClip.x-frame.x)}px)`;a.edge.style.boxShadow=a.source.shadow;a.edge.style.opacity=String(1-m);
  const blend=a.kind==='launch'?(a.launchRewrap?sendLayoutBlend(p):1):frame.blend;
  const fullSource=a.source.scrollTop===0&&a.source.metrics.height<=a.source.textViewport.h+.5;
  const fullTarget=target.textY>=target.clipY-.5&&target.textY+a.contentHeight<=target.clipY+target.clipH+.5;
  for(const l of a.layers){l.text.style.color=blendColor(a.source.ink,rgba(a.ink),m);l.opacity=l.destination?l.startOpacity+(1-l.startOpacity)*blend:l.startOpacity*(1-blend);l.clip.style.opacity=String(l.opacity);const clip=paintedTextWindow(frame,l,a.align,fullSource,fullTarget,core.canvas.target);Object.assign(l.clip.style,{left:clip.x+'px',top:clip.y+'px',width:clip.w+'px',height:clip.h+'px'});Object.assign(l.text.style,{left:clip.anchorX-l.width*a.align-clip.x+'px',top:frame.textY-clip.y+'px'});}
  const pose=core.ctx.contourPose;if(pose?.contour&&core.ctx.morphology?.path)a.node.style.clipPath=`path("${core.ctx.morphology.path(pose.contour)}")`;else if(core.canvas.target){const r=core.canvas.target;a.node.style.clipPath=`inset(${r.y}px ${Math.max(0,win.innerWidth-r.x-r.w)}px ${Math.max(0,win.innerHeight-r.y-r.h)}px ${r.x}px round 24px)`;}
  const alpha=clamp(core.ctx.alpha.p);a.node.style.opacity=String(alpha);a.node.style.filter=core.ctx.contentBlur>.01?`blur(${core.ctx.contentBlur}px)`:'none';paintWell(a,frame.well);
  if(a.closing&&(ui.panel.hidden||alpha<.001))clear(a,'close-hidden');
 }
 function animate(a,kind,start=null){
  a.tween?.kill();const ticket=++serial;a.ticket=ticket;a.kind=kind;a.duration=(kind==='launch'?(a.variant==='D'?SEND_PATH.duration:duration):SEND_CONTINUITY.retargetDuration)*a.durationScale;a.proxy={p:0};a.elapsed=0;
  if(start){a.start={...start.frame};a.startVelocity={...start.velocity};reconcileLayers(a);}paint(a);if(!isLive(a))return;
  a.tween=gsap.to(a.proxy,{p:1,duration:a.duration,ease:'none',overwrite:true,onUpdate:()=>{if(a.ticket===ticket)paint(a);},onComplete:()=>{if(!isLive(a)||a.ticket!==ticket)return;paint(a);clear(a,a.closing?'close-complete':'complete');}});
 }
 const snapshot=a=>a.frame?{frame:{...a.frame},velocity:{...a.velocity}}:null;
 function begin({source,user,id}){
  if(!source||source.animate===false||destroyed||reduced()||doc.hidden||!user.isConnected)return false;
  if(current?.frame){const previous=current;restoreWell(previous);animate(previous,'retarget',snapshot(previous));}
  while(flights.size>=SEND_CONTINUITY.maxFlights)clear(each()[0],'flight-limit');
  const requestedVariant=ui.panel.dataset.sendVariant||new URLSearchParams(win.location.search).get('sendVariant');
  const a={id,user,source,turn:user.closest('.chat-turn'),variant:['A','B','C','D'].includes(requestedVariant)?requestedVariant:'D',durationScale:ui.panel.dataset.sendSlow==='true'?5:1,visibility:saveProperty(user,'visibility'),frame:null,velocity:{},node:null,pendingLayout:false,closing:false};flights.add(a);current=a;if(a.turn)a.turn.dataset.sendInFlight='true';return true;
 }
 function beforeLayout(){for(const a of each()){a.rebase=snapshot(a);a.pendingLayout=true;restoreWell(a);}}
 function prepareNativeCommit(){/* Original native messages never leave layout. */}
 function layoutCommitted(){
  for(const a of each()){
   if(!measureTarget(a)){clear(a,'invalid-target');continue;}
   if(!a.node){a.kind='launch';a.pendingLayout=false;a.rebase=null;makeCarrier(a);a.origin=initialSendFrame(a.source,{align:a.align});if(a.variant==='D'){const box=core.canvas.target,ink=a.source.metrics.maxLine;a.path=createSendPath(a.origin,targetFrame(a),box?{left:box.x+ink*a.align,right:box.x+box.w-ink*(1-a.align)}:null);}animate(a,'launch');}
   else if(a.pendingLayout){const start=a.rebase||snapshot(a);a.pendingLayout=false;a.rebase=null;animate(a,'retarget',start);}
  }
 }
 function rebase(reason='manual-reading'){lastReason=reason;for(const a of each()){restoreWell(a);restorePlaceholder(a);if(reduced()||doc.hidden||!a.node){clear(a,reason);continue;}animate(a,'retarget',snapshot(a));}}
 function setOpen(value){for(const a of each())a.closing=!value;rebase(value?'reopen':'close');}
 const visibility=()=>{if(doc.hidden)release('hidden');},pagehide=()=>release('pagehide');doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',pagehide);
 return{capture,prepareMessage,begin,beforeLayout,prepareNativeCommit,layoutCommitted,rebase,setOpen,release,canSend:()=>!composing,
  paintPresented(){for(const a of each())paint(a);},
  state:()=>({active:!!current,retiring:flights.size-(current?1:0),reason:lastReason,id:current?.id??null,variant:current?.variant??null,kind:current?.kind??null,progress:current?.proxy?.p??null,frame:current?.frame?{...current.frame}:null,textLayers:current?.layers?.map(l=>({width:l.width,height:l.height,opacity:l.opacity}))||[],presentation:'source-material-continuity'}),
  destroy(){if(destroyed)return;release('destroy');destroyed=true;ui.input.removeEventListener('compositionstart',compositionStart);ui.input.removeEventListener('compositionend',compositionEnd);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',pagehide);style.remove();}};
}
