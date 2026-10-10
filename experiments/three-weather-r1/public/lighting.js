import * as THREE from 'three';
export function sunDirection(state){const a=THREE.MathUtils.degToRad(state.azimuth),e=THREE.MathUtils.degToRad(state.elevation);return new THREE.Vector3(Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a));}
export function foregroundBounds(root){const box=new THREE.Box3();root.traverse(o=>{if(o.isMesh&&o.userData.slice_role!=='ground')box.union(new THREE.Box3().setFromObject(o));});return box;}
export function boxCorners(b){const result=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])result.push(new THREE.Vector3(x,y,z));return result;}
export function fitSunShadow(light, bounds, direction, groundY) {
  const corners=boxCorners(bounds), points=[...corners];
  for(const point of corners){const distance=(point.y-groundY)/direction.y;if(distance>0)points.push(point.clone().addScaledVector(direction,-distance));}
  const relevant=new THREE.Box3().setFromPoints(points),center=relevant.getCenter(new THREE.Vector3());
  light.target.position.copy(center);light.position.copy(center).addScaledVector(direction,5);light.updateMatrixWorld(true);light.target.updateMatrixWorld(true);
  const camera=light.shadow.camera;camera.position.copy(light.position);camera.up.set(0,1,0);camera.lookAt(center);camera.updateMatrixWorld(true);
  const local=new THREE.Box3().setFromPoints(points.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse))),margin=.07;
  // Fit the real casters plus their projected receiver footprint, not the huge ground.
  const width=Math.ceil((local.max.x-local.min.x+2*margin)*100)/100,height=Math.ceil((local.max.y-local.min.y+2*margin)*100)/100;
  const cx=(local.min.x+local.max.x)/2,cy=(local.min.y+local.max.y)/2;
  Object.assign(camera,{left:cx-width/2,right:cx+width/2,bottom:cy-height/2,top:cy+height/2,near:Math.max(.05,-local.max.z-.2),far:-local.min.z+.2});camera.updateProjectionMatrix();
  return {width,height,near:camera.near,far:camera.far,worldTexelSize:[width/light.shadow.mapSize.x,height/light.shadow.mapSize.y],points:points.map(p=>p.toArray())};
}
