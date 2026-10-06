import { parseRoute, routeURL, type Category, type RouteState } from './route-state';
type Manifest = readonly { id: string; category: Exclude<Category, 'all'> }[];
export type Position = { feed: number; reader: number };
type HistoryEntry = { source: 'personalos-next'; token: string; openedHere: boolean; position: Position };
export function createNavigationAuthority(env: Window, records: Manifest, readPosition: () => Position) {
  const listeners = new Set<(state: RouteState, position?: Position) => void>();
  const token = `${Date.now()}-${Math.random()}`;
  let disposed = false, awaitingBack = false, queued: RouteState | null = null;
  let current = parseRoute(new URL(env.location.href).searchParams, records);
  const ownedPath = env.location.pathname;
  const previousRestoration = env.history.scrollRestoration;
  env.history.scrollRestoration = 'manual';
  const entry = (): HistoryEntry | undefined => env.history.state?.personalosNext;
  function write(state: RouteState, method: 'pushState' | 'replaceState', openedHere: boolean, position = readPosition()) {
    // Do not copy Next's __NA marker. Its documented native-history wrapper must run.
    env.history[method]({ personalosNext: { source: 'personalos-next', token, openedHere, position } satisfies HistoryEntry }, '', routeURL(state, env.location.href));
  }
  function publish(state: RouteState, position?: Position) {
    current = state;
    for (const listener of listeners) listener(state, position);
  }
  function checkpoint() { if (env.location.pathname !== ownedPath) return; const old = entry(); write(current, 'replaceState', !!old?.openedHere && old.token === token); }
  function navigate(state: RouteState) {
    if (disposed) return;
    if (awaitingBack) { queued = state; publish(state); return; }
    checkpoint(); write(state, 'pushState', !!state.item); publish(state);
  }
  function onPop() {
    if (disposed || env.location.pathname !== ownedPath) return;
    awaitingBack = false;
    if (queued) { const desired = queued; queued = null; write(desired, 'pushState', !!desired.item); publish(desired); return; }
    publish(parseRoute(new URL(env.location.href).searchParams, records), entry()?.position);
  }
  env.addEventListener('popstate', onPop);
  // Deep links keep their URL and browser history depth. No fabricated preview entry.
  write(current, 'replaceState', false);
  return {
    getState: () => ({ ...current }),
    subscribe(listener: (state: RouteState, position?: Position) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(id: string) { const record = records.find(record => record.id === id); if (record) navigate({ ...current, item: id, category: current.category === 'all' ? 'all' : record.category }); },
    filter(category: Category) { navigate({ ...current, category, item: null }); },
    setChat(open: boolean) { navigate({ ...current, chat: open }); },
    close() {
      if (disposed || !current.item) return;
      checkpoint();
      const state = { ...current, item: null }, own = entry();
      if (own?.openedHere && own.token === token) { awaitingBack = true; publish(state); env.history.back(); }
      else { write(state, 'replaceState', false); publish(state); }
    },
    checkpoint,
    dispose() { if (disposed) return; disposed = true; checkpoint(); listeners.clear(); env.removeEventListener('popstate', onPop); env.history.scrollRestoration = previousRestoration; },
    diagnostics: () => ({ listeners: listeners.size, awaitingBack, disposed }),
  };
}
