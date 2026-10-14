import { AgXToneMapping, Color, Mesh, NoColorSpace, Scene, TextureLoader, Vector3, VSMShadowMap, WebGLRenderer, type Object3D } from 'three';
import { add, clamp, damp, lerp, scale, type Vec3 } from '../core/math';
import { createNoiseTexture } from '../core/noise';
import { atmos } from '../world/atmosphere';
import { Sky, cloudUniforms, envSkyUniforms, moonUniforms } from '../world/Sky';
import { createGround, createSnowMound, groundUniforms } from '../world/Ground';
import { Terrain, terrainUniforms } from '../world/Terrain';
import { Lighting } from '../world/Lighting';
import { EnvAssets } from '../world/EnvAssets';
import { PlanarReflection, REFLECT_LAYER } from '../world/PlanarReflection';
import { InteractionMap } from '../world/InteractionMap';
import { Weather } from '../weather/Weather';
import { WEATHERS, type WeatherName, type WeatherParams } from '../weather/presets';
import { TimeOfDay, type TimeMode } from '../weather/TimeOfDay';
import { ParticleSystem } from '../weather/ParticleSystem';
import { ParticleRenderer } from '../weather/ParticleRenderer';
import { BallBrain, type BallEnv, type BallEvent } from '../characters/ball/BallBrain';
import { UmbrellaRig } from '../characters/umbrella/UmbrellaRig';
import { createBallVisual, createUmbrellaVisual, type AnyBallVisual, type AnyUmbrellaVisual } from '../characters/factory';
import { ASSETS } from '../config/assets';
import { PostFX } from '../fx/PostFX';
import { Ambience } from '../audio/Ambience';
import { CameraRig } from './CameraRig';
import { Input, type PressTarget } from './Input';

export const DEFAULT_LINES: Record<WeatherName, string[]> = {
  sunny: ['晒太阳~', '好暖和'], cloudy: ['云来了', '阴天也不错'], windy: ['风好大！', '站稳站稳…'],
  rain: ['下雨啦，撑伞！', '滴答滴答'], snow: ['下雪了！', '好冷…'], fog: ['雾里看花', '看不清路…'],
};
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
const tmpColor = new Color();
const rgb = (c: Color, v: [number, number, number]) => c.setRGB(v[0], v[1], v[2]);

export type CursorKind = 'default' | 'grab' | 'grabbing';
export type InteractTarget = 'ball' | 'umbrella' | 'ground' | 'sky' | 'key';

/** What the scene tells its host (the public WeatherScene turns these into events). */
export interface AppHooks {
  say(text: string, duration: number): void;
  weather(name: WeatherName, previous: WeatherName): void;
  time(mode: TimeMode): void;
  daynight(night: boolean): void;
  cursor(kind: CursorKind): void;
  ball(ev: BallEvent): void;
  interact(target: InteractTarget, action: 'click' | 'doubleclick' | 'drag' | 'key', detail?: { key?: string; point?: Vec3 }): void;
}

/** Screen-space anchors (CSS px relative to the canvas) for host overlays, updated every frame. */
export interface SceneAnchors {
  ball: { x: number; y: number; radius: number };
  /** Just above the ball's head (speech bubble). */
  bubble: { x: number; y: number };
  /** On the ground in front of the ball (hints, labels). */
  ground: { x: number; y: number };
}

export class App {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  readonly weather = new Weather('sunny');
  /** Day / night (local clock or fixed); turns the weather into what is rendered. */
  readonly clock = new TimeOfDay();
  readonly ball = new BallBrain();
  readonly umbrella = new UmbrellaRig();
  readonly particles = new ParticleSystem(14000);
  readonly interact = new InteractionMap(512);
  readonly reflection = new PlanarReflection();
  readonly audio = new Ambience();
  readonly input: Input;
  /** Lines the ball says when the weather changes (host-configurable). */
  lines: Record<WeatherName, string[]> = { ...DEFAULT_LINES };
  /** Pixel budget of the main image and the device pixel ratio cap. */
  pixelBudget = 3.6e6;
  maxPixelRatio = 2;
  autoCycleInterval = 14;
  readonly anchors: SceneAnchors = { ball: { x: 0, y: 0, radius: 0 }, bubble: { x: 0, y: 0 }, ground: { x: 0, y: 0 } };
  private cursorKind: CursorKind = 'default';
  private lastNight: boolean | null = null;
  private disposed = false;
  readonly sky: Sky;
  readonly terrain: Terrain;
  private envTerrain: Mesh;
  readonly lighting: Lighting;
  /** Photo-scanned ground / rock textures and HDR skies (ASSETS.environment), loaded in the background. */
  readonly envAssets: EnvAssets;
  readonly post: PostFX;
  readonly ground: Mesh;
  private snowMound: Mesh;
  private moundAmt = 0;
  ballVisual!: AnyBallVisual;
  umbrellaVisual!: AnyUmbrellaVisual;
  private particleRenderer: ParticleRenderer;
  private extraImpulses: number[][] = [];
  time = 0;
  renderScale = 1;
  private autoOn = false;
  private autoTimer = 0;
  private reduceMotion: boolean;
  private lastFrame = performance.now();
  private perf = { acc: 0, frames: 0, good: 0, locked: false };
  private running = false;
  private looping = false;

