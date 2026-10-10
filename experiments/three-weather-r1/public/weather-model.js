import * as THREE from 'three';
import {RainCollisionAdapter} from './rain-collision-adapter.mjs';
import {CanopyDrainage} from './canopy-drainage.js';
import {FIXED_STEP} from './weather-clock.js';
const UP = new THREE.Vector3(0, 1, 0);
const makeParticle = () => ({active:false, position:new THREE.Vector3(), velocity:new THREE.Vector3(), id:null, collidable:true});
const pool = (n, factory) => Array.from({length:n}, factory);
const rounded = v => v.toArray().map(n => +n.toFixed(7));

export class WeatherModel {
  constructor({colliderRoot, seed = 20261010, rainCapacity = 176, onEvent = null}) {
    if (!Number.isInteger(rainCapacity) || rainCapacity < 1 || rainCapacity > 256) throw new Error('Rain capacity must be 1–256');
    this.adapter = new RainCollisionAdapter(); this.onEvent = onEvent; this.stepListeners = new Set(); this.disposed = false;
    this.rain = pool(rainCapacity, makeParticle); this.runoff = pool(112, () => ({active:false}));
    this.drops = pool(192, makeParticle); this.rims = pool(64, () => ({active:false}));
    this.ripples = pool(112, () => ({active:false})); this.contacts = pool(96, () => ({active:false}));
    colliderRoot.traverse(mesh => { if (mesh.isMesh && ['ball','canopy','ground'].includes(mesh.userData.slice_role)) { this.adapter.addCollider(mesh,{id:mesh.userData.slice_role}); if (mesh.userData.slice_role === 'canopy') this.canopy = mesh; if (mesh.userData.slice_role === 'ground') this.ground = mesh; }});
    if (this.adapter.colliders.size !== 3) throw new Error('Expected three approved triangle colliders');
    this.drainage = new CanopyDrainage(this.canopy); this.groundY = new THREE.Box3().setFromObject(this.ground).max.y;
    this.next = new THREE.Vector3(); this.reset(seed);
  }
  random() { this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0; return this.randomState / 4294967296; }
  reset(seed = this.seed) {
    if (this.disposed) throw new Error('Weather disposed');
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Seed must be uint32');
    this.seed = seed; this.randomState = seed >>> 0; this.ticks = 0; this.time = 0; this.sequence = 0; this.events = []; this.enabled = true;
    this.counts = {rainImpacts:0, canopy:0, ball:0, ground:0, runoffStarted:0, rimFeeds:0, rimReleases:0, rimGroundHits:0, ripples:0, secondaryHits:0};
    this.overflow = {runoff:0, drops:0, rims:0, ripples:0, contacts:0}; this.usedRimVertices = new Set();
    for (const list of [this.rain,this.runoff,this.drops,this.rims,this.ripples,this.contacts]) for (const p of list) { p.active = false; p.rimVertex = null; p.sourceImpacts = null; }
    for (const p of this.rain) p.nextBirth = this.random() * .65;
    this.adapter.syncWorldTransforms();
  }
  emit(type, details) {
    const event = {eventId:`event-${++this.sequence}`, type, time:this.time, ...details};
    this.events.push(event); if (this.events.length > 2048) this.events.shift(); this.onEvent?.(event); return event;
  }
  acquire(kind) { const entry = this[kind].find(p => !p.active); if (!entry) this.overflow[kind]++; return entry; }
  spawnRain(p) {
    p.id = `rain-${++this.sequence}`; p.position.set(.08 + 1.03*this.random(), 1.12 + .12*this.random(), -.92 + 1.18*this.random());
    p.velocity.set(.06 + .035*this.random(), -2.6 - 1.1*this.random(), .018);
    p.radius = this.random() < .26 ? .0022 + .0008*this.random() : .0011 + .00065*this.random(); p.birth = this.time; p.active = true;
  }
  recordImpact(hit, kind, sourceImpact = null, parentEvent = null, extra = {}) {
    return this.emit('impact',{particleId:hit.id,kind,collider:hit.collider.id,sourceImpact,parentEvent,
      position:rounded(hit.worldPoint), normal:rounded(hit.worldNormal), faceIndex:hit.faceIndex, impactTime:hit.time, ...extra});
  }
  smallSplash(hit, impact, amount) {
    for (let k = 0; k < amount; k++) {
      const p = this.acquire('drops'); if (!p) break;
      const angle = this.random()*Math.PI*2;
      const tangent = new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)); tangent.addScaledVector(hit.worldNormal,-tangent.dot(hit.worldNormal)).normalize();
      p.id = `micro-${++this.sequence}`; p.kind = 'micro'; p.rimVertex = null; p.sourceImpacts = null; p.sourceImpact = impact.sourceImpact || impact.eventId; p.parentEvent = impact.eventId;
      p.position.copy(hit.worldPoint).addScaledVector(hit.worldNormal,.0018);
      p.velocity.copy(tangent).multiplyScalar(.09+.12*this.random()).addScaledVector(hit.worldNormal,.12+.17*this.random());
      p.radius = .0008 + .0007*this.random(); p.birth = this.time; p.life = .13+.17*this.random(); p.active = true;
    }
  }
  makeRipple(hit, impact, strength = 1) {
    let r = this.ripples.find(p => !p.active);
    if (!r) { this.overflow.ripples++; if (impact.kind !== 'rim') return; r = this.ripples.reduce((a,b) => a.birth < b.birth ? a : b); }
    const event = this.emit('ripple',{sourceImpact:impact.sourceImpact || impact.eventId,parentEvent:impact.eventId,
      position:rounded(hit.worldPoint),kind:impact.kind});
    Object.assign(r,{active:true,eventId:event.eventId,sourceImpact:event.sourceImpact,parentEvent:impact.eventId,
      position:hit.worldPoint.clone(),birth:this.time,life:.7+.3*this.random(),radius:(.031+.022*this.random())*strength,phase:this.random()*Math.PI*2});
    this.counts.ripples++;
  }
  rainImpact(hit) {
    const impact = this.recordImpact(hit,'rain'); this.counts.rainImpacts++; this.counts[hit.collider.id]++;
    const contact = this.acquire('contacts'); if (contact) Object.assign(contact,{active:true,position:hit.worldPoint.clone(),normal:hit.worldNormal.clone(),birth:this.time,life:.16,role:hit.collider.id,eventId:impact.eventId});
    this.smallSplash(hit,impact,hit.collider.id === 'ground' ? 1 : 2);
    if (hit.collider.id === 'ground') this.makeRipple(hit,impact,.75);
    if (hit.collider.id === 'canopy' && this.random() < .34) {
      const r = this.acquire('runoff'); if (!r) return;
      const route = this.drainage.route(hit);
      const start = this.emit('runoff',{sourceImpact:impact.eventId,parentEvent:impact.eventId,sourceFace:hit.faceIndex,
        sourcePosition:impact.position,rimVertex:route.rimVertex,rimEdge:route.rimEdge,rimPosition:rounded(route.rimPoint),pathLength:route.length});
      Object.assign(r,{active:true,eventId:start.eventId,sourceImpact:impact.eventId,route,distance:0,speed:.23+.23*this.random(),
        radius:.0014+.0011*this.random(),volume:.65+.6*this.random(),birth:this.time});
      this.counts.runoffStarted++;
    }
  }
  feedRim(runoff) {
    const route = runoff.route;
    let rim = this.rims.find(r => r.active && r.rimVertex === route.rimVertex);
    if (!rim) { rim = this.acquire('rims'); if (!rim) return; Object.assign(rim,{active:true,rimVertex:route.rimVertex,position:route.rimPoint.clone(),volume:0,
      sources:[],parents:[],birth:this.time,releaseAt:this.time+.13+.20*this.random(),threshold:1.2+.45*this.random()}); }
    rim.volume += runoff.volume; rim.sources.push(runoff.sourceImpact); rim.parents.push(runoff.eventId);
    // The short residence cap and bounded input rate keep this list small, but cap explicitly.
    rim.sources = rim.sources.slice(-8); rim.parents = rim.parents.slice(-8);
    const event = this.emit('rim-feed',{sourceImpact:runoff.sourceImpact,parentEvent:runoff.eventId,rimVertex:route.rimVertex,
      position:rounded(rim.position),volume:rim.volume}); rim.lastFeed = event.eventId; this.counts.rimFeeds++;
    this.usedRimVertices.add(route.rimVertex);
  }
  releaseRim(rim) {
    const p = this.acquire('drops'); if (!p) { rim.releaseAt = this.time+.04; return; }
    const radius = .0033*Math.cbrt(rim.volume);
    const event = this.emit('rim-release',{sourceImpact:rim.sources[0],sourceImpacts:[...rim.sources],parentEvent:rim.lastFeed,
      runoffEvents:[...rim.parents],rimVertex:rim.rimVertex,position:rounded(rim.position),volume:rim.volume,radius});
    p.id = `rim-drop-${++this.sequence}`; p.kind = 'rim'; p.sourceImpact = event.sourceImpact; p.sourceImpacts = event.sourceImpacts;
    p.parentEvent = event.eventId; p.rimVertex = rim.rimVertex;
    // Offset outside the actual boundary and below the thin sheet to avoid a
    // zero-distance self-hit. Subsequent motion still queries every collider.
    const outward = rim.position.clone().sub(this.drainage.center); outward.y = 0; outward.normalize();
    p.position.copy(rim.position).addScaledVector(outward,.002).addScaledVector(UP,-radius*1.15);
    p.velocity.copy(outward).multiplyScalar(.025+.015*this.random()); p.velocity.y = -.06;
    p.radius = radius; p.birth = this.time; p.life = 1.4; p.active = true; rim.active = false; this.counts.rimReleases++;
  }
  onStep(callback) { this.stepListeners.add(callback); return () => this.stepListeners.delete(callback); }
  step(dt = FIXED_STEP) {
    if (this.disposed || !this.enabled) return;
    if (Math.abs(dt-FIXED_STEP)>1e-10) throw new Error('WeatherModel requires the fixed 1/120s clock');
    const start = this.ticks*FIXED_STEP; this.ticks++; this.time = this.ticks*FIXED_STEP;
    for (const p of this.rain) {
      if (!p.active && this.time >= p.nextBirth) this.spawnRain(p);
      if (!p.active) continue;
      this.next.copy(p.position).addScaledVector(p.velocity,dt); const hit = this.adapter.advanceParticle(p,this.next,{time:start,dt});
      if (hit) { this.rainImpact(hit); p.nextBirth = this.time+.015+.04*this.random(); }
      else if (this.time-p.birth > .65 || p.position.y < this.groundY-.01) { p.active = false; p.nextBirth = this.time+.02; }
    }
    for (const r of this.runoff) if (r.active) { r.distance += r.speed*dt; if (r.distance >= r.route.length) { this.feedRim(r); r.active = false; } }
    for (const r of this.rims) if (r.active && (r.volume >= r.threshold || this.time >= r.releaseAt)) this.releaseRim(r);
    for (const p of this.drops) if (p.active && p.birth < this.time) {
      this.next.copy(p.position).addScaledVector(p.velocity,dt); this.next.y -= 4.905*dt*dt;
      const hit = this.adapter.advanceParticle(p,this.next,{time:start,dt}); p.velocity.y -= 9.81*dt;
      if (hit) {
        const impact = this.recordImpact(hit,p.kind,p.sourceImpact,p.parentEvent,{rimVertex:p.rimVertex ?? null}); this.counts.secondaryHits++;
        if (hit.collider.id === 'ground') { if (p.kind === 'rim') { this.counts.rimGroundHits++; this.smallSplash(hit,impact,3); } if (impact.kind === 'rim') this.makeRipple(hit,impact,1.4); }
      } else if (this.time-p.birth > p.life || p.position.y < this.groundY-.01) p.active = false;
    }
    for (const list of [this.ripples,this.contacts]) for (const p of list) if (p.active && this.time-p.birth > p.life) p.active = false;
    for (const callback of this.stepListeners) callback(this);
  }
  snapshot() {
    return {seed:this.seed,ticks:this.ticks,time:this.time,enabled:this.enabled,counts:{...this.counts},overflow:{...this.overflow},
      pools:Object.fromEntries(['rain','runoff','drops','rims','ripples','contacts'].map(k=>[k,{active:this[k].filter(p=>p.active).length,capacity:this[k].length}])),
      drainage:this.drainage.snapshot(),distinctRimVertices:this.usedRimVertices.size,collision:{...this.adapter.stats},recentEvents:this.events.slice(-48),
      scope:'Real BVH first triangle hits; fixed-step ballistic point droplets; geometry-following event-driven runoff/coalescence approximation. No fluid solver, droplet radius CCD, puddle displacement or full transparent multilayer optics.'};
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.stepListeners.clear(); this.adapter.dispose(); for (const k of ['rain','runoff','drops','rims','ripples','contacts']) for (const p of this[k]) p.active=false; }
}
