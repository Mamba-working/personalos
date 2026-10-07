'use client';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createNavigationAuthority, type Position } from '../../lib/navigation/navigation-authority';
import type { RouteState } from '../../lib/navigation/route-state';
import ContentSurface, { type Phase, type ProofEntry, type SurfaceHandle } from './ContentSurface';
import styles from './proof.module.css';
type Props = { entries: ProofEntry[]; revision: number; initialItem: string | null };
const plainClick = (event: MouseEvent<HTMLAnchorElement>) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
export default function ContentProof({ entries, revision, initialItem }: Props) {
  const router = useRouter(), search = useSearchParams(), [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState({ entries, revision }), [ready, setReady] = useState(false), [instant, setInstant] = useState(false);
  const [route, setRoute] = useState<RouteState>({ category: 'all', item: initialItem, chat: false });
  const [phases, setPhases] = useState<Record<string, Phase>>({});
  const handles = useRef(new Map<string, SurfaceHandle>()), navigation = useRef<ReturnType<typeof createNavigationAuthority> | null>(null), routeRef = useRef(route), restore = useRef<Position | null>(null), queuedRevision = useRef<string | null>(null);
  routeRef.current = route;
  const busy = Object.values(phases).some(phase => phase === 'opening' || phase === 'closing');
  const displayedId = route.item ?? Object.keys(phases).find(id => phases[id] !== 'preview') ?? null;
  const register = useCallback((id: string, handle: SurfaceHandle | null) => { if (handle) handles.current.set(id, handle); else handles.current.delete(id); }, []);
  const onPhase = useCallback((id: string, phase: Phase) => setPhases(previous => previous[id] === phase ? previous : { ...previous, [id]: phase }), []);
  useEffect(() => {
    const manifest = entries.map(entry => ({ id: entry.record.id, category: entry.record.space }));
    const authority = createNavigationAuthority(window, manifest, () => ({ feed: document.scrollingElement?.scrollTop ?? 0, reader: routeRef.current.item ? handles.current.get(routeRef.current.item)?.scroll.scrollTop ?? 0 : 0 }));
    navigation.current = authority;
    const unsubscribe = authority.subscribe((next, position) => { restore.current = position ?? null; setRoute(next); if (queuedRevision.current && authority.replaceServerQuery({ rev: queuedRevision.current })) queuedRevision.current = null; });
    setRoute(authority.getState()); setReady(true);
    return () => { unsubscribe(); authority.dispose(); navigation.current = null; };
    // This fixture's IDs/kinds are fixed. Revisions only change supported content fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { navigation.current?.reconcileServerRefresh(); }, [entries, revision]);
  const requestedRevision = search.get('rev') === '2' ? 2 : 1;
  useEffect(() => {
    if (ready && requestedRevision !== revision) startTransition(() => router.refresh());
  }, [ready, requestedRevision, revision, router]);
  useLayoutEffect(() => {
    // Queue the newest payload during visual transactions. Never freeze the initial records.
    if (!busy && requestedRevision === revision && (applied.entries !== entries || applied.revision !== revision)) setApplied({ entries, revision });
  }, [entries, revision, applied, busy, requestedRevision]);
  useLayoutEffect(() => {
    const position = restore.current;
    if (!position || busy) return;
    const host = route.item ? handles.current.get(route.item)?.scroll : null;
    if (route.item && phases[route.item] !== 'detail') return;
    if (host) host.scrollTop = position.reader;
    if (document.scrollingElement) document.scrollingElement.scrollTop = position.feed;
    restore.current = null;
  }, [route, phases, busy]);
  useEffect(() => {
    if (!ready || !displayedId) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      const handle = handles.current.get(routeRef.current.item ?? displayedId);
      if (!handle) return;
      if (event.key === 'Escape') { event.preventDefault(); setInstant(true); navigation.current?.close(); }
      if (event.key === 'Tab') {
        const controls = [...handle.frame.querySelectorAll<HTMLElement>('a[href], button, input, textarea, [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[inert]'));
        const index = controls.indexOf(document.activeElement as HTMLElement), next = event.shiftKey ? index <= 0 ? controls.length - 1 : index - 1 : index < 0 || index === controls.length - 1 ? 0 : index + 1;
        if (controls[next]) { event.preventDefault(); controls[next].focus({ preventScroll: true }); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.documentElement.style.overflow = previous; document.removeEventListener('keydown', keyboard); };
  }, [displayedId, ready]);
  const href = (item: string | null, version = applied.revision) => `/proof/react-content?rev=${version}${item ? `&item=${encodeURIComponent(item)}` : ''}`;
  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string | null) => { if (!plainClick(event) || !navigation.current) return; event.preventDefault(); setInstant(event.detail === 0); if (id) navigation.current.open(id); else navigation.current.close(); };
  const nextRevision = applied.revision === 1 ? 2 : 1;
  const revisionLink = <a href={href(route.item, nextRevision)} data-load-revision={nextRevision} onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }} onClick={event => {
    if (!plainClick(event)) return; event.preventDefault();
    if (!navigation.current?.replaceServerQuery({ rev: String(nextRevision) })) queuedRevision.current = String(nextRevision);
  }}>载入服务器版本 {nextRevision}</a>;
  return <main id="feed" className={styles.proof} data-react-content-proof data-revision={applied.revision} data-server-revision={revision} data-ready={ready} data-updating={pending || applied.revision !== revision}>
    <header className={styles.intro} inert={ready && !!displayedId}>
      <p className={styles.eyebrow}>PERSONALOS / COMPONENT PROOF</p><h1>内容在变，手上的事还在</h1>
      <p>一篇长文，一个小实验。这里单独检验 React 内容、原生阅读与服务端版本更新。</p>
      <div className={styles.versionTools}>{revisionLink}<button type="button" onClick={() => startTransition(() => router.refresh())}>重新获取当前版本</button><a href="/">回到原有示例</a></div>
      <p className={styles.source} role="status">服务端演示夹具 v{applied.revision}{pending ? ' · 正在获取' : applied.revision !== revision ? ' · 等待过渡结束后应用' : ' · 已应用'}。非真实用户内容，不连接数据库。</p>
    </header>
    <noscript><p className={styles.source}>长文和版本链接可直接使用；计数与草稿交互需要 JavaScript。</p></noscript>
    <div className={styles.backdrop} hidden={!ready || !displayedId} aria-hidden="true" />
    <div className={styles.feed}>{applied.entries.map(entry => <ContentSurface key={entry.record.id} {...entry} selected={route.item === entry.record.id} otherSelected={!!displayedId && displayedId !== entry.record.id} ready={ready} instant={instant} itemHref={href(entry.record.id)} closeHref={href(null)} revisionLink={revisionLink} onOpen={event => navigate(event, entry.record.id)} onClose={event => navigate(event, null)} onPhase={onPhase} register={register} />)}</div>
    <footer className={styles.footer} inert={ready && !!displayedId}>演示边界：当前文档内保留组件状态。整页重载会重置实验；文章与实验没有发布或保存功能。</footer>
  </main>;
}
