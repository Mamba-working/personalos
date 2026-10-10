// One deterministic simulation timeline; browser frame cadence only feeds this clock.
export const FIXED_STEP = 1 / 120;
export const SUN_DURATION = 12;
export function sampleSun(elapsed) {
  const seconds = Math.min(SUN_DURATION, Math.max(0, elapsed));
  const progress = seconds / SUN_DURATION;
  return { seconds, progress, azimuth: -60 + 120 * progress,
    elevation: 12 + 6 * progress + 30 * Math.sin(Math.PI * progress),
    endpoint: progress === 0 ? 'A' : progress === 1 ? 'B' : null };
}
export class WeatherClock {
  constructor() { this.reset(); }
  reset() { this.ticks = 0; this.accumulator = 0; this.running = true; this.sunTicks = 0; this.sunPlaying = true; this.droppedWallSeconds = 0; }
  advance(delta, onStep) {
    if (!Number.isFinite(delta) || delta < 0) throw new TypeError('Finite nonnegative frame delta required');
    if (!this.running) return 0;
    // A stalled/background tab must not create an unbounded catch-up burst.
    const accepted = Math.min(delta, .25); this.droppedWallSeconds += delta - accepted;
    this.accumulator += accepted; let count = 0;
    while (this.accumulator + 1e-10 >= FIXED_STEP && count < 30) {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP); this.ticks++;
      if (this.sunPlaying) { this.sunTicks = Math.min(1440, this.sunTicks + 1); if (this.sunTicks === 1440) this.sunPlaying = false; }
      onStep(FIXED_STEP, this.ticks * FIXED_STEP); count++;
    }
    return count;
  }
  selectSun(key) { if (!['A', 'B'].includes(key)) throw new Error('Unknown sun endpoint'); this.sunTicks = key === 'A' ? 0 : 1440; this.sunPlaying = false; }
  playSun() { if (this.sunTicks >= 1440) this.sunTicks = 0; this.sunPlaying = true; this.running = true; }
  snapshot() { return { ticks: this.ticks, time: this.ticks * FIXED_STEP, fixedStep: FIXED_STEP, running: this.running,
    sunPlaying: this.sunPlaying, sun: sampleSun(this.sunTicks * FIXED_STEP), droppedWallSeconds: this.droppedWallSeconds }; }
}
