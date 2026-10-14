/**
 * Native conversation scroll owner. It owns only latest-turn min-block-size,
 * scrollTop, and two native-host scroll settings. It never renders a message,
 * changes focus, projects a surface, or creates a clock.
 */
export const TURN_SCROLL_MODE = Object.freeze({
  ANCHORING: 'ANCHORING', PINNED: 'PINNED', FOLLOWING: 'FOLLOWING', READING: 'READING'
});

const installed = new WeakMap();
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const nonnegative = value => Math.max(0, finite(value));
const px = value => parseFloat(value) || 0;
const restoreProperty = (node, name, saved) => {
  if (saved.value) node.style.setProperty(name, saved.value, saved.priority);
  else node.style.removeProperty(name);
};
const saveProperty = (node, name) => ({
  value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name)
});

/**
 * readInsets is a commit-time policy, returning CSS pixels relative to the
 * active host's client box. Default: transcript padding + exact 12px user inset.
 * Short-reader integration must supply its actual fixed/sticky chrome insets.
 * Existing GSAP owns both the numeric tween and one-shot stream-batch ticker.
 */
export function createChatTurnScroll({
  messages, getHost, hosts = [], gsap, reduced = () => false, initiallyOpen = true,
  readInsets = ({ css }) => ({
    upper: 12, lower: px(css.paddingBottom),
    paddingTop: px(css.paddingTop), paddingBottom: px(css.paddingBottom)
  }),
  duration = .32, ease = 'power3.out', onTailVisibilityChange = () => {},
  onModeChange = () => {}, canFollow = () => true, ResizeObserver: Observer,
  window: win = messages?.ownerDocument?.defaultView
} = {}) {
  if (!messages || typeof getHost !== 'function' || !gsap?.to ||
      !gsap.ticker?.add || !gsap.ticker?.remove) {
    throw new TypeError('Original messages, native host getter and existing GSAP are required');
  }
  if (installed.has(messages)) return installed.get(messages);
  const doc = messages.ownerDocument;
  const hostRecords = new Map();
  // Every projected original, including a retiring prior turn, has a stable
  // native-layout anchor. Weak identity records do not retain old history.
  const userIds = new WeakMap(), userAnchors = new Map();
  let destroyed = false, open = !!initiallyOpen, epoch = 0, turn = null;
  let mode = TURN_SCROLL_MODE.READING, modeReason = 'initial', currentHost = null;
  let tween = null, scheduled = false, layoutDepth = 0, preserveOnReopen = false;
  let tailBelow = false, lastTouchY = null, observer = null;
  const proxy = { top: 0 };

  function setMode(next, reason) {
    const changed = mode !== next;
    mode = next; modeReason = reason;
    if (changed) onModeChange({ mode, reason, turnId: turn?.id ?? null });
  }
  function selectedHistory() {
    const selection = win?.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    if (messages.contains(selection.anchorNode) || messages.contains(selection.focusNode)) return true;
    for (let index = 0; index < selection.rangeCount; index++) {
      try { if (selection.getRangeAt(index).intersectsNode(messages)) return true; } catch {}
    }
    return false;
  }
  function selectionSignature() {
    const selection = win?.getSelection?.();
    return selection ? [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset] : null;
  }
  function readerSelectionActive() {
    if (!selectedHistory()) { if (turn) turn.selectionAtSend = null; return false; }
    const now = selectionSignature(), beforeSend = turn?.selectionAtSend;
    // An explicit new Send reclaims the view even if an old selection remains
    // highlighted. Do not clear that selection or interfere with input focus.
    return !beforeSend || now.some((value, index) => value !== beforeSend[index]);
  }
  function cancelBatch() {
    if (!scheduled) return;
    gsap.ticker.remove(flushBatch); scheduled = false;
  }
  function killMotion() {
    epoch++; const old = tween; tween = null; old?.kill(); cancelBatch();
  }
  function interrupt(reason = 'manual') {
    if (destroyed || !turn) return;
    killMotion(); turn.pendingAnchor = false; preserveOnReopen = false;
    turn.explicitFollowing = false; turn.followSizePending = false;
    setMode(TURN_SCROLL_MODE.READING, reason);
  }
  function preserveViewportDuringLayout() {
    return mode === TURN_SCROLL_MODE.READING ||
      (mode === TURN_SCROLL_MODE.FOLLOWING && turn &&
       !(turn.contentStarted && turn.contentObserved) && !turn.explicitFollowing);
  }
  function notifyTail(force = false) {
    if (!turn?.geometry || !currentHost) return;
    const below = canFollow() && turn.geometry.answerHeight > 0 &&
      turn.geometry.tail > currentHost.scrollTop + turn.geometry.readingBottom + 1;
    if (!force && below === tailBelow) return;
    tailBelow = below;
    onTailVisibilityChange({ below, open, mode, turnId: turn.id });
  }
  function registerHost(host) {
    if (!host || hostRecords.has(host)) return;
    const styles = Object.fromEntries(['overflow-anchor', 'scroll-behavior'].map(name => [name, saveProperty(host, name)]));
    // Native anchor heuristics and CSS smooth scrolling must not compete with
    // this explicit owner. Every style is restored on destroy.
    host.style.setProperty('overflow-anchor', 'none');
    host.style.setProperty('scroll-behavior', 'auto');
    const wheel = event => { if (open && (event.deltaY || event.deltaX)) interrupt('wheel'); };
    const touchStart = event => { lastTouchY = event.touches?.[0]?.clientY ?? null; };
    const touchMove = event => {
      const y = event.touches?.[0]?.clientY ?? null;
      if (open && (y === null || lastTouchY === null || y !== lastTouchY)) interrupt('touch');
      lastTouchY = y;
    };
    const pointer = event => {
      if (!open) return;
      if (event.button !== undefined && event.button !== 0) return;
      // Includes scrollbar track/thumb drag. Composer input is outside messages
      // and never loses focus or ownership merely because it was clicked.
      if (messages.contains(event.target) && event.target?.closest?.('button, a, input, textarea, select, summary, [contenteditable]')) return;
      if (event.target === host || messages.contains(event.target)) interrupt('pointer');
    };
    const scroll = () => {
      if (destroyed || host !== getHost() || layoutDepth) return;
      // A scroll event conveys position, never user intent. Browser/core/GSAP
      // programmatic writes cannot silently enter or exit READING.
      proxy.top = host.scrollTop; notifyTail();
    };
    const handlers = { wheel, touchstart: touchStart, touchmove: touchMove, pointerdown: pointer, scroll };
    for (const [name, handler] of Object.entries(handlers)) host.addEventListener(name, handler, { passive: true });
    hostRecords.set(host, { styles, handlers });
  }
  function syncHost() {
    const host = getHost();
    if (!host?.contains(messages)) throw new TypeError('Native scroll host must contain the original transcript');
    registerHost(host);
    if (host !== currentHost) { killMotion(); currentHost = host; }
    return host;
  }
  function releaseReservation() {
    if (!turn) return;
    observer?.unobserve?.(turn.answer);
    restoreProperty(turn.node, 'min-block-size', turn.reservation);
  }
  function writeScroll(host, top, readBack = false) {
    host.scrollTop = nonnegative(top);
    // Only a one-shot stream batch reads the browser's clamp. Tween onUpdate
    // performs a native write only, with its legal target cached at commit.
    if (readBack) proxy.top = host.scrollTop;
  }
  function moveTo(target, finalMode, reason) {
    if (!open || destroyed || !turn?.geometry || preserveOnReopen) return;
    if (readerSelectionActive()) { interrupt('selection'); return; }
    killMotion();
    const host = currentHost, id = turn.id, ticket = epoch;
    const legal = Math.max(0, Math.min(target, turn.geometry.max));
    proxy.top = host.scrollTop;
    const complete = () => {
      if (destroyed || !open || epoch !== ticket || turn?.id !== id || host !== currentHost) return;
      tween = null; turn.pendingAnchor = false; setMode(finalMode, reason); notifyTail();
      if ([TURN_SCROLL_MODE.PINNED, TURN_SCROLL_MODE.FOLLOWING].includes(finalMode)) maybeFollow();
    };
    if (reduced() || Math.abs(proxy.top - legal) < .5 || duration <= 0) {
      writeScroll(host, legal); complete(); return;
    }
    tween = gsap.to(proxy, {
      top: legal, duration, ease, overwrite: true,
      onUpdate() {
        if (destroyed || !open || epoch !== ticket || turn?.id !== id || host !== currentHost) return;
        writeScroll(host, proxy.top);
      }, onComplete: complete
    });
  }
  function measure() {
    if (!turn || destroyed) return null;
    const host = syncHost();
    const css = win.getComputedStyle(host), supplied = readInsets({ host, css, turn: turn.node });
    const insets = Object.fromEntries(['upper', 'lower', 'paddingTop', 'paddingBottom'].map(name => [name, nonnegative(supplied?.[name])]));
    const height = nonnegative(host.clientHeight);
    const turnCss = win.getComputedStyle(turn.node);
    const extras = px(turnCss.paddingTop) + px(turnCss.paddingBottom) + px(turnCss.borderTopWidth) + px(turnCss.borderBottomWidth);
    const reservedBorderSize = Math.max(0, height - insets.paddingTop - insets.paddingBottom);
    const cssMinimum = Math.max(turn.baselineMinimum, reservedBorderSize - (turnCss.boxSizing === 'border-box' ? 0 : extras));
    // An active reservation is exactly one reading viewport in every mode.
    // While closed/paused, retain the old range until an explicit new intent.
    const minimum = preserveOnReopen ? Math.max(turn.minimum || 0, cssMinimum) : cssMinimum;
    turn.minimum = minimum;
    turn.node.style.setProperty('min-block-size', minimum + 'px');
    // All rectangle/style/range reads live in this explicit layout transaction.
    // Ancestor translations cancel in these differences; glyphs stay native.
    const hostRect = host.getBoundingClientRect(), userRect = (userAnchors.get(turn.user) || turn.user).getBoundingClientRect();
    const answerRect = turn.answer.getBoundingClientRect();
    const origin = hostRect.top + finite(host.clientTop);
    const user = host.scrollTop + userRect.top - origin;
    const answerStart = host.scrollTop + answerRect.top - origin;
    const answerCss = win.getComputedStyle(turn.answer);
    const answerExtras = px(answerCss.paddingTop) + px(answerCss.paddingBottom) + px(answerCss.borderTopWidth) + px(answerCss.borderBottomWidth);
    const max = Math.max(0, host.scrollHeight - height);
    const geometry = {
      hostHeight: height, ...insets, readingBottom: Math.max(insets.upper, height - insets.lower),
      user, target: Math.max(0, Math.min(max, user - insets.upper)), max,
      answerStart, answerHeight: answerRect.height, answerExtras,
      tail: answerStart + answerRect.height
    };
    turn.geometry = geometry;
    turn.contentObserved = turn.contentStarted;
    if (turn.initialAnswerHeight === undefined) turn.initialAnswerHeight = answerRect.height;
    notifyTail();
    return geometry;
  }
  function maybeFollow(allowCompleted = false) {
    if (!turn || (!(turn.contentStarted && turn.contentObserved) && !turn.explicitFollowing) || (!turn.streaming && !allowCompleted && !turn.followSizePending && !turn.explicitFollowing) ||
        !open || preserveOnReopen || !canFollow() || !turn.geometry ||
        [TURN_SCROLL_MODE.READING, TURN_SCROLL_MODE.ANCHORING].includes(mode)) return;
    if (readerSelectionActive()) { interrupt('selection'); return; }
    turn.followSizePending = false;
    const g = turn.geometry;
    if (mode === TURN_SCROLL_MODE.PINNED && turn.hasAnswerGrowth &&
        g.tail > currentHost.scrollTop + g.readingBottom + 1) {
      setMode(TURN_SCROLL_MODE.FOLLOWING, 'answer-overflow');
    }
    if (mode === TURN_SCROLL_MODE.FOLLOWING && !tween && !scheduled) {
      scheduled = true; gsap.ticker.add(flushBatch);
    }
  }
  function flushBatch() {
    gsap.ticker.remove(flushBatch); scheduled = false;
    if (destroyed || !open || preserveOnReopen || !canFollow() || mode !== TURN_SCROLL_MODE.FOLLOWING || !turn?.geometry || (!(turn.contentStarted && turn.contentObserved) && !turn.explicitFollowing)) return;
    if (readerSelectionActive()) { interrupt('selection'); return; }
    // ResizeObserver supplies the new answer size. No rectangle/computed style
    // read, no new tween, and no forced reservation-bottom target per token.
    const g = turn.geometry;
    writeScroll(currentHost, Math.max(0, g.tail - g.readingBottom), true);
    notifyTail();
  }
  function answerResized(id, borderHeight) {
    if (destroyed || turn?.id !== id || !turn.geometry || !Number.isFinite(borderHeight)) return false;
    const g = turn.geometry;
    turn.contentObserved = turn.contentStarted;
    g.answerHeight = nonnegative(borderHeight); g.tail = g.answerStart + g.answerHeight;
    if (g.answerHeight > turn.initialAnswerHeight + .5) turn.hasAnswerGrowth = true;
    // Cache a safe range estimate for explicit jump animation. Actual native
    // streaming clamp is read once in flushBatch, not in any animation frame.
    g.max = Math.max(g.max, g.tail - g.readingBottom);
    const wasStreamUpdate = turn.sizeUpdatePending;
    turn.sizeUpdatePending = false;
    if (turn.streaming || wasStreamUpdate) turn.followSizePending = true;
    notifyTail(); maybeFollow(wasStreamUpdate); return true;
  }
  const selectionChanged = () => { if (open && readerSelectionActive()) interrupt('selection'); };
  const keydown = event => {
    if (!open || event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (!currentHost?.contains(event.target) && event.target !== doc.body) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(event.key)) interrupt('keyboard');
  };
  const pagehide = event => { if (event.persisted) api.setOpen(false); else api.destroy(); };
  doc.addEventListener('selectionchange', selectionChanged);
  doc.addEventListener('keydown', keydown);
  win?.addEventListener('pagehide', pagehide);
  for (const host of hosts) registerHost(host);
  const ResizeObserverClass = Observer || win?.ResizeObserver;
  if (ResizeObserverClass) observer = new ResizeObserverClass(entries => {
    for (const entry of entries) {
      if (!turn || entry.target !== turn.answer) continue;
      const box = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
      const height = Number.isFinite(box?.blockSize) ? box.blockSize : entry.contentRect?.height + (turn.geometry?.answerExtras || 0);
      answerResized(turn.id, height);
    }
  });

  const api = {
    /** Release the previous reservation and append the supplied original pair
     * together, in this synchronous task. Caller creates the .chat-turn only. */
    appendTurn({ node, user, answer, deferUntilLayout = false, contentStarted = true } = {}) {
      if (destroyed) throw new Error('Chat turn scroll owner is destroyed');
      if (!node || !user || !answer || node === user || node === answer || user === answer ||
          !node.contains(user) || !node.contains(answer) || node === messages) {
        throw new TypeError('A turn containing the original distinct user and assistant nodes is required');
      }
      killMotion(); releaseReservation();
      messages.append(node);
      const baselineMinimum = px(win.getComputedStyle(node).minBlockSize);
      turn = { id: ++api.sequence, node, user, answer, baselineMinimum,
        reservation: saveProperty(node, 'min-block-size'), streaming: true, contentStarted: !!contentStarted, contentObserved: !!contentStarted,
        pendingAnchor: true, sizeUpdatePending: true, deferUntilLayout: !!deferUntilLayout, geometry: null,
        followSizePending: false, explicitFollowing: false,
        hasAnswerGrowth: false,
        selectionAtSend: selectedHistory() ? selectionSignature() : null };
      userIds.set(user, turn.id);
      preserveOnReopen = false; setMode(TURN_SCROLL_MODE.ANCHORING, 'send');
      measure(); observer?.observe(answer, { box: 'border-box' });
      if (open && !deferUntilLayout) moveTo(turn.geometry.target, TURN_SCROLL_MODE.PINNED, 'send');
      return turn.id;
    },
    /** Paint projection supplies an empty native-layout slot, never a glyph clone.
     * No measurement or scroll write occurs here. The next native commit uses it. */
    setUserAnchor(id, node, original = turn?.id === id ? turn.user : null) {
      if (destroyed || !original || userIds.get(original) !== id || !node) return false;
      if (node === original) { userAnchors.delete(original); return true; }
      if (!messages.contains(original) || !original.parentNode?.contains(node)) return false;
      userAnchors.set(original, node); return true;
    },
    sequence: 0,
    /** Call once AFTER the core's native mode/resize/host-transfer commit. */
    layoutCommitted() {
      if (destroyed || !turn) return;
      killMotion(); measure();
      if (!open || preserveOnReopen || mode === TURN_SCROLL_MODE.READING) return;
      turn.deferUntilLayout = false;
      if (mode === TURN_SCROLL_MODE.FOLLOWING) {
        if ((turn.contentStarted && turn.contentObserved) || turn.explicitFollowing) writeScroll(currentHost, Math.max(0, turn.geometry.tail - turn.geometry.readingBottom), true);
        notifyTail();
      } else {
        if (turn.pendingAnchor) setMode(TURN_SCROLL_MODE.ANCHORING, 'layout-commit');
        moveTo(turn.geometry.target, TURN_SCROLL_MODE.PINNED, 'layout-commit');
      }
    },
    /** If final native layout precedes a paint-only composer pin, canFollow
     * remains false until that owner's settlement. This uses cached geometry. */
    readingViewportSettled() {
      if (destroyed || !turn) return;
      notifyTail(); maybeFollow();
    },
    /** Safe at token frequency: no layout or scroll writes. With no native
     * ResizeObserver, producer must pass an observed border-box answer height. */
    streamUpdated(id, { answerHeight } = {}) {
      if (destroyed || turn?.id !== id || !turn.streaming) return false;
      if (readerSelectionActive()) interrupt('selection');
      const firstContent = !turn.contentStarted;
      turn.contentStarted = true; turn.sizeUpdatePending = true;
      if (firstContent) {
        // Re-observing the same original requests a fresh native size sample,
        // including equal-height text replacement. Never follow stale status.
        turn.contentObserved = false;
        observer?.unobserve?.(turn.answer); observer?.observe?.(turn.answer, { box: 'border-box' });
      }
      if (Number.isFinite(answerHeight)) answerResized(id, answerHeight);
      return true;
    },
    resumeTurn(id, { contentStarted = true } = {}) {
      if (destroyed || turn?.id !== id) return false;
      turn.streaming = true; turn.contentStarted = !!contentStarted; turn.contentObserved = !!contentStarted; turn.sizeUpdatePending = true;
      return true;
    },
    finishTurn(id) {
      if (destroyed || turn?.id !== id) return false;
      // Allow the already scheduled final-size batch to land; subsequent
      // disclosure/layout growth cannot start automatic following.
      turn.streaming = false; return true;
    },
    cancelTurn(id) {
      if (destroyed || turn?.id !== id) return false;
      turn.streaming = false; turn.sizeUpdatePending = false; interrupt('cancelled'); return true;
    },
    jumpToLatest() {
      if (destroyed || !open || !turn) return;
      preserveOnReopen = false; measure();
      turn.explicitFollowing = true;
      setMode(TURN_SCROLL_MODE.FOLLOWING, 'jump-latest');
      moveTo(Math.max(0, turn.geometry.tail - turn.geometry.readingBottom), TURN_SCROLL_MODE.FOLLOWING, 'jump-latest');
    },
    setOpen(value) {
      if (destroyed || open === !!value) return;
      open = !!value;
      if (!open) { killMotion(); preserveOnReopen = true; }
      else { syncHost(); notifyTail(true); }
    },
    /** Preserve native reading, including an automatically following turn
     * paused for retry status. Reservation/host commits can otherwise clamp
     * scrollTop transiently even when the final legal range is unchanged. */
    captureReadingAnchor() {
      if (destroyed || !turn || !preserveViewportDuringLayout()) return null;
      const host = syncHost(), view = host.getBoundingClientRect();
      // Send/tail insets position new content; native padding does not occlude
      // a scrolled message. Anchor the first actually visible retained node,
      // including a row fragment inside the authored 12px top inset.
      const readingTop = view.top + finite(host.clientTop);
      const readingBottom = readingTop + host.clientHeight;
      for (const node of messages.querySelectorAll('.message')) {
        const measurementNode = userAnchors.get(node) || node;
        const r = measurementNode.getBoundingClientRect();
        if (r.height > 0 && r.bottom > readingTop && r.top < readingBottom) {
          return { host, node, measurementNode, offset: r.top - view.top - finite(host.clientTop), top: host.scrollTop, turnId: turn.id };
        }
      }
      return { host, node: null, offset: 0, top: host.scrollTop, turnId: turn.id };
    },
    restoreReadingAnchor(anchor) {
      if (destroyed || !anchor || !preserveViewportDuringLayout() ||
          (anchor.turnId !== undefined && anchor.turnId !== turn?.id)) return;
      const host = syncHost(); layoutDepth++;
      try {
        if (anchor.host !== host) anchor.host.scrollTop = 0;
        if (anchor.node?.isConnected) {
          const delta = (userAnchors.get(anchor.node) || anchor.node).getBoundingClientRect().top - host.getBoundingClientRect().top - finite(host.clientTop) - anchor.offset;
          writeScroll(host, host.scrollTop + delta, true);
        } else writeScroll(host, anchor.top, true);
      } finally { layoutDepth--; }
      notifyTail();
    },
    preferencesChanged() {
      if (destroyed || !reduced() || !tween || !turn?.geometry) return;
      const next = mode === TURN_SCROLL_MODE.ANCHORING ? TURN_SCROLL_MODE.PINNED : mode;
      moveTo(next === TURN_SCROLL_MODE.PINNED ? turn.geometry.target : turn.geometry.tail - turn.geometry.readingBottom, next, 'reduced-motion');
    },
    interrupt,
    state: () => ({ mode, reason: modeReason, open, destroyed, turnId: turn?.id ?? null,
      streaming: !!turn?.streaming, contentStarted: !!turn?.contentStarted, contentObserved: !!turn?.contentObserved, animating: !!tween, scheduled, tailBelow,
      pausedForReopen: preserveOnReopen, top: proxy.top, projectedUserAnchors: userAnchors.size, geometry: turn?.geometry ? { ...turn.geometry } : null }),
    destroy() {
      if (destroyed) return;
      killMotion(); destroyed = true; releaseReservation(); observer?.disconnect();
      doc.removeEventListener('selectionchange', selectionChanged);
      doc.removeEventListener('keydown', keydown); win?.removeEventListener('pagehide', pagehide);
      for (const [host, { styles, handlers }] of hostRecords) {
        for (const [name, handler] of Object.entries(handlers)) host.removeEventListener(name, handler);
        for (const [name, saved] of Object.entries(styles)) restoreProperty(host, name, saved);
      }
      hostRecords.clear(); userAnchors.clear(); installed.delete(messages); turn = null; currentHost = null;
    }
  };
  installed.set(messages, api);
  return api;
}
