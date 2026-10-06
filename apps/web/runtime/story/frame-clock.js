// Only the world owns RAF. An active subscriber is a real clock consumer.
export function createFrameClock({step,needsFrame,request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now(),visible=()=>!document.hidden}={}){
 let frame=0,last=null,disposed=false,frames=0,executing=false,requested=false;
 function wake(){if(disposed||frame||!visible())return;if(executing){requested=true;return;}last=null;frame=request(tick);}
 function tick(stamp){frame=0;if(disposed||!visible()){last=null;return;}const dt=last===null?1/60:Math.max(0,Math.min(.05,(stamp-last)/1000));last=stamp;executing=true;requested=false;try{step(dt,stamp);}finally{executing=false;}frames++;if(!disposed&&!frame&&(needsFrame()||requested)){frame=request(tick);}else if(!frame)last=null;}
 return{wake,suspend(){if(frame)cancel(frame);frame=0;last=null;requested=false;},getState:()=>({running:!!frame,frames,disposed}),dispose(){disposed=true;if(frame)cancel(frame);frame=0;}};
}
