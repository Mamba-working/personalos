/** Opt-in single-node Send paint. Native turn/scroll and shell owners are unchanged.
 * The top layer is required: the first-send transcript clip-path clips absolute
 * descendants even when a reader ancestor supplies their containing block.
 * Responsive glyph transport uses an inert measured preview; original text and
 * native parent are retained. No independent clock or frame geometry reads.
 */
const NS = 'http://www.w3.org/2000/svg';
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
const rect = r => ({ x: r.left ?? r.x, y: r.top ?? r.y, w: r.width, h: r.height });
const finiteRect = r => r && ['x','y','w','h'].every(k => Number.isFinite(r[k])) && r.w > 0 && r.h > 0;
const phase = (p, values) => {
  const times = [0, .22, .55, 1];
  for (let i = 1; i < times.length; i++) if (p <= times[i]) return mix(values[i - 1], values[i], smooth((p - times[i - 1]) / (times[i] - times[i - 1])));
  return values[values.length - 1];
};

/** Qualitative gather/release, bounded by the full fixed-size text block.
 * Values are authored web adaptation, not private platform coefficients.
 * A long prompt may require a source body taller than its scrolled composer.
 */
export function sampleFluidSend(source, target, progress) {
  const p = clamp(progress), travel = smooth(p);
  const startW = Math.max(source.w, target.w), startH = Math.max(source.h, target.h);
  const releaseW = Math.min(24, Math.max(8, (startW - target.w) * .24));
  const releaseH = Math.min(14, Math.max(5, target.h * .12));
  const w = phase(p, [startW, target.w + 2, target.w + releaseW, target.w]);
  const h = phase(p, [startH, target.h + 1, target.h + releaseH, target.h]);
  const right = mix(source.x + source.w, target.x + target.w, travel);
  // For a long question, expand upward from the actual composer bottom. No
  // glyph is clipped/scaled to force the full text into its old scroll viewport.
  const startY = source.y + source.h - startH;
  const y = mix(startY, target.y, travel);
  const radius = Math.min(w / 2, h / 2, phase(p, [24, 15, 21, 18]));
  const lip = p === 0 || p === 1 ? 0 : 3 * Math.sin(Math.PI * p) ** 2;
  return { x: right - w, y, w, h, radius, lip,
    textX: right - target.w, textY: y + (h - target.h) / 2,
    textW: target.w, textH: target.h };
}

/** Rounded material with a transient soft release on its trailing corner.
 * Endpoint exactly matches the native 18px user bubble (no endpoint pop).
 */
