import {createSendPath,sampleSendPath} from './send-path.js';
/** Authored DOM mechanisms informed by staged overlay/native-row ownership.
 * All variants share fixed glyph metrics, native endpoints and duration.
 * No Apple constants, anisotropic scaling, elastic overshoot or per-frame layout. */
export const SEND_CONTINUITY = Object.freeze({duration:.36,retargetDuration:.18,paddingX:14,paddingY:10,maxFlights:3});
// A-only authored uniform contraction; this is not a measured Apple curve.
export const SEND_SCALE=Object.freeze({minimum:.88,departureEnd:.32,retargetMinimum:.86});
export function sampleSendScale(progress){
 const p=clamp(progress),{minimum,departureEnd}=SEND_SCALE;
 return p<departureEnd?mix(1,minimum,smooth(p/departureEnd)):mix(minimum,1,smooth((p-departureEnd)/(1-departureEnd)));
}
// Pivot is the center of the visible text window, not the offscreen full draft.
export const sendScalePivot=frame=>({x:frame.clipX+frame.clipW/2,y:frame.clipY+frame.clipH/2});
export const SEND_VARIANTS=Object.freeze({A:'source-material',B:'form-then-travel',C:'text-first',D:'curved-text-late-bubble'});
// D is an original path adaptation of the user's six ordered screenshots.
// The stills ground lateral lead + late background, not timing/control values.
export const SEND_CURVE=Object.freeze({control1X:.78,control2Y:.62,bubbleArrival:.90});
export const clamp=p=>Math.max(0,Math.min(1,p));
export const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
const mix=(a,b,p)=>a+(b-a)*p;
const geometry=['x','y','w','h','anchorX','textY','clipX','clipY','clipW','clipH','bodyClipX','bodyClipY','bodyClipW','bodyClipH'];
// A clip is a window relative to fixed glyphs, not a second world-space actor.
// Separate world-space easing can let the window outrun its own text. Keeping
// its edges in glyph space preserves full ink when both endpoints contain it,
// while retaining the exact scrolled textarea/native viewport at either end.
const clipKeys=['clipX','clipY','clipW','clipH'];
const localWindow=f=>({left:f.clipX-f.anchorX,right:f.clipX+f.clipW-f.anchorX,top:f.clipY-f.textY,bottom:f.clipY+f.clipH-f.textY});
function glyphWindow(frame,start,target,p,interpolate){
 if(p===0||p===1){for(const key of clipKeys)frame[key]=(p===0?start:target)[key];return;}
 const a=localWindow(start),b=localWindow(target),edges={};
 for(const key of ['left','right','top','bottom'])edges[key]=interpolate(a[key],b[key],key);
 frame.clipX=frame.anchorX+edges.left;frame.clipY=frame.textY+edges.top;
 frame.clipW=Math.max(0,edges.right-edges.left);frame.clipH=Math.max(0,edges.bottom-edges.top);
}
export function sampleSendContinuity(source,target,progress,variant='A',path=null){
 const p=clamp(progress),travel=smooth(p),frame={};let windowProgress=travel;
 if(variant==='B'){
  // Form the compact bubble around stationary input glyphs, then transport it.
  const form=smooth(p/.28),flight=smooth((p-.28)/.72);windowProgress=flight;
  const near={x:source.anchorX-(target.anchorX-target.x),y:source.y,w:target.w,h:source.h,radius:target.radius};
  for(const key of ['x','y','w','h'])frame[key]=mix(mix(source[key],near[key],form),target[key],flight);
  for(const key of geometry.filter(k=>!['x','y','w','h'].includes(k)))frame[key]=mix(source[key],target[key],flight);
  frame.radius=mix(mix(source.radius,target.radius,form),target.radius,flight);frame.material=form;frame.well=smooth((p-.08)/.28);frame.materialOpacity=1;
 }else if(variant==='D'){
  // Bare, fixed-layout text arcs toward the right first, then rises into its
  // native anchor. The receiving bubble becomes visible only near arrival.
  const point=sampleSendPath(path||createSendPath(source,target),p);windowProgress=point.distance;
  frame.anchorX=point.x;frame.textY=point.y;
  frame.x=frame.anchorX-(target.anchorX-target.x);frame.y=frame.textY-(target.textY-target.y);
  frame.w=target.w;frame.h=target.h;frame.radius=target.radius;
  // Body and glyph windows follow the same curved text plane; neither can
  // take a faster straight shortcut and shear off a visible source line.
  frame.bodyClipX=frame.anchorX+mix(source.bodyClipX-source.anchorX,target.bodyClipX-target.anchorX,windowProgress);
  frame.bodyClipY=frame.textY+mix(source.bodyClipY-source.textY,target.bodyClipY-target.textY,windowProgress);
  frame.bodyClipW=mix(source.bodyClipW,target.bodyClipW,windowProgress);frame.bodyClipH=mix(source.bodyClipH,target.bodyClipH,windowProgress);
  const arrival=point.distance;
  const reveal=clamp((arrival-SEND_CURVE.bubbleArrival)/(1-SEND_CURVE.bubbleArrival));
  frame.material=1;frame.materialOpacity=1-(1-reveal)**2;frame.well=1;frame.lateBubble=1;
 }else if(variant==='C'){
  // Text takes the lead. A native-size background follows and fades behind it.
  const follow=travel,lag=6*Math.sin(Math.PI*p)**2,near={x:source.anchorX-(target.anchorX-target.x),y:source.textY-(target.textY-target.y)};
  frame.x=mix(near.x,target.x,follow);frame.y=mix(near.y,target.y,follow)+lag;frame.w=target.w;frame.h=target.h;frame.radius=target.radius;
  for(const key of geometry.filter(k=>!['x','y','w','h'].includes(k)))frame[key]=mix(source[key],target[key],travel);
  if(target.h<=source.h){frame.bodyClipX=frame.x;frame.bodyClipY=frame.y;frame.bodyClipW=frame.w;frame.bodyClipH=frame.h;}frame.material=1;frame.materialOpacity=smooth(p/.42);frame.well=1;
 }else{
  // Source writing-well material and glyphs leave in one continuous carrier.
  const reveal=smooth(p/.8);windowProgress=mix(travel,reveal,.15);
  for(const key of geometry)frame[key]=mix(source[key],target[key],travel);
  frame.scale=sampleSendScale(p);
  frame.radius=mix(source.radius,target.radius,travel);frame.material=smooth(p/.58);frame.materialOpacity=1;frame.well=smooth((p-.08)/.28);
 }
 glyphWindow(frame,source,target,p,(a,b)=>mix(a,b,windowProgress));
 frame.blend=1;return frame;
}
export function sampleSendRetarget(start,velocity,target,progress,duration=SEND_CONTINUITY.retargetDuration){
 const p=clamp(progress),p2=p*p,p3=p2*p,frame={};
 if(Number.isFinite(start.scale)){
  // Preserve the current scale and its velocity through Stop/resize/close.
  // A single bounded Hermite reunion ends at identity with zero velocity.
  const value=(2*p3-3*p2+1)*start.scale+(p3-2*p2+p)*duration*(velocity?.scale||0)+(-2*p3+3*p2);
  frame.scale=p===0?start.scale:p===1?1:Math.max(SEND_SCALE.retargetMinimum,Math.min(1,value));
 }
 for(const key of [...geometry,'radius']){
  const a=start[key],b=target[key],v=velocity?.[key]||0,value=(2*p3-3*p2+1)*a+(p3-2*p2+p)*duration*v+(-2*p3+3*p2)*b;
  frame[key]=Math.max(Math.min(a,b)-4,Math.min(Math.max(a,b)+4,value));
 }
 // Retarget the same local window from the currently painted state. Clamp
 // relative edges to their endpoint range so velocity cannot shave common
 // visible ink or expose lines outside the two allowed endpoint windows.
 const v=velocity||{},relativeVelocity={left:(v.clipX||0)-(v.anchorX||0),right:(v.clipX||0)+(v.clipW||0)-(v.anchorX||0),top:(v.clipY||0)-(v.textY||0),bottom:(v.clipY||0)+(v.clipH||0)-(v.textY||0)};
 glyphWindow(frame,start,target,p,(a,b,key)=>{
  const value=(2*p3-3*p2+1)*a+(p3-2*p2+p)*duration*relativeVelocity[key]+(-2*p3+3*p2)*b;
  return Math.max(Math.min(a,b),Math.min(Math.max(a,b),value));
 });
 for(const key of ['w','h','clipW','clipH','bodyClipW','bodyClipH'])frame[key]=Math.max(0,frame[key]);
 frame.radius=Math.max(0,Math.min(frame.radius,frame.w/2,frame.h/2));frame.material=mix(start.material??1,1,smooth(p));frame.materialOpacity=mix(start.materialOpacity??1,1,start.lateBubble?smooth((p-.65)/.35):smooth(p));if(start.lateBubble)frame.lateBubble=1;frame.well=1;frame.blend=smooth(p);return frame;
}
export function initialSendFrame(source,target){
 return{x:source.box.x,y:source.box.y,w:source.box.w,h:source.box.h,radius:source.radius,
  anchorX:source.textViewport.x+source.textViewport.w*target.align-source.scrollLeft,textY:source.textViewport.y-source.scrollTop,
  clipX:source.textViewport.x,clipY:source.textViewport.y,clipW:source.textViewport.w,clipH:source.textViewport.h,
  bodyClipX:source.box.x,bodyClipY:source.box.y,bodyClipW:source.box.w,bodyClipH:source.box.h,material:0,materialOpacity:1,well:0,blend:1};
}
