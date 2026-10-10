import * as THREE from 'three';
import {RainCollisionAdapter} from './rain-collision-adapter.mjs';

// Rendering is standard Three LineSegments/Points. Collision construction and
// intersection use the separately tested three-mesh-bvh adapter, not new CCD.
export class ForegroundRain {
 constructor({scene,colliderRoot,capacity=96,seed=20261009}){
  if(capacity<1||capacity>128)throw new Error('Rain experiment capacity must be 1–128');
  this.scene=scene;this.colliderRoot=colliderRoot;this.capacity=capacity;this.seed=seed;this.randomState=seed>>>0;this.time=0;this.enabled=false;this.debugMarkers=false;this.adapter=null;this.sequence=0;this.disposed=false;
  this.particles=Array.from({length:capacity},()=>({id:null,position:new THREE.Vector3(),velocity:new THREE.Vector3(),active:false,collidable:true,nextBirth:0,birthTime:0}));this.events=[];this.impactCounts={ball:0,canopy:0,ground:0};this.next=new THREE.Vector3();this.tail=new THREE.Vector3();
  this.group=new THREE.Group();this.group.name='Experimental foreground rain / standard primitives';this.group.visible=false;scene.add(this.group);
  this.linePositions=new Float32Array(capacity*6);const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(this.linePositions,3).setUsage(THREE.DynamicDrawUsage));lineGeometry.setDrawRange(0,0);
  this.lines=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0xc8e5ef,transparent:true,opacity:.72,depthTest:true,depthWrite:false}));this.lines.frustumCulled=false;this.lines.name='96 point-rain trajectory streaks';this.group.add(this.lines);
  this.markerPositions=new Float32Array(128*3);this.markerColors=new Float32Array(128*3);const markerGeometry=new THREE.BufferGeometry();markerGeometry.setAttribute('position',new THREE.BufferAttribute(this.markerPositions,3).setUsage(THREE.DynamicDrawUsage));markerGeometry.setAttribute('color',new THREE.BufferAttribute(this.markerColors,3).setUsage(THREE.DynamicDrawUsage));markerGeometry.setDrawRange(0,0);
  this.markers=new THREE.Points(markerGeometry,new THREE.PointsMaterial({size:.011,sizeAttenuation:true,vertexColors:true,depthTest:true,depthWrite:false}));this.markers.name='Diagnostic first-contact points / not splash simulation';this.markers.frustumCulled=false;this.markers.visible=false;this.group.add(this.markers);
 }
 random(){this.randomState=(1664525*this.randomState+1013904223)>>>0;return this.randomState/4294967296;}
 ensureColliders(){if(this.adapter)return;this.adapter=new RainCollisionAdapter();this.colliderRoot.traverse(o=>{if(o.isMesh&&['ball','canopy','ground'].includes(o.userData.slice_role))this.adapter.addCollider(o,{id:o.userData.slice_role});});if(this.adapter.colliders.size!==3)throw new Error('Expected one Ball, one canopy and one ground collider');}
 setEnabled(enabled){if(this.disposed)throw new Error('Rain disposed');if(Boolean(enabled)===this.enabled)return;this.enabled=Boolean(enabled);this.group.visible=this.enabled;if(this.enabled){this.ensureColliders();this.time=0;this.randomState=this.seed>>>0;this.events=[];this.impactCounts={ball:0,canopy:0,ground:0};for(const p of this.particles){p.active=false;p.nextBirth=this.random()*.7;}this.lines.geometry.setDrawRange(0,0);this.markers.geometry.setDrawRange(0,0);}}
 setDebugMarkers(enabled){this.debugMarkers=Boolean(enabled);this.markers.visible=this.debugMarkers;}
 spawn(p,start){p.id=`foreground-rain-${++this.sequence}`;p.position.set(.18+.87*this.random(),1.15,-.75+.95*this.random());p.velocity.set(.015+.06*this.random(),-(2.3+.9*this.random()),.01);p.birthTime=start;p.active=true;}
 update(dt){
  if(!this.enabled||this.disposed||dt<=0)return;if(!Number.isFinite(dt))throw new Error('Invalid rain delta');const start=this.time,end=start+dt;this.adapter.syncWorldTransforms();
  for(const p of this.particles){
   let stepStart=start;
   if(!p.active){if(end<p.nextBirth)continue;stepStart=Math.max(start,p.nextBirth);this.spawn(p,stepStart);}
   const duration=end-stepStart;if(duration<=0)continue;
   this.next.copy(p.position).addScaledVector(p.velocity,duration);const event=this.adapter.advanceParticle(p,this.next,{time:stepStart,dt:duration});
   if(event){this.impactCounts[event.collider.id]++;this.events.push(event);p.nextBirth=event.time+.08+.12*this.random();}
  }
  this.time=end;this.events=this.events.filter(e=>end-e.time<.35).slice(-128);
  let lineCount=0;for(const p of this.particles){if(!p.active)continue;const streak=Math.min(.012,end-p.birthTime);this.tail.copy(p.position).addScaledVector(p.velocity,-streak);this.tail.toArray(this.linePositions,lineCount*6);p.position.toArray(this.linePositions,lineCount*6+3);lineCount++;}
  this.lines.geometry.attributes.position.needsUpdate=true;this.lines.geometry.setDrawRange(0,lineCount*2);
  const colors={canopy:[.22,.62,1],ball:[1,.6,.18],ground:[.25,.8,.55]};this.events.forEach((e,i)=>{this.tail.copy(e.worldPoint).addScaledVector(e.worldNormal,.001);this.tail.toArray(this.markerPositions,i*3);this.markerColors.set(colors[e.collider.id],i*3);});this.markers.geometry.attributes.position.needsUpdate=true;this.markers.geometry.attributes.color.needsUpdate=true;this.markers.geometry.setDrawRange(0,this.events.length);
 }
 snapshot(){return {enabled:this.enabled,capacity:this.capacity,time:this.time,active:this.particles.filter(p=>p.active).length,impactCounts:{...this.impactCounts},debugMarkers:this.debugMarkers,collision:this.adapter?{...this.adapter.stats}:null,scope:'Point particles against static-pose triangle colliders; no rain radius, liquid film or transparent multilayer optics claim'};}
 dispose(){if(this.disposed)return;this.disposed=true;this.enabled=false;this.adapter?.dispose();this.lines.geometry.dispose();this.lines.material.dispose();this.markers.geometry.dispose();this.markers.material.dispose();this.scene.remove(this.group);}
}
