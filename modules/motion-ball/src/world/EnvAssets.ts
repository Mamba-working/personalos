import {
  DataTexture, DataUtils, HalfFloatType, LinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace,
  TextureLoader, type Texture, type Vector3, type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { EnvironmentAssets, TextureSet } from '../config/assets';
import { damp } from '../core/math';
import type { WeatherName } from '../weather/presets';
import { groundUniforms } from './Ground';
import { terrainUniforms } from './Terrain';
import { envSkyUniforms, moonUniforms } from './Sky';

/** A loaded sky: the radiance map, its per-elevation mean (to extract structure) and where its sun is. */
interface Hdri { tex: DataTexture; smooth: DataTexture; sunU: number }

type MapKind = 'diff' | 'nor' | 'rough';

/**
 * Loads the photo-scanned ground / rock texture sets and the HDR skies from `ASSETS.environment`
 * and hands them to the shaders. Everything is optional and asynchronous: until a set arrives (or
 * if it fails) the shaders keep their procedural detail, so the page renders from the first frame.
 */
export class EnvAssets {
  enabled = true;
  private loader = new TextureLoader();
  private hdrLoader = new HDRLoader();
  private hdris = new Map<string, Promise<Hdri | null>>();
  private ready = new Map<string, Hdri>();
  private weather: WeatherName = 'sunny';
  private a: Hdri | null = null;
  private b: Hdri | null = null;
  private snowRequested = false;
  private moonRequested = false;
  private readonly status: Record<string, string> = {};
  private neutral: DataTexture;

  constructor(private renderer: WebGLRenderer, private cfg: EnvironmentAssets) {
    // any constant texture is neutral in the shaders (tone / slope are taken relative to the map's mean)
    this.neutral = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
    this.neutral.needsUpdate = true;
    const g = groundUniforms;
    for (const u of [g.uBaseDiff, g.uBaseNor, g.uMicroDiff, g.uMicroNor, g.uMicroRough, g.uSnowDiff, g.uSnowNor, terrainUniforms.uRockDiff, terrainUniforms.uRockNor]) u.value = this.neutral;
    const s = envSkyUniforms;
    for (const u of [s.uHdrA, s.uHdrSmoothA, s.uHdrB, s.uHdrSmoothB]) u.value = this.neutral;
  }

  /** Kick off the loads needed for the first frame's weather. */
  start(weather: WeatherName) {
    this.weather = weather;
    if (!this.enabled) return;
    const { ground, rock } = this.cfg;
    const t = groundUniforms.uTexTile.value;
    if (ground.base) t.x = 1 / ground.base.tile;
    if (ground.micro) t.y = 1 / ground.micro.tile;
    if (ground.snow) t.z = 1 / ground.snow.tile;
    if (ground.base) {
      // the micro layer is optional; the base layer is what switches the ground over
      void Promise.all([
        this.loadSet('ground.base', ground.base, { diff: groundUniforms.uBaseDiff, nor: groundUniforms.uBaseNor }),
        ground.micro ? this.loadSet('ground.micro', ground.micro, { diff: groundUniforms.uMicroDiff, nor: groundUniforms.uMicroNor, rough: groundUniforms.uMicroRough }) : true,
      ]).then(([ok]) => { if (ok) groundUniforms.uGTex.value = 1; });
    }
    if (rock) {
      terrainUniforms.uRockTile.value = 1 / rock.tile;
      void this.loadSet('rock', rock, { diff: terrainUniforms.uRockDiff, nor: terrainUniforms.uRockNor }, 1)
        .then((ok) => { if (ok) terrainUniforms.uRockTex.value = 1; });
    }
    this.setWeather(weather);
  }

  setWeather(name: WeatherName) {
    this.weather = name;
    if (!this.enabled) return;
    const url = this.cfg.hdri[name];
    if (url) void this.hdri(url);
    if (name === 'snow' && !this.snowRequested && this.cfg.ground.snow) {
      this.snowRequested = true;
      void this.loadSet('ground.snow', this.cfg.ground.snow, { diff: groundUniforms.uSnowDiff, nor: groundUniforms.uSnowNor })
        .then((ok) => { if (ok) groundUniforms.uSnowTex.value = 1; });
    }
  }

  /** Cross-fade between skies as the weather changes and keep each one's sun on ours. */
  update(dt: number, sunDir: Vector3) {
    const s = envSkyUniforms;
    const url = this.enabled ? this.cfg.hdri[this.weather] : undefined;
    const want = url ? this.ready.get(url) ?? null : null;
    if (want) {
      if (!this.a) { this.a = want; s.uHdrMix.value = 0; }
      else if (want !== this.a) {
        if (this.b !== want) { this.b = want; s.uHdrMix.value = 0; }
        s.uHdrMix.value = Math.min(1, s.uHdrMix.value + dt / 2.5);
        if (s.uHdrMix.value >= 1) { this.a = want; this.b = null; s.uHdrMix.value = 0; }
      } else if (this.b) { s.uHdrMix.value = Math.max(0, s.uHdrMix.value - dt / 2.5); if (s.uHdrMix.value <= 0) this.b = null; }
    }
    // no sky for this weather (or still loading at startup): the procedural env clouds take over
    s.uHdrOn.value = damp(s.uHdrOn.value, want || (url && this.a) ? 1 : 0, 2, dt);
    const sunAz = Math.atan2(sunDir.z, sunDir.x);
    const rot = (h: Hdri | null) => (h ? 2 * Math.PI * (h.sunU - 0.5) - sunAz : 0);
    s.uHdrA.value = this.a?.tex ?? this.neutral;
    s.uHdrSmoothA.value = this.a?.smooth ?? this.neutral;
    s.uHdrRotA.value = rot(this.a);
    s.uHdrB.value = this.b?.tex ?? this.neutral;
    s.uHdrSmoothB.value = this.b?.smooth ?? this.neutral;
    s.uHdrRotB.value = rot(this.b);
  }

  /** Load the moon maps the first time it is night (idempotent). */
  requestMoon() {
    const cfg = this.cfg.moon;
    if (!this.enabled || !cfg || this.moonRequested) return;
    this.moonRequested = true;
    const load = (url: string, srgb: boolean) => this.loader.loadAsync(url).then((t) => {
      t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;   // edges clamp (the default): no wrap at the limb
      t.needsUpdate = true;
      this.renderer.initTexture(t);
      return t;
    });
    Promise.all([load(cfg.albedo, true), cfg.height ? load(cfg.height, false) : Promise.resolve(null)])
      .then(([a, h]) => {
        moonUniforms.uMoonTex.value = a;
        moonUniforms.uMoonHeight.value = h ?? a;
        moonUniforms.uMoonTexOn.value = 1;
        moonUniforms.uMoonRelief.value = h ? moonUniforms.uMoonRelief.value : 0;
        this.status.moon = 'ok';
      })
      .catch((err) => { console.warn('[assets] moon maps failed to load, keeping the procedural moon', err); this.status.moon = 'failed'; });
  }

  /** What has loaded (for the debug console). */
  describe() {
    return { loads: { ...this.status }, on: { ground: groundUniforms.uGTex.value, rock: terrainUniforms.uRockTex.value, snow: groundUniforms.uSnowTex.value, sky: +envSkyUniforms.uHdrOn.value.toFixed(2) } };
  }

  /** A/B for tuning: show the procedural surfaces (false) or the loaded assets (true), instantly. */
  setActive(on: boolean) {
    this.enabled = on;
    const ok = (k: string) => on && this.status[k] === 'ok';
    groundUniforms.uGTex.value = ok('ground.base') ? 1 : 0;
    groundUniforms.uSnowTex.value = ok('ground.snow') ? 1 : 0;
    terrainUniforms.uRockTex.value = ok('rock') ? 1 : 0;
    envSkyUniforms.uHdrOn.value = on && this.a ? 1 : 0;
    if (on) this.setWeather(this.weather);
  }

  // ---------------------------------------------------------------- loading
  /**
   * Anisotropic filtering keeps the grazing ground crisp but is most of these textures' cost
   * (16× added ~5 ms per frame at 3.6 MP, 4× ~1.5 ms): 4× on the ground, where the ball stands,
   * none on the hazy distant ranges.
   */
  private async loadSet(name: string, set: TextureSet, targets: Partial<Record<MapKind, { value: Texture | null }>>, anisotropy = 4): Promise<boolean> {
    const maps = (Object.keys(targets) as MapKind[]).filter((k) => set[k]);
    try {
      const texs = await Promise.all(maps.map((k) => this.loader.loadAsync(set[k]!)));
      const aniso = Math.min(anisotropy, this.renderer.capabilities.getMaxAnisotropy());
      texs.forEach((tex, i) => {
        tex.wrapS = tex.wrapT = RepeatWrapping;
        tex.anisotropy = aniso;
        tex.colorSpace = maps[i] === 'diff' ? SRGBColorSpace : NoColorSpace;
        tex.needsUpdate = true;
        this.renderer.initTexture(tex);
        targets[maps[i]]!.value = tex;
      });
      this.status[name] = 'ok';
      return maps.length > 0;
    } catch (err) {
      console.warn(`[assets] texture set "${name}" failed to load, keeping the procedural surface`, err);
      this.status[name] = 'failed';
      return false;
    }
  }

  private hdri(url: string): Promise<Hdri | null> {
    let p = this.hdris.get(url);
    if (!p) {
      p = this.hdrLoader.loadAsync(url).then((tex) => {
        const h = analyseSky(tex as DataTexture);
        this.renderer.initTexture(h.tex);
        this.renderer.initTexture(h.smooth);
        this.ready.set(url, h);
        this.status[url] = 'ok';
        return h;
      }).catch((err) => {
        console.warn(`[assets] sky "${url}" failed to load, keeping the procedural environment`, err);
        this.status[url] = 'failed';
        return null;
      });
      this.hdris.set(url, p);
    }
    return p;
  }
}

/**
 * A heavily low-passed copy of the sky (32×16, sun clipped) and the sun's column. Dividing by it
 * keeps the clouds but drops the broad gradients (bright sun side, darker opposite side) that our
 * own sky model already draws, so the photo adds structure without re-lighting the scene.
 */
function analyseSky(tex: DataTexture): Hdri {
  const { width: w, height: h } = tex.image;
  const data = tex.image.data as Uint16Array | Float32Array;
  const ch = data.length / (w * h);
  const half = data instanceof Uint16Array;
  const val = (i: number) => (half ? DataUtils.fromHalfFloat(data[i]) : data[i]);
  const SW = 32, SH = 16, bw = w / SW, bh = h / SH;
  const acc = new Float32Array(SW * SH * 3);
  let best = -1, sunX = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const R = val(i), G = val(i + 1), B = val(i + 2);
      const j = (Math.floor(y / bh) * SW + Math.floor(x / bw)) * 3;
      acc[j] += Math.min(R, 8); acc[j + 1] += Math.min(G, 8); acc[j + 2] += Math.min(B, 8);
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      if (y < h / 2 && L > best) { best = L; sunX = x; }
    }
  }
  const out = new Uint16Array(SW * SH * 4);
  for (let k = 0; k < SW * SH; k++) {
    for (let c = 0; c < 3; c++) out[k * 4 + c] = DataUtils.toHalfFloat(acc[k * 3 + c] / (bw * bh));
    out[k * 4 + 3] = DataUtils.toHalfFloat(1);
  }
  // same row order and flip as the sky texture, so one uv addresses both
  const smooth = new DataTexture(out, SW, SH, RGBAFormat, HalfFloatType);
  smooth.flipY = tex.flipY;
  smooth.wrapS = RepeatWrapping;
  smooth.minFilter = smooth.magFilter = LinearFilter;
  smooth.generateMipmaps = false;
  smooth.needsUpdate = true;
  tex.wrapS = RepeatWrapping;   // the equirect seam at u = 0 / 1
  tex.needsUpdate = true;
  return { tex, smooth, sunU: (sunX + 0.5) / w };
}
