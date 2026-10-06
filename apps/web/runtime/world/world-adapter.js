// Public contract only: the content module remains the owner of DOM, scroll and history.
const EVENT='personalos:content-transition';
const actions=new Set(['select','progress','detail-ready','cancel-return','returned','category-select','resize-retarget']);
const copy=value=>JSON.parse(JSON.stringify(value));
function bounds(value){if(!value||!['x','y','w','h'].every(k=>Number.isFinite(value[k]))||value.w<0||value.h<0)return null;return Object.fromEntries(['x','y','w','h'].map(k=>[k,value[k]]))}
export function mapFrameBounds(value,frame){const b=bounds(value);if(!b)return null;const r=frame.getBoundingClientRect(),w=frame.contentWindow.innerWidth,h=frame.contentWindow.innerHeight;return{x:r.x+b.x*r.width/w,y:r.y+b.y*r.height/h,w:b.w*r.width/w,h:b.h*r.height/h}}
export function createWorldAdapter({onTransition=()=>{},snapshot=()=>({})}={}){
 let controller=null,unsubscribe=null,mapper=b=>b,state={version:1,action:'returned',contentId:null,category:'all',phase:'preview',progress:0,targetBounds:null,displayBounds:null,returnBounds:null,cancelled:false};
 function consume(detail){if(!detail||!actions.has(detail.action))return false;
  const progress=Number.isFinite(detail.progress)?Math.max(0,Math.min(1,detail.progress)):0;
  state={version:1,action:detail.action,contentId:typeof detail.contentId==='string'?detail.contentId:null,category:typeof detail.category==='string'?detail.category:'all',phase:detail.phase||'preview',progress:detail.action==='returned'?0:progress,cancelled:detail.cancelled===true};
  for(const k of ['targetBounds','displayBounds','returnBounds'])state[k]=bounds(mapper(bounds(detail[k])));
  onTransition(copy(state));return true;
 }
 const localHandler=e=>consume(e.detail);
 window.addEventListener(EVENT,localHandler);
 function disconnect(){unsubscribe?.();unsubscribe=null;controller=null;mapper=b=>b;consume({action:'returned',phase:'preview',progress:0});window.removeEventListener(EVENT,localHandler);window.addEventListener(EVENT,localHandler)}
 const api={version:2,eventName:EVENT,consume,
  connectContent(next,{frameElement=null,mapBounds=null}={}){
   if(!next||!['select','cancel','setCategory','subscribe'].every(k=>typeof next[k]==='function'))throw new TypeError('Expected the personalOSContent v1 controller');
   disconnect();window.removeEventListener(EVENT,localHandler);controller=next;mapper=mapBounds||(frameElement?(b=>mapFrameBounds(b,frameElement)):(b=>b));unsubscribe=next.subscribe(consume);
   const initial=next.getState?.();if(initial)consume({...initial,action:initial.phase==='preview'?'returned':'progress'});return()=>disconnect();
  },
  async select(id){if(!controller)return false;return !!(await controller.select(id))},
  cancel(){if(!controller)return false;controller.cancel();return true},
  setCategory(category){if(!controller)return false;controller.setCategory(category);return true},
  getState:()=>({...copy(state),connected:!!controller,world:snapshot()}),disconnect,
  dispose(){disconnect();window.removeEventListener(EVENT,localHandler)}
 };
 return api;
}
