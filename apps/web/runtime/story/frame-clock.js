// Only the world owns RAF. An active subscriber is a real clock consumer.
// This is active-visible elapsed time, not a physics integration step. Closed-form
// consumers may use it directly; procedural simulations must bound their own step.
// Sleeping/hidden intervals are excluded. A slow visible frame is never discarded.
export function createFrameClock({step,needsFrame,request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now(),visible=()=>!document.hidden}={}){
 let frame=0,last=null,disposed=false,frames=0,executing=false,requested=false;
 function wake(){if(disposed||frame||!visible())return;if(executing){requested=true;return;}last=now();frame=request(tick);}
 function tick(stamp){
  frame=0;if(disposed||!visible()){last=null;return;}
  const dt=Number.isFinite(stamp)&&last!==null?Math.max(0,(stamp-last)/1000):0;
  last=Number.isFinite(stamp)?Math.max(last??stamp,stamp):last;executing=true;requested=false;
  try{step(dt,stamp);}finally{executing=false;}frames++;
  if(!disposed&&!frame&&last!==null&&visible()&&(needsFrame()||requested))frame=request(tick);else if(!frame)last=null;
 }
 return{wake,suspend(){if(frame)cancel(frame);frame=0;last=null;requested=false;},getState:()=>({running:!!frame,frames,disposed}),dispose(){disposed=true;if(frame)cancel(frame);frame=0;last=null;}};
}
