/**
 * Actual app controller with deliberately synthetic native-column/text dimensions.
 * These bounds are an injected test input, never browser/device acceptance evidence.
 */
import {bootContent} from './content-fixture.mjs';
export function bootCompactFeed({width=390,feedWidth=width-32,rootFont=16,reduced=false,query='',identityHeights={}}={}){
 const metrics={feedReads:0,slotReads:0,feedWrites:0,animations:[]};
 let feedSize=feedWidth,fontSize=rootFont;
 const presented=new Map();
 const f=bootContent({width,reduced,query,beforeBoot({w,d,$,box}){
  const nativeRect=w.HTMLElement.prototype.getBoundingClientRect;
  const computed=w.getComputedStyle.bind(w);
  w.getComputedStyle=node=>{
   const style=computed(node);
   if(node.matches?.('.slot')&&!presented.has(node))return new Proxy(style,{get(target,key){if(key==='opacity')return target.opacity||'1';if(key==='display'&&node.classList.contains('excluded')&&target.display!=='block')return 'none';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   if(presented.has(node))return new Proxy(style,{get(target,key){if(key==='opacity')return String(presented.get(node).opacity??1);const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   if(node===d.documentElement)return new Proxy(style,{get(target,key){if(key==='fontSize')return fontSize+'px';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   return style;
  };
  const feed=$('#feed'),originalReplace=feed.replaceChildren.bind(feed);
  feed.replaceChildren=(...nodes)=>{metrics.feedWrites++;return originalReplace(...nodes);};
  const gap=()=>parseFloat(feed.style.columnGap)||((width<=650)?12:18);
  const columns=()=>[...feed.querySelectorAll(':scope > .feed-column')];
  const columnWidth=()=>Math.max(1,(feedSize-(Math.max(1,columns().length)-1)*gap())/Math.max(1,columns().length));
  const slotHeight=slot=>slot.classList.contains('excluded')?0:parseFloat(slot.style.getPropertyValue('--height'))||400;
  const slotRect=slot=>{
   const column=slot.parentElement,index=Math.max(0,columns().indexOf(column));
   let y=600-d.scrollingElement.scrollTop;
   for(const sibling of column?.children||[]){if(sibling===slot)break;if(!sibling.classList.contains('excluded'))y+=slotHeight(sibling)+gap();}
   return box(16+index*(columnWidth()+gap()),y,columnWidth(),slotHeight(slot));
  };
  w.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this===feed){metrics.feedReads++;return box(16,600-d.scrollingElement.scrollTop,feedSize,1200);}
   if(this.matches('.feed-column')){const first=this.querySelector('.slot');return first?slotRect(first):box(16,600-d.scrollingElement.scrollTop,columnWidth(),0);}
   if(this.matches('.slot')){metrics.slotReads++;if(presented.has(this)){const p=presented.get(this);return box(p.x,p.y,p.w,p.h);}return slotRect(this);}
   if(this.matches('.identity')){
    const id=this.closest('article')?.dataset.contentId;
    const height=identityHeights[id]??(id==='thoughts-long'?326:164+(Number(this.querySelector('.card-index')?.textContent||0)%4)*13);
    return box(0,0,parseFloat(this.style.width)||columnWidth()-2,height*(fontSize/16));
   }
   if(this.matches('article.card')){
    const slot=this.closest('.slot');if(slot)return slotRect(slot);
   }
   return nativeRect.call(this);
  };
  Object.defineProperty(feed,'clientWidth',{configurable:true,get:()=>feedSize});
  w.HTMLElement.prototype.animate=function(keyframes,options){
   const record={node:this,keyframes,options,cancelled:false,finished:false};
   const animation={cancel(){record.cancelled=true;presented.delete(record.node);animation.oncancel?.();},finish(){if(record.cancelled)return;record.finished=true;animation.onfinish?.();},onfinish:null,oncancel:null};
   record.animation=animation;metrics.animations.push(record);return animation;
  };
 }});
 return {...f,metrics,presentSlot(id,bounds){presented.set(f.$(`.slot[data-id="${id}"]`),bounds);},setFeedWidth(value){feedSize=value;},setRootFont(value){fontSize=value;},finishAnimations(){for(const a of metrics.animations)a.animation.finish();},
  flushFrames(time=16){const pending=[...f.frames];f.frames.clear();for(const [,fn]of pending)fn(time);},
  visibleSlots(){return[...f.d.querySelectorAll('#feed .slot:not(.excluded)')];},
  columnIds(){return[...f.$('#feed').querySelectorAll(':scope > .feed-column')].map(column=>[...column.querySelectorAll('.slot:not(.excluded)')].map(s=>s.dataset.id));},
  bounds(){return[...f.d.querySelectorAll('#feed .slot:not(.excluded)')].map(slot=>({id:slot.dataset.id,category:slot.querySelector('article')?.dataset.category,...slot.getBoundingClientRect()}));}
 };
}
