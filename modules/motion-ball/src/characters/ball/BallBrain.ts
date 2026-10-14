// Gameplay brain of the motion ball: physics (hop, roll, throw, self-righting), attention
// and expressions, snow cap + wetness. Renderer-agnostic — it only produces a
// BallRenderState that any BallVisual (procedural or GLTF) can draw.
import {
  add, clamp, cross, damp, dot, length, lerp, normalize, qAxisAngle, qConj, qDeltaVector, qIdentity,
  qIntegrate, qMul, qRotate, rand, scale, sub, type Quat, type Vec3,
} from '../../core/math';
import type { WeatherName } from '../../weather/presets';
import type { BallRenderState, Expression } from '../types';

const UP: Vec3 = [0, 1, 0];
const G = 26;
const EXPR_KEYS: (keyof Expression)[] = ['open', 'happy', 'surprise', 'squint', 'sleepy', 'dizzy', 'squeeze', 'blush'];

export type BallEvent =
  | { type: 'boop' } | { type: 'flip' } | { type: 'grab' }
  | { type: 'hop'; pos?: Vec3; big?: boolean }
  | { type: 'land'; pos: Vec3; impact: number }
  | { type: 'shed'; amount: number; dir: Vec3 }
  | { type: 'release'; speed: number }
  | { type: 'say'; text: string; dur: number };

export interface BallEnv {
  weather: WeatherName;
  wind: [number, number];
  windStrength: number;
  gust: number;
  snowing: number;
  raining: number;
  sunDir: Vec3;
  sunBright: number;
  camPos: Vec3;
  cursorTarget: Vec3 | null;
  cursorActive: boolean;
  umbrella: number;
  friction: number;
  bounds: { x0: number; x1: number; z0: number; z1: number; y1: number };
}

type Timers = { happy: number; surprise: number; dizzy: number; squeeze: number; startle: number; shake: number };

export class BallBrain {
  R = 1;
  home: Vec3 = [3, 1, 0];
  baseHome: Vec3 = [3, 1, 0];
  pos: Vec3 = [3, 1, 0];
  vel: Vec3 = [0, 0, 0];
  q: Quat = qIdentity();
  w: Vec3 = [0, 0, 0];
  squash = 1; squashV = 0;
  dentDir: Vec3 = [0, 0, 1]; dent = 0; dentV = 0;
  snowDir: Vec3 = [0, 1, 0]; snow = 0;   // snowDir is in the head frame (see headBasis)
  wet = 0;
  grounded = true;
  airSpinFree = 0;
  grabbed = false;
  grabTarget: Vec3 = [3, 1, 0];
  goTo: Vec3 | null = null; goToTimer = 0;
  homing = false;
  hopCooldown = 0;
  calmTime = 0;

  lookTarget: Vec3 = [0, 1.2, 10];
  gaze: [number, number] = [0, 0];
  bodyYaw = 0; bodyPitch = 0;
  saccadeT = 1.5;
  wanderTarget: Vec3 | null = null;

  expr: Expression = { open: 1, happy: 0, surprise: 0, squint: 0, sleepy: 0, dizzy: 0, squeeze: 0, blush: 0 };
  timers: Timers = { happy: 0, surprise: 0, dizzy: 0, squeeze: 0, startle: 0, shake: 0 };
  blinkT = 2.5; blink = 0; blinkPhase = -1; doubleBlink = false;
  hover = false; hoverTime = 0;
  pet = 0;
  idle = 0; sleeping = false;
  time = 0;
  lean: Vec3 = [0, 0, 0];
  events: BallEvent[] = [];
  private placed = false;

  setHome(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    this.home = [x, this.R, z];
    this.baseHome = [x, this.R, z];
    if (!this.placed || !this.pos.every(Number.isFinite)) {
      this.placed = true;
      this.pos = [x, this.R, z];
      this.vel = [0, 0, 0];
    }
  }

  emit(e: BallEvent) { this.events.push(e); }
  say(text: string, dur = 1.8) { this.emit({ type: 'say', text, dur }); }