  constructor(canvas: HTMLCanvasElement, private hooks: AppHooks, opts: { reducedMotion?: boolean } = {}) {
    this.reduceMotion = opts.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resetSharedState();
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    const r = this.renderer;
    r.toneMapping = AgXToneMapping;   // filmic: long highlight shoulder, hue-stable desaturation
    r.shadowMap.enabled = true;
    r.shadowMap.type = VSMShadowMap;
    r.transmissionResolutionScale = 0.5;   // the clear umbrella refracts a soft image anyway
    atmos.uNoise2D.value = createNoiseTexture();

    this.sky = new Sky(r);
    this.terrain = new Terrain();
    this.ground = createGround();
    this.snowMound = createSnowMound(this.ground);
    this.envTerrain = new Mesh(this.terrain.mesh.geometry, this.terrain.mesh.material);
    this.lighting = new Lighting(r, this.sky.envDome, this.envTerrain);
    this.envAssets = new EnvAssets(r, ASSETS.environment);
    this.particleRenderer = new ParticleRenderer(this.particles);
    if (this.reduceMotion) this.particles.quality = 0.5;

    const s = this.scene;
    s.add(this.sky.dome, this.terrain.group, this.ground, this.snowMound, this.lighting.sun, this.lighting.sun.target, this.particleRenderer.mesh);
    this.rig.camera.layers.enable(REFLECT_LAYER);
    this.lighting.sun.layers.enable(REFLECT_LAYER);
    this.sky.dome.layers.enable(REFLECT_LAYER);
    this.terrain.setLayers((o) => o.layers.enable(REFLECT_LAYER));
    this.post = new PostFX(r, s, this.rig.camera);

    this.weather.onLightning = () => { this.ball.startle(); this.ball.say('！', 0.7); this.audio.thunder(); };

    this.input = new Input(canvas, this.rig, {
      classify: (ro, rd) => this.classify(ro, rd),
      onActivity: () => this.ball.pointerActivity(),
      onHoverMove: (px) => { if (this.ball.hover) this.ball.addPet(px); },
      onDragStart: (p) => this.onDragStart(p),
      onDrag: (p) => this.onDrag(p),
      onRelease: (p, click, dbl) => this.onRelease(p, click, dbl),
      onKey: (k) => this.onKey(k),
    }, () => this.time);
  }

