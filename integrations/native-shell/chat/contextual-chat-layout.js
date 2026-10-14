/** Native layout only. No animation clock, actor renderer, focus or generation. */
export const CHAT_MODES = Object.freeze({
  empty: Object.freeze({ mode: 'empty', preferredHeight: 348, minimumScroll: 64 }),
  reader: Object.freeze({ mode: 'reader', preferredHeight: 560, minimumScroll: 112 })
});

// Production renderer's authored 64px nominal-anchor envelope. This is a
// source-derived fallback, NOT a measured painted silhouette. The integration
// owner passes renderer-derived gutters normalized to a 64px VISIBLE body.
export const CHAT_GUTTERS_AT_64 = Object.freeze({ left: 13.34, right: 26.69, top: 38.05, bottom: 5.44 });
const installedLayouts = new WeakMap();
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), n));
const rect = r => ({ x: finite(r.x ?? r.left), y: finite(r.y ?? r.top), w: Math.max(0, finite(r.w ?? r.width)), h: Math.max(0, finite(r.h ?? r.height)) });
const expand = (r, g) => ({ x: r.x - g.left, y: r.y - g.top, w: r.w + g.left + g.right, h: r.h + g.top + g.bottom });
const intersect = (a, b) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
};
const contains = (a, b) => b.x >= a.x - .01 && b.y >= a.y - .01 && b.x + b.w <= a.x + a.w + .01 && b.y + b.h <= a.y + a.h + .01;

export function conversationMode({ messageCount = 0, hasMessages = false } = {}) {
  return hasMessages || messageCount > 0 ? 'reader' : 'empty';
}

/** Both returned rects and DOM getBoundingClientRect() use layout CSS pixels.
 * visualViewport width/height are already CSS pixels; never multiply by scale.
 * Read this at intent / resize / visualViewport scroll, never each frame. */
export function readChatViewport(win = window) {
  const v = win.visualViewport;
  return { x: finite(v?.offsetLeft), y: finite(v?.offsetTop), w: finite(v?.width, win.innerWidth), h: finite(v?.height, win.innerHeight) };
}

/** Probe has no text and no accessibility tree presence. The install API owns it. */
export function readChatSafeInsets(probe) {
  const css = probe.ownerDocument.defaultView.getComputedStyle(probe);
  return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side, parseFloat(css.getPropertyValue('padding-' + side)) || 0]));
}

/**
 * Pick fixed final layout and a concurrent local actor settle together.
 * This does NOT move either actor or panel. The core projects the descriptor.
 * sourceBody is the actual presented visible body (not backing canvas bounds).
 * maxLocalSettle defaults to zero. Set 32 only under the approved local-settle
 * policy. Zero-time surface seed always remains sourceBody, with no preflight.
 * Desktop side placement is opt-in. Pass intent-time containerRect to protect
 * navigation; no DOM reads are performed here. Mobile ignores the option.
 */
