import * as THREE from '../world/vendor/three/three.module.js';

// Authored cinematic geometry only. There is no renderer, actor, DOM tree or clock
// here. The product owns those identities and bridges this HANDOFF pose back to
// its original host placement; the study's later camera-to-home move is omitted.
export const IDS=Object.freeze(['work-context','thoughts-type','labs-spring']);
export const HANDOFF=9.7, CAMERA_SETTLE=11.3, END=12.7;
export const PAPER_W=1.56,PAPER_H=1.05,PAPER_THICKNESS=.008,PAPER_FRONT_OFFSET=.004;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10)};
export const phase=(t,a,b)=>smooth((t-a)/(b-a));
export const lerp=(a,b,p)=>a+(b-a)*p;
// Accept DOMRect-like values or the product's {x,y,w,h} bounds. The three
// rectangles must be measured in the same viewport coordinate system used by
// the canvas. Any positive aspect ratio and offscreen destination are supported;
// this module neither invents slots nor measures/changes the host layout.
export function normalizeTargetRect(rect){
  if(!rect)throw new TypeError('A measured story target rectangle is required');
  const x=rect.x??rect.left??0,y=rect.y??rect.top??0,width=rect.width??rect.w,height=rect.height??rect.h;
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw new RangeError('Story target rectangles need finite coordinates and positive dimensions');
  return{x,y,width,height};
}
export const rectQuad=value=>{const r=normalizeTargetRect(value);return[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]]};
export const mixQuad=(a,b,p)=>a.map((v,i)=>v.map((n,j)=>lerp(n,b[i][j],p)));
export const copyQuad=a=>a.map(v=>v.slice());
export function curve(t,keys){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){const[a,A]=keys[i-1],[b,B]=keys[i];if(t<=b)return lerp(A,B,phase(t,a,b))}return keys.at(-1)[1]}
export const vectorCurve=(t,keys)=>[0,1,2].map(i=>curve(t,keys.map(([k,v])=>[k,v[i]])));
// A rigid axis conversion, applied to authored positions, local shell axes and camera targets.
export const blenderToThree=([x,y,z])=>new THREE.Vector3(x,z,-y);
const axisConversion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
export function paperDimensions(target){if(!target)return{width:PAPER_W,height:PAPER_H};const r=normalizeTargetRect(target),ratio=r.width/r.height,h=Math.min(PAPER_H,PAPER_W/ratio);return{width:h*ratio,height:h}}
function validateViewport(width,height){if(![width,height].every(Number.isFinite)||width<=0||height<=0)throw new RangeError('Story viewport dimensions must be finite and positive')}
export function actorPose(time){
  const t=clamp(time,0,HANDOFF);let p;
  if(t<1.6){const u=phase(t,0,1.6);p=[lerp(-5,-1.8,u),lerp(-1.4,-3,u),.88]}
  else if(t<3){const u=(t-1.6)/1.4,e=smooth(u);p=[lerp(-1.8,1.16,e),lerp(-3,-.9,e),lerp(.88,1.209,e)+.69*Math.sin(Math.PI*u)]}
  else p=vectorCurve(t,[[3,[1.16,-.90,1.209]],[3.55,[1.05,-.2,1.209]],[4.5,[1.10,-.05,1.209]],[5,[.94,-.02,1.209]],[5.35,[1.05,-.02,1.209]],[6.2,[1.44,.2,1.209]]]);
  return blenderToThree(p);
}
export function cameraPose(time,width,height){
  validateViewport(width,height);
  const t=clamp(time,0,HANDOFF),portrait=width<701;
  const location=vectorCurve(t,[[0,[5,-12,4.8]],[2.7,[4.7,-10.6,4.6]],[4.45,[2.8,-7.7,3.7]],[5.25,[1.55,-6.8,2.9]],[7.15,[2,-7.4,3.55]],[9.7,[4.8,-11.5,7]]]);
  const look=vectorCurve(t,[[0,[-1.6,-.55,.9]],[2.7,[-.25,-.25,1.05]],[4.45,[-.25,0,1.05]],[5.25,[-.25,0,1.02]],[7.15,[-.2,0,1.45]],[9.7,[-.1,.1,1.65]]]);
  const lens=curve(t,[[0,43],[2.7,45],[4.45,49],[5.25,46],[7.15,45],[9.7,46]]);
  const target=blenderToThree(look),position=blenderToThree(location);
  // Portrait has its own physical dolly/framing. Maintain horizontal story coverage
  // with a 50 degree vertical field; no screen-space world-paper displacement.
  const desktopVertical=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*lens)/(width/height)));
  const camera=new THREE.PerspectiveCamera(portrait?50:desktopVertical,width/height,.1,150);
  if(portrait){
    const distanceFactor=(36/(2*lens))/(Math.tan(THREE.MathUtils.degToRad(25))*(width/height))*1.06;
    position.sub(target).multiplyScalar(Math.max(1,distanceFactor)).add(target);
    // More top room for the three staggered sheets through the handoff.
    target.y+=.05;
  }
  camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
  return{camera,target,lens,portrait};
}
export function cameraForViewport(time,viewport){
  if(viewport.cameraSnapshot){const s=viewport.cameraSnapshot,camera=new THREE.PerspectiveCamera(s.fov,s.aspect,.1,150);camera.position.fromArray(s.position);camera.quaternion.fromArray(s.quaternion);camera.updateMatrixWorld(true);return{camera,target:new THREE.Vector3().fromArray(s.target),lens:s.lens,portrait:viewport.width<701}}
  if(viewport.cameraBlend){const b=viewport.cameraBlend,a=cameraForViewport(time,b.from),z=cameraForViewport(time,b.to),p=b.progress,camera=a.camera.clone();camera.position.lerp(z.camera.position,p);camera.quaternion.slerp(z.camera.quaternion,p);camera.fov=lerp(a.camera.fov,z.camera.fov,p);camera.aspect=lerp(a.camera.aspect,z.camera.aspect,p);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return{camera,target:a.target.clone().lerp(z.target,p),lens:lerp(a.lens,z.lens,p),portrait:viewport.width<701}}
  return cameraPose(time,viewport.width,viewport.height);
}
// Remap a virtual screen projection into the actual drawing surface. This
// preserves the old pixel geometry on resize without exposing a canvas edge.
export function remapProjectionMatrix(matrix,virtual,actual){
  const out=matrix.clone(),source=matrix.elements,e=out.elements,sx=virtual.width/actual.width,sy=virtual.height/actual.height,tx=(virtual.width+2*(virtual.offsetX||0))/actual.width-1,ty=1-(virtual.height+2*(virtual.offsetY||0))/actual.height;
  for(let column=0;column<4;column++){const i=column*4;e[i]=sx*source[i]+tx*source[i+3];e[i+1]=sy*source[i+1]+ty*source[i+3]}return out;
}
export function makeWorldPose(time,width,height,nativeTargets,viewportState){
  validateViewport(width,height);
  const t=clamp(time,0,HANDOFF),paperTime=Math.min(t,HANDOFF),{camera,target,lens,portrait}=cameraForViewport(t,viewportState||{width,height}),actor=actorPose(t);
  const faceTilt=curve(t,[[0,.025],[1.45,-.055],[2.3,.025],[3.05,-.075],[3.55,0],[4.5,-.05],[5,-.08],[5.6,.035],[6.4,0]]);
  const cover=curve(t,[[0,0],[4.6,0],[4.98,.13],[5.24,.07],[6.7,2.6],[7.05,2.42],[7.35,2.47]]);
  const hingePosition=blenderToThree([-1,.1,.36]).add(blenderToThree([-.975,0,.31]).multiplyScalar(1.12));
  const edgeTarget=new THREE.Vector3(1.95,.035,0).applyAxisAngle(Z,cover).multiplyScalar(1.12).add(hingePosition);
  const gazeTarget=edgeTarget.clone().lerp(blenderToThree([-1.1,.12,2.75]),phase(t,7,8.3));
  const direction=gazeTarget.clone().sub(actor).normalize(),right=new THREE.Vector3().crossVectors(Y,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const gazeQuaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,direction));
  const gazeAngle=camera.quaternion.angleTo(gazeQuaternion),attention=phase(t,3.05,4.15)*(1-phase(t,8.5,10.1));
  const gazeWeight=attention*Math.min(.72,THREE.MathUtils.degToRad(52)/Math.max(.001,gazeAngle));
  const faceQuaternion=camera.quaternion.clone().slerp(gazeQuaternion,gazeWeight).multiply(new THREE.Quaternion().setFromAxisAngle(Z,faceTilt));
  // The host owns all post-HANDOFF movement and shell visibility.
  const paperCamera=camera;
  const project=v=>{const p=v.clone().project(camera);return[(p.x*.5+.5)*width,(-p.y*.5+.5)*height]};
  const papers=IDS.map((id,i)=>{
    const start=7.05+i*.24,end=9.25+i*.12,rise=phase(paperTime,start,end-.3),spread=phase(paperTime,start+.06,end-.16),turn=phase(paperTime,start+.14,end);
    const a=[-1,.1,.657-i*.01],mid=[[-2.12,-.15,2.9],[-.05,.3,3.5],[2.3,.62,3.55]][i];
    const position=blenderToThree([lerp(a[0],mid[0],spread),lerp(a[1],mid[1],spread),lerp(a[2],mid[2],rise)+.2*Math.sin(Math.PI*rise)]);
    const flat=axisConversion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z,[-.015,0,.012][i]));
    const front=paperCamera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z,[-.075,.025,.07][i]));
    const quaternion=flat.slerp(front,turn),size=viewportState?.paperSizes?.[i]||paperDimensions(nativeTargets?.[i]);
    const matrix=new THREE.Matrix4().compose(position,quaternion,new THREE.Vector3(1,1,1));
    const corners=[[-size.width/2,size.height/2,PAPER_FRONT_OFFSET],[size.width/2,size.height/2,PAPER_FRONT_OFFSET],[size.width/2,-size.height/2,PAPER_FRONT_OFFSET],[-size.width/2,-size.height/2,PAPER_FRONT_OFFSET]].map(p=>new THREE.Vector3(...p).applyMatrix4(matrix));
    // Native ink becomes visible only on the lifting, camera-facing front.
    const ink=phase(turn,.48,.87);
    return{id,size,position,quaternion,matrix,corners,quad:corners.map(project),rise,turn,ink,minimumPaperY:Math.min(...corners.map(p=>p.y))-PAPER_THICKNESS};
  });
  // Estimate actual exposed front area for interruption boundaries. The normal
  // world renderer owns depth; this prevents a hidden sheet popping over a lid
  // merely because an interruption changes its shell owner.
  const lidQuaternion=new THREE.Quaternion().setFromAxisAngle(Z,cover),lidCenter=new THREE.Vector3(.975,0,0).applyQuaternion(lidQuaternion).multiplyScalar(1.12).add(hingePosition);
  const lidInverse=new THREE.Matrix4().compose(lidCenter,lidQuaternion,new THREE.Vector3(1.12,1.12,1.12)).invert(),coverBox=new THREE.Box3(new THREE.Vector3(-.975,-.035,-.73),new THREE.Vector3(.975,.035,.73));
  papers.forEach((paper,index)=>{let clear=0,total=0;for(const u of[-.9,0,.9])for(const v of[-.9,0,.9]){total++;const point=new THREE.Vector3(u*paper.size.width/2,v*paper.size.height/2,PAPER_FRONT_OFFSET).applyMatrix4(paper.matrix),origin=camera.position.clone().applyMatrix4(lidInverse),end=point.clone().applyMatrix4(lidInverse),direction=end.clone().sub(origin),ray=new THREE.Ray(origin,direction.clone().normalize()),hit=ray.intersectBox(coverBox,new THREE.Vector3());let blocked=!!hit&&hit.distanceTo(origin)<direction.length()-1e-6;
    if(!blocked)for(let j=0;j<papers.length;j++){if(j===index)continue;const other=papers[j],inverse=other.matrix.clone().invert(),a=camera.position.clone().applyMatrix4(inverse),b=point.clone().applyMatrix4(inverse),d=b.sub(a),q=(PAPER_FRONT_OFFSET-a.z)/d.z;if(q>1e-6&&q<1-1e-6){const p=a.addScaledVector(d,q);if(Math.abs(p.x)<other.size.width/2&&Math.abs(p.y)<other.size.height/2){blocked=true;break}}}
    if(!blocked)clear++;
  }paper.exposedFraction=clear/total;paper.fullyBookOccluded=clear===0});
  return{time:t,paperTime,camera,cameraTarget:target,lens,portrait,actor,papers,faceQuaternion,faceTilt,gazeTarget,edgeTarget,hingePosition,rigidGazeDegrees:THREE.MathUtils.radToDeg(gazeWeight*gazeAngle),
    bodyRoll:curve(t,[[0,0],[1.6,4],[3,7.6],[3.55,8.4],[5,8.6],[6.2,8.2]]),
    cover,
    shot:t<3?'arrival':t<4.6?'discovery':t<7.2?'weighted-opening':t<HANDOFF?'page-lift':'handoff'};
}
// Optional route from the study: exact endpoints for arbitrary measured cards.
// Its face-clear lane assumptions are not a general obstacle planner. The host
// must choose a route suitable for its own Ball bridge and content placement.
export function nativeRoute(time,index,layout,startWorld){
  const targets=layout.targets.map(normalizeTargetRect);
  const source=startWorld.papers[index].quad,target=rectQuad(targets[index]);
  const project=v=>{const p=v.project(startWorld.camera);return[(p.x+1)*layout.width/2,(1-p.y)*layout.height/2]};
  const left=project(startWorld.actor.clone().add(new THREE.Vector3(-.98,0,0).applyQuaternion(startWorld.camera.quaternion)))[0];
  const right=project(startWorld.actor.clone().add(new THREE.Vector3(.98,0,0).applyQuaternion(startWorld.camera.quaternion)))[0];
  const xs=source.map(p=>p[0]),ys=source.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys);
  const gap=layout.width<701?12:24;
  // Exit sideways above the face while still source-sized. Descend in the outer
  // corridor; only grow to native size once the sheet is below the scene.
  const laneX=index===2?Math.max(minX,right+gap):index===1?Math.min(minX,left-gap-(maxX-minX)):Math.min(minX,targets[0].x);
  const beside=source.map(([x,y])=>[x+laneX-minX,y]);
  const below=beside.map(([x,y])=>[x,y+targets[index].y-minY]);
  const exit=HANDOFF+.62,descent=HANDOFF+1.98;
  if(time<exit)return mixQuad(source,beside,phase(time,HANDOFF,exit));
  if(time<descent)return mixQuad(beside,below,phase(time,exit,descent));
  return mixQuad(below,target,phase(time,descent,END));
}
export function storyFrame(t,layout){
  const world=makeWorldPose(t,layout.width,layout.height,layout.targets);
  const start=t>=HANDOFF?makeWorldPose(HANDOFF,layout.width,layout.height,layout.targets):world;
  const owner=t<HANDOFF?'world':t<END?'dom':'native';
  return{cards:IDS.map((id,i)=>({id,quad:t<HANDOFF?world.papers[i].quad:nativeRoute(t,i,layout,start),ink:t<HANDOFF?world.papers[i].ink:1,shellOpacity:t<HANDOFF?world.papers[i].exposedFraction:1,owner})),worldTime:Math.min(t,HANDOFF),paperTime:Math.min(t,HANDOFF),owner,progress:clamp(t/END)};
}

