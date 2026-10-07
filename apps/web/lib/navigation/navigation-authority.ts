import { parseRoute, routeURL, type Category, type RouteState } from './route-state';
type Manifest = readonly { id: string; category: Exclude<Category, 'all'> }[];
export type Position = { feed: number; reader: number };
type HistoryEntry = { source: 'personalos-next'; token: string; id: string; openedHere: boolean; position: Position };
export function createNavigationAuthority(env: Window, records: Manifest, readPosition: () => Position) {
  const listeners = new Set<(state: RouteState, position?: Position) => void>();
  const token = `${Date.now()}-${Math.random()}`;
  const positions = new Map<string, Position>();
  let sequence = 0;
  let disposed = false, awaitingBack = false, queued: RouteState | null = null;
  let current = parseRoute(new URL(env.location.href).searchParams, records);
  const ownedPath = env.location.pathname;
  const previousRestoration = env.history.scrollRestoration;
  env.history.scrollRestoration = 'manual';
  const entry = (): HistoryEntry | undefined => env.history.state?.personalosNext;
  let currentEntryId: string | undefined = entry()?.id;
  function rememberPosition() {
    const position = readPosition();
    if (currentEntryId) positions.set(currentEntryId, { ...position });
    return position;
  }
  function write(state: RouteState, method: 'pushState' | 'replaceState', openedHere: boolean, position = readPosition()) {
    const id = method === 'replaceState' && currentEntryId ? currentEntryId : `${token}:${++sequence}`;
    // Do not copy Next's __NA marker. Its documented native-history wrapper must run.
    // Resolve the method at user-intent time, after Next installs that wrapper.
    env.history[method]({ personalosNext: { source: 'personalos-next', token, id, openedHere, position } satisfies HistoryEntry }, '', routeURL(state, env.location.href));
    currentEntryId = id;
    positions.set(id, { ...position });
  }
  function publish(state: RouteState, position?: Position) {
    current = state;
    for (const listener of listeners) listener(state, position);
  }
  function checkpoint() {
    if (disposed || awaitingBack || env.location.pathname !== ownedPath) return;
    const old = entry();
    write(current, 'replaceState', !!old?.openedHere && old.token === token, rememberPosition());
  }
  function navigate(state: RouteState) {
    if (disposed) return;
    if (awaitingBack) { queued = state; publish(state); return; }
    checkpoint(); write(state, 'pushState', !!state.item); publish(state);
  }
  function onPop() {
    if (disposed || env.location.pathname !== ownedPath) return;
    // The URL/state already describe the destination. Save the departed reader
    // under its retained entry ID, without writing into the destination entry.
    // Close already checkpointed before its optimistic reader teardown.
    if (!awaitingBack) rememberPosition();
    const incoming = entry();
    currentEntryId = incoming?.id;
    awaitingBack = false;
    const arrived = parseRoute(new URL(env.location.href).searchParams, records);
    if (queued) {
      const desired = queued; queued = null;
      if (desired.item !== arrived.item || desired.category !== arrived.category || desired.chat !== arrived.chat) {
        write(desired, 'pushState', !!desired.item); publish(desired); return;
      }
    }
    publish(arrived, (currentEntryId && positions.get(currentEntryId)) || incoming?.position);
  }
  env.addEventListener('popstate', onPop);
  // Mount/dispose must not write history: child effects may run before Next's
  // wrapper is installed (or after it is removed during Strict Mode cleanup).
  // Deep links keep both their opaque framework state and browser history depth.
  return {
    getState: () => ({ ...current }),
    subscribe(listener: (state: RouteState, position?: Position) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(id: string) { const record = records.find(record => record.id === id); if (record) navigate({ ...current, item: id, category: current.category === 'all' ? 'all' : record.category }); },
    filter(category: Category) { navigate({ ...current, category, item: null }); },
    setChat(open: boolean) { navigate({ ...current, chat: open }); },
    close() {
      if (disposed || !current.item) return;
      const state = { ...current, item: null };
      // Close/reopen/Close can all arrive before the first Back event. Keep
      // only the latest intent rather than traversing another history entry.
      if (awaitingBack) { queued = state; publish(state); return; }
      checkpoint();
      const own = entry();
      if (own?.openedHere && own.token === token) { awaitingBack = true; publish(state); env.history.back(); }
      else { write(state, 'replaceState', false); publish(state); }
    },
    checkpoint,
    dispose() { if (disposed) return; disposed = true; listeners.clear(); positions.clear(); env.removeEventListener('popstate', onPop); env.history.scrollRestoration = previousRestoration; },
    diagnostics: () => ({ listeners: listeners.size, awaitingBack, disposed }),
  };
}
