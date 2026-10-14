import {
  Box3, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Material,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { applyPatches } from '../../core/patch';
import { atmospherePatch } from '../../world/atmosphere';
import type { BallAsset, ExpressionChannel } from '../../config/assets';
import type { BallRenderState, BallVisual, Expression } from '../types';
import { createSurfaceUniforms, snowCapPatch, surfacePatch, type SurfaceUniforms } from './surfacePatch';

type GltfBallAsset = Extract<BallAsset, { kind: 'gltf' }>;

const isPbr = (m: Material): m is MeshStandardMaterial => (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/**
 * A GLTF model driven by the ball brain. The model is centred and rescaled so its
 * bounding sphere matches `radius`; static meshes get their node transforms baked so
 * the surface effects (face decal, wetness, snow rim) work in a common body space.
 */
export class GltfBall implements BallVisual {
  readonly root = new Group();
  readonly radius: number;
  readonly uniforms: SurfaceUniforms = createSurfaceUniforms();
  private squash = new Group();
  private body = new Group();
  private morphTargets: { mesh: Mesh; map: Partial<Record<ExpressionChannel, number>> }[] = [];
  private cap: Mesh | null = null;
  private meshes: Mesh[] = [];

  constructor(gltf: GLTF, cfg: GltfBallAsset) {
    this.radius = cfg.radius ?? 1;
    this.uniforms.uBodyRadius.value = this.radius;
    const model = gltf.scene;
    model.updateMatrixWorld(true);

    // centre + fit: radius = farthest vertex from the box centre (exact for round models)
    const box = new Box3().setFromObject(model, true);
    const center = box.getCenter(new Vector3());
    let sphereR = 0;
    const v = new Vector3();
    model.traverse((o) => {
      const m = o as Mesh;
      const pos = m.isMesh ? m.geometry.getAttribute('position') : null;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) sphereR = Math.max(sphereR, v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).distanceTo(center));
    });
    sphereR = sphereR || 1;
    const fit = cfg.fit === undefined || cfg.fit === 'auto' ? this.radius / sphereR : cfg.fit;
    const toBody = new Matrix4().makeScale(fit, fit, fit).multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
    if (cfg.forward) {
      const q = new Quaternion().setFromUnitVectors(new Vector3(...cfg.forward).normalize(), new Vector3(0, 0, 1));
      toBody.premultiply(new Matrix4().makeRotationFromQuaternion(q));
    }

    const faceMode = cfg.face?.mode ?? 'procedural';
    const patchSurface = surfacePatch(this.uniforms, { face: faceMode === 'procedural', dent: false });
    const holder = new Group();
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const skinned = (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh;
      if (!skinned) {
        // bake node transform → mesh lives directly in body space
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.applyMatrix4(new Matrix4().multiplyMatrices(toBody, mesh.matrixWorld));
        mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1);
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => { if (isPbr(m)) applyPatches(m, [atmospherePatch, patchSurface]); });
      mesh.castShadow = true;
      this.meshes.push(mesh);
      if (faceMode === 'morph' && mesh.morphTargetDictionary && cfg.face?.morphs) {
        const map: Partial<Record<ExpressionChannel, number>> = {};
        for (const [ch, name] of Object.entries(cfg.face.morphs)) {
          const i = mesh.morphTargetDictionary[name as string];
          if (i !== undefined) map[ch as ExpressionChannel] = i;
        }
        this.morphTargets.push({ mesh, map });
      }
    });
    for (const m of this.meshes) {
      if (!(m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) holder.add(m);
    }
    // skinned hierarchies keep their rig: place the whole scene with the body transform
    if (this.meshes.some((m) => (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh)) {
      model.applyMatrix4(toBody);
      holder.add(model);
    }

    if (cfg.snowShell !== false) {
      const capMat = new MeshStandardMaterial({ color: 0xf6f8ff, roughness: 0.88 });
      applyPatches(capMat, [atmospherePatch, snowCapPatch(this.uniforms)]);
      this.cap = new Mesh(new SphereGeometry(this.radius * 1.0, 192, 144), capMat);
      this.cap.visible = false;
      holder.add(this.cap);
    }
    this.body.add(holder);
    this.squash.add(this.body);
    this.root.add(this.squash);
    this.root.name = 'ball-root';
  }

  setEnvIntensity(v: number) { this.uniforms.uEnvGain.value = v; }

  forEachMesh(fn: (o: Object3D) => void) {
    this.meshes.forEach(fn);
    if (this.cap) fn(this.cap);
  }

  update(s: BallRenderState) {
    this.root.position.fromArray(s.position);
    this.squash.scale.fromArray(s.scale).multiplyScalar(1 / this.radius);
    this.body.quaternion.fromArray(s.quaternion);
    const u = this.uniforms;
    u.uSnowCap.value.set(s.snow.dir[0], s.snow.dir[1], s.snow.dir[2], s.snow.amount);
    u.uWet.value = s.wet;
    u.uGaze.value.set(s.gaze[0], s.gaze[1]);
    const e: Expression = s.expression;
    u.uEyeA.value.set(e.open, e.happy, e.surprise, e.squint);
    u.uEyeB.value.set(e.sleepy, e.dizzy, e.squeeze, e.blush);
    if (this.cap) this.cap.visible = s.snow.amount > 0.004;
    for (const { mesh, map } of this.morphTargets) {
      const inf = mesh.morphTargetInfluences;
      if (!inf) continue;
      const set = (ch: ExpressionChannel, v: number) => { const i = map[ch]; if (i !== undefined) inf[i] = v; };
      set('blink', 1 - e.open);
      set('happy', e.happy); set('surprise', e.surprise); set('squint', e.squint);
      set('sleepy', e.sleepy); set('dizzy', e.dizzy); set('squeeze', e.squeeze); set('blush', e.blush);
    }
  }

  dispose() {
    this.meshes.forEach((m) => m.geometry.dispose());
    this.cap?.geometry.dispose();
  }
}