export function describeChatLayout({
  mode = 'empty', viewport, safeInsets = {}, sourceBody, containerRect = null,
  mobile = false, metrics = {}, bodySize = 64, guttersAt64 = CHAT_GUTTERS_AT_64,
  maxLocalSettle = 0, preferredSide = null, previousSide = null, desktopSidePlacement = false,
  edge = mobile ? 12 : 24, gap = 8, maxWidth = 420, keyboardViewport = false
}) {
  const specification = CHAT_MODES[mode];
  if (!specification) throw new TypeError('Chat mode must be empty or reader');
  const view = rect(viewport), source = rect(sourceBody);
  if (!(view.w > 0 && view.h > 0 && source.w > 0 && source.h > 0)) throw new RangeError('Non-empty viewport and source body are required');
  const inset = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(k => [k, Math.max(0, finite(safeInsets[k]))]));
  let available = { x: view.x + inset.left + edge, y: view.y + inset.top + edge,
    w: Math.max(0, view.w - inset.left - inset.right - 2 * edge), h: Math.max(0, view.h - inset.top - inset.bottom - 2 * edge) };
  if (containerRect) available = intersect(available, rect(containerRect));
  if (!(available.w > 0 && available.h > 0)) throw new RangeError('Safe viewport is empty');
  // A native corner actor can legitimately occupy the panel's edge padding.
  // Keep its full props inside the safe viewport/container, not that padding.
  let actorBounds = available;
  if (desktopSidePlacement && !mobile) {
    actorBounds = { x: view.x + inset.left, y: view.y + inset.top,
      w: Math.max(0, view.w - inset.left - inset.right), h: Math.max(0, view.h - inset.top - inset.bottom) };
    if (containerRect) actorBounds = intersect(actorBounds, rect(containerRect));
  }
  const width = Math.min(maxWidth, available.w), center = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
  const diameter = Math.min(source.w, Math.max(1, bodySize));
  const gutters = Object.fromEntries(Object.entries(guttersAt64).map(([k, v]) => [k, Math.max(0, finite(v)) * diameter / 64]));
  const localLimit = Math.min(Math.max(0, maxLocalSettle), diameter / 2);
  const fixedChrome = Math.max(0, finite(metrics.headHeight, 69)) + Math.max(0, finite(metrics.composerHeight, 121));
  const idealHeight = Math.max(fixedChrome + specification.minimumScroll,
    mode === 'empty' ? finite(metrics.emptyHeight, specification.preferredHeight) : finite(metrics.readerHeight, specification.preferredHeight));
  const minimumHeight = fixedChrome + specification.minimumScroll;
  const originalActor = { x: center.x - diameter / 2, y: center.y - diameter / 2, w: diameter, h: diameter };
  // A soft keyboard changes usable layout, not the conversation's scroll owner.
  // Keep the native composer outside the transcript and reserve the actor's
  // complete painted envelope in the same visual viewport as the panel.
  if (mobile && keyboardViewport) {
    const envelopeRatio = 1 + (finite(guttersAt64.top) + finite(guttersAt64.bottom)) / 64;
    const headerHeight = Math.max(48, finite(metrics.headHeight, 64));
    const actorSize = Math.min(diameter, 32, Math.max(20, (headerHeight - 8) / envelopeRatio));
    const keyboardGutters = Object.fromEntries(Object.entries(guttersAt64).map(([k, v]) => [k, Math.max(0, finite(v)) * actorSize / 64]));
    const actor = { x: available.x + width - 60 - keyboardGutters.right - actorSize,
      y: available.y + (headerHeight - actorSize * envelopeRatio) / 2 + keyboardGutters.top, w: actorSize, h: actorSize };
    const envelope = expand(actor, keyboardGutters);
    const target = { x: available.x, y: available.y, w: width, h: Math.max(1, available.h) };
    const readableHeight = Math.max(0, target.h - fixedChrome);
    return { version: 1, mode, seed: source, viewport: view, safeBounds: available,
      target, plane: { w: target.w, h: target.h }, actorTarget: actor, propSafeBounds: envelope,
      placement: 'header', scrollMode: 'transcript', minimumHeight, idealHeight, fixedChrome, keyboardViewport: true,
      constraints: { compressed: target.h < idealHeight, insufficientReadingRoom: readableHeight < 24,
        actorOutsideViewport: !contains(available, envelope), sourceOutsideViewport: !contains(view, source),
        zeroRoom: target.h < 1, readableHeight, localSettle: { x: actor.x - originalActor.x, y: actor.y - originalActor.y } } };
  }
  const preferred = preferredSide || (center.y > available.y + available.h / 2 ? 'above' : 'below');

  function candidate(side) {
    const actor = { ...originalActor };
    let envelope = expand(actor, gutters);
    // Move only far enough to gain the desired native reading height, at most
    // half a target body. Viewport constraints may reduce this settle to zero.
    if (side === 'above') {
      const need = Math.max(0, idealHeight - (envelope.y - gap - available.y));
      actor.y += Math.min(localLimit, need, Math.max(0, available.y + available.h - envelope.y - envelope.h));
    } else if (side === 'below') {
      const need = Math.max(0, idealHeight - (available.y + available.h - envelope.y - envelope.h - gap));
      actor.y -= Math.min(localLimit, need, Math.max(0, envelope.y - available.y));
    }
    envelope = expand(actor, gutters);
    const top = side === 'above' ? available.y : clamp(envelope.y + envelope.h + gap, available.y, available.y + available.h);
    const bottom = side === 'above' ? clamp(envelope.y - gap, available.y, available.y + available.h) : available.y + available.h;
    const space = Math.max(0, bottom - top), height = Math.min(idealHeight, space);
    const target = { x: clamp(center.x - width / 2, available.x, available.x + available.w - width),
      y: side === 'above' ? bottom - height : top, w: width, h: height };
    return { side, actor, envelope, target, space, readableHeight: Math.max(0, height - fixedChrome),
      fullContent: height >= idealHeight - .1, usable: height >= minimumHeight - .1,
      localDistance: Math.hypot(actor.x - originalActor.x, actor.y - originalActor.y) };
  }
  const candidates = [candidate('above'), candidate('below')];
  function sideCandidate(side) {
    const actor = { ...originalActor };
    let envelope = expand(actor, gutters);
    const left = side === 'left';
    const freeWidth = left ? envelope.x - gap - available.x : available.x + available.w - envelope.x - envelope.w - gap;
    const oppositeRoom = left ? actorBounds.x + actorBounds.w - envelope.x - envelope.w : envelope.x - actorBounds.x;
    actor.x += (left ? 1 : -1) * Math.min(localLimit, 32, Math.max(0, width - freeWidth), Math.max(0, oppositeRoom));
    envelope = expand(actor, gutters);
    const horizontalSpace = left ? envelope.x - gap - available.x : available.x + available.w - envelope.x - envelope.w - gap;
    const readerMinimum = fixedChrome + CHAT_MODES.reader.minimumScroll;
    // Never make a thin reader to force a side. Even the first empty open
    // must meet the reader's native minimum so a send need not switch sides.
    if (horizontalSpace < width || available.h < readerMinimum || !contains(actorBounds, envelope)) return null;
    const readerHeight = Math.max(readerMinimum, finite(metrics.readerHeight, CHAT_MODES.reader.preferredHeight));
    const reservedHeight = Math.min(Math.max(idealHeight, readerHeight), available.h);
    const height = Math.min(idealHeight, available.h);
    const reservedTop = clamp(center.y - reservedHeight / 2, available.y, available.y + available.h - reservedHeight);
    const bottomAnchored = center.y > available.y + available.h / 2;
    const target = { x: left ? envelope.x - gap - width : envelope.x + envelope.w + gap,
      y: reservedTop + (bottomAnchored ? reservedHeight - height : 0), w: width, h: height };
    return { side, actor, envelope, target, space: available.h, horizontalSpace,
      readableHeight: Math.max(0, height - fixedChrome), fullContent: height >= idealHeight - .1, usable: height >= minimumHeight - .1,
      localDistance: Math.hypot(actor.x - originalActor.x, actor.y - originalActor.y) };
  }
  const sideCandidates = desktopSidePlacement && !mobile ? ['left', 'right'].map(sideCandidate).filter(Boolean) : [];
  sideCandidates.sort((a, b) => Number(b.side === preferredSide) - Number(a.side === preferredSide) || a.localDistance - b.localDistance || b.horizontalSpace - a.horizontalSpace);
  // Preserve side on remeasurement while it remains usable. A first-open mode
  // change never routes the character elsewhere just to find a bigger panel.
  const stable = previousSide && [...candidates, ...sideCandidates].find(c => c.side === previousSide && c.usable);
  candidates.sort((a, b) => Number(b.fullContent) - Number(a.fullContent) || Number(b.usable) - Number(a.usable) ||
    (a.fullContent && b.fullContent ? Number(b.side === preferred) - Number(a.side === preferred) : b.space - a.space) || a.localDistance - b.localDistance);
  const chosen = stable || sideCandidates[0] || candidates[0];
  const scrollMode = chosen.readableHeight < 64 ? 'reader' : 'transcript';
  return {
    version: 1, mode, seed: source, viewport: view, safeBounds: available,
    ...(desktopSidePlacement && !mobile ? { actorSafeBounds: actorBounds } : {}),
    target: chosen.target, plane: { w: chosen.target.w, h: chosen.target.h },
    actorTarget: chosen.actor, propSafeBounds: chosen.envelope, placement: chosen.side,
    scrollMode, minimumHeight, idealHeight, fixedChrome,
    constraints: {
      compressed: !chosen.fullContent,
      insufficientReadingRoom: !chosen.usable,
      actorOutsideViewport: !contains(actorBounds, chosen.envelope),
      sourceOutsideViewport: !contains(view, source),
      zeroRoom: chosen.target.h < 1,
      readableHeight: chosen.readableHeight,
      localSettle: { x: chosen.actor.x - originalActor.x, y: chosen.actor.y - originalActor.y }
    }
  };
}