  /** Load character visuals (procedural or GLTF per config) and start the loop. */
  async start(greeting: string | null = '嗨～') {
    this.envAssets.start(this.weather.name);   // textures stream in; procedural surfaces until then
    const dem = ASSETS.environment.terrain;
    if (dem && this.envAssets.enabled) {
      const detail = new TextureLoader().loadAsync(dem.detail.url).then((t) => {
        t.colorSpace = NoColorSpace;
        t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());   // seen at grazing angles
        return t;
      });
      const heights = fetch(dem.heights).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); });
      Promise.all([heights, detail])
        .then(([buf, tex]) => {
          if (this.disposed) { tex.dispose(); return; }
          this.terrain.applyDem(new Uint16Array(buf), dem, tex);
          this.envTerrain.geometry = this.terrain.mesh.geometry;
          this.layout();   // portrait framing depends on which terrain is shown
          this.lighting.updateEnvironment(this.renderer, this.scene, this.lighting.sun.target.position, true);
        })
        .catch((err) => console.warn(`[assets] terrain "${dem.heights}" failed to load, keeping the procedural ranges`, err));
    }
    const [bv, uv] = await Promise.all([createBallVisual(ASSETS.ball), createUmbrellaVisual(ASSETS.umbrella)]);
    if (this.disposed) { bv.dispose(); uv.dispose(); return; }
    this.ballVisual = bv;
    this.umbrellaVisual = uv;
    this.ball.R = bv.radius;
    const reflect = (o: Object3D) => o.layers.enable(REFLECT_LAYER);
    bv.forEachMesh(reflect);
    uv.forEachMesh(reflect);
    this.scene.add(bv.root, uv.root);
    this.layout();
    this.interact.clear(this.renderer);
    this.lighting.updateEnvironment(this.renderer, this.scene, new Vector3(...this.ball.pos), true);
    if (greeting) this.hooks.say(greeting, 1.6);
    this.running = true;
    this.resume();
  }

  /** Stop / restart the render loop (the simulation pauses with it). */
  pause() { this.looping = false; this.renderer.setAnimationLoop(null); }
  resume() {
    if (!this.running || this.disposed || this.looping) return;
    this.looping = true;
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }
  get isRunning() { return this.looping; }

  private cssW = 1;
  private cssH = 1;

  /** Size the scene to `w × h` CSS pixels (the host calls this when its container resizes). */
  layout(w = this.cssW, h = this.cssH) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    this.cssW = w; this.cssH = h;
    this.rig.layout(w, h);
    this.ball.setHome(this.rig.homeX, 0);
    // the ranges are composed around the ball: on portrait screens the ball is centred, so swing
    // the hero peak round behind it (Fuji sits at azimuth 0.2; the procedural massif at 0.36)
    const swing = this.rig.aspect < 0.95 ? (terrainUniforms.uDem.value > 0.5 ? 0.17 : 0.3) : 0;
    this.terrain.group.rotation.y = swing;
    this.envTerrain.rotation.y = swing;
    terrainUniforms.uTerrainSwing.value = swing;
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, pr);
    const dw = w * pr, dh = h * pr;
    // clouds and the ground mirror are soft by nature: their resolution follows CSS pixels (≤1.25×)
    const soft = Math.min(pr, 1.25 * this.renderScale);
    this.sky.setSize(w * soft, h * soft);
    this.reflection.setSize(w * soft, h * soft);
    this.particleRenderer.setResolution(dw, dh);
  }
  /** Device pixel ratio × adaptive scale, capped so the frame stays within a pixel budget. */
  private pixelRatio() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    // the main image is what the eye judges for sharpness; soft secondary buffers (clouds, mirror)
    // are sized separately in layout() so this budget goes to the scene itself
    const budget = this.pixelBudget;
    const px = this.rig.cssW * this.rig.cssH * dpr * dpr;
    const base = px > budget ? dpr * Math.sqrt(budget / px) : dpr;
    return Math.max(0.5, base * this.renderScale);
  }
  // ------------------------------------------------------------------ weather switching
  setWeather(name: WeatherName, instant = false) {
    const prev = this.weather.name;
    if (!this.weather.set(name)) return;
    if (instant) this.weather.snap();
    this.envAssets.setWeather(name);
    this.hooks.weather(name, prev);
    if (prev === 'rain' && name === 'windy' && this.umbrella.blowAway(this.weather.windDir())) this.ball.say('我的伞！', 1.6);
    else if (this.lines[name]?.length) this.ball.say(pick(this.lines[name]), 1.8);
    this.ball.wake();
    this.ball.timers.surprise = 0.35;
    this.ball.wanderTarget = null;
    this.ball.saccadeT = 0.6;
    this.audio.setWeather(name);
    this.autoTimer = 0;
  }

  nextWeather() { this.setWeather(WEATHERS[(WEATHERS.indexOf(this.weather.name) + 1) % WEATHERS.length]); }

  /** Cycle through the weathers every `interval` seconds. */
  setAutoCycle(on: boolean, interval = this.autoCycleInterval) { this.autoOn = on; this.autoCycleInterval = interval; this.autoTimer = 0; }
  get autoCycle() { return this.autoOn; }

  // ------------------------------------------------------------------ input
  private classify(ro: Vec3, rd: Vec3): PressTarget {
    const bh = this.ball.hit(ro, rd);
    const uh = this.umbrella.hit(ro, rd);
    if (uh && (!bh || uh.t < bh.t)) return { mode: 'umbrella', hit: uh };
    if (bh) return { mode: 'ball', hit: bh };
    if (rd[1] < -0.003) {
      const t = -ro[1] / rd[1];
      if (t < 70) return { mode: 'ground', point: add(ro, scale(rd, t)) };
    }
    return { mode: 'sky' };
  }

  private dragSun() {
    const rd = this.input.ray();
    const o = { az: Math.atan2(rd[0], -rd[2]), el: clamp(Math.asin(rd[1]), 0.02, 1.2) };
    if (this.clock.isNight) this.clock.moonOverride = o;
    else this.weather.sunOverride = o;
  }

  setTimeMode(mode: TimeMode, opts: { instant?: boolean; quiet?: boolean } = {}) {
    this.clock.setMode(mode);
    if (opts.instant) this.clock.snap();
    this.hooks.time(mode);
    if (opts.quiet) return;
    const night = mode === 'night' || (mode === 'auto' && this.clock.night > 0.5);
    this.ball.say(mode === 'auto' ? '跟着时间走' : night ? '晚安～' : '早上好！', 1.4);
    this.ball.wake();
  }

  private dragging = false;
  private onDragStart(p: PressTarget) {
    this.dragging = true;
    this.hooks.interact(p.mode, 'drag');
    if (p.mode === 'sky') this.dragSun();
    if (p.mode === 'ball') this.ball.startGrab();
  }

  private onDrag(p: PressTarget) { if (p.mode === 'sky') this.dragSun(); }

  private onRelease(p: PressTarget, click: boolean, dbl: boolean) {
    this.dragging = false;
    if (click) this.hooks.interact(p.mode, dbl ? 'doubleclick' : 'click', p.mode === 'ground' ? { point: p.point } : undefined);
    if (p.mode === 'ball') {
      if (this.ball.grabbed) this.ball.endGrab();
      else if (click) { if (dbl) this.ball.flip(); else this.ball.boop(p.hit.local, p.hit.point); }
    } else if (p.mode === 'umbrella' && click) {
      this.umbrella.spinV += 9;
      this.ball.timers.happy = 0.8;
      this.ball.say('转~', 0.9);
      if (this.umbrella.pose) this.particles.rimDrops(this.umbrella.pose, 40);
    } else if (p.mode === 'ground' && click) {
      this.ball.sendTo(p.point);
      this.groundPoke(p.point);
    }
  }

  private groundPoke(pt: Vec3) {
    const W = this.weather.p;
    if (W.snowCover > 0.4) this.particles.snowPuff(pt[0], 0.05, pt[2], 10, 0.6);
    else if (Math.max(W.groundWet, W.puddle) > 0.5) this.particles.splashRing(pt[0], pt[2], 12, 0.6);
    else this.particles.dustPuff(pt[0], pt[2], 8, 0.6);
    this.extraImpulses.push([pt[0], pt[2], 0.35, -0.9]);
  }

  private onKey(k: string): boolean {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 6) { this.setWeather(WEATHERS[n - 1]); return false; }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-4.5, 0], ArrowRight: [4.5, 0], ArrowUp: [0, -4.5], ArrowDown: [0, 4.5] };
    if (k === 'n' || k === 'N') { this.setTimeMode(this.clock.isNight ? 'day' : 'night'); return true; }
    if (k === ' ') this.ball.jump();
    else if (moves[k]) this.ball.push(...moves[k]);
    else return false;
    this.hooks.interact('key', 'key', { key: k });
    return true;
  }
  // ------------------------------------------------------------------ frame
  private frame(now: number) {
    const raw = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const dt = Math.min(raw, 1 / 30) || 1 / 60;
    this.adapt(Math.min(raw, 0.1));
    this.step(dt);
  }

  /** One simulation + render step (also used by the debug tools to render synchronously). */
  step(dt: number) {
    if (!this.running || this.disposed) return;
    this.time += dt;
    this.update(dt);
    this.render(dt);
    this.onFrame?.(dt);
  }
  /** Called after every rendered frame (the public API uses it for stats and overlay anchors). */
  onFrame: ((dt: number) => void) | null = null;

  private update(dt: number) {
    this.weather.update(dt);
    this.clock.update(dt);
    if (this.clock.night > 0.01) this.envAssets.requestMoon();   // moon maps load the first night
    // the weather as rendered at this time of day (night sky, moon instead of sun, …)
    const W = this.clock.apply(this.weather.p);
    const night = this.clock.isNight;
    if (night !== this.lastNight) { this.lastNight = night; this.hooks.daynight(night); }
    this.applyWeather(W);
    this.envAssets.update(dt, atmos.uSunDir.value);
    this.rig.update(dt, this.input.inside ? this.input.ndc : null);
    this.input.updateVelocity(dt);

    const camPos = this.rig.position;
    const rd = this.input.ray();
    const cursorActive = this.input.active;
    const hoverHit = this.input.inside && !this.input.down ? this.ball.hit(camPos, rd) : null;
    this.ball.setHover(!!hoverHit || this.ball.grabbed);
    const overUmb = this.input.inside && !this.input.down && !hoverHit && this.umbrella.hit(camPos, rd);
    const cursor: CursorKind = this.ball.grabbed || this.dragging ? 'grabbing' : hoverHit || overUmb ? 'grab' : 'default';
    if (cursor !== this.cursorKind) { this.cursorKind = cursor; this.hooks.cursor(cursor); }
    const hw = this.rig.halfWidth;
    const bounds = { x0: Math.max(this.ball.home[0] - 8, -hw + 1.2), x1: Math.min(this.ball.home[0] + 3.2, hw - 1.0), z0: -9, z1: 3.2, y1: 8 };
    if (this.ball.grabbed) {
      const t = (this.ball.pos[2] - camPos[2]) / rd[2];
      const p = t > 0 ? add(camPos, scale(rd, t)) : this.ball.pos;
      this.ball.grabTarget = [clamp(p[0], bounds.x0, bounds.x1), clamp(p[1], this.ball.R, 7.5), this.ball.pos[2]];
    }
    let cursorTarget: Vec3 | null = null;
    if (cursorActive) {
      if (hoverHit) cursorTarget = camPos;
      else {
        const t = (this.ball.pos[2] + 2.5 - camPos[2]) / rd[2];
        cursorTarget = t > 0 ? add(camPos, scale(rd, t)) : camPos;
      }
    }
    const wind = this.weather.windDir();
    const windStrength = this.weather.windStrength();
    const env: BallEnv = {
      weather: this.weather.name, wind, windStrength, gust: this.weather.gust,
      snowing: W.snowRate, raining: W.rainRate, sunDir: this.weather.sunDir(W), sunBright: clamp(W.sunI / 3, 0, 1),
      camPos, cursorTarget, cursorActive, umbrella: this.umbrella.open,
      friction: lerp(lerp(2.6, 1.5, W.groundWet), 4.5, W.snowCover), bounds,
    };
    // make room for the umbrella (on narrow screens only as far as the frame allows)
    const leftmost = Math.min(this.ball.baseHome[0], -this.rig.halfWidth + 1.5);
    this.ball.home[0] = Math.max(this.ball.baseHome[0] - 1.2 * Math.min(this.umbrella.open, 1), leftmost);
    this.ball.update(dt, env);
    this.umbrella.update(dt, this.ball, { raining: W.rainRate, wind, windStrength });
    this.handleBallEvents();
    this.updateSnowMound(dt);

    const mc = this.mapCenter();
    const half = this.interact.worldSize / 2;
    this.particles.update(dt, {
      weather: W, ball: this.ball, ballCenter: this.ball.renderPos(), ballScale: this.ball.scaleVec(),
      umbPose: this.umbrella.pose, cam: camPos,
      cursor: { active: cursorActive && !this.ball.grabbed, dir: rd, vel: this.input.worldVel },
      region: { x0: -15, x1: this.ball.home[0] + 13, z0: camPos[2] - 30, z1: camPos[2] - 1, top: W.snowRate > W.rainRate ? 9 : 12 },
      mapRect: [mc[0] - half, mc[0] + half, mc[1] - half, mc[1] + half],
      wind, windStrength, gust: this.weather.gust,
    });

    this.audio.update(this.weather.gust * W.wind);
    if (this.autoOn && (this.autoTimer += dt) > this.autoCycleInterval) this.nextWeather();
    const rp = this.ball.renderPos();
    const top = this.rig.project(add(rp, [0, this.ball.R * this.ball.squash + 0.5 + this.ball.snow * 0.2, 0]));
    const bottom = this.rig.project([rp[0], 0, rp[2] + 0.2]);
    const c = this.rig.project(rp), edge = this.rig.project([rp[0], rp[1] + this.ball.R, rp[2]]);
    const a = this.anchors;
    a.ball.x = c[0]; a.ball.y = c[1]; a.ball.radius = Math.abs(c[1] - edge[1]);
    a.bubble.x = top[0]; a.bubble.y = top[1];
    a.ground.x = bottom[0]; a.ground.y = bottom[1] + 12;
  }

  /** Snow piles up around the ball while it rests in the snow; rolling or jumping flattens it. */
  private updateSnowMound(dt: number) {
    const W = this.weather.p, b = this.ball;
    const onGround = b.pos[1] - b.R < 0.06;
    const speed = Math.hypot(b.vel[0], b.vel[2]);
    const target = W.snowCover * (onGround ? 1 : 0) * (1 - 0.7 * clamp((speed - 0.3) / 1.2, 0, 1));
    this.moundAmt = damp(this.moundAmt, target, target > this.moundAmt ? 0.8 : 3, dt);
    const rp = b.renderPos();
    this.snowMound.visible = this.moundAmt > 0.01;
    this.snowMound.position.set(rp[0], -0.002, rp[2]);
    this.snowMound.scale.set(b.R, 1, b.R);
    groundUniforms.uSnowMound.value.set(rp[0], rp[2], b.R, this.moundAmt);
  }

  private mapCenter(): [number, number] { return [this.ball.baseHome[0] - 1.5, -1.0]; }

  private handleBallEvents() {
    const W = this.weather.p;
    for (const ev of this.ball.events) {
      switch (ev.type) {
        case 'land': {
          const I = ev.impact;
          const wet = Math.max(W.groundWet, W.puddle) * (1 - W.snowCover);
          if (W.snowCover > 0.4) this.particles.snowPuff(ev.pos[0], 0.1, ev.pos[2], Math.round(6 + I * 1.6), 0.4 + I * 0.08);
          else if (wet > 0.55) this.particles.splashRing(ev.pos[0], ev.pos[2], Math.round(8 + I * 2.2), 0.55 + I * 0.06);
          else if (I > 4) this.particles.dustPuff(ev.pos[0], ev.pos[2], Math.round(4 + I), 0.5 + I * 0.05);
          this.extraImpulses.push([ev.pos[0], ev.pos[2], 0.75, -Math.min(I * 0.12, 1.6)]);
          if (I > 13 && !this.reduceMotion) this.rig.shake = Math.min(1, I / 20);
          this.audio.thud(I);
          break;
        }
        case 'hop':
          this.extraImpulses.push([ev.pos?.[0] ?? this.ball.pos[0], ev.pos?.[2] ?? this.ball.pos[2], 0.5, -0.3]);
          this.audio.hop();
          break;
        case 'shed': {
          const c = this.ball.renderPos(), d = ev.dir;
          this.particles.snowPuff(c[0] + d[0] * 0.9, c[1] + d[1] * 0.9, c[2] + d[2] * 0.9, Math.round(18 + ev.amount * 60), 1.5, d);
          break;
        }
        case 'boop': this.audio.boop(); break;
        case 'flip': this.audio.boop(1.5); break;
        case 'say': this.hooks.say(ev.text, ev.dur); break;
        default: break;
      }
      this.hooks.ball(ev);
    }
    this.ball.events.length = 0;
  }
  /** Push the blended weather state into every shared uniform, light and post pass. */
  private applyWeather(W: WeatherParams) {
    const wind = this.weather.windDir();
    const windStrength = this.weather.windStrength();
    const sd = this.weather.sunDir(W);
    const sc = this.weather.sunColor(W, !this.clock.isNight);   // moonlight has no golden hour
    const L = this.weather.lightning;
    atmos.uSunDir.value.set(sd[0], sd[1], sd[2]);
    atmos.uSunCol.value.setRGB(sc[0], sc[1], sc[2]);
    atmos.uSunGlow.value = W.sunGlow;
    // visible share of the sun's disc: gone under a full deck, a little through broken cloud
    atmos.uSunSpec.value = Math.pow(clamp(1 - W.cloudCover * 1.05, 0, 1), 1.5);
    rgb(atmos.uZenith.value, W.zenith);
    rgb(atmos.uHorizon.value, W.horizon);
    rgb(atmos.uFogCol.value, W.fogCol);
    atmos.uFogDens.value = W.fogDens;
    atmos.uFogFall.value = W.fogFall;
    atmos.uHaze.value = W.haze;
    atmos.uMist.value = W.mist;
    atmos.uLightning.value = L;
    atmos.uNight.value = this.clock.night;
    atmos.uStars.value = this.clock.stars(W);
    atmos.uMoonDisc.value = this.clock.moonDisc();
    atmos.uMoonPhase.value = this.clock.phase * Math.PI * 2;
    atmos.uTime.value = this.time;

    const cu = cloudUniforms;
    cu.uCloudBase.value = W.cloudBase;
    cu.uCloudTop.value = W.cloudTop;
    cu.uCloudCover.value = W.cloudCover;
    cu.uCloudDensity.value = W.cloudDens;
    cu.uCloudType.value = W.cloudType;
    cu.uCloudStretch.value = W.cloudStretch;
    cu.uCloudWindDir.value.set(wind[0], wind[1]);
    cu.uCloudOffset.value.set(this.weather.cloudOffset[0], this.weather.cloudOffset[1]);
    cu.uTowers.value = W.towers;
    cu.uSunAz.value = W.sunAz;
    cu.uCloudAmbTop.value.setRGB(W.zenith[0] * 1.2 + L, W.zenith[1] * 1.2 + L, W.zenith[2] * 1.22 + L);
    // clouds are lit by the full sun above the deck; the ground only gets what passes through (sunI)
    const sunTint = W.sunI > 1e-3 ? 3.2 / W.sunI : 0;
    const cl = sunTint * this.clock.cloudLight();
    cu.uCloudSun.value.setRGB(sc[0] * cl, sc[1] * cl, sc[2] * cl);
    const lowSun = W.sunI * Math.max(W.sunEl, 0) * 0.25;
    cu.uCloudAmbBottom.value.setRGB(W.sandCol[0] * lowSun + W.horizon[0] * 0.6, W.sandCol[1] * lowSun + W.horizon[1] * 0.6, W.sandCol[2] * lowSun + W.horizon[2] * 0.6);
    rgb(cu.uCloudTint.value, W.cloudTint);
    cu.uCloudAmbScale.value = W.cloudAmb;
    const b = this.weather.bolt;
    cu.uBolt.value.set(b[0], 6360000 + b[1], b[2], L);

    terrainUniforms.uMtnSnow.value = W.mtnSnow;
    rgb(terrainUniforms.uMtnTint.value, W.mtnTint);
    terrainUniforms.uMistSheets.value = W.mistSheets;
    terrainUniforms.uMtnHaze.value = W.mtnHaze;

    const g = groundUniforms;
    g.uGroundWet.value = W.groundWet;
    g.uPuddle.value = W.puddle;
    g.uSnowCover.value = W.snowCover;
    g.uDust.value = W.dust;
    g.uRain.value = W.rainRate;
    rgb(g.uSandCol.value, W.sandCol);
    g.uGroundWind.value.set(wind[0], wind[1]);
    g.uBallSphere.value.fromArray(this.ball.colliderSphere());
    g.uShelter.value.fromArray(this.umbrella.shelter(wind, windStrength));

    // three's directional light: reflected = albedo/π · E, so E = π · radiance
    const peak = Math.max(sc[0], sc[1], sc[2], 1e-4);
    tmpColor.setRGB(sc[0] / peak, sc[1] / peak, sc[2] / peak);
    const focus = new Vector3(this.ball.baseHome[0] - 1, 0, 0);
    this.lighting.setSun(atmos.uSunDir.value, tmpColor, peak * Math.PI, focus);
    this.lighting.sun.shadow.radius = W.shadowRadius;
    this.scene.environmentIntensity = W.envI;
    const snow = W.snowCover;
    this.lighting.setGroundAlbedo(tmpColor.setRGB(lerp(W.sandCol[0], 0.93, snow), lerp(W.sandCol[1], 0.95, snow), lerp(W.sandCol[2], 0.98, snow)));

    if (this.ballVisual) {
      const u = this.ballVisual.uniforms;
      rgb(u.uFillCol.value, W.fill);
      rgb(u.uKeyCol.value, W.key);
      const rp = this.ball.renderPos(), cp = this.rig.position;
      u.uFillDir.value.set(cp[0] - rp[0] - 3, cp[1] - rp[1] + 4, cp[2] - rp[2]).normalize();
      // portrait key: ~85° off the view axis toward the sun's side, ~35° up (follows the sun as the
      // weather changes, so shading and the cast shadow agree on where the light comes from)
      const fx = cp[0] - rp[0], fz = cp[2] - rp[2], fl = Math.hypot(fx, fz) || 1;
      const f: Vec3 = [fx / fl, 0, fz / fl], right: Vec3 = [f[2], 0, -f[0]];
      const side = clamp((sd[0] * right[0] + sd[2] * right[2]) * 6, -1, 1);
      const c70 = Math.cos(1.48), s70 = Math.sin(1.48), c35 = Math.cos(0.61), s35 = Math.sin(0.61);
      u.uKeyDir.value.set((f[0] * c70 + right[0] * side * s70) * c35, s35, (f[2] * c70 + right[2] * side * s70) * c35).normalize();
    }
    if (this.umbrellaVisual && 'wet' in this.umbrellaVisual) this.umbrellaVisual.wet.value = W.rainRate;
    const pm = this.particleRenderer.material.uniforms;
    (pm.uAmbCol.value as Color).setRGB(
      (W.zenith[0] + W.horizon[0]) * 0.5 * (1 + L * 0.8), (W.zenith[1] + W.horizon[1]) * 0.5 * (1 + L * 0.8), (W.zenith[2] + W.horizon[2]) * 0.5 * (1 + L * 0.8));

    const post = this.post;
    const sp = this.rig.project(add(this.rig.position, scale(sd, 400)));
    const su = sp[0] / this.rig.cssW, sv = 1 - sp[1] / this.rig.cssH;
    const onScreen = sp[2] > 0 ? clamp(1.6 - Math.max(Math.abs(su - 0.5), Math.abs(sv - 0.5)) * 2, 0, 1) : 0;
    // like a camera metering a bright frame: stop down a little when the sun itself is in shot
    const sunInShot = onScreen * clamp(W.sunI / 3.4, 0, 1) * clamp(W.sunEl * 4, 0, 1);
    this.renderer.toneMappingExposure = W.exposure * (1 - 0.12 * sunInShot);
    post.bloom.strength = W.bloom;
    post.bloom.radius = W.bloomRadius;
    post.bloom.threshold = W.threshold;
    post.lens.sunUv.set(su, sv);
    post.lens.rays = W.rays * onScreen * 1.4;
    post.lens.streak = W.streak * sunInShot;
    const gu = post.grade.uniforms;
    rgb(gu.uLift.value as Color, W.lift);
    rgb(gu.uGain.value as Color, W.gain);
    gu.uSat.value = W.sat;
    gu.uContrast.value = W.contrast;
    gu.uCurve.value = W.curve;
    gu.uWhite.value = W.white;
    gu.uHalation.value = W.halation;
    gu.uGrain.value = W.grain;
    post.optics.uniforms.uVignette.value = W.vignette;
    gu.uFlash.value = L * 0.12;
    gu.uTime.value = this.time;
    // rack focus on the ball; blur radius scales with the drawing-buffer height
    const bp = this.ball.renderPos(), cp = this.rig.position;
    // focus on the face (front of the ball), where the eye goes first
    const focusDist = Math.hypot(bp[0] - cp[0], bp[1] - cp[1], bp[2] - cp[2]) - this.ball.R * 0.6;
    this.particleRenderer.setFocus(focusDist);
    post.setFocus(this.rig.camera, focusDist, W.dof * 0.001 * this.renderer.domElement.height * (this.reduceMotion ? 0.5 : 1));
    this.ballVisual?.setEnvIntensity(W.ballEnv);
    tmpColor.setRGB((W.zenith[0] + W.horizon[0]) * 0.5, (W.zenith[1] + W.horizon[1]) * 0.5, (W.zenith[2] + W.horizon[2]) * 0.5);
    post.setPrecip(this.rig.camera, W.rainRate, W.snowRate, windStrength, this.time, tmpColor);
  }

  private render(dt: number) {
    const r = this.renderer;
    const W = this.weather.p;
    this.ballVisual.update(this.ball.renderState());
    const pose = this.umbrella.pose;
    if (pose) this.umbrellaVisual.update(pose, dt);
    else this.umbrellaVisual.root.visible = false;

    // interaction map: ripples, snow tracks, cleared mist
    const imp = [...this.extraImpulses, ...this.particles.impulses];
    this.extraImpulses.length = 0;
    const rp = this.ball.renderPos();
    const sp = Math.hypot(this.ball.vel[0], this.ball.vel[2]);
    const onGround = this.ball.pos[1] - this.ball.R < 0.06;
    const wetGround = Math.max(W.groundWet, W.puddle) * (1 - W.snowCover);
    if (onGround && sp > 0.4 && wetGround > 0.35) imp.unshift([rp[0], rp[2], 0.7, -0.05 * Math.min(sp, 6)]);
    let fogPt: Vec3 | null = null;
    const rd = this.input.ray();
    if (W.mist > 0.05 && this.input.active && rd[1] < -0.01) {
      const cp = this.rig.position;
      const t = -cp[1] / rd[1];
      if (t < 40) fogPt = add(cp, scale(rd, t));
    }
    const mc = this.mapCenter();
    this.interact.setCenter(mc[0], mc[1]);
    this.interact.step(r, {
      impulses: imp,
      ballContact: [rp[0], rp[2], 0.5 + (1 - this.ball.squash) * 1.6, onGround ? 1 : 0],
      fogBrush: fogPt ? [fogPt[0], fogPt[2], 1.5, 1] : [0, 0, 1, 0],
      fogBrush2: [rp[0], rp[2], 1.8, W.mist > 0.05 ? clamp(0.35 + sp * 0.25, 0, 1) : 0],
      dt, snowing: W.snowRate, snowCover: W.snowCover,
    });

    this.lighting.updateEnvironment(r, this.scene, new Vector3(rp[0], 0, rp[2]));
    this.sky.update(r, this.rig.camera);
    this.sky.setSunDisc(0);
    this.reflection.render(r, this.scene, this.rig.camera);
    this.sky.setSunDisc(1);
    groundUniforms.uMirror.value = this.reflection.texture;
    groundUniforms.uMirrorMatrix.value.copy(this.reflection.textureMatrix);
    this.particleRenderer.upload();
    this.post.render(dt);
  }

  // ------------------------------------------------------------------ adaptive resolution
  lockScale(v: number) { this.renderScale = v; this.perf.locked = true; this.layout(); }
  /** Back to the adaptive resolution / cloud quality loop. */
  unlockScale() { this.perf.locked = false; this.perf.good = 0; }

  /** Release everything: the render loop, input listeners, audio and all GPU resources. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    this.input.dispose();
    this.audio.dispose();
    this.envAssets.enabled = false;
    const seen = new Set<object>();
    const free = (root: Object3D) => root.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); }
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) if (!seen.has(mat)) { seen.add(mat); mat.dispose(); }
    });
    free(this.scene);
    free(this.lighting.envScene);
    this.sky.dispose();
    this.reflection.dispose();
    this.post.composer.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    // frees every remaining GPU object at once and keeps browsers from running out of contexts
    this.renderer.forceContextLoss();
  }

  private adapt(raw: number) {
    const p = this.perf;
    if (p.locked || this.time < 2.5 || document.hidden) { p.acc = 0; p.frames = 0; return; }
    p.acc += raw; p.frames++;
    if (p.acc < 1) return;
    const avg = p.acc / p.frames;
    p.acc = 0; p.frames = 0;
    // sharpness matters most: shed soft-effect cost (cloud march steps) first, resolution last
    if (avg > 0.0205) {
      p.good = 0;
      if (this.sky.steps > 28) this.sky.steps -= 10;
      else if (this.renderScale > 0.6) { this.renderScale = Math.max(0.6, this.renderScale - 0.08); this.layout(); }
    } else if (avg < 0.0175 && ++p.good >= 3) {
      p.good = 0;
      if (this.renderScale < 1) { this.renderScale = Math.min(1, this.renderScale + 0.05); this.layout(); }
      else if (this.sky.steps < 64) this.sky.steps = Math.min(64, this.sky.steps + 10);
    }
  }
}

/**
 * The world's uniforms are module-level (shared by every material). A new scene starts from a clean
 * state: the "asset loaded" switches go back to the procedural fallbacks until its own loads finish.
 */
function resetSharedState() {
  groundUniforms.uGTex.value = 0;
  groundUniforms.uSnowTex.value = 0;
  groundUniforms.uSnowMound.value.set(0, 0, 1, 0);
  terrainUniforms.uRockTex.value = 0;
  terrainUniforms.uDem.value = 0;
  terrainUniforms.uTerrainSwing.value = 0;
  envSkyUniforms.uHdrOn.value = 0;
  envSkyUniforms.uHdrMix.value = 0;
  moonUniforms.uMoonTexOn.value = 0;
}
