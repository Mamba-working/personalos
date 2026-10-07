"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WorldHandle } from '../native/world/original-scene';
export default function PersistentMotionShell({worldHTML,children}: {worldHTML: string; children: ReactNode}) {
  const [snapshot] = useState(()=>({__html:worldHTML})), owner=useRef<HTMLDivElement>(null), status=useRef<HTMLParagraphElement>(null), world=useRef<WorldHandle|null>(null), router=useRouter();
  const [,rerender]=useState(0);
  useEffect(()=>{
    let cancelled=false, disposePlacement: (()=>void)|undefined, disposeFrames: (()=>void)|undefined;
    const host=owner.current!, label=status.current!;
    host.dataset.worldStatus='starting';
    function fallback(reason: string) { host.dataset.worldStatus='fallback'; label.textContent=`3D unavailable (${reason}); all 18 articles remain readable. GPU verification has not passed.`; }
    const availability=(event: Event)=>{const detail=(event as CustomEvent<{status:string;reason?:string}>).detail;if(detail.status==='failed'||detail.status==='lost')fallback(detail.reason??detail.status);else if(detail.status==='ready'){host.dataset.worldStatus='ready';label.textContent='Original Ball renderer mounted. This candidate is not a visual or GPU acceptance result.';}};
    window.addEventListener('personalos:world-availability',availability);
    Promise.all([import('../native/world/original-scene.js'),import('../native/world/rings-data.js')]).then(([scene,rings])=>{
      if(cancelled)return;
      try {
        const handle=scene.mountOriginalWorld(host.querySelector<HTMLElement>('#ball-world-root')!,rings.default) as WorldHandle;
        if(cancelled){handle.dispose();return;}world.current=handle;
        disposePlacement=handle.world.setPlacementProvider(()=>({mode:'home',bounds:{x:Math.max(8,window.innerWidth-110),y:Math.max(90,window.innerHeight-130),w:72,h:72}}));
        // Original intro remains; this subscriber belongs to its one existing clock.
        let lastPhase='';disposeFrames=handle.world.onFrame(()=>{const phase=handle.snapshot().mode;if(phase!==lastPhase){lastPhase=phase;host.dataset.worldPhase=phase;}if(phase==='home'){disposeFrames?.();disposeFrames=undefined;}});
        host.dataset.worldStatus='ready';label.textContent='Original Ball renderer mounted. This candidate is not a visual or GPU acceptance result.';
        handle.world.requestFrame();
      } catch(error) { fallback(error instanceof Error?error.message:'initialization failed'); }
    }).catch(error=>{if(!cancelled)fallback(error instanceof Error?error.message:'module failed');});
    return()=>{cancelled=true;window.removeEventListener('personalos:world-availability',availability);disposeFrames?.();disposePlacement?.();world.current?.dispose();world.current=null;host.dataset.worldStatus='disposed';};
  },[]);
  return <>
    <a className="skip" href="#feed">跳到内容</a>
    <header className="topbar"><Link className="brand" href="/" prefetch={false}>PersonalOS<span className="brand-mark">◌</span></Link><span className="edition">A SMALL PERSONAL SPACE</span><span className="top-note">公开示例 / Placeholder</span><div className="world-controls"><button aria-label="减少动态" onClick={()=>{const current=world.current?.world.story;if(current)current.setReduced(!current.getState().reduced);}}>≈</button><button aria-label="重播开场" onClick={()=>world.current?.world.story.replay()}>↻</button><button onClick={()=>world.current?.world.story.skip()}>进入空间 ↗</button></div></header>
    <p className="migration-notice">Isolated migration proof: native reader + SSR. Menu, weather and chat have not migrated.<Link href="/route-check" prefetch={false}>Route check</Link><button onClick={()=>router.refresh()}>Refresh payload</button><button onClick={()=>rerender(value=>value+1)}>Parent rerender</button></p>
    <p id="world-status" ref={status} role="status">Readable without JavaScript. Ball loads progressively.</p>
    <div id="world-owner" ref={owner} data-world-status="starting" dangerouslySetInnerHTML={snapshot}/>
    {children}
  </>;
}
