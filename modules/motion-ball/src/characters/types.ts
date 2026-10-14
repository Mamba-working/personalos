import type { Object3D } from 'three';
import type { Quat, Vec3 } from '../core/math';

/**
 * Contract between the simulation ("brains") and whatever draws the characters.
 * The procedural ball/umbrella implement these, and so do the GLTF-backed versions,
 * which is what makes the models swappable from `config/assets.ts`.
 */

export interface Expression {
  open: number;      // 0 closed .. 1 open (blink already folded in)
  happy: number;     // ^ ^
  surprise: number;  // round, wide
  squint: number;    // narrowed (sun / wind)
  sleepy: number;    // ‿ ‿
  dizzy: number;     // x x
  squeeze: number;   // > <
  blush: number;
}

export interface BallRenderState {
  /** Render centre in world space (squash keeps the bottom on the ground). */
  position: Vec3;
  /** Body orientation, local → world. Local +Z is the face, +Y is up. */
  quaternion: Quat;
  /** World-aligned squash & stretch. */
  scale: Vec3;
  /** Poke dent in body-local space. */
  dent: { dir: Vec3; amount: number };
  /** Eye offset on the surface (yaw, pitch in radians) — the face "slides" to look. */
  gaze: [number, number];
  expression: Expression;
  wet: number;
  /** Accumulated snow cap in body-local space. */
  snow: { dir: Vec3; amount: number };
  time: number;
}

export interface BallVisual {
  readonly root: Object3D;
  /** Physical radius used by physics and particle collisions. */
  readonly radius: number;
  update(state: BallRenderState, dt: number): void;
  dispose(): void;
}

export interface UmbrellaPose {
  visible: boolean;
  /** Where the ball holds the shaft (world). */
  anchor: Vec3;
  /** Shaft direction, pointing at the canopy apex. */
  axis: Vec3;
  /** Pop-open scale (springy, can overshoot 1). */
  open: number;
  /** Rotation of the canopy around the shaft. */
  spin: number;
  /** Canopy collider (spherical cap) used by rain particles. */
  canopyCenter: Vec3;
  canopyRadius: number;
  canopyTheta: number;
  /** World positions of the rib tips, where rain water runs off the canopy. */
  ribTips: Vec3[];
}

export interface UmbrellaVisual {
  readonly root: Object3D;
  update(pose: UmbrellaPose, dt: number): void;
  dispose(): void;
}

/**
 * Canopy geometry shared by the rig (collider) and the procedural mesh: a classic clear stick
 * umbrella nearly twice the ball's width, its handle resting on the ground beside the ball.
 */
export const UMBRELLA_GEOMETRY = {
  apex: 2.45,         // shaft length from the hand up to the top of the canopy
  below: 1.05,        // shaft length below the hand, to the end of the handle (on the ground)
  radius: 2.45,       // canopy sphere radius
  theta: 0.86,        // canopy half angle (radians): ~1.85 across the hem, ~0.85 deep
  ribs: 8,
};
