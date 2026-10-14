/* Modal page ownership only. No animation, focus, transcript or touch handlers.
 * overflow:hidden alone is still programmatically scrollable. Freeze the
 * document's native flow while keeping all fixed overlays in viewport space.
 * In particular, never transform body: that would rebase the Ball/chat layers.
 */
export function createChatPageLock(doc = document) {
  const win = doc.defaultView, root = doc.documentElement, body = doc.body;
  let saved = null;
  function preserve(node, properties) {
    const values = properties.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
    return () => values.forEach(([name, value, priority]) => value ? node.style.setProperty(name, value, priority) : node.style.removeProperty(name));
  }
  function syncViewport(view = win.visualViewport) {
    if (!saved) return;
    // Visual viewport panning is distinct from document scrolling on iOS.
    // The background follows the same viewport origin as the fixed chat;
    // positions change only on viewport events, never by scrolling the page.
    body.style.top = ((view?.y ?? view?.offsetTop ?? 0) - saved.viewportY - saved.y) + 'px';
    body.style.left = ((view?.x ?? view?.offsetLeft ?? 0) - saved.viewportX - saved.x) + 'px';
  }
  return {
    get locked() { return !!saved; },
    offset() { return saved?.y ?? doc.scrollingElement.scrollTop; },
    lock() {
      if (saved) return;
      const sticky = [...doc.querySelectorAll('.topbar,.filters')].map(node => ({ node, top: node.getBoundingClientRect().top, restore: preserve(node, ['position', 'top', 'bottom']) }));
      saved = { x: win.scrollX, y: doc.scrollingElement.scrollTop,
        viewportX: win.visualViewport?.offsetLeft || 0, viewportY: win.visualViewport?.offsetTop || 0,
        restoreRoot: preserve(root, ['overflow-x', 'overflow-y', 'height']),
        restoreBody: preserve(body, ['position', 'top', 'left', 'width', 'overflow-x', 'overflow-y']), sticky };
      root.style.overflow = 'hidden'; root.style.height = '100%';
      Object.assign(body.style, { position: 'fixed', width: '100%', overflow: 'clip' });
      // Relative positioning retains each sticky node's original flow space.
      // Freeze its presented position, including a partly scrolled filter row.
      for (const { node } of sticky) Object.assign(node.style, { position: 'relative', top: '0px', bottom: 'auto' });
      syncViewport();
      for (const { node, top } of sticky) node.style.top = (top - node.getBoundingClientRect().top) + 'px';
    },
    syncViewport,
    unlock({restoreScroll=true} = {}) {
      if (!saved) return;
      const previous = saved; saved = null;
      for (const item of previous.sticky) item.restore();
      previous.restoreBody(); previous.restoreRoot();
      const restoreBehavior = preserve(root, ['scroll-behavior']);
      root.style.scrollBehavior = 'auto';
      if (restoreScroll) win.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' });
      restoreBehavior();
    }
  };
}
