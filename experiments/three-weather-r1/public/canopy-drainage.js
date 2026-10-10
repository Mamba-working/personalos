import * as THREE from 'three';

// Geometry-derived, gravity-biased routing. This is an event-driven artistic
// runoff approximation, NOT a Navier–Stokes / film / surface-tension solver.
// Every path follows the approved canopy triangle graph to an actual open rim.
class MinHeap {
  constructor() { this.items = []; }
  push(id, cost) { const a = this.items; let n = a.length; a.push({id, cost}); while (n) { const p = (n - 1) >> 1; if (a[p].cost <= cost) break; a[n] = a[p]; n = p; } a[n] = {id, cost}; }
  pop() { const a = this.items, top = a[0], last = a.pop(); if (a.length) { let n = 0; while (true) { let c = n * 2 + 1; if (c >= a.length) break; if (c + 1 < a.length && a[c + 1].cost < a[c].cost) c++; if (a[c].cost >= last.cost) break; a[n] = a[c]; n = c; } a[n] = last; } return top; }
}
export class CanopyDrainage {
  constructor(mesh) {
    this.mesh = mesh; mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index;
    if (!index) throw new Error('Drainage expects indexed approved canopy');
    // glTF UV seams duplicate positions. Weld ONLY the routing graph so UV seams
    // and the duplicated crown are not mistaken for physical drainage rims.
    this.points = []; this.normals = []; const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld); const welded = new Map(); this.vertexMap = new Uint32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const key = point.toArray().map(n => Math.round(n * 1e6)).join(':');
      if (!welded.has(key)) { welded.set(key, this.points.length); this.points.push(point); this.normals.push(new THREE.Vector3()); }
      this.vertexMap[i] = welded.get(key);
      this.normals[this.vertexMap[i]].add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix));
    }
    this.normals.forEach(n => { n.normalize(); if (n.y < 0) n.negate(); });
    this.neighbors = Array.from({length: this.points.length}, () => new Set());
    const edgeUse = new Map();
    for (let i = 0; i < index.count; i += 3) {
      const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)].map(id => this.vertexMap[id]);
      if (new Set(tri).size !== 3) continue;
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
        this.neighbors[a].add(b); this.neighbors[b].add(a); edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
      }
    }
    this.boundaryEdges = [...edgeUse].filter(([, count]) => count === 1).map(([key]) => key.split(':').map(Number));
    this.boundary = new Set(this.boundaryEdges.flat());
    if (this.boundary.size < 32) throw new Error('No usable real canopy boundary');
    this.cost = new Float64Array(this.points.length).fill(Infinity); this.next = new Int32Array(this.points.length).fill(-1);
    const heap = new MinHeap();
    for (const id of this.boundary) { this.cost[id] = 0; heap.push(id, 0); }
    while (heap.items.length) {
      const {id, cost} = heap.pop(); if (cost !== this.cost[id]) continue;
      for (const from of this.neighbors[id]) {
        const a = this.points[from], b = this.points[id];
        const proposed = cost + a.distanceTo(b) + 36 * Math.max(0, b.y - a.y);
        if (proposed < this.cost[from]) { this.cost[from] = proposed; this.next[from] = id; heap.push(from, proposed); }
      }
    }
    this.index = index; this.bounds = new THREE.Box3().setFromObject(mesh);
    this.center = this.bounds.getCenter(new THREE.Vector3());
  }
  route(hit) {
    const face = hit.faceIndex * 3;
    const candidates = [this.index.getX(face), this.index.getX(face + 1), this.index.getX(face + 2)].map(id => this.vertexMap[id]);
    let vertex = candidates.reduce((best, id) => this.cost[id] + hit.worldPoint.distanceTo(this.points[id]) < this.cost[best] + hit.worldPoint.distanceTo(this.points[best]) ? id : best);
    const points = [hit.worldPoint.clone()], normals = [hit.worldNormal.clone()], vertices = []; let guard = 0;
    while (vertex !== -1 && guard++ <= this.points.length) { points.push(this.points[vertex].clone()); normals.push(this.normals[vertex].clone()); vertices.push(vertex); if (this.boundary.has(vertex)) break; vertex = this.next[vertex]; }
    if (!this.boundary.has(vertex)) throw new Error('Canopy route failed to reach actual rim');
    // Interpolate along an actual boundary edge, varying drainage continuously
    // with the source impact rather than emitting from a few hard-coded points.
    const rimNeighbors = [...this.neighbors[vertex]].filter(n => this.boundary.has(n));
    let rimPoint = this.points[vertex].clone(), edge = [vertex, vertex];
    if (rimNeighbors.length) {
      const next = rimNeighbors.reduce((best, id) => this.points[id].distanceToSquared(hit.worldPoint) < this.points[best].distanceToSquared(hit.worldPoint) ? id : best);
      const a = this.points[vertex], b = this.points[next], ab = b.clone().sub(a);
      const t = THREE.MathUtils.clamp(hit.worldPoint.clone().sub(a).dot(ab) / ab.lengthSq(), .08, .92);
      rimPoint.lerpVectors(a, b, t); points.push(rimPoint.clone()); normals.push(this.normals[vertex].clone().lerp(this.normals[next], t).normalize()); edge = [vertex, next];
    }
    const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + points[i].distanceTo(points[i - 1]));
    return {points, normals, lengths, length: lengths.at(-1), vertices, rimPoint, rimVertex: vertex, rimEdge: edge, sourceFace: hit.faceIndex};
  }
  sample(route, distance, target = new THREE.Vector3()) {
    const d = THREE.MathUtils.clamp(distance, 0, route.length);
    for (let i = 1; i < route.points.length; i++) if (d <= route.lengths[i]) {
      const span = route.lengths[i] - route.lengths[i - 1];
      return target.lerpVectors(route.points[i - 1], route.points[i], span > 0 ? (d - route.lengths[i - 1]) / span : 0);
    }
    return target.copy(route.rimPoint);
  }
  sampleNormal(route, distance, target = new THREE.Vector3()) {
    const d = THREE.MathUtils.clamp(distance, 0, route.length);
    for (let i = 1; i < route.points.length; i++) if (d <= route.lengths[i]) {
      const span = route.lengths[i] - route.lengths[i - 1];
      return target.lerpVectors(route.normals[i - 1], route.normals[i], span > 0 ? (d - route.lengths[i - 1]) / span : 0).normalize();
    }
    return target.copy(route.normals.at(-1));
  }
  snapshot() { return {vertices: this.points.length, rimVertices: this.boundary.size, rimEdges: this.boundaryEdges.length,
    method: 'Gravity-biased shortest path along the actual canopy triangle graph; artistic event-driven runoff, not fluid simulation'}; }
}
