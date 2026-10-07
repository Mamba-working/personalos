export type Pose = { x: number; y: number; clip: number };
export type FrameClock = { now(): number; request(callback: (time: number) => void): number; cancel(id: number): void; hidden(): boolean; subscribeVisibility(callback: () => void): () => void };
const interpolate = (from: Pose, to: Pose, progress: number): Pose => ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress, clip: from.clip + (to.clip - from.clip) * progress });
/** Owns exactly transform and clipPath on one registered frame. Never owns content or scroll. */
export function createContentFrame(node: Pick<HTMLElement, 'style'>, clock: FrameClock, settled: (open: boolean) => void) {
  let pose: Pose = { x: 0, y: 0, clip: 0 }, from = pose, target = pose;
  let frame = 0, last: number | null = null, elapsed = 0, duration = 0, epoch = 0, open = false, active = false, disposed = false;
  function paint() { node.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0)`; node.style.clipPath = `inset(0 0 ${Math.max(0, pose.clip)}px 0 round 24px)`; }
  function cancel() { if (frame) clock.cancel(frame); frame = 0; last = null; }
  function schedule() { if (!disposed && active && !frame && !clock.hidden()) { if (last === null) last = clock.now(); const scheduledEpoch = epoch; frame = clock.request(time => { if (!disposed && scheduledEpoch === epoch) tick(time); }); } }
  function finish() { active = false; cancel(); pose = { ...target }; paint(); settled(open); }
  function tick(time: number) {
    frame = 0;
    if (disposed || !active || clock.hidden()) { last = null; return; }
    const ownEpoch = epoch;
    const dt = last !== null && Number.isFinite(time) ? Math.max(0, time - last) : 0;
    if (Number.isFinite(time)) last = Math.max(last ?? time, time);
    elapsed += dt; // All visible elapsed time; no frame-rate-dependent clamp.
    const progress = Math.min(1, elapsed / duration);
    pose = interpolate(from, target, 1 - Math.pow(1 - progress, 3)); paint();
    if (disposed || epoch !== ownEpoch) return;
    if (progress === 1) finish(); else schedule();
  }
  const unsubscribe = clock.subscribeVisibility(() => { cancel(); schedule(); });
  return {
    initialize(value: Pose) { cancel(); active = false; pose = { ...value }; paint(); },
    target(value: Pose, isOpen: boolean, instant = false) {
      if (disposed) return;
      epoch++; cancel(); from = { ...pose }; target = { ...value }; open = isOpen; elapsed = 0; duration = isOpen ? 240 : 180; active = true;
      if (instant) finish(); else schedule();
    },
    clear() { epoch++; active = false; cancel(); node.style.transform = ''; node.style.clipPath = ''; },
    snapshot: () => ({ pose: { ...pose }, active, pendingFrame: !!frame, disposed, elapsed }),
    dispose() { if (disposed) return; disposed = true; epoch++; active = false; cancel(); unsubscribe(); node.style.transform = ''; node.style.clipPath = ''; },
  };
}
export function browserFrameClock(env: Window): FrameClock {
  return { now: () => env.performance.now(), request: callback => env.requestAnimationFrame(callback), cancel: id => env.cancelAnimationFrame(id), hidden: () => env.document.hidden, subscribeVisibility(callback) { env.document.addEventListener('visibilitychange', callback); return () => env.document.removeEventListener('visibilitychange', callback); } };
}
