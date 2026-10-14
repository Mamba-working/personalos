// The content controller owns every semantic article, its slot and all history.
// A lease only borrows presentation; it never recreates content or handles input.
export function createContentPresentation({entries,canBorrow,onChange=()=>{},document:doc=document}) {
  let current=null,serial=0;
  const layer=doc.createElement('div');layer.id='story-content-layer';layer.hidden=true;layer.inert=true;
  layer.setAttribute('aria-hidden','true');doc.body.append(layer);
  const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
  const restore=(node,value)=>value===null?node.removeAttribute('style'):node.setAttribute('style',value);
  function release(reason='returned') {
    if(!current)return false;
    const lease=current;current=null;
    for(const item of lease.items){item.slot.append(item.article);restore(item.article,item.saved.article);restore(item.identity,item.saved.identity);item.article.inert=item.saved.inert;delete item.article.dataset.storyOwner;}
    layer.hidden=true;lease.released=true;onChange({action:'presentation-returned',reason,id:lease.id});return true;
  }
  function acquire(ids){
    if(current)return null;
    if(!canBorrow()||!Array.isArray(ids)||new Set(ids).size!==ids.length)return null;
    const selected=ids.map(id=>entries.get(id));
    if(selected.some(e=>!e||e.slot.classList.contains('excluded')||e.article.parentElement!==e.slot))return null;
    if(selected.some(e=>{const b=box(e.slot);return b.width<=0||b.height<=0;}))return null;
    const items=selected.map(e=>({id:e.record.id,category:e.record.category,title:e.record.title,article:e.article,identity:e.identity,slot:e.slot,bounds:box(e.slot),saved:{article:e.article.getAttribute('style'),identity:e.identity.getAttribute('style'),inert:e.article.inert}}));
    const lease={id:++serial,items,released:false,release(reason){return current===lease?release(reason):false;},targets(){return items.map(i=>box(i.slot));}};
    current=lease;layer.hidden=false;
    try{for(const item of items){const b=item.bounds;layer.append(item.article);item.article.inert=true;item.article.dataset.storyOwner='world';Object.assign(item.article.style,{position:'absolute',left:'0px',top:'0px',width:b.width+'px',height:b.height+'px',transformOrigin:'0 0',visibility:'hidden'});item.identity.style.width=(b.width-2)+'px';}}
    catch(error){release('acquire-error');throw error;}
    onChange({action:'presentation-borrowed',id:lease.id,contentIds:[...ids]});return lease;
  }
  function ready(ids,isCurrent=()=>true){
    const started=performance.now();return new Promise(resolve=>{function check(){if(!isCurrent()||performance.now()-started>2500){resolve(false);return;}const stable=canBorrow()&&ids.every(id=>{const e=entries.get(id);if(!e||e.slot.classList.contains('excluded'))return false;const b=box(e.slot);return b.width>0&&Math.abs(b.height-e.record.height)<.2;});if(stable)resolve(true);else requestAnimationFrame(check);}check();});
  }
  return Object.freeze({version:1,acquire,release,ready,getState:()=>({leased:!!current,contentIds:current?.items.map(i=>i.id)||[],leaseId:current?.id||null}),dispose(){release('dispose');layer.remove();}});
}
