import { Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, type Object3D } from 'three';
import { applyPatches } from '../../core/patch';
import { atmospherePatch } from '../../world/atmosphere';
import type { BallRenderState, BallVisual } from '../types';
import { createSurfaceUniforms, snowCapPatch, surfacePatch, type SurfaceUniforms } from './surfacePatch';

/**
 * Default ball: a soft-touch porcelain sphere with a procedural face, poke dents,
 * rain beading and a displaced snow-cap shell.
 *
 * Hierarchy: root (position) → squash (world-aligned scale) → body (orientation) → meshes,
 * so squash & stretch always happens along world axes even while the ball rolls.
 */
export class ProceduralBall implements BallVisual {
  readonly root = new Group();
  readonly radius = 1;
  readonly uniforms: SurfaceUniforms = createSurfaceUniforms();
  private squash = new Group();
  private body = new Group();
  private shell: Mesh;
  private cap: Mesh;

  constructor() {
    const mat = new MeshPhysicalMaterial({
      color: new Color().setRGB(0.87, 0.85, 0.81),
      roughness: 0.4,
      clearcoat: 0.28,
      clearcoatRoughness: 0.32,
      sheen: 0.3,
      sheenRoughness: 0.8,
      sheenColor: new Color(1, 1, 1),
    });
    applyPatches(mat, [atmospherePatch, surfacePatch(this.uniforms, { face: true, dent: true })]);
    this.shell = new Mesh(new SphereGeometry(1, 160, 112), mat);
    this.shell.castShadow = true;
    this.shell.name = 'ball';

    const capMat = new MeshStandardMaterial({ color: new Color().setRGB(0.97, 0.98, 1.0), roughness: 0.88 });
    applyPatches(capMat, [atmospherePatch, snowCapPatch(this.uniforms)]);
    this.cap = new Mesh(new SphereGeometry(1, 192, 144), capMat);
    this.cap.name = 'ball-snowcap';
    this.cap.visible = false;

    this.body.add(this.shell, this.cap);
    this.squash.add(this.body);
    this.root.add(this.squash);
    this.root.name = 'ball-root';
  }

  forEachMesh(fn: (o: Object3D) => void) { fn(this.shell); fn(this.cap); }

  /** Scale of sky reflections/ambient on the shell (lower on backlit days for subject contrast). */
  setEnvIntensity(v: number) { this.uniforms.uEnvGain.value = v; }

  update(s: BallRenderState) {
    this.root.position.fromArray(s.position);
    this.squash.scale.fromArray(s.scale);
    this.body.quaternion.fromArray(s.quaternion);
    const u = this.uniforms;
    u.uDent.value.set(s.dent.dir[0], s.dent.dir[1], s.dent.dir[2], s.dent.amount);
    u.uSnowCap.value.set(s.snow.dir[0], s.snow.dir[1], s.snow.dir[2], s.snow.amount);
    u.uWet.value = s.wet;
    u.uGaze.value.set(s.gaze[0], s.gaze[1]);
    const e = s.expression;
    u.uEyeA.value.set(e.open, e.happy, e.surprise, e.squint);
    u.uEyeB.value.set(e.sleepy, e.dizzy, e.squeeze, e.blush);
    this.cap.visible = s.snow.amount > 0.004;
  }

  dispose() {
    this.shell.geometry.dispose();
    (this.shell.material as MeshPhysicalMaterial).dispose();
    this.cap.geometry.dispose();
    (this.cap.material as MeshStandardMaterial).dispose();
  }
}
