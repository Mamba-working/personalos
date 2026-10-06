/* A reversible document route, not another fixed keyboard root.
 * The interactive contract is copied from send-comparison.css: a normal-flow
 * 100dvh/min-height:0 grid with an untransformed relative panel. No viewport
 * offsets or keyboard estimates enter this owner. Original nodes stay alive.
 */
export function mobileFlowPreview(win) {return new URLSearchParams(win.location?.search||'').get('chatPagePreview')==='1';}
export function mobileFlowEligible(win) {return mobileFlowPreview(win)|| win.innerWidth<=650||(win.innerWidth<=1000&&win.matchMedia('(pointer:coarse)').matches);}
const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x??r.left,y:r.y??r.top,w:r.width,h:r.height};};
export function createMobileFlowPage(doc=document) {
 const win=doc.defaultView,root=doc.createElement('main'),frame=doc.createElement('section');
 root.className='mobile-chat-page';root.hidden=true;frame.className='mobile-chat-frame';root.append(frame);doc.body.append(root);
 let state=null,phase='closed',siteRemoved=false,restored=false;
 const preserveDisplay=node=>{const value=node.style.getPropertyValue('display'),priority=node.style.getPropertyPriority('display');return()=>value?node.style.setProperty('display',value,priority):node.style.removeProperty('display');};
 function returnPanel(){if(state?.marker.parentNode)state.marker.parentNode.insertBefore(state.panel,state.marker);}
 function restoreSite(){
  if(!state||!siteRemoved)return false;
  for(const item of state.site)item.restore();siteRemoved=false;root.hidden=true;
  delete doc.documentElement.dataset.mobileChatPage;delete doc.body.dataset.mobileChatPage;
  win.dispatchEvent(new win.CustomEvent('personalos:mobile-chat-restoring'));
  // Layout is restored first. The single saved-position write is not a pan loop.
  for(const item of state.scrollers||[]){item.node.scrollTop=item.top;item.node.scrollLeft=item.left;}
  win.scrollTo({left:state.x,top:state.y,behavior:'instant'});win.dispatchEvent(new win.CustomEvent('personalos:mobile-chat-restored'));restored=true;return true;
 }
 return {
  root,frame,get owned(){return !!state;},get active(){return phase==='flow';},get siteRemoved(){return siteRemoved;},get phase(){return phase;},
  offset:()=>state?.y??doc.scrollingElement.scrollTop,measure:()=>rect(frame),
  prepare(panel,offset=doc.scrollingElement.scrollTop){
   if(!state){const marker=doc.createComment('mobile conversation return');panel.parentNode.insertBefore(marker,panel);state={panel,marker,x:win.scrollX,y:offset,site:[],inert:[...doc.querySelectorAll('.topbar,.app,.transition-stage')].map(node=>({node,value:node.inert})),history:win.history.scrollRestoration};win.history.scrollRestoration='manual';win.dispatchEvent(new win.CustomEvent('personalos:mobile-chat-hold'));}
   else if(restored){restored=false;}
   phase='opening';root.dataset.phase='measure';root.hidden=false;panel.dataset.mobileFlow='opening';return rect(frame);
  },
  stage(releaseFixedPage){
   if(!state||phase!=='opening')return null;
   const before=rect(frame);
   if(!siteRemoved){state.scrollers=[doc.querySelector('#reader')].filter(Boolean).map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));state.site=[...doc.querySelectorAll('.topbar,.app,.transition-stage,.skip,#host-chat-fallback,.chat-reading-debug-tools')].map(node=>({node,restore:preserveDisplay(node)}));for(const {node} of state.site)node.style.setProperty('display','none','important');siteRemoved=true;}
   doc.documentElement.dataset.mobileChatPage='true';doc.body.dataset.mobileChatPage='true';
   releaseFixedPage(); // Restore body/root style without restoring the long-page scroll.
   delete root.dataset.phase;phase='handoff';
   return {before,after:rect(frame)};
  },
  commit(){if(!state||phase!=='handoff')return false;frame.append(state.panel);state.panel.dataset.mobileFlow='flow';phase='flow';return true;},
  beginExit(){
   if(!state||phase!=='flow')return null;const current=rect(state.panel);returnPanel();state.panel.dataset.mobileFlow='closing';Object.assign(state.panel.style,{left:current.x+'px',top:current.y+'px',width:current.w+'px',height:current.h+'px'});phase='closing';root.dataset.phase='outgoing';return current;
  },
  restoreSite,
  finish(){
   if(!state)return;returnPanel();restoreSite();const old=state;old.marker.remove();delete old.panel.dataset.mobileFlow;
   root.hidden=true;delete root.dataset.phase;delete doc.documentElement.dataset.mobileChatPage;delete doc.body.dataset.mobileChatPage;
   for(const item of old.inert)item.node.inert=item.value;win.history.scrollRestoration=old.history;state=null;phase='closed';restored=false;win.dispatchEvent(new win.CustomEvent('personalos:mobile-chat-release'));
  }
 };
}
