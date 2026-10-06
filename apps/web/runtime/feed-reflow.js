// Short-lived native-slot transport, not a scroll layout engine. Every article
// remains in its one original slot. Exits alone borrow absolute positioning.
export function createSlotReflow({feed,entries,reduced=()=>false,window:win=window}){
 const running=new Map();let epoch=0;
 const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
 function snapshot(){const result=new Map();for(const [id,e]of entries){const style=win.getComputedStyle(e.slot),bounds=box(e.slot);if(style.display!=='none'&&bounds.h>0)result.set(id,{...bounds,opacity:Number.isFinite(parseFloat(style.opacity))?Math.max(0,Math.min(1,parseFloat(style.opacity))):1});}return result;}
 function stopOne(id){const item=running.get(id);if(!item)return;running.delete(id);item.animation.onfinish=null;item.animation.cancel();item.cleanup?.();}
 function stop(){epoch++;for(const id of [...running.keys()])stopOne(id);}
 function capture(){const result=snapshot();stop();return result;}
 function animate(id,slot,frames,options,cleanup){if(typeof slot.animate!=='function'){cleanup?.();return;}const animation=slot.animate(frames,options),ticket=epoch;running.set(id,{animation,cleanup});animation.onfinish=()=>{if(ticket!==epoch||running.get(id)?.animation!==animation)return;running.delete(id);animation.onfinish=null;animation.cancel();cleanup?.();};}
 function play(before){
  if(!before?.size||reduced()){stop();return;}
  const origin=box(feed),easing='cubic-bezier(.32,.72,0,1)';
  for(const[id,e]of entries){const previous=before.get(id),visible=!e.slot.classList.contains('excluded');
   if(!visible&&previous){const parent=e.slot.parentElement,next=e.slot.nextSibling,style=e.slot.getAttribute('style'),inert=e.slot.inert,disabled=e.button?.disabled;
    feed.append(e.slot);Object.assign(e.slot.style,{position:'absolute',left:(previous.x-origin.x)+'px',top:(previous.y-origin.y)+'px',width:previous.w+'px',height:previous.h+'px',margin:'0px',display:'block',clipPath:'none',pointerEvents:'auto'});
    // The visible departing card still occludes its old hit area. Its disabled
    // opener cannot send a tap through to a different card underneath.
    e.slot.inert=false;if(e.button)e.button.disabled=true;
    const cleanup=()=>{e.slot.inert=inert;if(e.button)e.button.disabled=disabled;if(style===null)e.slot.removeAttribute('style');else e.slot.setAttribute('style',style);if(next?.parentElement===parent)parent.insertBefore(e.slot,next);else parent.append(e.slot);};
    animate(id,e.slot,[{opacity:previous.opacity,transform:'none'},{opacity:0,transform:'none'}],{duration:180,easing:'linear',fill:'both'},cleanup);
   }else if(visible){const current=box(e.slot),dx=previous?previous.x-current.x:0,dy=previous?previous.y-current.y:12;
    if(previous&&Math.abs(dx)+Math.abs(dy)<.1&&previous.opacity>=.999)continue;
    animate(id,e.slot,[{transform:`translate3d(${dx}px,${dy}px,0)`,opacity:previous?.opacity??0},{transform:'translate3d(0px,0px,0)',opacity:1}],{duration:previous?360:280,easing,fill:'both'});
   }
  }
 }
 function take(id){const e=entries.get(id);if(!e)return null;const bounds=box(e.slot),opacity=parseFloat(win.getComputedStyle(e.slot).opacity);stopOne(id);return{bounds,opacity:Number.isFinite(opacity)?opacity:1};}
 return{capture,play,take,finish:stop,getState:()=>({active:running.size>0,count:running.size}),dispose:stop};
}
