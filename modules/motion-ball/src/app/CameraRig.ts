import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { clamp, damp, type Vec3 } from '../core/math';

/**
 * Hero composition: low camera looking slightly up over the flat, ball on the right
 * third (centred on portrait screens), gentle pointer parallax and impact shake.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 40000);
  cssW = 1; cssH = 1;
  aspect = 1;
  fov = 38; pitch = -1; camH = 2.2; dist = 9.6;
  tanH = Math.tan(MathUtils.degToRad(19));
  homeX = 3;
  shake = 0;
  /** Ball's horizontal screen position in NDC (−1 left … 1 right); null = the default composition. */
  ballX: number | null = null;
  portraitBallX: number | null = null;
  private parallax = [0, 0];
  private tmp = new Vector3();

  layout(w: number, h: number) {
    this.cssW = Math.max(1, w); this.cssH = Math.max(1, h);
    this.aspect = this.cssW / this.cssH;
    const portrait = this.aspect < 0.95;
    this.fov = portrait ? 46 : 38;
    // eye level just above the ball, tilted slightly down: the horizon sits near mid-frame so the
    // ball is seen against the reflective flat, with the ranges and sky stacked above it
    this.pitch = portrait ? -2.5 : -1;
    this.camH = portrait ? 2.4 : 2.2;
    this.dist = portrait ? 9.4 : 9.6;
    this.tanH = Math.tan(MathUtils.degToRad(this.fov / 2));
    const ndcX = portrait
      ? (this.portraitBallX ?? 0)
      : (this.ballX ?? clamp(0.58 - (1.75 - this.aspect) * 0.12, 0.38, 0.62));
    this.homeX = ndcX * this.tanH * this.aspect * this.dist;
    this.camera.fov = this.fov;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Visible half-width at the ball's depth (for keeping the ball on screen). */
  get halfWidth() { return this.dist * this.tanH * this.aspect; }

  update(dt: number, pointerNdc: [number, number] | null) {
    const tx = pointerNdc ? pointerNdc[0] : 0;
    const ty = pointerNdc ? pointerNdc[1] : 0;
    this.parallax[0] = damp(this.parallax[0], tx, 2.2, dt);
    this.parallax[1] = damp(this.parallax[1], ty, 2.2, dt);
    const yaw = -this.parallax[0] * 0.012;
    const pitch = MathUtils.degToRad(this.pitch) + this.parallax[1] * 0.006;
    const cam = this.camera;
    cam.position.set(this.parallax[0] * 0.22, this.camH + this.parallax[1] * 0.08, this.dist);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.05;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake = Math.max(0, this.shake - dt * 4);
    }
    cam.rotation.set(pitch, -yaw, 0, 'YXZ');   // three yaws left for +y; we orbit toward the pointer
    cam.updateMatrixWorld();
  }

  get position(): Vec3 { const p = this.camera.position; return [p.x, p.y, p.z]; }

  /** World ray direction through a normalized device coordinate. */
  ray(ndcX: number, ndcY: number): Vec3 {
    const v = this.tmp.set(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return [v.x, v.y, v.z];
  }

  /** World point → CSS pixels (+ clip w for "in front" tests). */
  project(p: Vec3): [number, number, number] {
    const v = this.tmp.set(p[0], p[1], p[2]);
    const w = v.clone().applyMatrix4(this.camera.matrixWorldInverse).z * -1;
    v.project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.cssW, (0.5 - v.y * 0.5) * this.cssH, w];
  }

  /** Camera basis vectors (right, up) for converting screen motion to world motion. */
  basis(): { right: Vec3; up: Vec3 } {
    const e = this.camera.matrixWorld.elements;
    return { right: [e[0], e[1], e[2]], up: [e[4], e[5], e[6]] };
  }
}