// A responsive WORLD rebase changes only projection and physical paper aspect.
// Narrative time, actor action, cover action and ownership continue unchanged.
export function createWorldRebase(time,frame,previousLayout,nextLayout){
  const viewport=frame.viewport||{width:previousLayout.width,height:previousLayout.height};
  const pose=makeWorldPose(time,viewport.width,viewport.height,previousLayout.targets,viewport);
  return{kind:'world',startTime:time,duration:.35,
    fromViewport:{width:viewport.width,height:viewport.height,offsetX:viewport.offsetX||0,offsetY:viewport.offsetY||0,cameraSnapshot:{position:pose.camera.position.toArray(),quaternion:pose.camera.quaternion.toArray(),target:pose.cameraTarget.toArray(),fov:pose.camera.fov,aspect:pose.camera.aspect,lens:pose.lens}},
    fromSizes:pose.papers.map(p=>({...p.size})),toSizes:nextLayout.targets.map(paperDimensions)};
}
export function worldRebaseFrame(time,layout,rebase){
  const p=rebase.duration>0?phase(time,rebase.startTime,rebase.startTime+rebase.duration):1,to={width:layout.width,height:layout.height},from=rebase.fromViewport;
  const viewport={width:lerp(from.width,to.width,p),height:lerp(from.height,to.height,p),offsetX:lerp(from.offsetX||0,0,p),offsetY:lerp(from.offsetY||0,0,p),cameraBlend:{from,to,progress:p},paperSizes:rebase.fromSizes.map((size,i)=>({width:lerp(size.width,rebase.toSizes[i].width,p),height:lerp(size.height,rebase.toSizes[i].height,p)}))};
  if(time>=HANDOFF){
    // Carry the same continuous screen rebase across the normal shell transfer.
    // The DOM owner inherits the rebased handoff quad, then converges to the
    // unchanged authored native route as the projection rebase completes.
    const canonical=storyFrame(time,layout),reference=makeWorldPose(HANDOFF,layout.width,layout.height,layout.targets),rebased=makeWorldPose(HANDOFF,viewport.width,viewport.height,layout.targets,viewport);
    return{...canonical,viewport,cards:canonical.cards.map((card,i)=>({...card,quad:card.quad.map((point,j)=>point.map((value,k)=>value+rebased.papers[i].quad[j][k]-reference.papers[i].quad[j][k]))}))};
  }
  const pose=makeWorldPose(time,viewport.width,viewport.height,layout.targets,viewport);
  return{cards:pose.papers.map(p=>({id:p.id,quad:p.quad,ink:p.ink,shellOpacity:p.exposedFraction,owner:'world'})),worldTime:time,paperTime:time,owner:'world',progress:clamp(time/END),viewport};
}

