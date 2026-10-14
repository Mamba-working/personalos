import { Group, Quaternion, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { applyPatches } from '../../core/patch';
import { atmospherePatch } from '../../world/atmosphere';
import type { UmbrellaAsset } from '../../config/assets';
import type { UmbrellaPose, UmbrellaVisual } from '../types';

type GltfUmbrellaAsset = Extract<UmbrellaAsset, { kind: 'gltf' }>;

/** A GLTF umbrella posed by the UmbrellaRig. Expects +Y along the shaft, origin at the grip. */
export class GltfUmbrella implements UmbrellaVisual {
  readonly root = new Group();
  private spin: Object3D | null;
  private meshes: Mesh[] = [];
  private q = new Quaternion();
  private y = new Vector3(0, 1, 0);
  private axis = new Vector3();
  private baseScale: number;

  constructor(gltf: GLTF, cfg: GltfUmbrellaAsset) {
    this.baseScale = cfg.scale ?? 1;
    const model = gltf.scene;
    this.spin = model.getObjectByName(cfg.spinNode ?? 'canopy') ?? null;
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      this.meshes.push(m);
      m.castShadow = !(cfg.transmissive ?? []).includes(m.name);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if ((mat as MeshStandardMaterial).isMeshStandardMaterial) applyPatches(mat as MeshStandardMaterial, [atmospherePatch]);
      });
    });
    this.root.add(model);
    this.root.visible = false;
    this.root.name = 'umbrella';
  }

  forEachMesh(fn: (m: Mesh) => void) { this.meshes.forEach(fn); }

  update(pose: UmbrellaPose, _dt?: number) {
    this.root.visible = pose.visible && pose.open > 0.01;
    if (!this.root.visible) return;
    this.root.position.fromArray(pose.anchor);
    this.axis.fromArray(pose.axis);
    this.root.quaternion.copy(this.q.setFromUnitVectors(this.y, this.axis));
    this.root.scale.setScalar(pose.open * this.baseScale);
    if (this.spin) this.spin.rotation.y = pose.spin;
  }

  dispose() { this.meshes.forEach((m) => m.geometry.dispose()); }
}
