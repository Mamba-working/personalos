import { App, DEFAULT_LINES, type CursorKind, type InteractTarget, type SceneAnchors } from '../app/App';
import type { BallEvent } from '../characters/ball/BallBrain';
import type { AssetConfig } from '../config/assets';
import { PRESETS, WEATHERS, type WeatherName, type WeatherParams } from '../weather/presets';
import { DAYLIGHT, NIGHT, type TimeMode } from '../weather/TimeOfDay';
import { configure, deepMerge, type DaylightConfig, type DeepPartial, type NightConfig } from './config';
import { Emitter } from './emitter';

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface WeatherSceneOptions {
  /** Initial weather (default 'sunny'). */
  weather?: WeatherName;
  /** 'auto' follows the local clock (default), or fix 'day' / 'night'. */
  time?: TimeMode;
  /** Moon phase: 'real' (today's, default) or 0 new … 0.5 full … 1. */
  moonPhase?: 'real' | number;

  /** Folder URL that relative asset paths resolve against (e.g. a CDN). Default: the page URL. */
  assetBase?: string;
  /** Override models and textures (deep-merged into the defaults; `null` removes an optional asset). */
  assets?: DeepPartial<AssetConfig>;
  /** Load the photo textures / HDR skies / real terrain / moon maps (default true). */
  environmentAssets?: boolean;
  /** Per-weather look overrides (see WeatherParams). */
  presets?: Partial<Record<WeatherName, Partial<WeatherParams>>>;
  /** Night look and the dusk / dawn hours of the auto clock. */
  night?: Partial<NightConfig>;
  daylight?: Partial<DaylightConfig>;

  /** Rendering quality: 'auto' adapts to the frame time (default). */
  quality?: Quality;
  /** Device pixel ratio cap (default 2) and main-image pixel budget (default 3.6 MP). */
  maxPixelRatio?: number;
  pixelBudget?: number;

  /** Ball's horizontal screen position in NDC (−1 … 1). Default: right third on landscape, centre on portrait. */
  layout?: { ballX?: number; portraitBallX?: number };
  /** Pointer interaction on the canvas (default true); keyboard shortcuts on the window (default false). */
  input?: { pointer?: boolean; keyboard?: boolean };
  /** Set the canvas cursor (grab / grabbing over the ball) (default true). */
  cursor?: boolean;
  /** Ambient sound on start (default false; browsers need a user gesture first). */
  audio?: boolean;
  /** The ball's speech: false silences 'say' events; or replace the weather lines / greeting. */
  speech?: boolean | { lines?: Partial<Record<WeatherName, string[]>>; greeting?: string | null };
  /** Cycle the weathers: true (every 14 s) or the interval in seconds. */
  autoCycle?: boolean | number;
  /** Pause while the container is off-screen or the tab hidden (default true). */
  autoPause?: boolean;
  /** Calmer motion and half the particles; default: the OS setting. */
  reducedMotion?: boolean;
  /** Install the `window.__mb` tuning console (default false). */
  debug?: boolean;
}

export interface WeatherSceneEvents {
  ready: { scene: WeatherScene };
  weatherchange: { weather: WeatherName; previous: WeatherName };
  timechange: { mode: TimeMode };
  /** Day ↔ night flipped (also fires once at start). */
  daynight: { night: boolean };
  say: { text: string; duration: number };
  /** Raw gameplay events of the ball (land, hop, boop, flip, grab, release, shed, say). */
  ball: BallEvent;
  interact: { target: InteractTarget; action: 'click' | 'doubleclick' | 'drag' | 'key'; key?: string; point?: [number, number, number] };
  cursor: { cursor: CursorKind };
  /** Every rendered frame: keep listeners cheap (move overlays with transforms, no framework state). */
  frame: { dt: number; anchors: SceneAnchors };
  pause: { paused: boolean };
  dispose: Record<string, never>;
}

export interface SceneStats { fps: number; frameMs: number; renderScale: number; cloudSteps: number; quality: Quality; width: number; height: number }

export class WeatherSceneError extends Error {
  constructor(readonly code: 'webgl2-unavailable' | 'already-active' | 'disposed' | 'init-failed', message: string) { super(message); this.name = 'WeatherSceneError'; }
}

let active: WeatherScene | null = null;