// Homography maps the same fixed native rectangle onto four presented corners.
export function homography(width,height,q){const[[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;let g=0,h=0;if(Math.abs(dx3)+Math.abs(dy3)>1e-10){const det=dx1*dy2-dx2*dy1;if(Math.abs(det)<1e-10)throw new Error('Degenerate projected paper quad');g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det}return[(x1-x0+g*x1)/width,(x3-x0+h*x3)/height,x0,(y1-y0+g*y1)/width,(y3-y0+h*y3)/height,y0,g/width,h/height,1]}
export function projectHomography(h,x,y){const d=h[6]*x+h[7]*y+1;return[(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d]}
export const cssMatrix=h=>`matrix3d(${[h[0],h[3],0,h[6],h[1],h[4],0,h[7],0,0,1,0,h[2],h[5],0,1].map(n=>Math.abs(n)<1e-13?0:n).join(',')})`;
export function bridgeQuad(from,to,velocity,u,duration){const p=clamp(u),p2=p*p,p3=p2*p,a=2*p3-3*p2+1,b=p3-2*p2+p,c=-2*p3+3*p2;return from.map((v,i)=>v.map((n,j)=>a*n+b*duration*(velocity?.[i]?.[j]||0)+c*to[i][j]))}
export function ownership(owner,hasWorld=true){return{worldShell:hasWorld&&owner==='world',domShell:owner==='dom'||owner==='native'||!hasWorld,textTrees:1}}
