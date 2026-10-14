// CPU particle pool for precipitation, splashes, blowing sand and sun motes. Particles
// collide with the ground, the ball (ellipsoid) and the umbrella canopy, and get stirred
// by the cursor. Rendering lives in ParticleRenderer.
import type { Vec3 } from '../core/math';
import type { UmbrellaPose } from '../characters/types';
import type { WeatherParams } from './presets';

export const PT = { RAIN: 0, SNOW: 1, MOTE: 2, SPLASH: 3, SAND: 4, CHUNK: 5, DRIP: 6 } as const;
export const PARTICLE_STRIDE = 10;

export interface ParticleBall {
  pos: Vec3;
  snow: number;
  accumulateSnow(a: number): void;
}

export interface ParticleContext {
  weather: WeatherParams;
  ball: ParticleBall;
  ballCenter: Vec3;
  ballScale: Vec3;
  umbPose: UmbrellaPose | null;
  cam: Vec3;
  cursor: { active: boolean; dir: Vec3; vel: Vec3 };
  region: { x0: number; x1: number; z0: number; z1: number; top: number };
  mapRect: [number, number, number, number];
  wind: [number, number];
  windStrength: number;
  gust: number;
}

export class ParticleSystem {
  readonly max: number;
  n = 0;
  quality = 1;
  readonly inst: Float32Array;
  impulses: number[][] = [];
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private age: Float32Array; private life: Float32Array; private size: Float32Array; private seed: Float32Array;
  private type: Uint8Array;
  private acc = { rain: 0, snow: 0, sand: 0, mote: 0, drip: 0 };
  private time = 0;

  constructor(max = 14000) {
    this.max = max;
    const f = () => new Float32Array(max);
    this.px = f(); this.py = f(); this.pz = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.age = f(); this.life = f(); this.size = f(); this.seed = f();
    this.type = new Uint8Array(max);
    this.inst = new Float32Array(max * PARTICLE_STRIDE);
  }

  spawn(type: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number): number {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size;
    this.type[i] = type; this.seed[i] = Math.random();
    return i;
  }

