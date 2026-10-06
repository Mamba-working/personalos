/*
 * Controlled navigation port. The host alone owns categories, history, content,
 * chat, and the world. Source choreography: living-space/living-core.js,
 * menuTo/paintSurface: right surface, convex edge, delayed rows, quiet footer.
 * WAAPI replaces that implementation's private clock; no old app is imported.
 */
const mounts = new WeakMap();
let serial = 0;
const CATEGORY_META = Object.freeze([
  { key: 'work', number: '01', title: 'Work', note: '做的事，留下线索。' },
  { key: 'thoughts', number: '02', title: 'Thoughts', note: '想的事，慢慢展开。' },
  { key: 'labs', number: '03', title: 'Labs', note: '正在试的事，保持好奇。' },
]);
const CATEGORIES = new Set(['all', ...CATEGORY_META.map(item => item.key)]);
const clamp = value => Math.max(0, Math.min(1, value));
// The source curve (.7,0,.2,1), evaluated once while building finite WAAPI
// keyframes. No frame loop or second rendering owner is installed.
function menuEase(x) {
  let low = 0, high = 1, t = x;
  for (let i = 0; i < 18; i++) {
    t = (low + high) / 2;
    const bx = 3 * (1 - t) ** 2 * t * .7 + 3 * (1 - t) * t * t * .2 + t ** 3;
    if (bx < x) low = t; else high = t;
  }
  return x <= 0 ? 0 : x >= 1 ? 1 : 3 * (1 - t) * t * t + t ** 3;
}
function segmentAt(segment, time) {
  const { start, velocity, target, duration, delay, warp = 0, warpVelocity = 0 } = segment;
  const u = clamp((time - delay) / duration);
  if (time < delay) return { p: start, v: 0, w: warp, wv: 0 };
  if (u === 1) return { p: target, v: 0, w: 0, wv: 0 };
  const e = menuEase(u), d = .0001;
  const derivative = (menuEase(Math.min(1, u + d)) - menuEase(Math.max(0, u - d)))
    / (Math.min(1, u + d) - Math.max(0, u - d));
  // Source velocity-corrected retarget: carry the current velocity into the new
  // curve, then decay its correction to zero at the destination.
  const correction = velocity - (target - start) * (menuEase(d) / d) / duration;
  return {
    p: start + (target - start) * e + correction * duration * u * (1 - u) ** 2,
    v: (target - start) * derivative / duration + correction * (1 - 4 * u + 3 * u * u),
    w: warp * (1 - 3 * u * u + 2 * u ** 3) + warpVelocity * duration * u * (1 - u) ** 2,
    wv: warp * (-6 * u + 6 * u * u) / duration + warpVelocity * (1 - 4 * u + 3 * u * u),
  };
}