/**
 * One-time wiring around existing nodes. Pass the patched content.js for short
 * labels/copy. Existing nodes are moved, never cloned, recreated, or serialized.
 */
export function installContextualChatLayout(panel) {
  if (installedLayouts.has(panel)) return installedLayouts.get(panel);
  const q = selector => panel.querySelector(selector);
  const head = q('.canvas-head'), scroll = q('#canvas-scroll'), intro = q('.canvas-intro'), messages = q('#messages'), composer = q('.canvas-composer'), close = q('#ai-close');
  if (![head, scroll, intro, messages, composer, close, q('#question')].every(Boolean)) throw new TypeError('Original production conversation nodes are required');
  const originalPanelNodes = [...panel.childNodes];
  const originalAttributes = Object.fromEntries(['class', 'style', 'data-chat-layout', 'data-chat-mode', 'data-chat-overflow'].map(name => [name, panel.getAttribute(name)]));
  const introHidden = intro.hidden, body = panel.ownerDocument.body;
  const bodyWasEnabled = body.classList.contains('contextual-chat-enabled');
  const undoCopy = [];
  function replaceText(node, text) {
    if (!node || node.textContent === text) return;
    const original = [...node.childNodes];
    node.replaceChildren(panel.ownerDocument.createTextNode(text));
    undoCopy.push(() => node.replaceChildren(...original));
  }
  function move(node, parent, before = null) {
    if (!node || node.parentNode === parent) return;
    const oldParent = node.parentNode, oldNext = node.nextSibling;
    parent.insertBefore(node, before);
    undoCopy.push(() => oldParent.insertBefore(node, oldNext?.parentNode === oldParent ? oldNext : null));
  }
  function attribute(node, name, value) {
    if (!node) return;
    const original = node.getAttribute(name);
    if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
    undoCopy.push(() => original === null ? node.removeAttribute(name) : node.setAttribute(name, original));
  }
  // One reversible native-copy transaction. Never replace a button, input,
  // message, generated module, or their listeners. Prompt data stays verbatim.
  attribute(intro.querySelector('.eyebrow'), 'hidden', '');
  // Reading interior owns its native copy and footer. It is installed before
  // this layout transaction, so the legacy disclosure must not move/rewrite it.
  if (panel.dataset.chatInterior !== 'reading') {
    replaceText(intro.querySelector('h2'), '有什么想一起聊聊？');
    replaceText(intro.querySelector('p'), '聊聊这里的内容，也可以一起理清一个想法。');
    const labels = ['看项目', '聊调度', '玩 Pulse'];
    intro.querySelectorAll('.prompt-list > button').forEach((button, index) => {
      if (!labels[index]) return;
      const textNodes = [...button.childNodes].filter(n => n.nodeType === 3);
      const oldText = textNodes.map(n => n.textContent);
      textNodes.forEach((node, i) => { node.textContent = i === 0 ? labels[index] : ''; });
      undoCopy.push(() => textNodes.forEach((node, i) => { node.textContent = oldText[i]; }));
    });
    const note = q('.composer-note'), identity = q('.canvas-identity'), disclosure = note?.querySelector(':scope > span');
    if (disclosure) {
      move(disclosure, identity, q('#agent-status'));
      attribute(disclosure, 'class', 'canvas-disclosure');
      replaceText(disclosure, 'AI 与界面模拟');
    }
    if (note) move(q('#canvas-pet'), note, q('#simulate-error'));
  }
  let plane = q('.canvas-reader');
  const createdPlane = !plane;
  if (createdPlane) { plane = panel.ownerDocument.createElement('div'); plane.className = 'canvas-reader'; panel.append(plane); plane.append(head, scroll, composer); }
  panel.classList.add('contextual-chat');
  panel.dataset.chatLayout = 'contextual';
  body.classList.add('contextual-chat-enabled');
  const probe = panel.ownerDocument.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  panel.ownerDocument.body.append(probe);
  const regions = [
    { node: q('.canvas-identity'), role: 'identity' },
    ...Array.from(intro.children).filter(n => !n.matches('.prompt-list')).map(node => ({ node, role: 'intro' })),
    ...Array.from(intro.querySelectorAll('.prompt-list > button')).map(node => ({ node, role: 'prompt' })),
    { node: messages, role: 'messages' },
    { node: composer, role: 'composer' },
    { node: close, role: 'close' }
  ].filter(x => x.node);

  function applyMode(mode) {
    if (!CHAT_MODES[mode]) throw new TypeError('Chat mode must be empty or reader');
    if (panel.dataset.chatMode !== mode) panel.dataset.chatMode = mode;
    // Caller first retreats intro without intrinsic mutations, then commits
    // once at opacity zero, preserving projection in the same owner transaction.
    if (intro.hidden !== (mode === 'reader')) intro.hidden = mode === 'reader';
    return mode;
  }

  function measure({ width, height, mode = panel.dataset.chatMode || 'empty' } = {}) {
    // This is a layout transaction, never a paint/ticker API. The panel must be
    // measurable already. The caller is responsible for hiding/rebasing it.
    if (Number.isFinite(width)) panel.style.width = Math.max(1, width) + 'px';
    if (Number.isFinite(height)) panel.style.height = Math.max(1, height) + 'px';
    if (panel.dataset.chatMode !== mode) applyMode(mode);
    const headHeight = head.getBoundingClientRect().height;
    const composerHeight = composer.getBoundingClientRect().height;
    const css = panel.ownerDocument.defaultView.getComputedStyle(scroll);
    const scrollPadding = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
    return { width: panel.getBoundingClientRect().width, headHeight, composerHeight,
      emptyHeight: intro.hidden ? null : headHeight + composerHeight + intro.getBoundingClientRect().height + scrollPadding,
      scrollPadding, scrollHeight: scroll.clientHeight, safeInsets: readChatSafeInsets(probe),
      measurable: headHeight > 0 && composerHeight > 0,
      regions: regions.filter(x => !x.node.closest('[hidden]')).map(x => ({ ...x, rect: x.node.getBoundingClientRect() })) };
  }

  applyMode(conversationMode({ messageCount: messages.children.length }));
  let disposed = false;
  const api = { plane, head, scroll, intro, messages, composer, close, regions, applyMode, measure,
    readSafeInsets: () => readChatSafeInsets(probe),
    destroy() {
      if (disposed) return;
      disposed = true;
      installedLayouts.delete(panel);
      probe.remove();
      for (const undo of undoCopy.reverse()) undo();
      intro.hidden = introHidden;
      if (createdPlane) { for (const node of originalPanelNodes) panel.insertBefore(node, plane); plane.remove(); }
      for (const [name, value] of Object.entries(originalAttributes)) {
        if (value === null) panel.removeAttribute(name); else panel.setAttribute(name, value);
      }
      if (!bodyWasEnabled) body.classList.remove('contextual-chat-enabled');
      // The core must release its own transform/clip/material ownership first.
      // Live input, transcript, scroll state, and generated nodes stay intact.
    } };
  installedLayouts.set(panel, api);
  return api;
}
