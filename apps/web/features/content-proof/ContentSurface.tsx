'use client';
import React, { useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { browserFrameClock, createContentFrame } from '../../engines/motion/content-frame';
import type { ContentHeader } from '@personalos/contracts/content-proof';
import RevisionBoundary from './RevisionBoundary';
import { captureAnchor, restoreAnchor, type ReadingAnchor } from './scroll-anchor';
import styles from './proof.module.css';
export type Phase = 'preview' | 'opening' | 'detail' | 'closing';
export type SurfaceHandle = { scroll: HTMLDivElement; frame: HTMLDivElement };
export type ProofEntry = { record: ContentHeader; body: ReactNode };
type Props = ProofEntry & { selected: boolean; otherSelected: boolean; ready: boolean; instant: boolean; itemHref: string; closeHref: string; revisionLink: ReactNode; onOpen(event: MouseEvent<HTMLAnchorElement>): void; onClose(event: MouseEvent<HTMLAnchorElement>): void; onPhase(id: string, phase: Phase): void; register(id: string, handle: SurfaceHandle | null): void };
export default function ContentSurface(props: Props) {
  const { record, body, selected, otherSelected, ready, instant, onPhase, register } = props;
  const slot = useRef<HTMLDivElement>(null), frame = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null), openLink = useRef<HTMLAnchorElement>(null);
  const [phase, setPhase] = useState<Phase>(selected ? 'detail' : 'preview'), [readerWidth, setReaderWidth] = useState<number | undefined>(undefined);
  const phaseRef = useRef(phase), selectedRef = useRef(selected), motion = useRef<ReturnType<typeof createContentFrame> | null>(null), savedAnchor = useRef<ReadingAnchor | null>(null), previousFocus = useRef<HTMLElement | null>(null), returnFocus = useRef(false);
  phaseRef.current = phase; selectedRef.current = selected;
  const presenting = ready && phase !== 'preview', showingReaderControls = presenting || (!ready && selected);
  useLayoutEffect(() => {
    const host = scroll.current!, surface = frame.current!;
    register(record.id, { scroll: host, frame: surface });
    const controller = createContentFrame(surface, browserFrameClock(window), open => {
      if (open !== selectedRef.current) return;
      setPhase(open ? 'detail' : 'preview');
      if (!open) {
        controller.clear(); host.scrollTop = 0;
        returnFocus.current = true;
      }
    });
    motion.current = controller;
    return () => { controller.dispose(); motion.current = null; register(record.id, null); };
  }, [record.id, register]);
  useLayoutEffect(() => {
    if (!ready) return;
    if (selected && (phaseRef.current === 'preview' || phaseRef.current === 'closing')) {
      if (phaseRef.current === 'preview') previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPhase('opening');
    } else if (!selected && (phaseRef.current === 'detail' || phaseRef.current === 'opening')) {
      const focused = document.activeElement;
      if ((focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) && frame.current!.contains(focused)) previousFocus.current = focused;
      savedAnchor.current = captureAnchor(scroll.current!); setPhase('closing');
    }
  }, [selected, ready]);
  useLayoutEffect(() => {
    onPhase(record.id, phase);
    if (phase === 'preview' && returnFocus.current) {
      returnFocus.current = false;
      const focus = previousFocus.current;
      if (focus?.isConnected && frame.current!.contains(focus) && focus.getBoundingClientRect().bottom <= slot.current!.getBoundingClientRect().bottom) focus.focus({ preventScroll: true });
      else openLink.current?.focus({ preventScroll: true });
    }
    if (!ready || !motion.current) return;
    const controller = motion.current, host = scroll.current!;
    if (phase !== 'preview') setReaderWidth(slot.current!.getBoundingClientRect().width);
    const home = () => { const rect = slot.current!.getBoundingClientRect(); return { x: rect.left - frame.current!.offsetLeft, y: rect.top - frame.current!.offsetTop, clip: Math.max(0, frame.current!.offsetHeight - rect.height) }; };
    if (phase === 'opening') {
      if (!controller.snapshot().active) {
        controller.initialize(home());
        if (savedAnchor.current) restoreAnchor(host, savedAnchor.current);
      }
      controller.target({ x: 0, y: 0, clip: 0 }, true, instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!frame.current!.contains(document.activeElement)) heading.current?.focus({ preventScroll: true });
    } else if (phase === 'closing') {
      controller.target(home(), false, instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } else if (phase === 'detail') {
      controller.initialize({ x: 0, y: 0, clip: 0 });
    }
    const resize = () => {
      setReaderWidth(slot.current!.getBoundingClientRect().width);
      if (phaseRef.current === 'closing') controller.target(home(), false, true);
      else if (phaseRef.current !== 'preview') controller.target({ x: 0, y: 0, clip: 0 }, true, true);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [phase, ready, instant, record.id, onPhase]);
  return <div ref={slot} className={styles.slot} data-proof-slot={record.id} data-kind={record.kind} data-ready={ready} data-selected={selected} inert={ready && otherSelected}>
    <div ref={frame} className={styles.frame} style={presenting ? { width: readerWidth } : undefined} data-proof-frame={record.id} data-presenting={presenting} data-phase={phase} role={presenting ? 'dialog' : undefined} aria-modal={presenting ? true : undefined} aria-labelledby={`proof-title-${record.id}`}>
      <div className={styles.surfaceTools} data-proof-toolbar={record.id}>
        <a ref={openLink} href={props.itemHref} data-open={record.id} hidden={showingReaderControls} inert={showingReaderControls} aria-hidden={showingReaderControls || undefined} onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }} onClick={props.onOpen}>打开 ↗</a>
        <div hidden={!showingReaderControls} inert={!showingReaderControls} aria-hidden={!showingReaderControls || undefined}>{props.revisionLink}<a href={props.closeHref} data-close={record.id} onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }} onClick={props.onClose}>返回 ↙</a></div>
      </div>
      <div ref={scroll} className={styles.scrollHost} data-proof-scroll={record.id} tabIndex={presenting ? 0 : -1}>
        <RevisionBoundary revision={record.revision} reading={ready && phase === 'detail'} scrollHost={scroll}>
          <article className={styles.article} data-proof-article={record.id} data-revision={record.revision}>
            <header className={styles.articleHeader}><p className={styles.kicker}>{record.space} / {record.kind === 'essay' ? '一篇长文' : '一个小实验'} <span>演示内容 · v{record.revision}</span></p><h2 id={`proof-title-${record.id}`} ref={heading} tabIndex={-1}>{record.title}</h2><p className={styles.summary}>{record.summary}</p></header>
            {body}
          </article>
        </RevisionBoundary>
      </div>
    </div>
  </div>;
}
