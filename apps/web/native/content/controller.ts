import { createNavigationAuthority, type Position } from '../../lib/navigation/navigation-authority';
import { categories, type Category, type RouteState } from '../../lib/navigation/route-state';
import { feedProfile, previewHeight, balanceEntries } from '../../runtime/feed-layout.js';
export type ManifestRecord = { id: string; category: Exclude<Category, 'all'>; title: string; height: number; index: string; kind: string };
type Entry = { record: ManifestRecord; slot: HTMLElement; article: HTMLElement; identity: HTMLElement; body: HTMLElement; button: HTMLAnchorElement; previewHeight: number };
type Bounds = { x: number; y: number; w: number; h: number };
type Pose = Bounds & { radius: number; ix: number; iy: number; bx: number; by: number; scale: number; progress: number };
type Active = Entry & { lockedWidth: number; bodyWidth: number; originFocus: Element | null; sourceOffset: number; pose: Pose; target: Pose; velocity: Pose; completed: boolean; restoreReader: number };
const keys: (keyof Pose)[] = ['x','y','w','h','radius','ix','iy','bx','by','scale','progress'];
export function mountContent(root: HTMLElement, manifest: readonly ManifestRecord[]) {
  if (root.dataset.nativeReady) throw new Error('Content host already has an owner');
  const doc = root.ownerDocument, env = doc.defaultView!;
  function get<T extends HTMLElement = HTMLElement>(selector: string): T { const node = root.querySelector<T>(selector); if (!node) throw new Error(`Missing SSR node: ${selector}`); return node; }
  const feed = get('#feed'), stage = get('#stage'), shell = get('#shell'), canvas = get('#canvas'), reader = get('#reader'), close = get<HTMLAnchorElement>('#close'), layer = get('#story-content-layer');
  const scroll = doc.scrollingElement ?? doc.documentElement;
  const reduced = env.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups: (() => void)[] = [];
  const originalArticles = [...root.querySelectorAll<HTMLElement>('article.card')];
  const entries = new Map<string, Entry>();
  let active: Active | null = null, frame = 0, last = 0, disposed = false, category: Category = 'all', phase = 'preview';
  let pendingRoute: { route: RouteState; position?: Position } | null = null;
  const trace: { action: string; id: string | null; phase: string; feed: number; reader: number }[] = [];
  function listen(target: EventTarget, type: string, fn: EventListener) { target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn)); }
  const rect = (node: HTMLElement): Bounds => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; };
  for (const record of manifest) {
    const article = get(`article[data-content-id="${record.id}"]`), slot = get(`.slot[data-id="${record.id}"]`);
    const identity = article.querySelector<HTMLElement>('.identity')!, body = article.querySelector<HTMLElement>('.detail-body')!, button = article.querySelector<HTMLAnchorElement>('.open-card')!;
    if (!identity || !body || !button) throw new Error(`Invalid SSR article ${record.id}`);
    entries.set(record.id,{record:{...record},slot,article,identity,body,button,previewHeight:record.height});
  }
  if (entries.size !== 18 || originalArticles.length !== 18) throw new Error('Expected exactly 18 authored SSR articles');
  // Adopt existing descendants, including a selected deep-link article already in the reader.
  for (const entry of entries.values()) { entry.slot.append(entry.article); entry.body.inert = true; entry.body.setAttribute('aria-hidden','true'); }
  stage.hidden = true; stage.removeAttribute('data-ssr-reader'); root.dataset.nativeReady = 'true'; shell.setAttribute('role','dialog'); shell.setAttribute('aria-modal','true');
  function emit(action: string) {
    const value = { version:1, action, contentId:active?.record.id ?? null, category, phase, progress:active?.pose.progress ?? 0, targetBounds:active?.target ?? null, displayBounds:active?.pose ?? null, returnBounds:active ? rect(active.slot) : null, cancelled:action === 'cancel-return' };
    env.dispatchEvent(new env.CustomEvent('personalos:content-transition',{detail:value}));
    if (action !== 'progress') { trace.push({action,id:value.contentId,phase,feed:scroll.scrollTop,reader:reader.scrollTop}); if (trace.length > 100) trace.shift(); }
  }
  function arrange() {
    const focused = doc.activeElement;
    const profile = feedProfile({viewportWidth:env.innerWidth,contentWidth:feed.getBoundingClientRect().width || env.innerWidth-32,rootFontSize:parseFloat(env.getComputedStyle(doc.documentElement).fontSize)||16});
    feed.dataset.compact = String(profile.compact); feed.dataset.columns = String(profile.columns); feed.dataset.layoutOwned = 'true'; feed.style.columnGap = `${profile.gap}px`;
    const columns = Array.from({length:profile.columns},() => { const column=doc.createElement('div'); column.className='feed-column'; return column; });
    for (const entry of entries.values()) {
      const excluded = category !== 'all' && category !== entry.record.category;
      entry.slot.classList.toggle('excluded', excluded); entry.slot.inert=excluded; entry.slot.setAttribute('aria-hidden',String(excluded));
      if (active?.record.id !== entry.record.id) { entry.article.dataset.previewDensity=profile.compact?'compact':'regular'; entry.identity.style.width=''; entry.identity.style.transform=''; }
    }
    const distribute = () => balanceEntries([...entries.values()],{...profile,category}).buckets.forEach((bucket: Entry[],i: number) => bucket.forEach(entry => columns[i].append(entry.slot)));
    distribute(); feed.replaceChildren(...columns);
    for (const entry of entries.values()) if (entry.record.id !== active?.record.id) { entry.previewHeight=previewHeight(entry.record,Number(entry.record.index)-1,profile,entry.identity.getBoundingClientRect().height+8); entry.slot.style.setProperty('--height',`${entry.previewHeight}px`); }
    distribute();
    for (const link of root.querySelectorAll<HTMLElement>('[data-filter]')) link.setAttribute('aria-pressed',String(link.dataset.filter===category));
    const selected = get(`[data-filter="${category}"]`), indicator = get('.filter-indicator'); indicator.style.width=`${selected.offsetWidth}px`; indicator.style.transform=`translateX(${selected.offsetLeft}px)`;
    if (focused instanceof env.HTMLElement && root.contains(focused)) focused.focus({preventScroll:true});
  }
  function destination(a: Active): Pose {
    const mobile=env.innerWidth<=650, top=Math.max(mobile?76:96,doc.querySelector('.topbar')!.getBoundingClientRect().bottom+12), width=mobile?env.innerWidth-24:Math.min(1040,env.innerWidth-56), margin=mobile?12:Math.max(28,(env.innerWidth-1040)/2);
    a.bodyWidth=mobile?width-48:Math.max(240,width-a.lockedWidth-88);
    return {x:margin,y:top,w:width,h:Math.max(40,env.innerHeight-top-(mobile?12:28)),radius:mobile?22:28,ix:mobile?(width-a.lockedWidth)/2:24,iy:mobile?44:56,bx:mobile?24:a.lockedWidth+48,by:mobile?a.identity.offsetHeight+76:64,scale:1,progress:1};
  }
  function home(a: Active): Pose { return {...a.target,...rect(a.slot),radius:20,ix:0,iy:0,scale:Math.max(1,rect(a.slot).w-2)/a.lockedWidth,progress:0}; }
  function configure(a: Active) { a.identity.style.width=`${a.lockedWidth}px`; a.article.style.setProperty('--identity-width',`${a.lockedWidth}px`); a.article.style.setProperty('--body-width',`${a.bodyWidth}px`); canvas.style.width=`${a.target.w}px`; canvas.style.height=`${Math.max(a.previewHeight,a.target.by+a.body.scrollHeight+64)}px`; }
  function paint() { const a=active;if(!a)return;const p=a.pose;Object.assign(shell.style,{transform:`translate3d(${p.x}px,${p.y}px,0)`,width:`${p.w}px`,height:`${p.h}px`,borderRadius:`${p.radius}px`});a.identity.style.transform=`translate3d(${p.ix}px,${p.iy}px,0) scale(${p.scale})`;a.body.style.transform=`translate3d(${p.bx}px,${p.by}px,0)`;get('.backdrop').style.opacity=String(Math.min(.58,Math.max(0,p.progress)*.58));emit('progress'); }
  function schedule() { if(!disposed&&!frame&&active&&!active.completed) frame=env.requestAnimationFrame(tick); }
  function tick(now: number) { frame=0;const dt=Math.min(.032,last?(now-last)/1000:1/60);last=now;advance(dt);schedule(); }
  function advance(dt: number) {
    const a=active;if(!a||a.completed||disposed)return;let settled=true;
    if(a.target.progress===0) a.target=home(a);
    for(const key of keys){const target=a.target[key];if(reduced.matches){a.pose[key]=target;a.velocity[key]=0;continue;}const omega=key==='progress'?17:19,v=a.velocity[key],x=a.pose[key]-target,c=v+omega*x,decay=Math.exp(-omega*dt);a.pose[key]=target+(x+c*dt)*decay;a.velocity[key]=(v-omega*c*dt)*decay;if(Math.abs(a.pose[key]-target)>.08||Math.abs(a.velocity[key])>.3)settled=false;}
    paint();if(settled){env.cancelAnimationFrame(frame);frame=0;a.pose={...a.target};paint();if(a.target.progress===1){a.completed=true;phase='detail';a.body.inert=false;a.body.setAttribute('aria-hidden','false');reader.classList.add('reading');reader.scrollTop=a.restoreReader;emit('detail-ready');}else finishClose();}
  }
  function openNative(entry: Entry, position?: Position) {
    if(active?.record.id===entry.record.id){active.target=destination(active);active.completed=false;phase='intermediate';active.restoreReader=position?.reader ?? active.restoreReader;schedule();return;}
    const source=rect(entry.slot), lockedWidth=entry.identity.offsetWidth||Math.max(1,source.w-2);
    const pose: Pose={...source,radius:20,ix:0,iy:0,bx:0,by:0,scale:1,progress:0};
    active={...entry,lockedWidth,bodyWidth:0,originFocus:doc.activeElement,sourceOffset:position?.feed??scroll.scrollTop,pose,target:{...pose},velocity:Object.fromEntries(keys.map(key=>[key,0])) as Pose,completed:false,restoreReader:position?.reader??0};
    const a=active;a.target=destination(a);a.pose.bx=a.target.bx;a.pose.by=a.target.by;
    canvas.append(a.article);stage.hidden=false;feed.inert=true;shell.setAttribute('aria-labelledby',`title-${a.record.id}`);shell.style.background=env.getComputedStyle(a.article).backgroundColor;
    configure(a);reader.scrollTop=0;reader.classList.remove('reading');phase='intermediate';close.focus({preventScroll:true});paint();emit('select');last=0;schedule();
  }
  function beginClose() { const a=active;if(!a)return;if(reader.scrollTop){a.restoreReader=reader.scrollTop;a.pose.iy-=reader.scrollTop;a.pose.by-=reader.scrollTop;}reader.classList.remove('reading');reader.scrollTop=0;a.body.inert=true;a.body.setAttribute('aria-hidden','true');a.target=home(a);a.completed=false;phase='return';emit('cancel-return');last=0;schedule(); }
  function restore(a: Active) { a.slot.append(a.article);a.identity.style.width='';a.identity.style.transform='';a.body.style.transform='';a.article.style.removeProperty('--identity-width');a.article.style.removeProperty('--body-width');a.body.inert=true;a.body.setAttribute('aria-hidden','true'); }
  function finishClose() { const a=active;if(!a)return;restore(a);stage.hidden=true;feed.inert=false;canvas.style.height='';active=null;phase='preview';scroll.scrollTop=a.sourceOffset;a.button.focus({preventScroll:true});emit('returned');if(pendingRoute){const pending=pendingRoute;pendingRoute=null;apply(pending.route,pending.position);} }
  const navigation=createNavigationAuthority(env,manifest,()=>({feed:scroll.scrollTop,reader:reader.scrollTop}));
  function apply(route: RouteState, position?: Position) {
    if(disposed)return;
    if(active&&route.item!==active.record.id){pendingRoute={route,position};beginClose();return;}
    pendingRoute=null;
    category=route.category;arrange();if(position)scroll.scrollTop=position.feed;
    const title=route.item?entries.get(route.item)?.record.title:null;doc.title=title?`${title} | PersonalOS`:'PersonalOS · authored demonstration space';
    const notice=get('[data-chat-scope]');notice.hidden=!route.chat;
    if(route.item){const entry=entries.get(route.item);if(entry)openNative(entry,position);}else emit('category-select');
  }
  cleanups.push(navigation.subscribe(apply));
  for(const entry of entries.values())listen(entry.button,'click',event=>{if(event instanceof env.MouseEvent&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0))return;event.preventDefault();navigation.open(entry.record.id);});
  for(const link of root.querySelectorAll<HTMLElement>('[data-filter]'))listen(link,'click',event=>{event.preventDefault();const next=categories.find(category=>category===link.dataset.filter);if(next)navigation.filter(next);});
  listen(close,'click',event=>{event.preventDefault();navigation.close();});listen(get('.backdrop'),'click',()=>navigation.close());
  listen(doc,'keydown',event=>{const key=event as KeyboardEvent;if(!active)return;if(key.key==='Escape'){key.preventDefault();navigation.close();}if(key.key==='Tab'){const focusables=[close,...active.body.querySelectorAll<HTMLElement>('button,a')].filter(node=>!node.closest('[inert]'));const i=focusables.indexOf(doc.activeElement as HTMLElement);if((key.shiftKey&&i<=0)||(!key.shiftKey&&i===focusables.length-1)){key.preventDefault();focusables[key.shiftKey?focusables.length-1:0].focus({preventScroll:true});}}});
  listen(root,'click',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-damping]');if(button)button.closest('.spring-demo')!.querySelector('[data-readout]')!.textContent=`ζ = ${Number(button.dataset.damping).toFixed(2)}`;});
  listen(env,'resize',()=>{arrange();if(active){const closing=active.target.progress===0;const goal=destination(active);active.target=goal;configure(active);if(closing)active.target=home(active);active.completed=false;schedule();}});
  listen(reduced,'change',()=>{if(active&&reduced.matches)advance(1);});
  const snapshot=()=>({phase,category,contentId:active?.record.id??null,articleCount:root.querySelectorAll('article.card').length,retained:originalArticles.every(node=>root.contains(node)),feedOffset:scroll.scrollTop,readerOffset:reader.scrollTop,framePending:!!frame,listeners:cleanups.length,navigation:navigation.diagnostics(),trace:[...trace]});
  const api={select:(id:string)=>{navigation.open(id);return Promise.resolve(entries.has(id));},cancel:()=>navigation.close(),setCategory:(value:Category)=>navigation.filter(value),getState:snapshot,subscribe:(callback:(detail:unknown)=>void)=>{const handler=(event:Event)=>callback((event as CustomEvent).detail);env.addEventListener('personalos:content-transition',handler);return()=>env.removeEventListener('personalos:content-transition',handler);},presentation:{release:()=>false,getState:()=>({leased:false}),ready:()=>Promise.resolve(false)}};
  const globals=env as Window & {personalOSContent?:typeof api;personalOSNextContent?:unknown};globals.personalOSContent=api;
  const controller={snapshot,open:(id:string)=>navigation.open(id),close:()=>navigation.close(),advance,dispose(){if(disposed)return;disposed=true;navigation.dispose();env.cancelAnimationFrame(frame);frame=0;for(const cleanup of cleanups.splice(0))cleanup();if(active){restore(active);active=null;}phase='preview';stage.hidden=true;feed.inert=false;reader.classList.remove('reading');layer.hidden=true;root.removeAttribute('data-native-ready');shell.setAttribute('role','region');shell.removeAttribute('aria-modal');for(const entry of entries.values()){entry.body.inert=false;entry.body.removeAttribute('aria-hidden');entry.slot.inert=false;entry.slot.removeAttribute('aria-hidden');entry.slot.classList.remove('excluded');}if(globals.personalOSContent===api)delete globals.personalOSContent;if(globals.personalOSNextContent===controller)delete globals.personalOSNextContent;emit('returned');}};
  globals.personalOSNextContent=controller;apply(navigation.getState());return controller;
}
