import * as THREE from 'three';
const UP = new THREE.Vector3(0,1,0);

// Standard Three materials only. The near-field water is curved 3D geometry;
// the ground wave response is a CPU-authored normal map on standard wet PBR.
export class WaterRenderer {
  constructor({scene, model}) {
    this.scene = scene; this.model = model; this.disposed = false; this.debug = false;
    this.group = new THREE.Group(); this.group.name = 'Causal 3D water'; scene.add(this.group);
    this.object = new THREE.Object3D(); this.position = new THREE.Vector3(); this.tail = new THREE.Vector3(); this.surfaceNormal = new THREE.Vector3();
    this.waterGeometry = new THREE.SphereGeometry(1,10,7);
    this.materials = [];
    const water = (thickness, roughness) => { const m = new THREE.MeshPhysicalMaterial({color:0xf0f9ff,metalness:0,roughness,transmission:.94,
      ior:1.333,thickness,transparent:false,opacity:1,depthWrite:true,clearcoat:1,clearcoatRoughness:.045,
      attenuationColor:0xe7f4f3,attenuationDistance:.6,envMapIntensity:1}); this.materials.push(m); return m; };
    // r180 thickness does not include instanceMatrix scale. Each size class uses
    // a conservative shared WORLD thickness; it is not per-instance refraction.
    this.rainMesh = this.instances('Near rain / volumetric curved droplets',model.rain.length,water(.0018,.035));
    this.microMesh = this.instances('Contact micro droplets',model.drops.length,water(.0015,.055));
    this.rimMesh = this.instances('Hanging and released rim water',model.drops.length+model.rims.length,water(.004,.04));
    this.beadMesh = this.instances('Moving canopy beads / actual surface paths',model.runoff.length,water(.0018,.055));
    // Short, subtle velocity trails supplement near droplets; never substitute
    // for their geometry. Per-particle luminance varies rather than fixed white.
    this.trailPositions = new Float32Array(model.rain.length*6); this.trailColors = new Float32Array(model.rain.length*6);
    const trails = new THREE.BufferGeometry(); trails.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));
    trails.setAttribute('color',new THREE.BufferAttribute(this.trailColors,3).setUsage(THREE.DynamicDrawUsage));
    this.trails = new THREE.LineSegments(trails,new THREE.LineBasicMaterial({color:0xffffff,vertexColors:true,transparent:true,opacity:.18,depthWrite:false}));
    this.trails.frustumCulled = false; this.trails.name = 'Secondary short exposure traces'; this.group.add(this.trails);
    this.debugPositions = new Float32Array(256*3); this.debugColors = new Float32Array(256*3);
    const debugGeometry = new THREE.BufferGeometry(); debugGeometry.setAttribute('position',new THREE.BufferAttribute(this.debugPositions,3));debugGeometry.setAttribute('color',new THREE.BufferAttribute(this.debugColors,3));
    this.markers = new THREE.Points(debugGeometry,new THREE.PointsMaterial({size:.006,vertexColors:true,depthWrite:false}));this.markers.visible=false;this.markers.frustumCulled=false;this.group.add(this.markers);
    this.setupGround(); this.unsubscribeStep = model.onStep(() => this.updateGround()); this.sync();
  }
  instances(name, count, material) { const m = new THREE.InstancedMesh(this.waterGeometry,material,count); m.name=name;m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;this.group.add(m);return m; }
  instance(mesh,index,position,sx,sy,sz,direction=UP) {
    this.object.position.copy(position); this.object.quaternion.setFromUnitVectors(UP,direction);this.object.scale.set(sx,sy,sz);this.object.updateMatrix();mesh.setMatrixAt(index,this.object.matrix);
  }
  setupGround() {
    this.normalSize = 320; const size = this.normalSize;
    this.normalBytes = new Uint8Array(size*size*4);this.slopeX = new Float32Array(size*size);this.slopeZ = new Float32Array(size*size);
    this.normalTexture = new THREE.DataTexture(this.normalBytes,size,size,THREE.RGBAFormat);this.normalTexture.colorSpace=THREE.NoColorSpace;
    this.normalTexture.magFilter=THREE.LinearFilter;this.normalTexture.minFilter=THREE.LinearFilter;this.normalTexture.generateMipmaps=false;
    this.patch={minX:-.25,maxX:1.3,minZ:-1.08,maxZ:.5};this.lastNormalTick=-1;this.normalUpdates=0;
    const ground=this.model.ground; this.originalGroundGeometry=ground.geometry;this.originalNormalMap=ground.material.normalMap;this.originalNormalMapType=ground.material.normalMapType;
    // Add receiver-only mapping. Position/index data and all identity meshes stay intact.
    const geometry=ground.geometry.clone(),uv=new Float32Array(geometry.attributes.position.count*2),p=new THREE.Vector3();
    for(let i=0;i<geometry.attributes.position.count;i++){p.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(ground.matrixWorld);uv[i*2]=(p.x-this.patch.minX)/(this.patch.maxX-this.patch.minX);uv[i*2+1]=(p.z-this.patch.minZ)/(this.patch.maxZ-this.patch.minZ);}
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));ground.geometry=geometry;
    // Rebind just this static collision record after explicitly replacing its geometry.
    this.model.adapter.removeCollider('ground');this.model.adapter.addCollider(ground,{id:'ground'});
    ground.material.normalMap=this.normalTexture;ground.material.normalMapType=THREE.ObjectSpaceNormalMap;ground.material.needsUpdate=true;
    this.updateGround(true);
  }
  updateGround(force=false) {
    const m=this.model;if(!force&&m.ticks>=this.lastNormalTick&&(m.ticks===this.lastNormalTick||m.ticks%6!==0))return;this.lastNormalTick=m.ticks;this.normalUpdates++;
    this.slopeX.fill(0);this.slopeZ.fill(0);const n=this.normalSize,p=this.patch,dx=(p.maxX-p.minX)/(n-1),dz=(p.maxZ-p.minZ)/(n-1);
    for(const r of m.ripples){if(!r.active||!m.enabled)continue;const age=m.time-r.birth,front=r.radius*(age/r.life),width=.0075;
      const bound=front+width*2.8,amp=.00019*Math.exp(-age*3.4)*Math.min(1,age/.025),k=460;
      const x0=Math.max(1,Math.floor((r.position.x-bound-p.minX)/dx)),x1=Math.min(n-2,Math.ceil((r.position.x+bound-p.minX)/dx));
      const z0=Math.max(1,Math.floor((r.position.z-bound-p.minZ)/dz)),z1=Math.min(n-2,Math.ceil((r.position.z+bound-p.minZ)/dz));
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
        const vx=p.minX+x*dx-r.position.x,vz=p.minZ+z*dz-r.position.z,d=Math.hypot(vx,vz);if(d<1e-7)continue;
        const q=d-front;if(Math.abs(q)>width*2.8)continue;const envelope=Math.exp(-q*q/(2*width*width));
        const derivative=amp*envelope*(k*Math.cos(k*q)-q/(width*width)*Math.sin(k*q));const i=z*n+x;
        this.slopeX[i]+=derivative*vx/d;this.slopeZ[i]+=derivative*vz/d;
      }
    }
    for(let i=0;i<n*n;i++){const x=-this.slopeX[i],z=-this.slopeZ[i],inv=1/Math.hypot(x,1,z);this.normalBytes[i*4]=Math.round((x*inv*.5+.5)*255);this.normalBytes[i*4+1]=Math.round((inv*.5+.5)*255);this.normalBytes[i*4+2]=Math.round((z*inv*.5+.5)*255);this.normalBytes[i*4+3]=255;}
    this.normalTexture.needsUpdate=true;
  }
  sync() {
    if(this.disposed)return;const m=this.model;this.group.visible=m.enabled;let rainCount=0,microCount=0,rimCount=0,beadCount=0;
    for(const p of m.rain)if(p.active){
      const elongation=2.0+.7*(p.radius/.00165);this.instance(this.rainMesh,rainCount,p.position,p.radius,p.radius*elongation,p.radius,p.velocity.clone().normalize());
      this.tail.copy(p.position).addScaledVector(p.velocity,-.006);this.tail.toArray(this.trailPositions,rainCount*6);p.position.toArray(this.trailPositions,rainCount*6+3);
      const brightness=.23+.45*(p.radius/.00165);this.trailColors.set([brightness*.55,brightness*.65,brightness*.7,brightness*.83,brightness*.92,brightness],rainCount*6);rainCount++;
    }
    for(const p of m.drops)if(p.active){const stretch=p.kind==='rim'?1+Math.min(1.9,Math.abs(p.velocity.y)*.4):1.12;
      this.instance(p.kind==='rim'?this.rimMesh:this.microMesh,p.kind==='rim'?rimCount++:microCount++,p.position,p.radius,p.radius*stretch,p.radius);
    }
    for(const r of m.rims)if(r.active){const radius=.0033*Math.cbrt(r.volume);this.position.copy(r.position);this.position.y-=radius*.65;this.instance(this.rimMesh,rimCount++,this.position,radius,radius*1.5,radius);}
    for(const r of m.runoff)if(r.active){m.drainage.sample(r.route,r.distance,this.position);m.drainage.sampleNormal(r.route,r.distance,this.surfaceNormal);this.position.addScaledVector(this.surfaceNormal,r.radius*.4);this.instance(this.beadMesh,beadCount++,this.position,r.radius*1.1,r.radius*.63,r.radius*1.25,this.surfaceNormal);}
    for(const [mesh,count]of[[this.rainMesh,rainCount],[this.microMesh,microCount],[this.rimMesh,rimCount],[this.beadMesh,beadCount]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
    this.trails.geometry.attributes.position.needsUpdate=true;this.trails.geometry.attributes.color.needsUpdate=true;this.trails.geometry.setDrawRange(0,rainCount*2);
    let markers=0;if(this.debug)for(const c of m.contacts){if(!c.active||markers>=256)continue;this.position.copy(c.position).addScaledVector(c.normal,.002);this.position.toArray(this.debugPositions,markers*3);this.debugColors.set(c.role==='canopy'?[.1,.5,1]:c.role==='ball'?[1,.5,.1]:[.1,.8,.3],markers*3);markers++;}
    this.markers.geometry.attributes.position.needsUpdate=true;this.markers.geometry.attributes.color.needsUpdate=true;this.markers.geometry.setDrawRange(0,markers);this.updateGround();
  }
  setDebug(value){this.debug=Boolean(value);this.markers.visible=this.debug;this.sync();}
  snapshot(){return {nearRainGeometry:'Instanced curved spheres elongated by velocity; subtle secondary motion trace',instances:{rain:this.rainMesh.count,micro:this.microMesh.count,rim:this.rimMesh.count,canopy:this.beadMesh.count},groundNormal:{size:this.normalSize,updates:this.normalUpdates,maximumCadenceHz:20,method:'Causal damped radial wave slopes in stock PBR object-space normal map; no luminous ring geometry'},optics:'Three r180 stock transmission; approximate shared world thickness per size class, no per-instance optical thickness or nested water/PVC refraction guarantee'};}
  dispose(){if(this.disposed)return;this.disposed=true;this.unsubscribeStep?.();this.scene.remove(this.group);this.waterGeometry.dispose();this.materials.forEach(m=>m.dispose());this.trails.geometry.dispose();this.trails.material.dispose();this.markers.geometry.dispose();this.markers.material.dispose();this.normalTexture.dispose();this.model.ground.material.normalMap=this.originalNormalMap;this.model.ground.material.normalMapType=this.originalNormalMapType;this.model.ground.geometry.dispose();this.model.ground.geometry=this.originalGroundGeometry;}
}