export function isWebGL2Available(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

/**
 * Create the scene inside `container` (it fills the element; give it a size) and resolve once the
 * first frame is ready. One scene per page at a time: dispose the previous one first.
 */
export async function createWeatherScene(container: HTMLElement, options: WeatherSceneOptions = {}): Promise<WeatherScene> {
  const scene = new WeatherScene(container, options);
  await scene.ready;
  return scene;
}

/** The ball's controls. */
export interface BallControls {
  jump(): void;
  flip(): void;
  /** Show a line in the speech bubble ('say' event). */
  say(text: string, duration?: number): void;
  /** Happy hop with an optional line (e.g. when a card is clicked). */
  cheer(text?: string, duration?: number): void;
  /** Roll by an impulse in metres per second (x right, z toward the viewer). */
  push(x: number, z: number): void;
  wake(): void;
  /** Screen anchors (CSS px relative to the canvas). */
  readonly anchors: SceneAnchors;
}

export class WeatherScene {
  readonly canvas: HTMLCanvasElement;
  readonly ready: Promise<void>;
  readonly ball: BallControls;
  private emitter = new Emitter<WeatherSceneEvents>();
  private app: App;
  private ro: ResizeObserver;
  private io: IntersectionObserver | null = null;
  private userPaused = false;
  private hiddenPaused = false;
  private offscreen = false;
  private disposed = false;
  private quality: Quality = 'auto';
  private speech: boolean;
  private fps = { t: 0, n: 0, value: 0, ms: 0 };
  private onVisibility = () => { this.hiddenPaused = this.autoPause && (document.hidden || this.offscreen); this.syncPause(); };
  private autoPause: boolean;
  private onWindowResize = () => this.resize();
  private baseParticles = 1;

  constructor(readonly container: HTMLElement, options: WeatherSceneOptions = {}) {
    if (!isWebGL2Available()) throw new WeatherSceneError('webgl2-unavailable', 'WebGL2 is not available in this browser');
    if (active && !active.disposed) throw new WeatherSceneError('already-active', 'Only one WeatherScene can run per page: dispose() the previous one first');
    active = this;

    configure({ assets: options.assets, presets: options.presets, night: options.night, daylight: options.daylight, assetBase: options.assetBase });
    if (options.moonPhase !== undefined) NIGHT.moonPhase = options.moonPhase;

    const canvas = this.canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const em = this.emitter;
    const manageCursor = options.cursor ?? true;
    const sp = options.speech ?? true;
    this.speech = sp !== false;
    this.autoPause = options.autoPause ?? true;
    try {
      this.app = new App(canvas, {
        say: (text, duration) => { if (this.speech) em.emit('say', { text, duration }); },
        weather: (weather, previous) => em.emit('weatherchange', { weather, previous }),
        time: (mode) => em.emit('timechange', { mode }),
        daynight: (night) => em.emit('daynight', { night }),
        cursor: (cursor) => { if (manageCursor) canvas.style.cursor = cursor === 'default' ? '' : cursor; em.emit('cursor', { cursor }); },
        ball: (ev) => em.emit('ball', ev),
        interact: (target, action, d) => em.emit('interact', { target, action, key: d?.key, point: d?.point }),
      }, { reducedMotion: options.reducedMotion });
    } catch (err) {
      canvas.remove();
      active = null;
      throw new WeatherSceneError('init-failed', `WeatherScene failed to start: ${(err as Error).message}`);
    }
    const app = this.app;
    this.baseParticles = app.particles.quality;   // 0.5 under reduced motion
    if (typeof sp === 'object' && sp.lines) Object.assign(app.lines, sp.lines);
    if (options.maxPixelRatio) app.maxPixelRatio = options.maxPixelRatio;
    if (options.pixelBudget) app.pixelBudget = options.pixelBudget;
    if (options.layout) { app.rig.ballX = options.layout.ballX ?? null; app.rig.portraitBallX = options.layout.portraitBallX ?? null; }
    app.input.pointer = options.input?.pointer ?? true;
    app.input.keyboard = options.input?.keyboard ?? false;
    if (options.environmentAssets === false) app.envAssets.enabled = false;
    if (options.audio) app.audio.enable(true);
    if (options.autoCycle) app.setAutoCycle(true, typeof options.autoCycle === 'number' ? options.autoCycle : 14);

    const w = options.weather ?? 'sunny';
    if (w !== app.weather.name) { app.weather.set(w); app.weather.snap(); }
    app.clock.setMode(options.time ?? 'auto');
    app.clock.snap();

    app.onFrame = (dt) => this.frame(dt);
    this.ball = this.makeBall();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    // ResizeObserver only reports during rendering steps (not in background tabs): window resizes too
    addEventListener('resize', this.onWindowResize);
    if (this.autoPause) {
      document.addEventListener('visibilitychange', this.onVisibility);
      this.io = new IntersectionObserver((e) => { this.offscreen = !e[e.length - 1].isIntersecting; this.onVisibility(); });
      this.io.observe(container);
    }
    this.resize();
    this.setQuality(options.quality ?? 'auto');

    const greeting = typeof sp === 'object' && sp.greeting !== undefined ? sp.greeting : '嗨～';
    this.ready = (async () => {
      if (options.debug) {
        const { installDebug } = await import('../app/debug');
        installDebug(app);
      }
      await app.start(greeting);
      if (this.disposed) return;
      this.resize();
      em.emit('weatherchange', { weather: app.weather.name, previous: app.weather.name });
      em.emit('timechange', { mode: app.clock.mode });
      this.syncPause();
      em.emit('ready', { scene: this });
    })();
  }

  // ---------------------------------------------------------------- events
  on<K extends keyof WeatherSceneEvents>(type: K, fn: (payload: WeatherSceneEvents[K]) => void) { return this.emitter.on(type, fn); }
  once<K extends keyof WeatherSceneEvents>(type: K, fn: (payload: WeatherSceneEvents[K]) => void) { return this.emitter.once(type, fn); }
  off<K extends keyof WeatherSceneEvents>(type: K, fn: (payload: WeatherSceneEvents[K]) => void) { this.emitter.off(type, fn); }

  // ---------------------------------------------------------------- weather
  /** The weather names, in cycling order. */
  static readonly weathers: readonly WeatherName[] = WEATHERS;
  get weather(): WeatherName { return this.app.weather.name; }
  /** Change the weather (eases over a few seconds unless `instant`). */
  setWeather(name: WeatherName, opts: { instant?: boolean } = {}) {
    if (!WEATHERS.includes(name)) throw new Error(`unknown weather "${name}" (expected ${WEATHERS.join(', ')})`);
    this.app.setWeather(name, opts.instant);
  }
  nextWeather() { this.app.nextWeather(); }
  /** Cycle the weathers every `intervalSeconds` (default 14). */
  setAutoCycle(on: boolean, intervalSeconds?: number) { this.app.setAutoCycle(on, intervalSeconds); }
  get autoCycle() { return this.app.autoCycle; }
  /** Change a weather's look at runtime; the scene eases to it if that weather is showing. */
  updatePreset(name: WeatherName, patch: Partial<WeatherParams>) { deepMerge(PRESETS[name] as never, patch as never); }
  /** A copy of a weather's current parameters. */
  getPreset(name: WeatherName): WeatherParams { return structuredClone(PRESETS[name]); }
  /** Pin the sun (radians: azimuth 0 = straight ahead, + right; elevation above the horizon), or null to release. */
  setSun(dir: { azimuth: number; elevation: number } | null) {
    this.app.weather.sunOverride = dir ? { az: dir.azimuth, el: dir.elevation } : null;
  }

  // ---------------------------------------------------------------- time of day
  get timeMode(): TimeMode { return this.app.clock.mode; }
  get isNight() { return this.app.clock.isNight; }
  /** 0 day … 1 night (eased). */
  get nightAmount() { return this.app.clock.night; }
  /** 'auto' follows the local clock; 'day' / 'night' fix it. `quiet` skips the ball's comment. */
  setTime(mode: TimeMode, opts: { instant?: boolean; quiet?: boolean } = {}) { this.app.setTimeMode(mode, opts); }
  setMoonPhase(phase: 'real' | number) { NIGHT.moonPhase = phase; }
  /** Pin the moon (same convention as setSun), or null for its default place. */
  setMoon(dir: { azimuth: number; elevation: number } | null) {
    this.app.clock.moonOverride = dir ? { az: dir.azimuth, el: dir.elevation } : null;
  }
  updateNight(patch: Partial<NightConfig>) { deepMerge(NIGHT as never, patch as never); }
  updateDaylight(patch: Partial<DaylightConfig>) { deepMerge(DAYLIGHT as never, patch as never); }

  // ---------------------------------------------------------------- interaction, audio, layout
  setInput(opts: { pointer?: boolean; keyboard?: boolean }) {
    if (opts.pointer !== undefined) this.app.input.setPointer(opts.pointer);
    if (opts.keyboard !== undefined) this.app.input.keyboard = opts.keyboard;
  }
  /** Ambient sound and effects (call from a user gesture the first time). */
  setSound(on: boolean) { this.app.audio.enable(on); }
  get sound() { return this.app.audio.enabled; }
  setSpeech(on: boolean) { this.speech = on; }
  /** Weather lines the ball says (merged into the current ones). */
  setLines(lines: Partial<Record<WeatherName, string[]>>) { Object.assign(this.app.lines, lines); }
  static readonly defaultLines = DEFAULT_LINES;
  setLayout(opts: { ballX?: number | null; portraitBallX?: number | null }) {
    if (opts.ballX !== undefined) this.app.rig.ballX = opts.ballX;
    if (opts.portraitBallX !== undefined) this.app.rig.portraitBallX = opts.portraitBallX;
    this.resize();
  }
  /** Re-measure the container (automatic through a ResizeObserver; call after unusual layout changes). */
  resize() {
    if (this.disposed) return;
    const r = this.container.getBoundingClientRect();
    this.app.layout(r.width || 1, r.height || 1);
  }

  // ---------------------------------------------------------------- quality & stats
  setQuality(q: Quality) {
    const app = this.app;
    this.quality = q;
    if (q === 'auto') { app.unlockScale(); app.sky.steps = 64; app.particles.quality = this.baseParticles; return; }
    const t = { low: [0.6, 28, 0.5], medium: [0.8, 44, 0.75], high: [1, 64, 1] }[q];
    app.sky.steps = t[1];
    app.particles.quality = Math.min(t[2], this.baseParticles);
    app.lockScale(t[0]);
  }
  getStats(): SceneStats {
    const a = this.app;
    return { fps: this.fps.value, frameMs: this.fps.ms, renderScale: a.renderScale, cloudSteps: a.sky.steps, quality: this.quality, width: a.renderer.domElement.width, height: a.renderer.domElement.height };
  }

  /** Render a frame now and encode it (PNG by default). */
  capture(type = 'image/png', quality?: number): Promise<Blob> {
    this.app.step(1e-3);
    return new Promise((res, rej) => this.canvas.toBlob((b) => (b ? res(b) : rej(new Error('capture failed'))), type, quality));
  }

  // ---------------------------------------------------------------- lifecycle
  get paused() { return this.userPaused || this.hiddenPaused; }
  pause() { this.userPaused = true; this.syncPause(); }
  resume() { this.userPaused = false; this.syncPause(); }
  private syncPause() {
    if (this.disposed) return;
    const want = this.paused;
    if (want === !this.app.isRunning) return;
    if (want) this.app.pause(); else this.app.resume();
    if (this.app.isRunning === !want) this.emitter.emit('pause', { paused: want });
  }

  /** Stop everything and free the GPU context; removes the canvas. Safe to call twice. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ro.disconnect();
    this.io?.disconnect();
    removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.app.dispose();
    this.canvas.remove();
    if (active === this) active = null;
    this.emitter.emit('dispose', {});
    this.emitter.clear();
  }
  get isDisposed() { return this.disposed; }

  /** Escape hatch for tooling: the internal engine. Not a stable API. */
  get internals() { return { app: this.app }; }

  // ---------------------------------------------------------------- internals
  private frame(dt: number) {
    const f = this.fps;
    f.t += dt; f.n++;
    if (f.t >= 0.5) { f.value = Math.round(f.n / f.t); f.ms = +(1000 * f.t / f.n).toFixed(1); f.t = 0; f.n = 0; }
    if (this.emitter.has('frame')) this.emitter.emit('frame', { dt, anchors: this.app.anchors });
  }

  private makeBall(): BallControls {
    const app = this.app, b = app.ball;
    return {
      jump: () => { b.wake(); b.jump(); },
      flip: () => { b.wake(); b.flip(); },
      say: (text, duration = 1.8) => b.say(text, duration),
      cheer: (text, duration = 2) => { b.wake(); b.timers.happy = 1.2; b.jump(); if (text) b.say(text, duration); },
      push: (x, z) => { b.wake(); b.push(x, z); },
      wake: () => b.wake(),
      get anchors() { return app.anchors; },
    };
  }
}
