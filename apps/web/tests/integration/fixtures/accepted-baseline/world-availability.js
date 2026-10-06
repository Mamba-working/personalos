/** Explicit renderer availability + a bounded readiness coordinator.
 * This creates no renderer, replacement actor, conversation or animation clock. */
export const WORLD_AVAILABILITY_EVENT='personalos:world-availability';
export function announceWorldAvailability(status,reason=null,env=window){
 const value=Object.freeze({status,reason});env.personalOSWorldAvailability=value;
 env.dispatchEvent(new env.CustomEvent(WORLD_AVAILABILITY_EVENT,{detail:value}));return value;
}
export function createWorldReadiness({read,onReady,onFallback,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,timeoutMs=8000,pollMs=100}){
 const started=now();let timer=null,disposed=false,state='starting',owner=null,reason=null;
 function clear(){if(timer!==null){cancel(timer);timer=null;}}
 function fallback(next){if(state!=='fallback'||reason!==next){state='fallback';reason=next;onFallback(next);}}
 function check(){
  if(disposed)return;clear();const value=read();
  if(value.status==='failed'||value.status==='lost'){fallback(value.reason||value.status);return;}
  if(value.status==='ready'&&value.usable&&value.world){
   if(state!=='ready'||owner!==value.world){state='ready';reason=null;owner=value.world;onReady(value.world);}return;
  }
  if(now()-started>=timeoutMs){fallback('startup-timeout');return;}
  timer=schedule(check,pollMs);
 }
 return{check,dispose(){disposed=true;clear();},getState:()=>({state,reason,pollPending:timer!==null,disposed})};
}
