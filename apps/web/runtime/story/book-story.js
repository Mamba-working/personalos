import {createStoryLifecycle} from './lifecycle.js';
import {IDS,HANDOFF,END,makeWorldPose,nativeRoute,rectQuad,mixQuad,smooth,homography,cssMatrix,createWorldRebase,worldRebaseFrame} from './geometry.js';
const clamp=x=>Math.max(0,Math.min(1,x));
// Narrative and presentation only. The caller owns the existing renderer/actor.
export function createBookStory({content,enabled=false,reduced=false,bypass=false,wake=()=>{},onChange=()=>{}}){
 let lease=null,layout=null,lastCards=null,lastWorld=null,skipFrom=null,resizeState=null,returning=false,lastBlend=0,intentStamp=null;
 const measure=()=>({width:innerWidth,height:innerHeight,targets:lease.targets()});
 function release(reason){returning=true;lease?.release(reason);lease=null;returning=false;lastCards=null;lastWorld=null;skipFrom=null;resizeState=null;document.body.dataset.storyPhase='home';document.documentElement.style.removeProperty('--story-content-alpha');}
 const lifecycle=createStoryLifecycle({enabled,reduced,bypass,duration:END,handoff:HANDOFF,wake,
  onStart(why){intentStamp=performance.now();lastBlend=why==='replay'?1:0;lease=content?.presentation?.acquire(IDS);if(!lease)return false;layout=measure();lastCards=null;skipFrom=null;resizeState=null;document.body.dataset.storyPhase='story';return true;},onReturn:release});
 const stop=lifecycle.subscribe(s=>{document.body.dataset.storyPhase=(s.phase==='bridge'||s.phase==='rewind')?'handoff':s.phase;onChange(s);});
 const invalidated=e=>{if(!returning&&lease&&e.detail.action==='presentation-returned')lifecycle.fail('content-action');};
 window.addEventListener('personalos:content-presentation',invalidated);
 function sample(dt=0,stamp){
  // A new intent cannot inherit the portion of a world frame before it existed.
  // Explicit deterministic steps omit stamp. Hidden time is already excluded by
  // the world clock. Keep an epoch pending if input occurred inside this RAF.
  if(Number.isFinite(stamp)&&intentStamp!==null){dt=Math.min(dt,Math.max(0,(stamp-intentStamp)/1000));if(stamp>=intentStamp)intentStamp=null;}
  const state=lifecycle.advance(dt);if(!state.active||!lease)return null;
  const next=measure();
  if(next.width!==layout.width||next.height!==layout.height){
   if(state.time<HANDOFF&&!state.bridge&&lastCards){const frame={cards:lastCards,viewport:{width:layout.width,height:layout.height}};resizeState=createWorldRebase(state.time,frame,layout,next);}
   layout=next;
  }else layout.targets=next.targets;
  const time=Math.min(state.time,HANDOFF);
  const rebase=resizeState&&!state.bridge?worldRebaseFrame(state.time,layout,resizeState):null;
  if(resizeState&&state.time>=resizeState.startTime+resizeState.duration)resizeState=null;
  const world=makeWorldPose(time,layout.width,layout.height,layout.targets,rebase?.viewport);
  let blend=state.time>=HANDOFF?smooth((state.time-HANDOFF)/(END-HANDOFF)):0,cards;
  if(state.bridge?.target==='story'){
   blend=1-smooth(state.bridge.elapsed/state.bridge.duration);cards=world.papers.map((p,i)=>({id:p.id,quad:rectQuad(layout.targets[i]),ink:0,owner:'world'}));
  }else if(state.bridge){
   if(!skipFrom)skipFrom={world:lastWorld||world,cards:lastCards||world.papers.map(p=>({id:p.id,quad:p.quad,ink:p.ink*(p.exposedFraction??1),owner:'world'})),blend:lastBlend};
   const u=smooth(state.bridge.elapsed/state.bridge.duration);blend=skipFrom.blend+(1-skipFrom.blend)*u;
   cards=skipFrom.cards.map((card,i)=>({...card,quad:mixQuad(card.quad,rectQuad(layout.targets[i]),u),ink:card.ink+(1-card.ink)*smooth((u-.35)/.65),owner:'dom'}));
  }else if(state.time<HANDOFF){cards=rebase?.cards||world.papers.map(p=>({id:p.id,quad:p.quad,ink:p.ink*(p.exposedFraction??1),owner:'world'}));}
  else cards=world.papers.map((p,i)=>({id:p.id,quad:nativeRoute(state.time,i,layout,world),ink:1,owner:'dom'}));
  lastWorld=skipFrom?.world||world;lastCards=cards;lastBlend=blend;
  for(let i=0;i<lease.items.length;i++){
   const item=lease.items[i],card=cards[i];item.article.dataset.storyOwner=card.owner;
   item.article.style.visibility='visible';item.article.style.transform=cssMatrix(homography(item.bounds.width,item.bounds.height,card.quad));
   item.identity.style.opacity=String(clamp(card.ink));
   item.article.style.opacity=String(card.owner==='world'?1:state.bridge?clamp(card.ink):1);
  }
  document.documentElement.style.setProperty('--story-content-alpha',String(smooth((blend-.1)/.9)));
  return{world:lastWorld,blend,papersVisible:(!state.bridge||state.bridge.target==='story')&&state.time<HANDOFF,phase:state.phase,time:state.time,viewport:rebase?.viewport,layout};
 }
 const api={getState:()=>({...lifecycle.getState(),contentIds:lease?.items.map(i=>i.id)||[],borrowed:!!lease}),sample,
  skip(reason,options){const accepted=lifecycle.skip(reason,options);if(accepted){skipFrom=null;intentStamp=performance.now();}return accepted;},replay(){return lifecycle.replay();},setReduced:value=>lifecycle.setReduced(value),fail:reason=>lifecycle.fail(reason),subscribe:fn=>lifecycle.subscribe(fn),dispose(){stop();window.removeEventListener('personalos:content-presentation',invalidated);lifecycle.dispose();}};
 return api;
}