  // ---------------------------------------------------------------- input hooks
  boop(hitLocal: Vec3, hitWorld: Vec3) {
    this.wake();
    this.dentDir = hitLocal;
    this.dentV += 2.6;
    if (this.grounded && !this.grabbed) {
      const away = normalize([this.pos[0] - hitWorld[0], 0, this.pos[2] - hitWorld[2]]);
      this.vel = add(this.vel, [away[0] * 1.2, 4.6, away[2] * 1.2]);
      this.grounded = false;
    }
    this.squashV -= 1.2;
    if (this.snow > 0.12) this.shakeOff();
    else if (Math.random() < 0.5) this.timers.happy = 0.9; else this.timers.surprise = 0.5;
    this.emit({ type: 'boop' });
  }

  flip() {
    if (this.grabbed) return;
    this.wake();
    this.vel[1] = 10.5;
    this.grounded = false;
    this.w = [-8.2, 0, 0];
    this.airSpinFree = 1.0;
    this.timers.happy = 1.6;
    if (this.snow > 0.05) this.shakeOff();
    this.emit({ type: 'flip' });
  }

  jump() {
    if (!this.grounded || this.grabbed) return;
    this.wake();
    this.vel[1] = 8.5;
    this.grounded = false;
    this.squashV -= 2.5;
    this.timers.happy = 0.8;
    this.emit({ type: 'hop', big: true });
  }

  push(dx: number, dz: number) {
    if (this.grabbed) return;
    this.wake();
    this.vel[0] += dx; this.vel[2] += dz;
    this.goTo = null;
    this.calmTime = -1.2;
  }

  shakeOff() {
    this.timers.shake = 0.7;
    if (this.snow > 0.02) this.emit({ type: 'shed', amount: this.snow, dir: this.capWorldDir() });
    this.snow = 0;
    this.say('brrr…', 1.2);
  }

  startGrab() {
    this.grabbed = true;
    this.goTo = null;
    this.grounded = false;
    this.wake();
    this.timers.squeeze = 99;
    this.emit({ type: 'grab' });
  }

  endGrab() {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.timers.squeeze = 0;
    const sp = length(this.vel);
    if (sp > 6) {
      this.airSpinFree = 1.2;
      this.w = add(this.w, scale(normalize(cross(UP, this.vel)), sp * 0.9));
      this.timers.surprise = 1.2;
      this.say(sp > 14 ? '哇啊——' : '呜！', 1.0);
    }
    this.calmTime = -1.5;
    this.emit({ type: 'release', speed: sp });
  }

  sendTo(point: Vec3) {
    this.wake();
    this.goTo = [point[0], this.R, point[2]];
    this.goToTimer = 7;
    this.calmTime = 1;
  }

  setHover(h: boolean) {
    if (h && !this.hover) { this.hoverTime = 0; this.squashV += 0.6; }
    this.hover = h;
  }

  addPet(px: number) { this.pet = Math.min(this.pet + px * 0.004, 2); }

  pointerActivity() {
    this.idle = 0;
    if (this.sleeping) this.wake(true);
  }

  wake(startle = false) {
    if (this.sleeping) {
      this.sleeping = false;
      if (startle) { this.timers.startle = 0.6; this.say('！', 0.8); }
    }
    this.idle = 0;
  }

  startle() {
    this.timers.startle = 0.7;
    if (this.grounded && !this.grabbed) { this.vel[1] = 4; this.grounded = false; this.squashV -= 1.5; }
  }

  /**
   * The snow cap lives in the head frame (the body turned by the gaze), not on the raw body. The
   * eyes lead and the body follows on a spring, so a cap glued to the body slid against the face and
   * lagged behind it like a loose hat; in the head frame it stays on top of the face.
   */
  private headBasis(): [Vec3, Vec3, Vec3] {
    const gx = this.gaze[0], gy = this.gaze[1];
    const f: Vec3 = [Math.sin(gx) * Math.cos(gy), Math.sin(gy), Math.cos(gx) * Math.cos(gy)];
    const r: Vec3 = [Math.cos(gx), 0, -Math.sin(gx)];
    return [r, cross(f, r), f];
  }
  private headToBody(v: Vec3): Vec3 {
    const [r, u, f] = this.headBasis();
    return [r[0] * v[0] + u[0] * v[1] + f[0] * v[2], r[1] * v[0] + u[1] * v[1] + f[1] * v[2], r[2] * v[0] + u[2] * v[1] + f[2] * v[2]];
  }
  private bodyToHead(v: Vec3): Vec3 {
    const [r, u, f] = this.headBasis();
    return [dot(v, r), dot(v, u), dot(v, f)];
  }
  capWorldDir(): Vec3 { return qRotate(this.q, this.headToBody(this.snowDir)); }
  localUp(): Vec3 { return qRotate(qConj(this.q), UP); }