export function fluidSendPath({ w, h, radius: r, lip = 0 }) {
  const f = n => Math.round(n * 10000) / 10000;
  w = f(w); h = f(h); r = f(r); lip = f(lip);
  return `M ${r} 0 H ${w-r} A ${r} ${r} 0 0 1 ${w} ${r} Q ${w+lip} ${h/2} ${w} ${h-r} A ${r} ${r} 0 0 1 ${w-r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h-r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

const PAINT_CSS = `
.living-study[data-chat-interior="reading"] #ai-canvas .message.user[data-fluid-send-paint] {
 position:fixed!important; inset:auto!important; left:0!important; top:0!important;
 display:block!important; box-sizing:border-box!important; max-width:none!important;
 margin:0!important; border:0!important; background:transparent!important;
 overflow:visible!important; z-index:1; color:var(--chat-ink);
 font-size:16px!important; line-height:1.7!important; letter-spacing:0!important;
}
.message.user[data-fluid-send-paint]::backdrop { background:transparent; pointer-events:none; }
.fluid-send-material { position:absolute; overflow:visible; pointer-events:none; z-index:-1; }
.fluid-send-material path { fill:var(--chat-user,#eaeaec); }
.fluid-send-glyphs { position:absolute; inset:0; pointer-events:none; user-select:none; color:var(--chat-ink); }
.fluid-send-glyphs span { position:absolute; left:0; top:0; box-sizing:border-box; padding:inherit; white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; letter-spacing:inherit; }
.fluid-send-glyphs { padding:inherit; }

`;

/** C1 rebase of cached paint. Glyphs remain at their current native size. */
export function sampleFluidRebase(start, velocity, target, progress, duration, glyphSize=target) {
  const p=clamp(progress), p2=p*p, p3=p2*p;
  const h00=2*p3-3*p2+1, h10=p3-2*p2+p, h01=-2*p3+3*p2;
  const end={...target,textX:target.x,textY:target.y,radius:18,lip:0};
  const frame={};
  for(const k of ['x','y','w','h','textX','textY','radius','lip']) frame[k]=h00*start[k]+h10*duration*(velocity[k]||0)+h01*end[k];
  // Readability wins over an undershooting spring. These are the full native
  // border-box bounds, so rounding/deformation can never clip the real glyphs.
  frame.textW=glyphSize.w;frame.textH=glyphSize.h;
  const right=Math.max(frame.x+frame.w,frame.textX+glyphSize.w),bottom=Math.max(frame.y+frame.h,frame.textY+glyphSize.h);
  frame.x=Math.min(frame.x,frame.textX);frame.y=Math.min(frame.y,frame.textY);
  frame.w=right-frame.x;frame.h=bottom-frame.y;
  frame.radius=Math.max(0,Math.min(frame.radius,frame.w/2,frame.h/2));frame.lip=Math.max(0,frame.lip);
  return frame;
}

/** Native settlement releases reader/messages opacity styles without resetting
 * the controller's cached region alpha. Derive that release from the owner's
 * numeric state, never a per-frame inline/computed-style or layout read. */
export function fluidNativeContentAlpha(core) {
  const ctx=core.ctx,s=core.canvas;
  const nativeOpen=core.chatWanted&&core.chatPhase==='open'&&s.p===1&&s.g===1&&!s.v&&
    !s.pendingSettle&&!s.segment&&!s.warp&&!s.contextSpring&&
    !ctx.alpha.segment&&!ctx.handoff&&!ctx.radiusWarp&&!ctx.contourWarp&&!core.shapeActive?.();
  if(nativeOpen)return 1;
  const messageAlpha=ctx.regions.find(item=>item.n===ctx.layout.messages)?.alpha??1;
  return clamp(ctx.alpha.p*messageAlpha);
}

let projectionSequence=0;
export function createFluidSendProjection({ ui, core, scroll, gsap, reduced, duration = .56 }) {
  const doc=ui.panel.ownerDocument,win=doc.defaultView;
  let active=null,destroyed=false,serial=0,lastReason='initial';const retiring=new Set();
  const live=a=>!destroyed&&(active===a||retiring.has(a));
  const projected=()=>[...(active?[active]:[]),...retiring];
  const style=doc.createElement('style');style.dataset.fluidSendStyle='';style.textContent=PAINT_CSS;doc.head.append(style);
  const clipPrefix='fluid-send-clip-'+(++projectionSequence)+'-';
  const needsEnclosure=a=>Math.abs(a.native.w-a.layoutNative.w)>.1||Math.abs(a.native.h-a.layoutNative.h)>.1;
  const props=['x','y','w','h','textX','textY','radius','lip','clipX','clipY','clipW','clipH'];
  const nativeStyle=a=>{if(a.oldStyle===null)a.user.removeAttribute('style');else a.user.setAttribute('style',a.oldStyle);};
  function demote(a){
    try{a.user.hidePopover();}catch{}
    if(a.oldPopover===null)a.user.removeAttribute('popover');else a.user.setAttribute('popover',a.oldPopover);
    a.user.removeAttribute('data-fluid-send-paint');nativeStyle(a);a.svg?.remove();a.glyphLayer?.remove();
  }
  // Range reads occur only at native layout boundaries. Text is never split or
  // reparented: complete shaped strings are painted through fixed fragment clips.
  function textLayout(a){
    const node=a.user.firstChild;if(node?.nodeType!==3)return[];
    const box=a.user.getBoundingClientRect(),r=doc.createRange();
    return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(node.textContent)].map(({segment,index})=>{r.setStart(node,index);r.setEnd(node,index+segment.length);const b=r.getBoundingClientRect();return{segment,index,x:b.x-box.x,y:b.y-box.y,w:b.width,h:b.height};});
  }
  function clearGlyphs(a){a.glyphLayer?.remove();for(const l of a.layers||[])l.clip?.remove();a.glyphLayer=null;a.layers=null;a.commonIndices=null;a.user.style.removeProperty('color');}
  function fragmentClip(a,l,indices){
    l.indices=new Set(indices);l.n.dataset.fluidFragmentIndices=[...l.indices].join(',');
    l.clip??=doc.createElementNS(NS,'clipPath');l.clip.id||=clipPrefix+'fragments-'+(++serial);l.clip.setAttribute('clipPathUnits','userSpaceOnUse');l.clip.replaceChildren();
    let run=null;const runs=[];
    for(const g of l.geometry){if(!l.indices.has(g.index)||g.w<=0||g.h<=0){run=null;continue;}
      if(run&&Math.abs(run.y-g.y)<.02&&Math.abs(run.h-g.h)<.02&&Math.abs(run.x+run.w-g.x)<.02)run.w=g.x+g.w-run.x;
      else{run={x:g.x,y:g.y,w:g.w,h:g.h};runs.push(run);}}
    for(const run of runs){const n=doc.createElementNS(NS,'rect');n.setAttribute('x',String(run.x));n.setAttribute('y',String(run.y-1));n.setAttribute('width',String(run.w));n.setAttribute('height',String(run.h+2));l.clip.append(n);}
    a.defs.append(l.clip);l.n.style.clipPath=`url(#${l.clip.id})`;
  }
  function fixedLayer(a,size,text,geometry,indices,role,alpha){
    const n=doc.createElement('span');n.textContent=text;Object.assign(n.style,{width:size.w+'px',height:size.h+'px'});n.dataset.fluidFragmentRole=role;a.glyphLayer.append(n);
    const l={n,w:size.w,h:size.h,geometry,role,alpha,startAlpha:alpha,x:0,startX:0,endX:0,destination:role==='detail'};fragmentClip(a,l,indices);return l;
  }
  function transportGlyphs(a,oldNative,oldText,oldGeometry){
    const next=textLayout(a),oldByIndex=new Map(oldGeometry.map(g=>[g.index,g]));
    const common=next.filter(g=>{const old=oldByIndex.get(g.index);return old&&Math.abs(old.x-g.x)<.02&&Math.abs(old.y-g.y)<.02&&Math.abs(old.w-g.w)<.02&&Math.abs(old.h-g.h)<.02&&(!a.layers||a.commonIndices?.has(g.index));}).map(g=>g.index);
    const commonSet=new Set(common),changed=next.filter(g=>!commonSet.has(g.index)).map(g=>g.index);
    if(!a.glyphLayer){a.glyphLayer=doc.createElement('span');a.glyphLayer.className='fluid-send-glyphs';a.glyphLayer.setAttribute('aria-hidden','true');a.glyphLayer.inert=true;a.layers=[];
      a.layers.push(fixedLayer(a,oldNative,oldText,oldGeometry,oldGeometry.map(g=>g.index),'outgoing',1));}
    // Keep interrupted fragment ownership/opacity; remove shared glyphs from all
    // outgoing clips so no semantic glyph has two simultaneously visible copies.
    for(const l of a.layers){fragmentClip(a,l,[...l.indices].filter(i=>!commonSet.has(i)));l.role='outgoing';l.n.dataset.fluidFragmentRole=l.role;l.destination=false;l.startAlpha=l.alpha;l.startX=l.x;}
    a.layers.push(fixedLayer(a,a.native,oldText,next,common,'common',1));
    a.layers.push(fixedLayer(a,a.native,oldText,next,changed,'detail',0));a.commonIndices=commonSet;
    a.user.append(a.glyphLayer);a.user.style.setProperty('color','transparent','important');
  }
  function paintGlyphs(a,frame){
    if(!a.layers)return;
    const p=a.proxy.p,oldFade=1-smooth(p/.45),detailReveal=smooth((p-.45)/.55);let right=a.native.w,bottom=a.native.h;
    for(const l of a.layers){l.alpha=l.role==='common'?1:l.role==='outgoing'?l.startAlpha*oldFade:mix(l.startAlpha,1,detailReveal);l.n.style.opacity=String(l.alpha);l.n.style.transform='translate3d(0,0,0)';if(l.alpha>0&&l.indices.size){right=Math.max(right,l.w);bottom=Math.max(bottom,l.h);}}
    const r=Math.max(frame.x+frame.w,frame.textX+right),b=Math.max(frame.y+frame.h,frame.textY+bottom);frame.w=r-frame.x;frame.h=b-frame.y;
    const cr=Math.max(frame.clipX+frame.clipW,frame.textX+right);frame.clipX=Math.min(frame.clipX,frame.textX);frame.clipW=cr-frame.clipX;
  }
  function cleanup(a,reason='complete'){
    if(!a)return;if(active===a)active=null;retiring.delete(a);a.ticket=++serial;lastReason=reason;a.tween?.kill();
    clearGlyphs(a);if(a.slot){demote(a);scroll.setUserAnchor(a.id,a.user,a.user);a.slot.remove();}
  }
  function release(reason='complete'){for(const a of projected())cleanup(a,reason);}
  function capture(){
    // A new explicit Send owns the next turn. A still-visible original rejoins
    // its own native slot continuously while the newer native scroll proceeds.
    // These are distinct original turns, never duplicate text/bubble clones.
    if(active?.slot&&active.frame&&!reduced()&&!doc.hidden){const old=active;animate(old,needsEnclosure(old)?'enclose':'reunion',snapshot(old));retiring.add(old);active=null;}
    else if(active)cleanup(active,'new-send');
    if(destroyed||reduced()||doc.hidden||typeof ui.input.showPopover!=='function'||typeof ui.input.hidePopover!=='function')return null;
    const composer=ui.input.closest('.composer-wrap');if(!composer||ui.panel.hidden)return null;
    const source=rect(composer.getBoundingClientRect());return finiteRect(source)?source:null;
  }
  function promote(a,glyphSize=null){
    const native=rect(a.user.getBoundingClientRect()),css=win.getComputedStyle(a.user);if(!finiteRect(native))return false;
    a.layoutNative=native;a.native=glyphSize||native;a.viewportWidth=win.innerWidth;a.viewportHeight=win.innerHeight;a.slot??=doc.createElement('div');a.slot.className='fluid-send-slot';a.slot.setAttribute('aria-hidden','true');
    Object.assign(a.slot.style,{width:native.w+'px',height:native.h+'px',boxSizing:'border-box',marginTop:css.marginTop,marginRight:css.marginRight,marginBottom:css.marginBottom,marginLeft:css.marginLeft});
    a.svg??=doc.createElementNS(NS,'svg');a.path??=doc.createElementNS(NS,'path');a.svg.classList.add('fluid-send-material');a.svg.setAttribute('aria-hidden','true');a.svg.append(a.path);
    if(!a.defs){
      a.defs=doc.createElementNS(NS,'defs');a.outerClip=doc.createElementNS(NS,'clipPath');a.outerPath=doc.createElementNS(NS,'path');a.viewportClip=doc.createElementNS(NS,'clipPath');a.viewportRect=doc.createElementNS(NS,'rect');
      const id=clipPrefix+(++serial);a.outerClip.id=id;a.viewportClip.id=id+'-viewport';a.outerClip.setAttribute('clipPathUnits','userSpaceOnUse');a.viewportClip.setAttribute('clipPathUnits','userSpaceOnUse');a.outerPath.setAttribute('clip-path',`url(#${a.viewportClip.id})`);a.outerClip.append(a.outerPath);a.viewportClip.append(a.viewportRect);a.defs.append(a.outerClip,a.viewportClip);a.svg.prepend(a.defs);
    }
    a.user.before(a.slot);a.user.append(a.svg);a.user.setAttribute('data-fluid-send-paint','');a.user.setAttribute('popover','manual');
    Object.assign(a.user.style,{width:a.native.w+'px',height:a.native.h+'px',padding:css.padding,pointerEvents:'auto'});
    try{a.user.showPopover();if(!a.user.matches(':popover-open'))throw new Error('Popover promotion was canceled');}catch{return false;}
    scroll.setUserAnchor(a.id,a.slot,a.user);return true;
  }
  function measureTarget(a){
    const user=rect(a.slot.getBoundingClientRect()),plane=rect(core.ctx.layout.plane.getBoundingClientRect());
    const host=core.conversationScrollHost(),state=scroll.state(),g=state.geometry;if(!finiteRect(user)||!finiteRect(plane)||!g)return false;
    a.local={x:user.x-plane.x,y:user.y-plane.y};a.measuredTop=host.scrollTop;a.targetTop=state.turnId===a.id?g.target:state.top;
    a.shell=core.ctx.contourPose?.rect||core.canvas.presented||core.canvas.target;
    const hr=rect(host.getBoundingClientRect());a.hostClip={x:hr.x-plane.x+(host.clientLeft||0),y:hr.y-plane.y+(host.clientTop||0),w:host.clientWidth||hr.w,h:host.clientHeight};a.wholeReader=host===core.ctx.layout.plane;
    if(a.wholeReader){const sr=rect(core.ctx.layout.scroll.getBoundingClientRect());a.pinClip={x:sr.x-plane.x,y:sr.y-plane.y,w:sr.w,h:sr.h};}
    return finiteRect(a.shell);
  }
  function targetFor(a){
    const shell=core.ctx.contourPose?.rect||core.canvas.presented||a.shell,planeX=core.ctx.responsive?shell.w-core.canvas.target.w:0;
    const top=a.kind==='launch'?a.targetTop:scroll.state().top;
    const width=a.kind==='enclose'?Math.max(a.native.w,a.layoutNative.w,...(a.layers||[]).map(l=>l.w)):a.layoutNative.w;
    // Both fixed text layers share an origin; common glyphs stay superimposed.
    // The enclosure is right-anchored, so its old width fits the new canvas.
    return{x:shell.x+planeX+a.local.x+a.layoutNative.w-width,y:shell.y+a.local.y-(top-a.measuredTop),w:width,h:a.kind==='enclose'?Math.max(a.native.h,a.layoutNative.h,...(a.layers||[]).map(l=>l.h)):a.layoutNative.h};
  }
  function paint(a){
    if(!live(a)||!a.slot)return;
    const target=targetFor(a),frame=a.kind==='launch'?sampleFluidSend(a.source,target,a.proxy.p):sampleFluidRebase(a.start,a.startVelocity,target,a.proxy.p,a.duration,a.native);
    const shell=core.ctx.contourPose?.rect||core.canvas.presented||a.shell,planeX=core.ctx.responsive?shell.w-core.canvas.target.w:0;
    let nativeClip={x:shell.x+planeX+a.hostClip.x,y:shell.y+a.hostClip.y,w:a.hostClip.w,h:Math.max(0,a.hostClip.h-(!a.wholeReader&&core.ctx.composerPin?Math.max(0,core.canvas.target.h-shell.h):0))};
    if(a.wholeReader&&core.ctx.composerPin&&a.pinClip){
      const pin={x:shell.x+planeX+a.pinClip.x,y:shell.y+a.pinClip.y-(scroll.state().top-a.measuredTop),w:a.pinClip.w,h:Math.max(0,a.pinClip.h-Math.max(0,core.canvas.target.h-shell.h))};
      const x=Math.max(nativeClip.x,pin.x),y=Math.max(nativeClip.y,pin.y);nativeClip={x,y,w:Math.max(0,Math.min(nativeClip.x+nativeClip.w,pin.x+pin.w)-x),h:Math.max(0,Math.min(nativeClip.y+nativeClip.h,pin.y+pin.h)-y)};
    }
    const clipTarget={clipX:nativeClip.x,clipY:nativeClip.y,clipW:nativeClip.w,clipH:nativeClip.h};
    const full={clipX:shell.x,clipY:shell.y,clipW:shell.w,clipH:shell.h};
    for(const k of ['clipX','clipY','clipW','clipH']){
      if(a.kind==='launch')frame[k]=mix(full[k],clipTarget[k],smooth(a.proxy.p));
      else{const p=a.proxy.p,p2=p*p,p3=p2*p;frame[k]=(2*p3-3*p2+1)*a.start[k]+(p3-2*p2+p)*a.duration*(a.startVelocity[k]||0)+(-2*p3+3*p2)*clipTarget[k];}
    }
    paintGlyphs(a,frame);
    const elapsed=a.proxy.p*a.duration,dt=elapsed-(a.lastElapsed??elapsed);
    if(dt>0.00001&&a.frame) a.velocity=Object.fromEntries(props.map(k=>[k,(frame[k]-a.frame[k])/dt]));
    else a.velocity??=Object.fromEntries(props.map(k=>[k,0]));
    a.frame=frame;a.lastElapsed=elapsed;
    a.user.style.transform=`translate3d(${frame.textX}px,${frame.textY}px,0)`;
    // Composer/Stop and header controls keep their real hit targets while the
    // original glyph box crosses chrome. History selection remains native.
    a.user.style.pointerEvents=frame.textY>=nativeClip.y&&frame.textY+frame.textH<=nativeClip.y+nativeClip.h?'auto':'none';
    a.svg.style.left=(frame.x-frame.textX)+'px';a.svg.style.top=(frame.y-frame.textY)+'px';
    a.svg.setAttribute('width',String(frame.w));a.svg.setAttribute('height',String(frame.h));a.svg.setAttribute('viewBox',`0 0 ${frame.w} ${frame.h}`);a.path.setAttribute('d',fluidSendPath(frame));
    // Top-layer content bypasses ancestor opacity/clipping. Reapply the exact
    // cached outer material path and numeric content fade, never DOM geometry.
    const pose=core.ctx.contourPose;
    if(pose?.contour){const local=pose.contour.map(point=>({x:point.x-frame.textX,y:point.y-frame.textY}));a.outerPath.setAttribute('d',core.ctx.morphology.path(local));a.viewportRect.setAttribute('x',String(frame.clipX-frame.textX));a.viewportRect.setAttribute('y',String(frame.clipY-frame.textY));a.viewportRect.setAttribute('width',String(Math.max(0,frame.clipW)));a.viewportRect.setAttribute('height',String(Math.max(0,frame.clipH)));a.user.style.setProperty('clip-path',`url(#${a.outerClip.id})`,'important');}
    const alpha=fluidNativeContentAlpha(core);
    a.user.style.setProperty('opacity',String(alpha),'important');
    a.user.style.setProperty('visibility',alpha>0?'visible':'hidden','important');
    const blur=core.ctx.contentBlur||0;
    a.user.style.setProperty('filter',blur>.01?`blur(${blur}px)`:'none','important');
    if(a.closing&&(ui.panel.hidden||core.ctx.alpha.p<.001))cleanup(a,'close-hidden');
  }
  function animate(a,kind,start=null){
    a.tween?.kill();a.tween=null;if(a.layers){kind='enclose';for(const l of a.layers){l.startAlpha=l.alpha;l.startX=l.x;}}a.kind=kind;a.duration=kind==='launch'?duration:kind==='enclose'?.16:.24;a.proxy={p:0};a.lastElapsed=0;
    if(start){a.start={...start.frame};a.startVelocity={...start.velocity};}
    const ticket=++serial;a.ticket=ticket;paint(a);
    if(!live(a)||a.ticket!==ticket)return;
    const tween=gsap.to(a.proxy,{p:1,duration:a.duration,ease:'none',overwrite:true,
      onUpdate:()=>{if(live(a)&&a.ticket===ticket)paint(a);},
      onComplete:()=>{if(live(a)&&a.ticket===ticket){paint(a);if(!live(a))return;
        if(a.kind==='enclose'){clearGlyphs(a);animate(a,'reunion',snapshot(a));}
        else cleanup(a,a.closing?'close-reunion':'complete');}}});
    if(!live(a)||a.ticket!==ticket){tween.kill();return;}a.tween=tween;
  }
  function snapshot(a){return a?.frame?{frame:{...a.frame},velocity:{...a.velocity}}:null;}
  function begin({source,user,id}){
    if(!source||destroyed||reduced()||doc.hidden||active||!user.isConnected)return false;
    // First-send end dimensions are deliberately not read here. The actual
    // native mode commit happens before promotion in layoutCommitted().
    active={source,user,id,oldStyle:user.getAttribute('style'),oldPopover:user.getAttribute('popover'),slot:null,frame:null,tween:null,pendingReflow:false,closing:false};return true;
  }
  function beforeLayout(){for(const a of projected())if(a.slot){a.rebase=snapshot(a);a.oldTextGeometry=textLayout(a);a.pendingReflow=true;}}
  function prepareNativeCommit(){
    for(const a of projected()){if(!a.slot||!a.pendingReflow)continue;
    // Final geometry is adopted once, before painting. Preview transports the
    // old line layout to that geometry instead of changing width on completion.
    a.tween?.kill();const hadGlyphs=!!a.layers,oldNative={...a.native},oldViewport=a.viewportWidth,oldHeight=a.viewportHeight,oldText=a.user.firstChild?.textContent,oldGeometry=a.oldTextGeometry||textLayout(a);
    demote(a);scroll.setUserAnchor(a.id,a.user,a.user);a.slot.remove();
    if(!promote(a)){cleanup(a,'top-layer-unavailable');continue;}a.pendingReflow=false;
    const changed=Math.abs(oldNative.w-a.native.w)>.1||Math.abs(oldNative.h-a.native.h)>.1;a.enclose=hadGlyphs||changed;
    if(a.enclose){
      if((oldViewport!==win.innerWidth||oldHeight!==win.innerHeight)&&a.rebase){
        // Native layout and the shell now share the resized right-edge basis.
        // Move the current paint with that basis; retain its progress/velocity.
        const dx=a.native.x+a.native.w-oldNative.x-oldNative.w,dy=core.ctx.viewportRebase?.dy||0;
        for(const key of ['x','textX','clipX'])a.rebase.frame[key]+=dx;
        for(const key of ['y','textY','clipY'])a.rebase.frame[key]+=dy;
      }
      if(changed)transportGlyphs(a,oldNative,oldText,oldGeometry);else{a.user.append(a.glyphLayer);a.user.style.setProperty('color','transparent','important');}
    }

    }
  }
  function layoutCommitted(){
    for(const a of projected()){
      if(!a.slot&&!promote(a)){cleanup(a,'top-layer-unavailable');continue;}
      if(!measureTarget(a)){cleanup(a,'invalid-geometry');continue;}
      const start=a.rebase||snapshot(a);a.rebase=null;animate(a,start?(a.enclose?'enclose':'reunion'):'launch',start);a.enclose=false;
    }
  }
  function rebase(reason='manual-reading'){
    lastReason=reason;for(const a of projected()){
      if(reduced()||doc.hidden||!a.slot){cleanup(a,reason);continue;}
      const start=snapshot(a);if(start)animate(a,needsEnclosure(a)?'enclose':'reunion',start);
    }
  }
  function setOpen(value){for(const a of projected())a.closing=!value;rebase(value?'reopen':'close');}
  const visibility=()=>{if(doc.hidden)release('hidden');};const pagehide=()=>release('pagehide');doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',pagehide);
  return{paintPresented(){for(const a of projected())paint(a);},capture,begin,beforeLayout,prepareNativeCommit,layoutCommitted,rebase,setOpen,release,
    state:()=>({active:!!active,retiring:retiring.size,reason:lastReason,id:active?.id??null,progress:active?.proxy?.p??null,kind:active?.kind??null,frame:active?.frame?{...active.frame}:null,velocity:active?.velocity?{...active.velocity}:null}),
    destroy(){if(destroyed)return;release('destroy');destroyed=true;doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',pagehide);style.remove();}};
}
