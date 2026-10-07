// Pure story clock. Resize changes geometry, never narrative time.
export function createStoryLifecycle({enabled=true,reduced=false,bypass=false,duration=12.7,handoff=9.7,onStart=()=>true,onReturn=()=>{},wake=()=>{}}={}) {
  const listeners=new Set();let time=0,phase='home',bridge=null,reason='disabled',serial=0;
  const state=()=>({phase,time,duration,handoff,reduced,enabled,active:phase!=='home',bridge:bridge&&{...bridge},reason,serial});
  function emit(action){const event={...state(),action};for(const fn of listeners)fn(event);wake();}
  function home(why){phase='home';time=duration;bridge=null;reason=why;onReturn(why);emit('settled');}
  function start(why){if(!enabled||!onStart(why)){home('content-unavailable');return false;}time=0;phase=why==='replay'?'rewind':'story';bridge=why==='replay'?{target:'story',elapsed:0,duration:.9,fromTime:0}:null;reason=why;serial++;emit('started');return true;}
  function skip(why='skipped',{immediate=false}={}){if(phase==='home')return false;if(bridge?.target==='home'&&!immediate&&!reduced)return false;if(immediate||reduced){home(why);return true;}bridge={target:'home',elapsed:0,duration:.8,fromTime:time};phase='bridge';reason=why;emit('skip');return true;}
  // Pure timeline: consume visible elapsed time, including overflow past rewind.
  // There are at most two phase boundaries; no per-missed-frame replay or paint.
  function advance(dt){
    if(phase==='home')return state();const advanceSerial=serial;dt=Number.isFinite(dt)?Math.max(0,dt):0;
    if(bridge){
      const current=bridge,used=Math.min(dt,Math.max(0,current.duration-current.elapsed));
      current.elapsed=Math.min(current.duration,current.elapsed+used);dt-=used;
      if(current.elapsed<current.duration-1e-12)return state();
      if(current.target==='home'){home(reason);return state();}
      bridge=null;phase='story';time=0;emit('rewound');
      if(phase!=='story'||bridge||serial!==advanceSerial)return state();
    }
    const nextTime=Math.min(duration,time+dt);
    if(time<handoff&&nextTime>=handoff){time=handoff;phase='handoff';emit('handoff');if(phase!=='handoff'||bridge||serial!==advanceSerial)return state();}
    time=nextTime;
    if(time>=duration-1e-12)home('completed');
    return state();
  }
  const api={getState:state,advance,skip,replay(){if(phase!=='home')home('replay-return');return start('replay');},setReduced(value){reduced=!!value;if(reduced&&phase!=='home')skip('reduced',{immediate:true});emit('reduced');return reduced;},fail(reason='error'){home(reason);},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},dispose(){home('disposed');listeners.clear();},start};
  if(enabled&&!bypass&&!reduced)start('autoplay');else home(bypass?'deep-link':reduced?'reduced':'disabled');return api;
}