  private kill(i: number) {
    const j = --this.n;
    if (i === j) return;
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j];
    this.type[i] = this.type[j]; this.seed[i] = this.seed[j];
  }

  private impulse(x: number, z: number, r: number, s: number) {
    if (this.impulses.length < 32) this.impulses.push([x, z, r, s]);
  }

  // ---- bursts triggered by the ball -------------------------------------------------
  splashRing(x: number, z: number, n: number, power: number) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random()) * power;
      this.spawn(PT.SPLASH, x + Math.cos(a) * 0.7, 0.03, z + Math.sin(a) * 0.7,
        Math.cos(a) * s * 1.4, (1.5 + Math.random() * 2.2) * power, Math.sin(a) * s * 1.4, 0.5 + Math.random() * 0.3, 0.012);
    }
  }
  dustPuff(x: number, z: number, n: number, power: number) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * power;
      this.spawn(PT.SAND, x + Math.cos(a) * 0.8, 0.05, z + Math.sin(a) * 0.8,
        Math.cos(a) * s, 0.4 + Math.random() * power, Math.sin(a) * s, 0.9 + Math.random() * 0.6, 0.01);
    }
  }
  snowPuff(x: number, y: number, z: number, n: number, power: number, dir: Vec3 = [0, 1, 0]) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * power;
      this.spawn(PT.CHUNK, x + Math.cos(a) * 0.5, y, z + Math.sin(a) * 0.5,
        Math.cos(a) * s + dir[0] * power, dir[1] * power * (0.5 + Math.random()) + 1.2, Math.sin(a) * s + dir[2] * power,
        1.2 + Math.random() * 0.8, 0.018 + Math.random() * 0.03);
    }
  }
  rimDrops(p: UmbrellaPose, n: number) {
    const ax = p.axis;
    const ref: Vec3 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const ux = norm(cross3(ax, ref)), uz = cross3(ax, ux);
    const ct = Math.cos(p.canopyTheta), st = Math.sin(p.canopyTheta);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const d: Vec3 = [ux[0] * Math.cos(a) + uz[0] * Math.sin(a), ux[1] * Math.cos(a) + uz[1] * Math.sin(a), ux[2] * Math.cos(a) + uz[2] * Math.sin(a)];
      const rim: Vec3 = [0, 1, 2].map((i) => p.canopyCenter[i] + p.canopyRadius * (ax[i] * ct + d[i] * st)) as Vec3;
      const tan = cross3(ax, d);
      this.spawn(PT.SPLASH, rim[0], rim[1], rim[2], tan[0] * 3 + d[0], 1 + Math.random(), tan[2] * 3 + d[2], 0.8, 0.009);
    }
  }

  // ---- simulation -------------------------------------------------------------------
  update(dt: number, ctx: ParticleContext) {
    this.time += dt;
    this.impulses.length = 0;
    const W = ctx.weather, ball = ctx.ball;
    const q = this.quality;
    const ws = ctx.windStrength;
    const wx = ctx.wind[0] * ws, wz = ctx.wind[1] * ws;
    const { x0, x1, z0, z1, top } = ctx.region;

    this.acc.rain += W.rainRate * 2600 * q * dt;
    while (this.acc.rain >= 1) {
      this.acc.rain -= 1;
      const y = top * (0.75 + Math.random() * 0.25);
      const ft = y / 17;
      this.spawn(PT.RAIN, x0 + Math.random() * (x1 - x0) - wx * 5 * ft, y, z0 + Math.random() * (z1 - z0) - wz * 5 * ft,
        wx * 5 + (Math.random() - 0.5) * 0.4, -16 - Math.random() * 3, wz * 5, 3, 0.006 + Math.random() * 0.004);
    }
    this.acc.snow += W.snowRate * 300 * q * dt;
    while (this.acc.snow >= 1) {
      this.acc.snow -= 1;
      this.spawn(PT.SNOW, x0 + Math.random() * (x1 - x0) - wx * 4, top * (0.85 + Math.random() * 0.15), z0 + Math.random() * (z1 - z0) - wz * 4,
        wx * 1.4, -0.9 - Math.random() * 0.7, wz * 1.4, 30, 0.014 + Math.pow(Math.random(), 3) * 0.035);
    }
    this.acc.sand += W.sandRate * 900 * q * dt * (0.4 + 0.8 * ctx.gust);
    while (this.acc.sand >= 1) {
      this.acc.sand -= 1;
      const sx = ctx.wind[0] < 0 ? x1 + Math.random() * 2 : x0 - Math.random() * 2;
      const y = Math.pow(Math.random(), 2.5) * 2.2 + 0.02;
      this.spawn(PT.SAND, Math.random() < 0.6 ? sx : x0 + Math.random() * (x1 - x0), y, z0 + Math.random() * (z1 - z0),
        wx * (6 + Math.random() * 5), (Math.random() - 0.3) * 1.5, wz * (6 + Math.random() * 5), 4 + Math.random() * 3, 0.006 + Math.random() * 0.008);
    }
    this.acc.mote += W.motes * 22 * q * dt;
    while (this.acc.mote >= 1) {
      this.acc.mote -= 1;
      const c = ball.pos;
      this.spawn(PT.MOTE, c[0] + (Math.random() - 0.6) * 10, 0.2 + Math.random() * 4, c[2] + (Math.random() - 0.4) * 9,
        (Math.random() - 0.5) * 0.1, (Math.random() - 0.4) * 0.08, (Math.random() - 0.5) * 0.1, 5 + Math.random() * 5, 0.01 + Math.random() * 0.018);
    }
    // rain collected by the canopy runs off the rib tips as drip lines
    const pose = ctx.umbPose;
    if (pose && W.rainRate > 0.05 && pose.open > 0.7) {
      this.acc.drip += W.rainRate * 7 * q * dt * pose.ribTips.length;
      while (this.acc.drip >= 1) {
        this.acc.drip -= 1;
        const tip = pose.ribTips[(Math.random() * pose.ribTips.length) | 0];
        this.spawn(PT.DRIP, tip[0], tip[1] - 0.012, tip[2],
          wx * 0.15 + (Math.random() - 0.5) * 0.06, -0.2 - Math.random() * 0.45, wz * 0.15 + (Math.random() - 0.5) * 0.06,
          2.5, 0.011 + Math.random() * 0.007);
      }
    }
    // gusts send sand skimming around the ball
    if (W.sandRate > 0.3 && ctx.gust > 0.6 && Math.random() < dt * 40 * W.sandRate) {
      const c = ball.pos;
      for (let k = 0; k < 3; k++) {
        const a = (Math.random() - 0.5) * 2.4;
        const side = [Math.cos(a) * -ctx.wind[0] - Math.sin(a) * -ctx.wind[1], Math.sin(a) * -ctx.wind[0] + Math.cos(a) * -ctx.wind[1]];
        this.spawn(PT.SAND, c[0] + side[0] * 1.05, 0.05 + Math.random() * 0.4, c[2] + side[1] * 1.05,
          wx * 5 + side[1] * 2, 1.5 + Math.random() * 3, wz * 5 - side[0] * 2, 1.5, 0.007);
      }
    }
    this.simulate(dt, ctx, wx, wz);
  }
  private simulate(dt: number, ctx: ParticleContext, wx: number, wz: number) {
    const { ball, cam, cursor, region, mapRect } = ctx;
    const bc = ctx.ballCenter, bs = ctx.ballScale;
    const pose = ctx.umbPose;
    const cosTheta = pose ? Math.cos(pose.canopyTheta) : 0;
    const t = this.time;
    const q = this.quality;
    const { px, py, pz, vx: VX, vy: VY, vz: VZ } = this;
    const capPad = 1 + ball.snow * 0.18;

    for (let i = 0; i < this.n; i++) {
      const ty = this.type[i];
      this.age[i] += dt;
      if (this.age[i] > this.life[i]) { this.kill(i); i--; continue; }
      let x = px[i], y = py[i], z = pz[i];
      let vx = VX[i], vy = VY[i], vz = VZ[i];

      if (ty === PT.SNOW) {
        const s = this.seed[i] * 6.283;
        vx += (Math.sin(t * 1.3 + s) * 0.45 + wx * 1.4 - vx) * dt * 1.5;
        vz += (Math.cos(t * 1.1 + s * 1.3) * 0.35 + wz * 1.4 - vz) * dt * 1.5;
      } else if (ty === PT.MOTE) {
        vx += (Math.random() - 0.5) * 0.4 * dt; vy += (Math.random() - 0.5) * 0.3 * dt; vz += (Math.random() - 0.5) * 0.4 * dt;
        const d = Math.exp(-dt * 0.6); vx *= d; vy *= d; vz *= d;
      } else if (ty === PT.SPLASH) {
        vy -= 20 * dt;
      } else if (ty === PT.DRIP) {
        vy -= 9.8 * dt;
        vx += (wx * 0.6 - vx) * dt * 0.4;
        vz += (wz * 0.6 - vz) * dt * 0.4;
      } else if (ty === PT.SAND) {
        vy -= 5 * dt;
        vx += (wx * 8 - vx) * dt * 0.7;
        vz += (wz * 8 - vz) * dt * 0.7;
      } else if (ty === PT.CHUNK) {
        vy -= 13 * dt;
        const d = Math.exp(-dt * 0.6); vx *= d; vz *= d;
      }

      // cursor stirring: a screen-space brush converted to world velocity at the particle depth
      if (cursor.active && ty !== PT.SPLASH) {
        const dx = x - cam[0], dy = y - cam[1], dz = z - cam[2];
        const along = dx * cursor.dir[0] + dy * cursor.dir[1] + dz * cursor.dir[2];
        if (along > 0.5) {
          const cx = dx - cursor.dir[0] * along, cy = dy - cursor.dir[1] * along, cz = dz - cursor.dir[2] * along;
          const rad = 0.35 + along * 0.07;
          const d2 = cx * cx + cy * cy + cz * cz;
          if (d2 < rad * rad) {
            const f = (1 - Math.sqrt(d2) / rad) * (ty === PT.RAIN ? 0.5 : 1);
            const k = Math.min(1, f * dt * 9);
            vx += (cursor.vel[0] * along - vx) * k;
            vy += (cursor.vel[1] * along - vy) * k * (ty === PT.RAIN ? 0.2 : 1);
            vz += (cursor.vel[2] * along - vz) * k;
          }
        }
      }

      const ox0 = (x - bc[0]) / bs[0], oy0 = (y - bc[1]) / bs[1], oz0 = (z - bc[2]) / bs[2];
      const r20 = ox0 * ox0 + oy0 * oy0 + oz0 * oz0;
      // light particles flow around the ball
      if ((ty === PT.SAND || ty === PT.SNOW || ty === PT.MOTE) && r20 < 5 && r20 > 1) {
        const r = Math.sqrt(r20);
        const nx = ox0 / r, ny = oy0 / r, nz = oz0 / r;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn < 0) {
          const k = Math.min(1, 1.15 / (r * r * r));
          vx -= vn * nx * k; vy -= vn * ny * k; vz -= vn * nz * k;
          if (ty === PT.SAND) vy += Math.abs(vn) * k * 0.35;
        }
      }

      x += vx * dt; y += vy * dt; z += vz * dt;

      // ball
      const ox = (x - bc[0]) / bs[0], oy = (y - bc[1]) / bs[1], oz = (z - bc[2]) / bs[2];
      const r2 = ox * ox + oy * oy + oz * oz;
      if (r2 < capPad * capPad) {
        const r = Math.sqrt(r2) || 1;
        const nx = ox / r, ny = oy / r, nz = oz / r;
        if (ty === PT.RAIN || ty === PT.DRIP) {
          if (Math.random() < 0.7 * q) {
            for (let k = 0; k < 2; k++) {
              this.spawn(PT.SPLASH, x, y, z, nx * 1.8 + (Math.random() - 0.5) * 1.5, ny * 1.4 + 1.2 + Math.random(), nz * 1.8 + (Math.random() - 0.5) * 1.5, 0.35, 0.008);
            }
          }
          this.kill(i); i--; continue;
        }
        if (ty === PT.SNOW) {
          if (ny > 0.2) ball.accumulateSnow(0.0012 * ny);
          this.kill(i); i--; continue;
        }
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn < 0) { vx -= 1.5 * vn * nx; vy -= 1.5 * vn * ny; vz -= 1.5 * vn * nz; }
        x = bc[0] + nx * bs[0] * capPad; y = bc[1] + ny * bs[1] * capPad; z = bc[2] + nz * bs[2] * capPad;
      }

      // umbrella canopy (outer surface crossing)
      if (pose && (ty === PT.RAIN || ty === PT.SNOW)) {
        const C = pose.canopyCenter, R = pose.canopyRadius, A = pose.axis;
        const cx = x - C[0], cy = y - C[1], cz = z - C[2];
        const d2 = cx * cx + cy * cy + cz * cz;
        if (d2 < R * R) {
          const bx = cx - vx * dt, by = cy - vy * dt, bz = cz - vz * dt;
          const d = Math.sqrt(d2);
          const ca = (cx * A[0] + cy * A[1] + cz * A[2]) / d;
          if (bx * bx + by * by + bz * bz >= R * R * 0.97 && ca > cosTheta) {
            const nx = cx / d, ny = cy / d, nz = cz / d;
            if (ty === PT.RAIN && Math.random() < 0.85 * q) {
              for (let k = 0; k < 2; k++) {
                this.spawn(PT.SPLASH, x, y, z, nx * 1.4 + (Math.random() - 0.5) * 1.6, ny * 1.4 + 1.0 + Math.random() * 1.2,
                  nz * 1.4 + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 0.15, 0.011 + Math.random() * 0.005);
              }
            }
            if (ty === PT.RAIN && Math.random() < 0.07) {
              // a drip leaves the rim below the hit
              let sx = nx - A[0] * ca, sy = ny - A[1] * ca, sz = nz - A[2] * ca;
              const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
              const st = Math.sin(pose.canopyTheta);
              this.spawn(PT.DRIP,
                C[0] + R * (A[0] * cosTheta + sx * st), C[1] + R * (A[1] * cosTheta + sy * st), C[2] + R * (A[2] * cosTheta + sz * st),
                sx * 0.3, -0.6, sz * 0.3, 2.5, 0.011);
            }
            this.kill(i); i--; continue;
          }
        }
      }

      // ground
      if (y <= 0) {
        if (ty === PT.RAIN) {
          const dc = (x - cam[0]) ** 2 + (z - cam[2]) ** 2;
          if (dc < 500 && Math.random() < 0.45 * q) {
            const n = 1 + (Math.random() < 0.4 ? 1 : 0);
            for (let k = 0; k < n; k++) {
              const a = Math.random() * 6.283;
              this.spawn(PT.SPLASH, x, 0.01, z, Math.cos(a) * 0.9, 1.4 + Math.random() * 1.4, Math.sin(a) * 0.9, 0.3, 0.007);
            }
          }
          if (x > mapRect[0] && x < mapRect[1] && z > mapRect[2] && z < mapRect[3] && Math.random() < 0.08) this.impulse(x, z, 0.09, -0.22);
          this.kill(i); i--; continue;
        }
        if (ty === PT.DRIP) {
          if (Math.random() < 0.8 * q) {
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * 6.283;
              this.spawn(PT.SPLASH, x, 0.01, z, Math.cos(a) * 0.8, 1.2 + Math.random() * 1.2, Math.sin(a) * 0.8, 0.28, 0.008);
            }
          }
          if (x > mapRect[0] && x < mapRect[1] && z > mapRect[2] && z < mapRect[3]) this.impulse(x, z, 0.08, -0.26);
          this.kill(i); i--; continue;
        }
        if (ty === PT.SNOW || ty === PT.SPLASH || ty === PT.CHUNK) { this.kill(i); i--; continue; }
        if (ty === PT.SAND) {
          y = 0.005;
          vy = Math.abs(vy) * 0.3 + (Math.random() < 0.25 ? Math.random() * 2.2 * (0.3 + ctx.gust) : 0);
        } else if (ty === PT.MOTE) { y = 0.01; vy = Math.abs(vy); }
      }

      if (x < region.x0 - 5 || x > region.x1 + 5 || z < region.z0 - 5 || z > region.z1 + 3 || y > region.top + 3) {
        this.kill(i); i--; continue;
      }
      px[i] = x; py[i] = y; pz[i] = z;
      VX[i] = vx; VY[i] = vy; VZ[i] = vz;
    }
  }

  /** Pack live particles into the instance buffer: pos(3) size, vel(3) alpha, type seed. */
  writeInstances(): number {
    const a = this.inst;
    for (let i = 0; i < this.n; i++) {
      const o = i * PARTICLE_STRIDE;
      const ty = this.type[i];
      const age = this.age[i], life = this.life[i];
      const al = ty === PT.SNOW || ty === PT.SAND || ty === PT.MOTE
        ? Math.min(1, age * 1.5) * Math.min(1, (life - age) * 1.2)
        : Math.min(1, age * 12) * Math.min(1, (life - age) * 5);
      a[o] = this.px[i]; a[o + 1] = this.py[i]; a[o + 2] = this.pz[i]; a[o + 3] = this.size[i];
      a[o + 4] = this.vx[i]; a[o + 5] = this.vy[i]; a[o + 6] = this.vz[i]; a[o + 7] = al;
      a[o + 8] = ty; a[o + 9] = this.seed[i];
    }
    return this.n;
  }
}

function cross3(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: Vec3): Vec3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
