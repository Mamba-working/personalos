import { clamp, damp, lerp } from '../core/math';
import { PRESETS, type RGB, type WeatherName, type WeatherParams } from './presets';

// Fields with their own (physical) time constants instead of the generic blend.
const SLOW: Partial<Record<keyof WeatherParams, [rise: number, fall: number]>> = {
  groundWet: [0.7, 0.12],
  puddle: [0.5, 0.1],
  snowCover: [0.22, 0.18],
};

function clone(p: WeatherParams): WeatherParams {
  const o = {} as Record<string, unknown>;
  for (const k in p) {
    const v = p[k as keyof WeatherParams];
    o[k] = Array.isArray(v) ? [...v] : v;
  }
  return o as unknown as WeatherParams;
}

export class Weather {
  name: WeatherName;
  p: WeatherParams;
  sunOverride: { az: number; el: number } | null = null;
  cloudOffset: [number, number] = [0, 0];
  time = 0;
  lightning = 0;
  /** Lightning flash position in the cloud layer (world metres) while a bolt is active. */
  bolt: [number, number, number] = [0, 2000, -8000];
  gust = 0;
  onLightning: (() => void) | null = null;
  private nextBolt = 6;
  private boltT = -1;

  constructor(name: WeatherName = 'sunny') {
    this.name = name;
    this.p = clone(PRESETS[name]);
  }

  set(name: WeatherName): boolean {
    if (!PRESETS[name] || name === this.name) return false;
    this.name = name;
    this.sunOverride = null;
    this.nextBolt = 3 + Math.random() * 4;
    return true;
  }

  /** Jump straight to the active preset (deep links / tuning). */
  snap() { this.p = clone(PRESETS[this.name]); }

  update(dt: number) {
    this.time += dt;
    const target = PRESETS[this.name];
    const p = this.p as unknown as Record<string, number | RGB>;
    const rate = 1.15;
    for (const key in target) {
      const k = key as keyof WeatherParams;
      const tv = target[k];
      if (Array.isArray(tv)) {
        const cur = p[k] as RGB;
        for (let i = 0; i < tv.length; i++) cur[i] = damp(cur[i], tv[i], rate, dt);
      } else if (SLOW[k]) {
        const [rise, fall] = SLOW[k]!;
        const cur = p[k] as number;
        p[k] = damp(cur, tv, tv > cur ? rise : fall, dt);
      } else if (k === 'sunEl' || k === 'sunAz') {
        const ov = this.sunOverride ? this.sunOverride[k === 'sunEl' ? 'el' : 'az'] : tv;
        p[k] = damp(p[k] as number, ov, this.sunOverride ? 9 : 0.9, dt);
      } else {
        p[k] = damp(p[k] as number, tv, rate, dt);
      }
    }

    const t = this.time;
    this.gust = clamp(0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3) + 0.25 * Math.sin(t * 1.9 + 0.4), 0, 1.3);
    // clouds drift downwind (metres in the cloud layer)
    const wd = this.windDir();
    const spd = this.p.cloudSpeed * (0.6 + 0.4 * this.gust);
    this.cloudOffset[0] -= wd[0] * spd * dt;
    this.cloudOffset[1] -= wd[1] * spd * dt;

    if (this.name === 'rain' && this.p.cloudCover > 0.8) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.boltT = 0;
        this.nextBolt = 9 + Math.random() * 14;
        this.bolt = [(Math.random() - 0.5) * 14000, this.p.cloudBase + 500 + Math.random() * 900, -5000 - Math.random() * 9000];
        this.onLightning?.();
      }
    }
    if (this.boltT >= 0) {
      this.boltT += dt;
      const b = this.boltT;
      // a distant flash glowing inside the cloud, not a strobe over the whole page
      this.lightning = 0.55 * (Math.exp(-b * 6) * 1.2 + (b > 0.16 ? Math.exp(-(b - 0.16) * 5) * 0.8 : 0));
      if (b > 1.5) { this.boltT = -1; this.lightning = 0; }
    }
  }

  windDir(): [number, number] { return [Math.cos(this.p.windAngle), Math.sin(this.p.windAngle)]; }
  windStrength(): number { return this.p.wind * (0.55 + 0.6 * this.gust); }

  sunDir(p: WeatherParams = this.p): [number, number, number] {
    const { sunEl: el, sunAz: az } = p;
    return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  }

  /** Sun radiance: lower sun → warmer and dimmer (golden hour), on top of the preset tint. */
  sunColor(p: WeatherParams = this.p, golden = true): RGB {
    const low = golden ? clamp(1 - p.sunEl / 0.6, 0, 1) : 0;
    const warm: RGB = [1, lerp(1, 0.86, low), lerp(1, 0.68, low)];
    const fade = clamp(p.sunEl * 6 + 0.25, 0, 1);
    return [0, 1, 2].map((i) => p.sunColor[i] * warm[i] * p.sunI * fade) as RGB;
  }
}
