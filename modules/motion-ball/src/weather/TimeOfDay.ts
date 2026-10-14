import { clamp, damp, lerp } from '../core/math';
import type { RGB, WeatherParams } from './presets';

export type TimeMode = 'auto' | 'day' | 'night';

/** Local clock hours of the transitions (auto mode): dusk 17:30 → 19:15, dawn 4:45 → 6:30. */
export const DAYLIGHT = { duskStart: 17.5, duskEnd: 19.25, dawnStart: 4.75, dawnEnd: 6.5 };

/**
 * The night look, applied on top of whatever the weather is. Sky and fog colours are scaled down
 * and shifted to blue (so a rainy night stays greyer than a clear one), the sun hands over to the
 * moon at the darkest point of the transition, and the camera opens up a little.
 */
export const NIGHT = {
  // the moon hangs in frame, upper right above the ranges (azimuth / elevation in radians)
  moonAz: 0.36, moonEl: 0.21,
  moonColor: [0.62, 0.72, 0.95] as RGB,
  moonI: 0.32,                       // moonlight at full moon under a clear sky
  // 'real' follows today's phase (never thinner than a visible crescent) or fix it: 0 new … 0.5 full
  moonPhase: 'real' as 'real' | number,
  skyScale: 0.035, skyTint: [0.55, 0.72, 1.35] as RGB, skyFloor: [0.012, 0.018, 0.04] as RGB,
  cloudLight: 0.025,                 // share of the daytime light the clouds receive from the moon
  exposure: 1.7,                     // × the weather's exposure
  key: [0.42, 0.5, 0.7] as RGB,      // × the weather's ball key: cool, dim moonlight on the ball
  stars: 1,
};

/** Warm horizon and light around sunset / sunrise (scaled by the clear share of the sky). */
const TWILIGHT_HORIZON: RGB = [0.42, 0.16, 0.05];
const TWILIGHT_SUN: RGB = [1.0, 0.62, 0.38];

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);   // a known new moon

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** 0 in daylight … 1 at night for a local clock time in hours. */
export function nightAt(hours: number): number {
  const D = DAYLIGHT;
  if (hours >= 12) return smooth(D.duskStart, D.duskEnd, hours);
  return 1 - smooth(D.dawnStart, D.dawnEnd, hours);
}

/** Fraction of the synodic month: 0 new, 0.5 full. */
export function moonPhaseAt(date: Date): number {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  return ((days / SYNODIC) % 1 + 1) % 1;
}

/**
 * Time of day: follows the local clock (auto) or a fixed day / night, eased so switching takes a
 * few seconds and passes through a warm twilight. `apply()` turns the blended weather into the
 * values actually rendered (sky, light, clouds, grade), so every weather works by day and by night.
 */
export class TimeOfDay {
  mode: TimeMode = 'auto';
  /** 0 day … 1 night, eased. */
  night = 0;
  /** Peaks mid-transition: drives the warm sunset / sunrise colours. */
  twilight = 0;
  /** Moon phase as a fraction of the month (0 new, 0.5 full) and its lit fraction. */
  phase = 0.5;
  illum = 1;
  /** Dragging the sky at night moves the moon. */
  moonOverride: { az: number; el: number } | null = null;
  private moonAz = NIGHT.moonAz;
  private moonEl = NIGHT.moonEl;
  private out: WeatherParams | null = null;

  constructor(private now: () => Date = () => new Date()) {}

  setMode(m: TimeMode) { this.mode = m; this.moonOverride = null; }

  /** Jump to the target without easing (deep links, tests). */
  snap() { this.night = this.target(); this.twilight = 0; }

  get isNight() { return this.night > 0.5; }

  private target(): number {
    if (this.mode === 'day') return 0;
    if (this.mode === 'night') return 1;
    const d = this.now();
    return nightAt(d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600);
  }