  scaleVec(): Vec3 {
    const sy = this.squash, sx = 1 / Math.sqrt(sy);
    return [sx * this.R, sy * this.R, sx * this.R];
  }

  renderPos(): Vec3 {
    const gf = clamp(1 - (this.pos[1] - this.R) / 0.35, 0, 1);
    return [this.pos[0], this.pos[1] - this.R * (1 - this.squash) * gf, this.pos[2]];
  }

  /** Ray vs the squashed ball. Returns hit distance, point and body-local surface direction. */
  hit(ro: Vec3, rd: Vec3): { t: number; point: Vec3; local: Vec3 } | null {
    const s = this.scaleVec();
    const c = this.renderPos();
    const o: Vec3 = [(ro[0] - c[0]) / s[0], (ro[1] - c[1]) / s[1], (ro[2] - c[2]) / s[2]];
    const d: Vec3 = [rd[0] / s[0], rd[1] / s[1], rd[2] / s[2]];
    const a = dot(d, d), b = dot(o, d), cc = dot(o, o) - 1.06;
    const h = b * b - a * cc;
    if (h < 0) return null;
    const t = (-b - Math.sqrt(h)) / a;
    if (t < 0) return null;
    const p = add(ro, scale(rd, t));
    const n = normalize([(p[0] - c[0]) / s[0], (p[1] - c[1]) / s[1], (p[2] - c[2]) / s[2]]);
    return { t, point: p, local: qRotate(qConj(this.q), n) };
  }

