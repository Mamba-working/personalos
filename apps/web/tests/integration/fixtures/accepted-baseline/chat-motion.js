// Authored choreography, not measured Apple constants. No timers or own RAF.
// Each spring retains its displayed position and velocity when intent changes.
export const CHAT_MOTION = Object.freeze({actorFrequency:34,openFrequency:19,closeFrequency:25,revealFrequency:32,concealFrequency:42,revealAt:.965,concealedAt:.02});
const keys=['x','y','w','h'];
const clamp=x=>Math.max(0,Math.min(1,x));
const zeros=o=>Object.fromEntries(Object.keys(o).map(k=>[k,0]));
function spring(p,v,goal,frequency,dt,reduced=false){
 let settled=true;
 for(const k of Object.keys(goal)){
  if(reduced){p[k]=goal[k];v[k]=0;continue;}
  const x=p[k]-goal[k],c=v[k]+frequency*x,e=Math.exp(-frequency*dt);
  p[k]=goal[k]+(x+c*dt)*e;v[k]=(v[k]-frequency*c*dt)*e;
  const tolerance=k==='p'?.0005:.025,speed=k==='p'?.012:.15;
  if(Math.abs(p[k]-goal[k])>tolerance||Math.abs(v[k])>speed)settled=false;
 }
 if(settled){Object.assign(p,goal);for(const k of Object.keys(goal))v[k]=0;}
 return settled;
}
const distance=(a,b)=>Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.h/2-b.y-b.h/2);
export function createChatMotion(){
 const pose={x:0,y:0,w:1,h:1,radius:.5,p:0},velocity=zeros(pose),actor={x:0,y:0,w:1,h:1},actorVelocity=zeros(actor),content={p:0},contentVelocity={p:0};
 let presentation='actor',target=null,anchor=null,wanted=false,shellReleased=false,returnReleased=false,initialized=false,phase='closed',interactive=false;
 const seed=()=>({...anchor,radius:Math.min(anchor.w,anchor.h)/2,p:0});
 function configure(descriptor,{nativeCommit=false,presentation:nextPresentation='actor'}={}){
  presentation=nextPresentation==='control'?'control':'actor';
  target={...descriptor.target};anchor={...(presentation==='control'?descriptor.seed:descriptor.actorTarget)};
  if(initialized&&nativeCommit&&interactive){Object.assign(pose,target);for(const k of keys)velocity[k]=0;Object.assign(actor,anchor);for(const k of keys)actorVelocity[k]=0;}
 }
 function reset(source,initialVelocity={}){
  Object.assign(actor,source);for(const k of keys)actorVelocity[k]=initialVelocity[k]||0;
  Object.assign(pose,seed());Object.assign(velocity,zeros(velocity));content.p=0;contentVelocity.p=0;
  shellReleased=false;returnReleased=false;interactive=false;initialized=true;phase='positioning';
 }
 function setWanted(value){wanted=value;if(value){returnReleased=false;shellReleased=pose.p>.01||presentation==='control';}interactive=false;}
 function advance(dt,returnBounds,reduced=false){
  dt=Math.min(.04,Math.max(0,dt));
  if(reduced){shellReleased=wanted;returnReleased=!wanted;}
  // Release only after the Ball's own spring settles at its destination.
  if(!wanted&&pose.p===0&&content.p<=CHAT_MOTION.concealedAt)returnReleased=true;
  const actorGoal=!wanted&&returnReleased?returnBounds:anchor;
  const actorSettled=spring(actor,actorVelocity,actorGoal,CHAT_MOTION.actorFrequency,dt,reduced);
  if(wanted&&actorSettled)shellReleased=true;
  const contentGoal=wanted&&shellReleased&&pose.p>=CHAT_MOTION.revealAt?1:0;
  const contentSettled=spring(content,contentVelocity,{p:contentGoal},wanted?CHAT_MOTION.revealFrequency:CHAT_MOTION.concealFrequency,dt,reduced);
  const expand=wanted?shellReleased:content.p>CHAT_MOTION.concealedAt;
  const shellGoal=expand?{...target,radius:24,p:1}:seed();
  const shellSettled=spring(pose,velocity,shellGoal,wanted?CHAT_MOTION.openFrequency:CHAT_MOTION.closeFrequency,dt,reduced);
  // Reduced motion resolves the gates together, without requiring another frame.
  if(reduced){content.p=wanted?1:0;contentVelocity.p=0;}
  interactive=wanted&&pose.p>.998&&content.p>.99&&distance(actor,anchor)<.5;
  const settled=actorSettled&&shellSettled&&contentSettled;
  phase=wanted?(settled&&content.p===1?'open':!shellReleased?'positioning':pose.p<CHAT_MOTION.revealAt?'expanding':'revealing'):
   (settled&&pose.p===0&&content.p===0&&returnReleased?'closed':content.p>CHAT_MOTION.concealedAt?'concealing':!returnReleased?'collapsing':'returning');
  if(reduced){phase=wanted?'open':'closed';interactive=wanted;}
  return phase==='open'||phase==='closed';
 }
 function state(){const c=clamp(content.p),visible=pose.p>=CHAT_MOTION.revealAt&&c>CHAT_MOTION.concealedAt;return{phase,wanted,interactive,presentation,actorVisible:presentation==='actor',pose:{...pose},velocity:{...velocity},actor:{...actor},actorVelocity:{...actorVelocity},anchor:anchor&&{...anchor},content:{p:c,velocity:contentVelocity.p,visible,opacity:visible?Math.pow(c,1.35):0,blur:12*Math.pow(1-c,.7)},shellVisible:shellReleased&&pose.p>.001,material:'contour-frost'};}
 return{pose,velocity,actor,actorVelocity,configure,reset,setWanted,advance,state};
}
