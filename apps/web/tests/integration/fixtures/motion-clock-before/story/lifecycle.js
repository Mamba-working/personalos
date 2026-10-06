// Pure story clock. Resize changes geometry, never narrative time.
export function createStoryLifecycle({enabled=true,reduced=false,bypass=false,duration=12.7,handoff=9.7,onStart=()=>true,onReturn=()=>{},wake=()=>{}}={}) {
  const listeners=new Set();let time=0,phase='home',bridge=null,reason='disabled',serial=0;
  const state=()=>({phase,time,duration,handoff,reduced,enabled,active:phase!=='home',bridge:bridge&&{...bridge},reason,serial});
  function emit(action){for(const fn of listeners)fn({...state(),action});wake();}
  function home(why){phase='home';time=duration;bridge=null;reason=why;onReturn(why);emit('settled');}
  function start(why){if(!enabled||!onStart(why)){home('content-unavailable');return false;}time=0;phase=why==='replay'?'rewind':'story';bridge=why==='replay'?{target:'story',elapsed:0,duration:.9,fromTime:0}:null;reason=why;serial++;emit('started');return true;}
  function skip(why='skipped',{immediate=false}={}){if(phase==='home')return false;if(bridge?.target==='home'&&!immediate&&!reduced)return false;if(immediate||reduced){home(why);return true;}bridge={target:'home',elapsed:0,duration:.8,fromTime:time};phase='bridge';reason=why;emit('skip');return true;}
  function advance(dt){if(phase==='home')return state();dt=Math.max(0,Math.min(.1,dt));if(bridge){bridge.elapsed=Math.min(bridge.duration,bridge.elapsed+dt);if(bridge.elapsed>=bridge.duration){if(bridge.target==='story'){bridge=null;phase='story';time=0;emit('rewound');}else home(reason);}}else{time=Math.min(duration,time+dt);if(time>=duration)home('completed');else{const next=time>=handoff?'handoff':'story';if(next!==phase){phase=next;emit('handoff');}}}return state();}
  const api={getState:state,advance,skip,replay(){if(phase!=='home')home('replay-return');return start('replay');},setReduced(value){reduced=!!value;if(reduced&&phase!=='home')skip('reduced',{immediate:true});emit('reduced');return reduced;},fail(reason='error'){home(reason);},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},dispose(){home('disposed');listeners.clear();},start};
  if(enabled&&!bypass&&!reduced)start('autoplay');else home(bypass?'deep-link':reduced?'reduced':'disabled');return api;
}
