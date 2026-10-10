import { DoubleSide, FrontSide, BackSide, Matrix3, Matrix4, Ray, Vector3 } from 'three';
import { MeshBVH } from './vendor/three-mesh-bvh/index.module.js';

function finiteVector(value, label) {
  if (!value?.isVector3 || !Number.isFinite(value.x + value.y + value.z)) {
    throw new TypeError(`${label} must be a finite THREE.Vector3`);
  }
}

/**
 * Point-particle segment queries against immutable triangle geometry.
 * Mature BVH construction / traversal / triangle intersection: three-mesh-bvh 0.9.1.
 * This module only supplies coordinate conversion, nearest-collider selection and events.
 * All distances are scene world units (metres in the supplied GLB), time is seconds.
 */
export class RainCollisionAdapter {
  constructor() {
    this.colliders = new Map();
    this.stats = { bvhBuilds: 0, bvhRefits: 0, worldSyncs: 0, segmentQueries: 0, meshQueries: 0, impacts: 0 };
    this._start = new Vector3();
    this._end = new Vector3();
    this._delta = new Vector3();
    this._ray = new Ray();
  }

  addCollider(mesh, { id = mesh?.uuid, role = mesh?.userData?.slice_role ?? null, side = DoubleSide } = {}) {
    if (!mesh?.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || !mesh.geometry?.attributes.position) {
      throw new TypeError('Collider must be an ordinary, non-skinned, non-instanced triangle mesh');
    }
    if (typeof id !== 'string' || !id || this.colliders.has(id)) throw new Error('Collider id must be unique and nonempty');
    if (![DoubleSide, FrontSide, BackSide].includes(side)) throw new TypeError('Unsupported collision side');
    const geometry = mesh.geometry;
    if (Object.keys(geometry.morphAttributes).length) throw new Error('Morph geometry is outside this adapter scope');
    // Indirect BVH preserves the render geometry index. No prototype overrides or material changes.
    const record = {
      descriptor: Object.freeze({ id, role, name: mesh.name }), mesh, geometry,
      side, bvh: new MeshBVH(geometry, { indirect: true, setBoundingBox: false }),
      inverse: new Matrix4(), normalMatrix: new Matrix3(), worldMatrix: new Matrix4(),
      position: geometry.attributes.position, positionVersion: geometry.attributes.position.version,
      index: geometry.index, indexVersion: geometry.index?.version,
    };
    this._syncCollider(record);
    this.colliders.set(id, record);
    this.stats.bvhBuilds++;
    return record.descriptor;
  }

  removeCollider(id) { return this.colliders.delete(id); }
  dispose() { this.colliders.clear(); }

  _syncCollider(record) {
    const { mesh, geometry } = record;
    if (mesh.geometry !== geometry || geometry.attributes.position !== record.position ||
        geometry.attributes.position.version !== record.positionVersion || geometry.index !== record.index ||
        geometry.index?.version !== record.indexVersion) {
      throw new Error(`Collider ${record.descriptor.id} geometry changed; remove and rebuild it explicitly`);
    }
    mesh.updateWorldMatrix(true, false);
    const determinant = mesh.matrixWorld.determinant();
    if (!Number.isFinite(determinant) || determinant === 0) throw new Error('Collider world transform is singular or invalid');
    record.worldMatrix.copy(mesh.matrixWorld);
    record.inverse.copy(mesh.matrixWorld).invert();
    record.normalMatrix.getNormalMatrix(mesh.matrixWorld);
  }

  /** Call once after changing object transforms and before querying a physics frame. No refit. */
  syncWorldTransforms() {
    for (const record of this.colliders.values()) this._syncCollider(record);
    this.stats.worldSyncs++;
  }

  /**
   * Return the earliest hit on [previous, next], or null. time is frame START time.
   * Event normal is the world geometric face normal, oriented against incoming motion.
   * velocity is the incoming world velocity (or segment / dt if omitted).
   * Stateless query: use advanceParticle for one-shot particle consumption.
   */
  traceSegment(previous, next, { id, time, dt, velocity } = {}) {
    finiteVector(previous, 'previous'); finiteVector(next, 'next');
    if (id === undefined || id === null) throw new TypeError('Particle id is required');
    if (!Number.isFinite(time) || !Number.isFinite(dt) || dt <= 0) throw new TypeError('Finite time and positive dt are required');
    if (velocity !== undefined) finiteVector(velocity, 'velocity');
    this._delta.subVectors(next, previous);
    if (this._delta.lengthSq() === 0) return null;
    this.stats.segmentQueries++;
    let nearest = null;
    for (const record of this.colliders.values()) {
      this._start.copy(previous).applyMatrix4(record.inverse);
      this._end.copy(next).applyMatrix4(record.inverse);
      this._ray.origin.copy(this._start);
      this._ray.direction.subVectors(this._end, this._start);
      const length = this._ray.direction.length();
      if (length === 0) continue;
      this._ray.direction.multiplyScalar(1 / length);
      this.stats.meshQueries++;
      // Both endpoints are transformed. Thus local far is correct even under nonuniform scale.
      const hit = record.bvh.raycastFirst(this._ray, record.side, 0, length);
      if (!hit) continue;
      const fraction = hit.distance / length;
      if (fraction < 0 || fraction > 1 || (nearest && fraction >= nearest.fraction)) continue;
      const worldPoint = hit.point.clone().applyMatrix4(record.worldMatrix);
      const worldNormal = hit.face.normal.clone().applyMatrix3(record.normalMatrix).normalize();
      if (worldNormal.dot(this._delta) > 0) worldNormal.negate();
      nearest = {
        id, time: time + dt * fraction, worldPoint, worldNormal,
        velocity: velocity ? velocity.clone() : this._delta.clone().multiplyScalar(1 / dt),
        collider: record.descriptor, fraction, faceIndex: hit.faceIndex,
      };
    }
    return nearest;
  }

  /**
   * Commit caller-integrated next position. On hit, park at contact and deactivate once.
   * Caller owns rain integration, splash response, respawn, and fresh ids per lifetime.
   * collidable:false is a cheap background path; it never enters the BVH query.
   */
  advanceParticle(particle, next, { time, dt } = {}) {
    if (particle.active === false) return null;
    finiteVector(particle.position, 'particle.position'); finiteVector(next, 'next');
    if (particle.collidable === false) { particle.position.copy(next); return null; }
    const impact = this.traceSegment(particle.position, next, {
      id: particle.id, time, dt, velocity: particle.velocity,
    });
    particle.position.copy(impact ? impact.worldPoint : next);
    if (impact) { particle.active = false; this.stats.impacts++; }
    return impact;
  }
}