  accumulateSnow(a: number, lu: Vec3 = this.bodyToHead(this.localUp())) {
    if (this.snow < 0.01) this.snowDir = lu;
    else this.snowDir = normalize(add(scale(this.snowDir, this.snow), scale(lu, a)));
    this.snow = Math.min(1, this.snow + a);
  }
  // ---------------------------------------------------------------- simulation
  update(dt: number, env: BallEnv) {
    this.time += dt;
    const T = this.timers;
    for (const k of Object.keys(T) as (keyof Timers)[]) if (T[k] > 0 && T[k] < 90) T[k] = Math.max(0, T[k] - dt);
    this.idle += dt;
    if (!this.sleeping && this.idle > 30 && !this.grabbed && !this.goTo) {
      this.sleeping = true;
      this.say('zzz…', 2.4);
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    this.lean = this.computeLean(env);
    for (let i = 0; i < steps; i++) this.step(h, env);
    this.updateFace(dt, env);
    this.updateSurface(dt, env);
  }

  private step(h: number, env: BallEnv) {
    const R = this.R, p = this.pos, v = this.vel;
    if (this.grabbed) {
      const gt = this.grabTarget;
      for (let k = 0; k < 3; k++) v[k] += ((gt[k] - p[k]) * 170 - v[k] * 19) * h;
    } else {
      v[1] -= G * h;
      // only real gusts beat static friction and shove the ball downwind
      const push = Math.max(0, env.windStrength - 0.35) * 2.4;
      if (push > 0 && this.grounded) {
        v[0] += env.wind[0] * push * h;
        v[2] += env.wind[1] * push * h;
      }
      const tgt = this.goTo ?? this.home;
      const dx = tgt[0] - p[0], dz = tgt[2] - p[2];
      const dist = Math.hypot(dx, dz);
      if (this.grounded && Math.hypot(v[0], v[2]) < 1.2) this.calmTime += h;
      if (!this.homing && dist > 0.5 && this.calmTime > 0.6 && !this.sleeping) this.homing = true;
      if (this.homing) {
        if (dist < 0.4 && this.grounded) {
          this.homing = false;
          v[0] *= 0.15; v[2] *= 0.15;
          if (this.goTo) this.timers.happy = 0.6;
        } else if (this.grounded && this.hopCooldown <= 0 && dist >= 0.4) {
          const vy = dist > 1.5 ? 5.6 : 4.2;
          const hs = Math.min((dist * 0.9) / ((2 * vy) / G), 4.4);   // land ~90% of the way there
          v[0] = (dx / dist) * hs; v[2] = (dz / dist) * hs;
          v[1] = vy;
          this.grounded = false;
          this.hopCooldown = 0.38;
          this.squashV -= 1.3;
          this.emit({ type: 'hop', pos: [p[0], 0, p[2]] });
        }
      }
      if (this.hopCooldown > 0) this.hopCooldown -= h;
      if (this.goTo) {
        this.goToTimer -= h;
        if (this.goToTimer <= 0) { this.goTo = null; this.calmTime = 0.4; }
      }
    }

    p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h;

    if (p[1] <= R) {
      p[1] = R;
      if (v[1] < -1.6 && !this.grabbed) {
        const impact = -v[1];
        v[1] = impact > 3.2 ? impact * 0.36 : 0;
        this.squashV -= impact * 0.085;
        this.emit({ type: 'land', pos: [p[0], 0, p[2]], impact });
        if (impact > 12 && this.airSpinFree > 0) { this.timers.dizzy = 1.8; this.say('晕…', 1.4); }
        if (this.snow > 0.1 && impact > 8) this.shakeOff();
      } else if (v[1] < 0) {
        v[1] = 0;
      }
      this.grounded = v[1] <= 0.01;
      if (this.grounded) {
        const f = Math.exp(-(this.homing ? 14 : env.friction) * h);
        v[0] *= f; v[2] *= f;
        if (this.airSpinFree > 0) this.airSpinFree = Math.max(0, this.airSpinFree - h * 1.4);
      }
    } else {
      this.grounded = false;
    }

    const b = env.bounds;
    if (p[0] < b.x0) { p[0] = b.x0; v[0] = Math.abs(v[0]) * 0.45; }
    if (p[0] > b.x1) { p[0] = b.x1; v[0] = -Math.abs(v[0]) * 0.45; }
    if (p[2] < b.z0) { p[2] = b.z0; v[2] = Math.abs(v[2]) * 0.45; }
    if (p[2] > b.z1) { p[2] = b.z1; v[2] = -Math.abs(v[2]) * 0.45; }
    if (p[1] > b.y1) { p[1] = b.y1; v[1] = Math.min(v[1], 0); }

    this.stepRotation(h);
  }

  private stepRotation(h: number) {
    let qT = qMul(qAxisAngle(UP, this.bodyYaw), qAxisAngle([1, 0, 0], -this.bodyPitch));
    const ll = length(this.lean);
    if (ll > 1e-5) qT = qMul(qAxisAngle(scale(this.lean, 1 / ll), ll), qT);
    const err = qDeltaVector(this.q, qT);
    const free = this.airSpinFree > 0 && !this.grounded;
    const k = free ? 3 : this.grabbed ? 45 : 72;
    const c = free ? 0.2 : this.grabbed ? 6 : 9;
    for (let i = 0; i < 3; i++) this.w[i] += (err[i] * k - this.w[i] * c) * h;
    if (this.grounded && !this.grabbed && !this.homing) {
      const v = this.vel;
      const sp = Math.hypot(v[0], v[2]);
      const roll = clamp((sp - 1.4) / 3, 0, 1);
      if (roll > 0) {
        const rw = scale(cross(UP, [v[0], 0, v[2]]), 1 / this.R);
        const t = Math.min(1, roll * h * 25);
        for (let i = 0; i < 3; i++) this.w[i] = lerp(this.w[i], rw[i], t);
      }
    }
    this.q = qIntegrate(this.q, this.w, h);
  }

  private computeLean(env: BallEnv): Vec3 {
    const t = this.time;
    let lean: Vec3 = [0, 0, 0];
    const ws = env.windStrength;
    if (ws > 0.05 && !this.grabbed) {
      const ax = normalize(cross(UP, [-env.wind[0], 0, -env.wind[1]]));
      lean = add(lean, scale(ax, (0.08 + 0.06 * env.gust) * ws + Math.sin(t * 9.3) * 0.015 * ws));
    }
    if (this.grabbed) {
      const v = this.vel;
      const sp = Math.hypot(v[0], v[2]);
      if (sp > 0.05) lean = add(lean, scale(normalize(cross(UP, [-v[0], 0, -v[2]])), Math.min(sp * 0.035, 0.5)));
      lean[2] += Math.sin(t * 13) * 0.05;
    }
    const T = this.timers;
    if (T.shake > 0) lean[2] += Math.sin(t * 42) * 0.22 * (T.shake / 0.7);
    if (env.weather === 'snow' && !this.sleeping) lean[2] += Math.sin(t * 57) * 0.012 * (0.4 + 0.6 * (Math.sin(t * 0.7) > 0.6 ? 1 : 0));
    if (this.pet > 0.3) lean[2] += Math.sin(t * 7.5) * 0.07 * Math.min(this.pet, 1);
    if (this.hover && !this.grabbed) lean[2] += Math.sin(t * 3.2) * 0.03;
    if (T.dizzy > 0) { lean[0] += Math.sin(t * 6) * 0.12; lean[2] += Math.cos(t * 6) * 0.12; }
    if (this.sleeping) lean[2] += Math.sin(t * 1.3) * 0.04 + 0.06;
    return lean;
  }

  private pickWander(env: BallEnv): Vec3 {
    const c = this.renderPos();
    const r = Math.random();
    if (r < 0.32) return [...env.camPos] as Vec3;
    if (r < 0.52) return add(env.camPos, [-5.5, 2.4, -5]);           // the headline
    if (r < 0.8) {
      switch (env.weather) {
        case 'sunny': return add(c, scale(env.sunDir, 12));
        case 'rain': return add(c, [rand(0.4, 1.6), 3.2, rand(-0.5, 1)]);
        case 'snow': return add(c, [rand(-2, 2), rand(4, 6), rand(0, 3)]);
        case 'windy': return add(c, [-env.wind[0] * 6, 0.6, -env.wind[1] * 6]);
        case 'cloudy': return add(c, [rand(-4, 4), 6, rand(-6, -2)]);
        default: return add(c, [rand(-6, 6), rand(0, 1.5), rand(-8, 2)]);
      }
    }
    return add(c, [rand(-5, 5), rand(-0.5, 2), rand(-4, 5)]);
  }

  private updateFace(dt: number, env: BallEnv) {
    const T = this.timers;
    const c = this.renderPos();
    let target: Vec3;
    if (this.sleeping) target = add(c, [0, -0.8, 3]);
    else if (this.grabbed) target = env.camPos;
    else if (this.homing) target = add(this.goTo ?? this.home, [0, 0.6, 0]);
    else if (env.cursorActive && env.cursorTarget) target = env.cursorTarget;
    else {
      this.saccadeT -= dt;
      if (this.saccadeT <= 0 || !this.wanderTarget) {
        this.wanderTarget = this.pickWander(env);
        this.saccadeT = rand(1.4, 3.8);
      }
      target = this.wanderTarget;
    }
    if (this.homing && length(sub(target, c)) < 1.2) target = env.camPos;
    for (let i = 0; i < 3; i++) this.lookTarget[i] = damp(this.lookTarget[i], target[i], 9, dt);
    const d = normalize(sub(this.lookTarget, c));
    const yaw = Math.atan2(d[0], d[2]);
    const pitch = Math.asin(clamp(d[1], -1, 1));
    this.bodyYaw = damp(this.bodyYaw, clamp(yaw * 0.5, -0.95, 0.95), 4.5, dt);
    this.bodyPitch = damp(this.bodyPitch, clamp(pitch * 0.32, -0.25, 0.32), 4.5, dt);
    const local = qRotate(qConj(this.q), d);
    this.gaze[0] = damp(this.gaze[0], clamp(Math.atan2(local[0], local[2]), -0.55, 0.55), 15, dt);
    this.gaze[1] = damp(this.gaze[1], clamp(Math.asin(clamp(local[1], -1, 1)) - 0.06, -0.36, 0.42), 15, dt);

    if (this.hover) this.hoverTime += dt;
    this.pet = Math.max(0, this.pet - dt * 0.55);
    const E: Expression = { open: 1, happy: 0, surprise: 0, squint: 0, sleepy: 0, dizzy: 0, squeeze: 0, blush: 0 };
    if (env.weather === 'sunny') E.squint = clamp((dot(d, env.sunDir) - 0.55) * 1.6, 0, 0.6) * env.sunBright;
    if (env.weather === 'windy') E.squint = Math.max(E.squint, 0.3 + 0.25 * env.gust);
    if (env.weather === 'snow') E.squint = Math.max(E.squint, 0.1);
    if (this.hover && this.hoverTime > 0.25) E.happy = 1;
    if (this.pet > 0.45) { E.happy = 1; E.blush = clamp((this.pet - 0.35) * 1.5, 0, 1); }
    if (T.happy > 0) E.happy = 1;
    if (!this.grounded && !this.grabbed && length(this.vel) > 7.5) { E.surprise = 1; E.happy = 0; }
    if (T.surprise > 0 || T.startle > 0) { E.surprise = 1; E.happy = 0; E.squint = 0; }
    if (this.grabbed) { E.squeeze = 1; E.happy = 0; E.surprise = 0; }
    if (T.dizzy > 0) { E.dizzy = 1; E.happy = 0; E.squeeze = 0; E.surprise = 0; }
    if (this.sleeping) { E.sleepy = 1; E.happy = 0; E.squint = 0; E.surprise = 0; }
    if (E.happy > 0 || E.squeeze > 0 || E.dizzy > 0 || E.sleepy > 0) E.squint = 0;
    for (const k of EXPR_KEYS) this.expr[k] = damp(this.expr[k], E[k], k === 'blush' ? 3 : 13, dt);

    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkT = rand(1.8, 5.2);
      this.doubleBlink = Math.random() < 0.22;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.15;
      this.blink = Math.sin(Math.min(this.blinkPhase, 1) * Math.PI);
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1; this.blink = 0;
        if (this.doubleBlink) { this.doubleBlink = false; this.blinkT = 0.1; }
      }
    }

