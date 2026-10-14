import { add, clamp, dot, normalize, scale, sub, type Vec3 } from '../../core/math';
import type { BallBrain } from '../ball/BallBrain';
import { UMBRELLA_GEOMETRY as G, type UmbrellaPose } from '../types';

export interface UmbrellaEnv {
  raining: number;
  wind: [number, number];
  windStrength: number;
}

/**
 * Umbrella dynamics: springy pop-open, pendulum lag behind the ball, wind lean,
 * spin on click and being blown away when the rain turns into a storm.
 * Produces a pose; any UmbrellaVisual draws it.
 */
export class UmbrellaRig {
  open = 0; openV = 0;
  tilt: [number, number] = [-0.1, -0.16]; tiltV: [number, number] = [0, 0];
  spin = 0; spinV = 0;
  private pv: Vec3 = [0, 0, 0];
  private away: { off: Vec3; vel: Vec3; t: number } | null = null;
  pose: UmbrellaPose | null = null;

  get isAway() { return !!this.away; }

  blowAway(wind: [number, number]): boolean {
    if (this.open < 0.5 || this.away) return false;
    this.away = { off: [0, 0, 0], vel: [wind[0] * 7, 5.5, wind[1] * 7], t: 0 };
    return true;
  }

  update(dt: number, ball: BallBrain, env: UmbrellaEnv) {
    const target = env.raining > 0.3 && !this.away ? 1 : 0;
    if (this.away) {
      const a = this.away;
      a.t += dt;
      a.vel[1] -= 2.5 * dt;
      for (let i = 0; i < 3; i++) a.off[i] += a.vel[i] * dt;
      this.tilt[0] += dt * 2.2; this.tilt[1] += dt * 1.3;
      this.spinV = 6;
      if (a.t > 3) { this.away = null; this.open = 0; this.openV = 0; this.tilt = [-0.1, -0.16]; }
    } else {
      this.openV += ((target - this.open) * 85 - this.openV * 9) * dt;
      this.open = Math.max(0, this.open + this.openV * dt);
      if (target === 0 && this.open < 0.02) { this.open = 0; this.openV = 0; }
      const ax = clamp((ball.vel[0] - this.pv[0]) / Math.max(dt, 1e-4), -80, 80);
      const az = clamp((ball.vel[2] - this.pv[2]) / Math.max(dt, 1e-4), -80, 80);
      const ws = env.windStrength;
      const restX = -0.1 + env.wind[0] * ws * 0.3;
      const restZ = -0.16 - env.wind[1] * ws * 0.3;
      this.tiltV[0] += ((restX - this.tilt[0]) * 55 - this.tiltV[0] * 6.5 - ax * 0.03) * dt;
      this.tiltV[1] += ((restZ - this.tilt[1]) * 55 - this.tiltV[1] * 6.5 + az * 0.03) * dt;
      this.tilt[0] += this.tiltV[0] * dt;
      this.tilt[1] += this.tiltV[1] * dt;
    }
    this.pv = [...ball.vel] as Vec3;
    this.spinV *= Math.exp(-dt * 1.6);
    this.spin += this.spinV * dt;
    this.pose = this.computePose(ball);
  }

  private computePose(ball: BallBrain): UmbrellaPose | null {
    const s = this.open;
    if (s <= 0.001) return null;
    const c = ball.renderPos();
    const axis = normalize([Math.tan(this.tilt[0]), 1, -Math.tan(this.tilt[1])]);
    // the shaft leans on the ball's front-right side; the handle end rests on the ground (and is
    // lifted along when the ball jumps)
    let anchor = add(c, [0.55, 0, 0.84]);
    anchor[1] = Math.max(anchor[1], axis[1] * G.below * s);
    if (this.away) anchor = add(anchor, this.away.off);
    const top = add(anchor, scale(axis, G.apex * s));
    const R = G.radius * s;
    // rib tips in umbrella space (the canopy spins about the shaft), then onto the tilted shaft
    const st = Math.sin(G.theta) * R, cy = (G.apex - G.radius) * s + Math.cos(G.theta) * R;
    const ribTips: Vec3[] = [];
    for (let k = 0; k < G.ribs; k++) {
      const phi = (k / G.ribs) * Math.PI * 2 - this.spin;
      ribTips.push(add(anchor, fromY(axis, [Math.cos(phi) * st, cy, Math.sin(phi) * st])));
    }
    return {
      visible: true, anchor, axis, open: s, spin: this.spin,
      canopyCenter: sub(top, scale(axis, R)), canopyRadius: R, canopyTheta: G.theta, ribTips,
    };
  }

  /** Ray vs canopy (spherical cap) for click handling. */
  hit(ro: Vec3, rd: Vec3): { t: number; point: Vec3 } | null {
    const p = this.pose;
    if (!p) return null;
    const oc = sub(ro, p.canopyCenter);
    const b = dot(oc, rd);
    const h = b * b - (dot(oc, oc) - p.canopyRadius * p.canopyRadius);
    if (h < 0) return null;
    const sq = Math.sqrt(h);
    for (const t of [-b - sq, -b + sq]) {
      if (t <= 0) continue;
      const q = add(ro, scale(rd, t));
      const v = normalize(sub(q, p.canopyCenter));
      if (Math.acos(clamp(dot(v, p.axis), -1, 1)) < p.canopyTheta) return { t, point: q };
    }
    return null;
  }

  /** Dry footprint on the ground: [x, z, radius, strength]. */
  shelter(windDir: [number, number], wind: number): [number, number, number, number] {
    const p = this.pose;
    if (!p) return [0, 0, 1, 0];
    const rim = add(p.canopyCenter, scale(p.axis, p.canopyRadius * Math.cos(p.canopyTheta)));
    const rr = p.canopyRadius * Math.sin(p.canopyTheta);
    return [rim[0] - windDir[0] * wind * rim[1] * 0.25, rim[2] - windDir[1] * wind * rim[1] * 0.25, rr, Math.min(p.open, 1)];
  }
}

/** Rotate `v` by the rotation taking +Y onto the unit vector `axis` (as Quaternion.setFromUnitVectors). */
function fromY(axis: Vec3, v: Vec3): Vec3 {
  const c = axis[1];
  const kx = axis[2], kz = -axis[0];          // +Y × axis
  const s = Math.hypot(kx, kz);
  if (s < 1e-6) return c > 0 ? v : [v[0], -v[1], -v[2]];
  const nx = kx / s, nz = kz / s;
  // Rodrigues: v cosθ + (k × v) sinθ + k (k·v)(1 − cosθ), with k = (nx, 0, nz)
  const kv = nx * v[0] + nz * v[2];
  const cx = -nz * v[1], cyy = nz * v[0] - nx * v[2], cz = nx * v[1];
  return [
    v[0] * c + cx * s + nx * kv * (1 - c),
    v[1] * c + cyy * s,
    v[2] * c + cz * s + nz * kv * (1 - c),
  ];
}