export function mountMenu({ host, container } = {}) {
  if (!container?.ownerDocument || !host?.getState || !host?.subscribe || !host?.navigate) {
    throw new TypeError('mountMenu requires a container and the controlled host contract');
  }
  if (mounts.has(container)) return mounts.get(container);
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const id = `pos-menu-${++serial}`;
  const root = doc.createElement('span');
  root.className = 'pos-menu';
  root.dataset.state = 'closed';
  root.innerHTML = `
    <span class="pos-menu-anchor"><button class="pos-menu-toggle" type="button" aria-label="打开空间菜单" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}">
      <span>Menu</span><span class="pos-menu-icon" aria-hidden="true"><i></i><i></i></span>
    </button></span>
    <dialog class="pos-menu-dialog" id="${id}" aria-labelledby="${id}-title">
      <div class="pos-menu-shade" aria-hidden="true"></div>
      <section class="pos-menu-panel">
        <div class="pos-menu-edge" aria-hidden="true"><div></div></div>
        <div class="pos-menu-content"><div class="pos-menu-reveal">
          <header class="pos-menu-header">
            <h2 class="pos-menu-eyebrow" id="${id}-title">PERSONAL SPACE / 空间导航</h2>
          </header>
          <nav class="pos-menu-links" aria-label="内容栏目">
            ${CATEGORY_META.map(item => `<a class="pos-menu-link" data-menu-category="${item.key}"><span class="pos-menu-number">${item.number}</span><strong>${item.title}</strong><small>${item.note}</small><span class="pos-menu-current" aria-hidden="true">↗</span></a>`).join('')}
          </nav>
          <div class="pos-menu-bottom">
            <a class="pos-menu-all" data-menu-category="all">浏览全部内容 <span aria-hidden="true">↗</span></a>
            <p>做的事，想的事，正在试的事。</p>
            <span class="pos-menu-disclosure">公开示例 / Placeholder</span>
          </div>
        </div></div>
      </section>
      <div class="pos-menu-controls"></div>
    </dialog>
    <span class="pos-menu-status" id="${id}-status" role="status" aria-live="polite"></span>`;
  container.append(root);
  const dialog = root.querySelector('dialog');
  const trigger = root.querySelector('.pos-menu-toggle');
  const anchor = root.querySelector('.pos-menu-anchor');
  const controls = root.querySelector('.pos-menu-controls');
  const panel = root.querySelector('.pos-menu-panel');
  const panelContent = root.querySelector('.pos-menu-content');
  const shade = root.querySelector('.pos-menu-shade');
  const status = root.querySelector('.pos-menu-status');
  const links = [...root.querySelectorAll('[data-menu-category]')];
  const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let hostState = host.getState();
  let wanted = false;
  let phase = 'closed';
  let disposed = false;
  const tracks = [];
  let geometry = null;
  let motionEpoch = 0;
  let navigationEpoch = 0;
  let pendingCategory = null;
  let error = null;
  let returnFocus = null;
  let pointerOnShade = null;
  let touchY = null;
  let closeInternally = false;
  let linkSignature = '';
  const cleanups = [];
  const on = (node, type, fn, options) => {
    node.addEventListener(type, fn, options);
    cleanups.push(() => node.removeEventListener(type, fn, options));
  };
  const reduced = () => !!(motionQuery?.matches || hostState?.reduced || hostState?.story?.reduced);
  const category = () => CATEGORIES.has(hostState?.content?.category) ? hostState.content.category : 'all';
  const focus = node => { if (node?.isConnected) node.focus({ preventScroll: true }); };

  function updateLinks() {
    const signature = `${doc.location.href}|${category()}|${pendingCategory || ''}`;
    if (signature === linkSignature) return;
    linkSignature = signature;
    for (const link of links) {
      const url = new URL(doc.location.href);
      url.searchParams.set('space', link.dataset.menuCategory);
      url.searchParams.delete('item');
      url.hash = '';
      link.href = url.href;
      if (link.dataset.menuCategory === category()) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (link.dataset.menuCategory === pendingCategory) link.setAttribute('aria-busy', 'true');
      else link.removeAttribute('aria-busy');
    }
  }

  function measureGeometry() {
    // CSS owns the width-mode decision; motion reads that exact mode.
    const mobile = win.getComputedStyle(dialog).getPropertyValue('--pos-menu-mobile').trim() === '1';
    const width = dialog.clientWidth || win.innerWidth;
    const panelWidth = panel.offsetWidth || (mobile ? width : Math.min(650, width * .65));
    return { mobile, left: width - panelWidth, travel: panelWidth + width * (mobile ? .2 : .06), rowShift: width * (mobile ? .2 : .15) };
  }

  function positionControl() {
    const rect = anchor.getBoundingClientRect();
    const viewport = win.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || win.innerWidth, height = viewport?.height || win.innerHeight;
    // Keep the one real button at its opener, clamped into the visible viewport
    // when browser chrome, zoom or a short screen would otherwise obscure it.
    const w = rect.width || trigger.offsetWidth || 88, h = rect.height || 44;
    Object.assign(trigger.style, {
      left: `${Math.max(left + 8, Math.min(rect.left, left + width - w - 8))}px`,
      top: `${Math.max(top + 8, Math.min(rect.top, top + height - h - 8))}px`,
      width: `${w}px`, height: `${h}px`,
    });
  }

  function dockControl() {
    const rect = trigger.getBoundingClientRect();
    anchor.style.width = `${rect.width || 88}px`;
    anchor.style.height = `${rect.height || 44}px`;
    controls.append(trigger);
    trigger.setAttribute('autofocus', '');
    positionControl();
  }

  function restoreControl() {
    anchor.append(trigger);
    trigger.removeAttribute('style');
    trigger.removeAttribute('autofocus');
    anchor.removeAttribute('style');
  }

  function buildTracks() {
    if (tracks.length) return;
    const add = (element, render, length = 800, row = null, kind = '') =>
      tracks.push({ element, render, length, row, kind, p: 0, animation: null, segment: null });
    add(panel, (p, w) => ({ transform: `translateX(${(1 - clamp(p)) * geometry.travel + w}px)` }), 800, null, 'panel');
    add(root.querySelector('.pos-menu-edge'), p => ({ transform: `scaleX(${1 - clamp(p)})` }), 850);
    root.querySelectorAll('.pos-menu-link').forEach((link, index) => {
      add(link, (p, w) => ({ transform: `translateX(${(1 - p) * geometry.rowShift + w}px)` }), 800, index, 'row');
    });
    add(root.querySelector('.pos-menu-bottom'), p => ({ transform: `translateX(${(1 - p) * 60}px)`, opacity: clamp(p * 1.3) }));
    add(root.querySelector('.pos-menu-eyebrow'), p => ({ opacity: clamp(p) }));
    add(shade, p => ({ opacity: clamp(p) }));
    const lines = trigger.querySelectorAll('i');
    add(lines[0], p => ({ transform: `translateY(${-3 * (1 - p)}px) rotate(${p * 45}deg)` }), 300);
    add(lines[1], p => ({ transform: `translateY(${3 * (1 - p)}px) rotate(${-p * 45}deg)` }), 300);
  }

  const sample = track => track.segment
    ? segmentAt(track.segment, Number(track.animation?.currentTime) || 0)
    : { p: track.p, v: 0, w: 0, wv: 0 };

  function runTracks(next, epoch, rebase = false) {
    const previous = geometry;
    const snapshots = tracks.map(sample);
    if (rebase || !geometry) geometry = measureGeometry();
    const promises = [];
    tracks.forEach((track, index) => {
      const state = snapshots[index], target = next ? 1 : 0;
      const oldTime = Number(track.animation?.currentTime) || 0;
      const oldSegment = track.segment;
      let warp = state.w, warpVelocity = state.wv;
      if (rebase && previous) {
        if (track.kind === 'panel') {
          warp += previous.left - geometry.left + (1 - clamp(state.p)) * (previous.travel - geometry.travel);
          warpVelocity += -state.v * (previous.travel - geometry.travel);
        } else if (track.kind === 'row') {
          warp += (1 - state.p) * (previous.rowShift - geometry.rowShift);
          warpVelocity += -state.v * (previous.rowShift - geometry.rowShift);
        }
      }
      track.animation?.cancel();
      track.animation = null;
      track.segment = null;
      track.p = state.p;
      const distance = Math.abs(target - state.p);
      if (distance < .00001 && Math.abs(state.v) < .00001 && Math.abs(warp) < .01) {
        track.p = target;
        Object.assign(track.element.style, track.render(target, 0));
        return;
      }
      const duration = rebase && oldSegment
        ? Math.max(180, oldSegment.duration - Math.max(0, oldTime - oldSegment.delay))
        : Math.max(180, track.length * distance);
      const delay = rebase && oldSegment ? Math.max(0, oldSegment.delay - oldTime)
        : next && distance > .99 && track.row !== null ? (geometry.mobile ? 100 : 0) + track.row * 30 : 0;
      const segment = { start: state.p, velocity: state.v, target, duration, delay, warp, warpVelocity };
      const total = duration + delay;
      const frames = [{ ...track.render(state.p, warp), offset: 0 }];
      if (delay) frames.push({ ...track.render(state.p, warp), offset: delay / total });
      // <= 10 ms finite samples preserve the source curve/velocity correction;
      // WAAPI owns playback and completion, including when the tab is hidden.
      const count = Math.ceil(duration / 10);
      for (let step = 1; step <= count; step++) {
        const time = delay + duration * step / count;
        const value = segmentAt(segment, time);
        frames.push({ ...track.render(value.p, value.w), offset: time / total });
      }
      const animation = track.element.animate(frames, { duration: total, fill: 'both', easing: 'linear' });
      track.segment = segment;
      track.animation = animation;
      promises.push(animation.finished);
    });
    if (!promises.length) finish(next, epoch);
    else Promise.all(promises).then(() => finish(next, epoch), () => {});
  }

  function retargetGeometry() {
    if (!dialog.open || disposed) return;
    positionControl();
    if (reduced() || phase === 'open') {
      geometry = measureGeometry();
      settle();
    } else {
      const epoch = ++motionEpoch;
      try { runTracks(wanted, epoch, true); } catch { settle(); }
    }
  }

  function closeModal() {
    root.append(status);
    if (!dialog.open) { restoreControl(); return; }
    closeInternally = true;
    dialog.close();
    closeInternally = false;
    restoreControl();
  }

  function finish(target, epoch) {
    if (disposed || epoch !== motionEpoch || wanted !== target) return;
    phase = target ? 'open' : 'closed';
    root.dataset.state = phase;
    if (!target) {
      closeModal();
      // Native modal teardown releases all UA-owned inertness before focus.
      if (!wanted) focus(returnFocus?.isConnected ? returnFocus : trigger);
    }
  }

  function settle() {
    const epoch = ++motionEpoch;
    geometry ||= measureGeometry();
    buildTracks();
    for (const track of tracks) {
      track.animation?.cancel();
      track.animation = null;
      track.segment = null;
      track.p = wanted ? 1 : 0;
      Object.assign(track.element.style, track.render(track.p, 0));
    }
    finish(wanted, epoch);
  }

  function setWanted(next) {
    if (disposed || wanted === next) return;
    wanted = next;
    const epoch = ++motionEpoch;
    error = null;
    status.textContent = '';
    trigger.removeAttribute('aria-describedby');
    trigger.setAttribute('aria-expanded', String(next));
    trigger.setAttribute('aria-label', next ? '关闭空间菜单' : '打开空间菜单');
    phase = next ? 'opening' : 'closing';
    root.dataset.state = phase;
    if (next && !dialog.open) {
      returnFocus = doc.activeElement === doc.body ? trigger : doc.activeElement;
      hostState = host.getState();
      updateLinks();
      // The native modal makes sibling live regions inert. Keep one status node
      // in the active accessibility tree, including during interrupted closes.
      panelContent.append(status);
      dockControl();
      dialog.showModal();
      geometry = measureGeometry();
      focus(trigger);
    }
    buildTracks();
    if (reduced() || typeof panel.animate !== 'function') { settle(); return; }
    try { runTracks(next, epoch); } catch {
      // An incomplete WAAPI implementation remains fully usable without motion.
      settle();
    }
  }

  function scrollBoundary(delta) {
    const limit = Math.max(0, panelContent.scrollHeight - panelContent.clientHeight);
    return limit <= 1 || (delta < 0 && panelContent.scrollTop <= 0)
      || (delta > 0 && panelContent.scrollTop >= limit - 1);
  }

  function keydown(event) {
    if (!dialog.open || disposed || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (wanted) setWanted(false);
      else settle();
    } else if (event.key === 'Tab') {
      // Window capture precedes the accepted chat's document-capture trap.
      event.preventDefault();
      event.stopImmediatePropagation();
      const nodes = [trigger, ...links];
      const index = nodes.indexOf(doc.activeElement);
      const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      // Reveal the next control inside the menu's own native scroll container.
      nodes[next].focus();
    } else if (!event.altKey && !event.ctrlKey && !event.metaKey
      && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      // Keep native Space activation on buttons. Other scroll keys belong to
      // this menu even when its content is too short to overflow.
      if (event.key === ' ' && event.target.closest?.('button')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const page = Math.max(44, panelContent.clientHeight * .85);
      const limit = Math.max(0, panelContent.scrollHeight - panelContent.clientHeight);
      const delta = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page, ' ': event.shiftKey ? -page : page }[event.key] || 0;
      panelContent.scrollTop = event.key === 'Home' ? 0 : event.key === 'End' ? limit
        : Math.max(0, Math.min(limit, panelContent.scrollTop + delta));
    }
  }

  function navigationError(epoch) {
    if (disposed || epoch !== navigationEpoch) return;
    error = '栏目暂时没有打开，请再试一次。';
    status.textContent = error;
    trigger.setAttribute('aria-describedby', status.id);
  }

  async function navigate(event) {
    const link = event.target.closest('[data-menu-category]');
    if (!link || !root.contains(link) || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const next = link.dataset.menuCategory;
    if (disposed || pendingCategory === next) return;
    const epoch = ++navigationEpoch;
    pendingCategory = next;
    setWanted(false);
    updateLinks();
    try {
      if (await host.navigate(next) === false) navigationError(epoch);
    } catch {
      navigationError(epoch);
    } finally {
      if (!disposed && epoch === navigationEpoch) {
        pendingCategory = null;
        hostState = host.getState();
        updateLinks();
      }
    }
  }

  on(trigger, 'click', () => setWanted(!wanted));
  on(dialog, 'click', navigate);
  on(dialog, 'wheel', event => {
    if (event.ctrlKey) return; // Browser zoom / trackpad pinch is not page scroll.
    if (!panelContent.contains(event.target) || scrollBoundary(event.deltaY)) event.preventDefault();
  }, { passive: false });
  on(dialog, 'touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, { passive: true });
  on(dialog, 'touchmove', event => {
    // Preserve pinch zoom and native interior scrolling; only stop chaining at
    // the menu boundary. This does not install a document/body scroll lock.
    if (event.touches.length !== 1 || touchY === null) return;
    const y = event.touches[0].clientY, delta = touchY - y;
    touchY = y;
    if (event.cancelable && (!panelContent.contains(event.target) || scrollBoundary(delta))) event.preventDefault();
  }, { passive: false });
  on(dialog, 'touchend', () => { touchY = null; });
  on(dialog, 'touchcancel', () => { touchY = null; });
  on(dialog, 'pointerdown', event => { pointerOnShade = event.target === shade; });
  on(shade, 'click', () => {
    if (pointerOnShade !== false) setWanted(false);
    pointerOnShade = null;
  });
  on(dialog, 'cancel', event => { event.preventDefault(); setWanted(false); });
  on(dialog, 'close', () => {
    // The close event is queued; a newly reopened dialog must not be dismissed.
    if (closeInternally || dialog.open || disposed || phase === 'closed') return;
    wanted = false;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', '打开空间菜单');
    settle();
  });
  on(win, 'keydown', keydown, true);
  on(win, 'resize', retargetGeometry);
  if (win.visualViewport) {
    on(win.visualViewport, 'resize', retargetGeometry);
    on(win.visualViewport, 'scroll', () => { if (dialog.open) positionControl(); });
  }
  on(win, 'pagehide', event => { if (event.persisted && dialog.open) { wanted = false; trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-label', '打开空间菜单'); settle(); } });
  if (motionQuery?.addEventListener) on(motionQuery, 'change', () => { if (reduced()) settle(); });
  const unsubscribe = host.subscribe(state => {
    if (disposed) return;
    hostState = state || host.getState();
    updateLinks();
    if (reduced() && (phase === 'opening' || phase === 'closing')) settle();
  });
  updateLinks();

  const api = Object.freeze({
    getState: () => ({ phase, open: wanted, modal: dialog.open, category: category(), reduced: reduced(), pendingCategory, error, disposed }),
    dispose() {
      if (disposed) return;
      disposed = true;
      motionEpoch++;
      navigationEpoch++;
      wanted = false;
      phase = 'closed';
      cleanups.splice(0).forEach(cleanup => cleanup());
      if (typeof unsubscribe === 'function') unsubscribe();
      for (const track of tracks) track.animation?.cancel();
      tracks.length = 0;
      closeModal();
      root.remove();
      mounts.delete(container);
    },
  });
  mounts.set(container, api);
  return api;
}