  update(dt: number) {
    this.night = damp(this.night, this.target(), 0.7, dt);
    if (Math.abs(this.night - Math.round(this.night)) < 1e-3) this.night = Math.round(this.night);
    this.twilight = Math.sin(Math.PI * clamp(this.night, 0, 1));
    const p = NIGHT.moonPhase === 'real' ? moonPhaseAt(this.now()) : NIGHT.moonPhase;
    // never thinner than a crescent that reads (a new moon would just look missing)
    const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
    const minLit = 0.14;
    if (lit < minLit) {
      const waxing = p < 0.5;
      const q = Math.acos(1 - 2 * minLit) / (2 * Math.PI);
      this.phase = waxing ? q : 1 - q;
    } else this.phase = p;
    this.illum = (1 - Math.cos(2 * Math.PI * this.phase)) / 2;
    const o = this.moonOverride;
    this.moonAz = damp(this.moonAz, o ? o.az : NIGHT.moonAz, o ? 9 : 0.9, dt);
    this.moonEl = damp(this.moonEl, o ? o.el : NIGHT.moonEl, o ? 9 : 0.9, dt);
  }

  /** The weather as rendered at this time of day (a reused object: do not keep it). */
  apply(W: WeatherParams): WeatherParams {
    const n = this.night;
    const o = (this.out ??= cloneParams(W));
    copyParams(W, o);
    if (n <= 0 && this.twilight <= 0) return o;
    const tw = this.twilight * (1 - 0.7 * W.cloudCover);
    const N = NIGHT;
    const sky = (src: RGB, dst: RGB, warm: number) => {
      for (let i = 0; i < 3; i++) {
        const night = src[i] * N.skyScale * N.skyTint[i] + N.skyFloor[i];
        dst[i] = lerp(src[i], night, n) + tw * TWILIGHT_HORIZON[i] * warm * (1 - 0.6 * n);
      }
    };
    sky(W.zenith, o.zenith, 0.25);
    sky(W.horizon, o.horizon, 1);
    sky(W.fogCol, o.fogCol, 0.7);
    // the sun sets into the twilight, the moon rises out of it: the hand-over happens at the
    // darkest point, so the light direction can switch without a visible jump
    const sunK = 1 - smooth(0, 0.5, n), moonK = smooth(0.5, 1, n);
    if (n < 0.5) {
      o.sunI = W.sunI * sunK;
      for (let i = 0; i < 3; i++) o.sunColor[i] = lerp(W.sunColor[i], TWILIGHT_SUN[i], clamp(this.twilight * 1.2, 0, 1));
    } else {
      o.sunAz = this.moonAz; o.sunEl = this.moonEl;
      o.sunI = N.moonI * (0.6 + 0.4 * this.illum) * (1 - 0.75 * W.cloudCover) * moonK;
      for (let i = 0; i < 3; i++) o.sunColor[i] = N.moonColor[i];
    }
    o.sunGlow = lerp(W.sunGlow, 0.15, n);   // a soft halo; the moon sits in frame, so keep it small
    o.exposure = W.exposure * lerp(1, N.exposure, n);
    for (let i = 0; i < 3; i++) {
      o.key[i] = W.key[i] * lerp(1, N.key[i], n);
      o.fill[i] = W.fill[i] * (1 - 0.6 * n);
      o.lift[i] = W.lift[i] + n * [0.0, 0.004, 0.012][i];
    }
    o.motes = W.motes * (1 - n);
    o.rays = W.rays * (1 - n);
    o.streak = W.streak * (1 - n);
    o.sat = W.sat * lerp(1, 0.88, n);
    o.vignette = W.vignette + 0.12 * n;
    o.halation = W.halation + 0.06 * n;
    return o;
  }

  /** Clouds receive only a little light from the moon. */
  cloudLight(): number { return lerp(1, NIGHT.cloudLight, this.night); }

  /** Star visibility (clear sky only). */
  stars(W: WeatherParams): number { return NIGHT.stars * smooth(0.55, 0.95, this.night) * clamp(1 - W.cloudCover * 1.15, 0, 1) * (1 - W.mist); }

  /** Moon disc visibility in the sky dome. */
  moonDisc(): number { return smooth(0.5, 0.9, this.night); }
}

function cloneParams(p: WeatherParams): WeatherParams {
  const o = {} as Record<string, unknown>;
  for (const k in p) {
    const v = p[k as keyof WeatherParams];
    o[k] = Array.isArray(v) ? [...v] : v;
  }
  return o as unknown as WeatherParams;
}

function copyParams(src: WeatherParams, dst: WeatherParams) {
  const s = src as unknown as Record<string, number | RGB>, d = dst as unknown as Record<string, number | RGB>;
  for (const k in s) {
    const v = s[k];
    if (Array.isArray(v)) { const t = d[k] as RGB; t[0] = v[0]; t[1] = v[1]; t[2] = v[2]; } else d[k] = v;
  }
}