    let sqT = 1 + Math.sin(this.time * (this.sleeping ? 1.5 : 2.6)) * 0.009;
    if (!this.grounded && !this.grabbed) sqT += clamp(Math.abs(this.vel[1]) * 0.01, 0, 0.12);
    if (this.grabbed) sqT = 1.07 + Math.sin(this.time * 12) * 0.015;
    if (this.hover && !this.grabbed) sqT -= 0.025;
    this.squashV += ((sqT - this.squash) * 230 - this.squashV * 12) * dt;
    this.squash = clamp(this.squash + this.squashV * dt, 0.62, 1.32);

    this.dentV += (-this.dent * 320 - this.dentV * 15) * dt;
    this.dent = clamp(this.dent + this.dentV * dt, -0.04, 0.17);
  }

  private updateSurface(dt: number, env: BallEnv) {
    if (env.snowing > 0.05) this.accumulateSnow(env.snowing * 0.03 * dt);   // a full cap in about half a minute
    else this.snow = Math.max(0, this.snow - dt * 0.06);
    if (this.snow > 0.05 && this.capWorldDir()[1] < 0.5) {
      this.emit({ type: 'shed', amount: this.snow * 0.85, dir: this.capWorldDir() });
      this.snow *= 0.15;
    }
    const wetT = env.raining * (env.umbrella > 0.5 ? 0.35 : 1);
    this.wet = damp(this.wet, wetT, wetT > this.wet ? 0.6 : 0.07, dt);
  }

  renderState(): BallRenderState {
    const e = this.expr;
    return {
      position: this.renderPos(),
      quaternion: this.q,
      scale: this.scaleVec(),
      dent: { dir: this.dentDir, amount: Math.max(this.dent, 0) },
      gaze: this.gaze,
      expression: { ...e, open: e.open * (1 - this.blink) },
      wet: this.wet,
      snow: { dir: this.headToBody(this.snowDir), amount: this.snow },
      time: this.time,
    };
  }

  /** Collider sphere for contact AO / shadows on the ground: [x, y, z, r]. */
  colliderSphere(): [number, number, number, number] {
    const c = this.renderPos(), s = this.scaleVec();
    const lift = this.snow * 0.12;
    return [c[0], c[1] + lift, c[2], (s[0] + s[1]) * 0.5 + lift * 0.6];
  }
}
