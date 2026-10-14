/* Keyboard policy is native layout, separate from the approved shell motion.
 * Keep the normal top edge; give up only the space that the measured chrome
 * and a reading band actually need. There is no keyboard-open 64 -> 0 switch.
 */
export function chatHeaderReservation({ height, header, head, composer, edge = 8, bottom = edge, reading = 48 }) {
  return Math.min(header, Math.max(edge, height - bottom - head - composer - reading));
}

/* WebKit can expose intermediate geometry before the keyboard finishes.
 * Sample for one bounded focus transition; never move focus, cancel a gesture,
 * or repeatedly scroll the document. Viewport events still commit immediately.
 * The 50 ms / 600 ms observation bounds follow React Aria's timing guidance;
 * this controller is local to this composer, not a global focus override.
 */
export function createKeyboardViewportObserver(win, sample, settled) {
  let timer = null, deadline = 0;
  const now = () => win.performance.now();
  function stop() { if (timer !== null) win.clearTimeout(timer); timer = null; deadline = 0; }
  function tick() {
    timer = null;
    sample();
    if (now() >= deadline) { deadline = 0; settled(); }
    else timer = win.setTimeout(tick, Math.min(50, deadline - now()));
  }
  return {
    get pending() { return deadline > 0; },
    start() { stop(); deadline = now() + 600; sample(); timer = win.setTimeout(tick, 50); },
    stop
  };
}
