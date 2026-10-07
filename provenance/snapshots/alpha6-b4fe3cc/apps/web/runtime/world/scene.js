import * as THREE from 'three';
import { THEME } from './theme.js';
import { createWorldAdapter } from './world-adapter.js';
import { announceWorldAvailability } from '../world-availability.js';
import {createBookStory} from '../story/book-story.js';
import {createStoryProps} from '../story/props.js';
import {createFrameClock} from '../story/frame-clock.js';
import {remapProjectionMatrix} from '../story/geometry.js';
import {createShadowCache} from './shadow-cache.js';

// One scene, one actor, one clock. The page never replaces Ball with a DOM image.
const worldRoot=document.querySelector('#ball-world-root');
const $=s=>worldRoot.querySelector(s.replace(/#([a-zA-Z][\w-]*)/g,'#world-$1'));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};
const mix=(a,b,t)=>Object.fromEntries(Object.keys(a).map(k=>[k,lerp(a[k],b[k],t)]));
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const params=new URLSearchParams(location.search);
const manual=params.has('manual');
const bookEnabled=document.documentElement.dataset.storyEnabled==='true'&&params.get('story')!=='off';
const DURATION=bookEnabled?12.7:10.2,R=.88;
let bookStory=null,bookFrame=null,clock=null,worldDisposed=false;
const effects=new Map(),storyListeners=new Set();let nativeEyeOpen=1;
function applyWeatherResponse(response){if(!response)return;face.rotateZ(response.lean||0);face.rotateY(response.lookX||0);face.rotateX(response.lookY||0);eyeVertices(nativeEyeOpen*(response.eyeOpen||1)*(1-(response.sunShade||0)),0);}
function requestWorldFrame(){clock?.wake();}
let systemReduced=motionQuery.matches,reduced=systemReduced,previewOnce=false,renderer;
announceWorldAvailability('starting');
try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:manual});
}catch(e){announceWorldAvailability('failed','renderer-initialization');throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.98;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.VSMShadowMap;
$('#stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(THEME.background);
scene.fog=new THREE.Fog(THEME.background,20,48);
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,80);
const shadowCache=createShadowCache({THREE,renderer,scene,camera});
function buildEnvironment(){
 const pmrem=new THREE.PMREMGenerator(renderer),room=new THREE.Scene();
 room.background=new THREE.Color(THEME.environment);
 room.add(new THREE.Mesh(new THREE.BoxGeometry(30,24,30),new THREE.MeshBasicMaterial({color:THEME.environmentShell,side:THREE.BackSide})));
 for(const[x,y,z,w,h,power]of[[-4,6,4,6,7,5],[5,3,-4,2,5,3],[0,9,-1,9,4,1.6]]){
  const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(1,.985,.965).multiplyScalar(power),side:THREE.DoubleSide}),panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);panel.position.set(x,y,z);panel.lookAt(0,1,0);room.add(panel);
 }
 try{return pmrem.fromScene(room,.07);}finally{room.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});pmrem.dispose();}
}
let env=buildEnvironment();scene.environment=env.texture;scene.environmentIntensity=.63;
scene.add(new THREE.HemisphereLight(THEME.sky,THEME.groundLight,1.5));
const key=new THREE.DirectionalLight(THEME.key,3.0);key.position.set(-3.5,8,5.5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.camera.near=.1;key.shadow.camera.far=26;key.shadow.normalBias=.035;key.shadow.bias=-.00015;key.shadow.radius=7;key.shadow.blurSamples=12;key.target.position.set(.5,.5,0);scene.add(key,key.target);
const rim=new THREE.DirectionalLight(THEME.rim,1.6);rim.position.set(5,3,-4);scene.add(rim);
// Deterministic, original micro-surface noise; no external texture or model assets.
const noiseSize=128,noiseData=new Uint8Array(noiseSize*noiseSize*4);let seed=7027;
for(let i=0;i<noiseSize*noiseSize;i++){seed=(seed*1664525+1013904223)>>>0;let v=120+(seed>>>26);noiseData.set([v,v,v,255],i*4)}
const noise=new THREE.DataTexture(noiseData,noiseSize,noiseSize,THREE.RGBAFormat);noise.wrapS=noise.wrapT=THREE.RepeatWrapping;noise.repeat.set(8,8);noise.needsUpdate=true;
const ceramic=new THREE.MeshPhysicalMaterial({color:THEME.ball,metalness:.02,roughness:.34,clearcoat:.3,clearcoatRoughness:.27,bumpMap:noise,bumpScale:.0019,envMapIntensity:.8});
const plaster=new THREE.MeshStandardMaterial({color:THEME.platter,roughness:.67,metalness:0,bumpMap:noise,bumpScale:.007});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:THEME.floor,roughness:.92,metalness:0}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const actor=new THREE.Group();actor.name='Ball / persistent actor';scene.add(actor);
const body=new THREE.Mesh(new THREE.SphereGeometry(R,96,64),ceramic);body.castShadow=true;body.receiveShadow=true;actor.add(body);
// Rigid face is mapped onto the actual sphere. No flat sprite, squash or projection stretch.
const face=new THREE.Group();actor.add(face);
const rings=window.EB_RINGS.EXPRESSIONS[10];
const eyes=rings.map((ring,i)=>{
 const center=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
 const local=ring.map(p=>new THREE.Vector2((p[0]-center[0])*.0064,-(p[1]-center[1])*.0064));
 const tris=THREE.ShapeUtils.triangulateShape(local,[]),surface=[];
 function subdivide(a,b,c,n){if(!n){surface.push(a,b,c);return}const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);subdivide(a,ab,ca,n-1);subdivide(ab,b,bc,n-1);subdivide(ca,bc,c,n-1);subdivide(ab,bc,ca,n-1)}
 for(const tri of tris)subdivide(...tri.map(n=>local[n]),2);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(surface.length*3),3));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(surface.length*3),3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:THEME.eyes,roughness:.65,metalness:0,side:THREE.DoubleSide}));mesh.name=i?'right eye':'left eye';face.add(mesh);return{mesh,local:surface,cx:i?.255:-.255};
});
// A lathed platter with a generous turned edge, a subtly dished top and a dark foot.
const disk=new THREE.Group();disk.name='the balancing stone';scene.add(disk);
const profile=[[0,-.16],[1.94,-.16],[2.08,-.12],[2.17,-.05],[2.2,.035],[2.17,.105],[2.08,.145],[1.96,.15],[1.6,.12],[.9,.105],[0,.105]].map(p=>new THREE.Vector2(...p));
const platter=new THREE.Mesh(new THREE.LatheGeometry(profile,144),plaster);platter.castShadow=true;platter.receiveShadow=true;disk.add(platter);
const underside=new THREE.Mesh(new THREE.TorusGeometry(1.98,.013,8,144),new THREE.MeshStandardMaterial({color:THEME.foot,roughness:.75}));underside.rotation.x=Math.PI/2;underside.position.y=-.1;disk.add(underside);
function shadowTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');const g=x.createRadialGradient(128,128,5,128,128,125);g.addColorStop(0,'rgba(35,43,61,.36)');g.addColorStop(.35,'rgba(35,43,61,.19)');g.addColorStop(.72,'rgba(35,43,61,.06)');g.addColorStop(1,'rgba(35,43,61,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)}
const shadowTex=shadowTexture();
function softShadow(){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.75}));m.rotation.x=-Math.PI/2;m.position.y=.008;scene.add(m);return m}
const ballShadow=softShadow(),diskShadow=softShadow();
const storyProps=createStoryProps({THREE,scene,shadowTexture:shadowTex});storyProps.root.visible=false;
const plateContact=new THREE.Mesh(new THREE.PlaneGeometry(2.0,2.0),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,opacity:.75,depthWrite:false}));plateContact.rotation.x=-Math.PI/2;plateContact.position.y=.151;disk.add(plateContact);
// Poses are semantic beats. C2 easing makes every bridge and keyframe continuous.
const base={pcamx:-1.6,pcamy:2.85,pcamz:7.7,ptx:-.72,pty:1.35,lift:0,roll:0,bx:-.95,by:1.31,bz:.22,dx:0,dy:.37,dz:0,drx:.035,drz:.13,dry:0,ds:1,attach:1,tilt:-.075,gx:-.15,gy:0,open:1,wink:0,camx:4.1,camy:3.7,camz:9.5,tx:.0,ty:1.1,tz:0,home:0};
const endPose={...base,pcamx:3.6,pcamy:5.5,pcamz:14.5,ptx:2.8,pty:3.15,bx:2.8,by:1.177,bz:.1,dx:2.8,dy:.18,dz:0,drz:0,drx:0,dry:0,ds:.73,attach:1,tilt:0,gx:0,gy:0,camx:3.8,camy:4.4,camz:12.8,tx:-.9,ty:1.1,home:1,roll:-3.2};
const opening={...base,bx:-.78,bz:.1,dx:-.08,dy:.31,drz:.065,drx:.025,ds:.96,camx:-3.2,camy:2.7,camz:6.2,tx:-.65,ty:1.05,gx:-.08,tilt:-.06};
const keyframes=[
 [0,{...opening}],
 [1.35,{...opening,bx:-.6,roll:-.2,gx:.17,gy:-.03,tilt:.025,camx:-1.0,camy:3.0,camz:7.4,tx:-.4,pcamx:-.8,pcamy:3.0,pcamz:8.0,ptx:-.45,pty:1.45}],
 [3.25,{...opening,bx:.40,dx:0,drz:-.075,gx:.11,tilt:.06,roll:-1.35,camx:2.2,camy:3.6,camz:8.3,tx:.10,pcamx:1.7,pcamy:3.3,pcamz:9.2,ptx:.12,pty:1.45}],
 [4.45,{...opening,bx:.91,dx:.12,drz:-.16,gx:.07,gy:-.14,tilt:.05,wink:.9,roll:-1.92,camx:3.35,camy:3.1,camz:9.05,tx:.14,pcamx:2.6,pcamy:3.8,pcamz:10.3,ptx:.5,pty:1.45}],
 [5.2,{...opening,bx:.94,dx:.16,drz:-.12,gx:0,gy:.015,tilt:-.035,open:.93,roll:-1.95,camx:3.0,camy:3.3,camz:9.25,tx:.14,pcamx:2.6,pcamy:3.8,pcamz:10.3,ptx:.5,pty:1.45}],
 [6.55,{...endPose,home:0,bx:1.72,dx:1.60,drz:-.026,ds:.78,dy:.19,gx:-.09,gy:-.05,tilt:-.06,open:.88,roll:-2.86,camx:2.75,camy:3.6,camz:9.7,tx:-.05,pcamx:3.1,pcamy:4.5,pcamz:12.0,ptx:1.8,pty:2.1}],
 [6.92,{...endPose,home:.08,bx:2.02,dx:1.98,drz:.009,ds:.75,tilt:.022,roll:-3.02,camx:3.05,camy:3.85,camz:10.5,tx:-.20,pcamx:3.3,pcamy:4.8,pcamz:12.8,ptx:2.1,pty:2.5}],
 [7.6,{...endPose,home:.35,tilt:0,camx:3.45,camy:4.2,camz:11.8,tx:-.6}],
 [8.8,{...endPose}],
 [DURATION,{...endPose}]
];
function supportHeight(p){const n=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(p.drx,p.dry,p.drz));const y=Math.max(p.dy,2.2*p.ds*Math.sqrt(Math.max(0,1-n.y**2))+.16*p.ds*Math.abs(n.y)+.018);return y+(.115*p.ds+R-n.x*(p.bx-p.dx)-n.z*(p.bz-p.dz))/n.y;}
function sample(t){let result={...keyframes.at(-1)[1]};for(let i=1;i<keyframes.length;i++){const[a,A]=keyframes[i-1],[b,B]=keyframes[i];if(t<=b){result=mix(A,B,smooth((t-a)/(b-a)));break}}if(t>5.2&&t<6.55){const u=(t-5.2)/1.35;const arch=Math.sin(Math.PI*u)**2;result.lift=1.65*4*u*(1-u);result.drz-=arch*.91;result.attach=0;result.by=lerp(supportHeight(keyframes[4][1]),supportHeight(keyframes[5][1]),u);result.camx-=arch*1.6;result.camy+=arch*.6;result.ty+=arch*.65;result.pcamx-=arch*.9;result.pcamy+=arch*.45;result.pty+=arch*.6}return result;}

let t=reduced?DURATION:0,pose=sample(t),mode=reduced?'home':'intro',bridge=null,last=performance.now(),elapsed=0,paused=false;
let portrait=innerWidth/innerHeight<.85,layout=portrait?1:0,layoutTarget=layout,resizePending=false;
const pointer={x:0,y:0},gaze={x:0,y:0};
let interaction=0,interactionTime=-100,speechUntil=0,tapCount=0,drag=null,dragX=0,dragTarget=0,manualTime=0;
const homePose=()=>({...keyframes.at(-1)[1]});
function beginBridge(target,after,duration=.9){requestWorldFrame();target={...target,drz:pose.drz+Math.atan2(Math.sin(target.drz-pose.drz),Math.cos(target.drz-pose.drz))};bridge={from:{...pose},to:target,elapsed:0,duration,after};mode=after==='home'?'arriving':'rewinding';$('#replay-label').textContent=after==='home'?'重新看一遍':'回到开场';}
function skip(){if(bookEnabled&&bookStory){const accepted=bookStory.skip();requestWorldFrame();return accepted;}if(mode==='home')return;showSpeech('好，我们直接进去。',1.2);if(reduced&&!previewOnce){t=DURATION;pose=homePose();mode='home';bridge=null}else beginBridge(homePose(),'home',.85);}
function replay(){if(bookEnabled&&bookStory){const accepted=bookStory.replay();requestWorldFrame();return accepted;}if(contentState.progress>0)worldAPI.cancel();previewOnce=reduced;if(previewOnce)showSpeech('为你播放一次开场。',1.6);interactionTime=-100;dragTarget=0;beginBridge(sample(0),'intro',1.15);}
function setReduced(value){if(bookEnabled&&bookStory)bookStory.setReduced(value);requestWorldFrame();previewOnce=false;reduced=value;$('#motion').setAttribute('aria-pressed',String(value));$('#motion').setAttribute('aria-label',value?'恢复动态':'减少动态');if(bookEnabled){bridge=null;interactionTime=-100;dragTarget=0;return;}if(value){if(mode!=='home')beginBridge(homePose(),'home',.55);interactionTime=-100;dragTarget=0}else showSpeech('慢慢来，随时可以重播。');}
$('#motion').setAttribute('aria-pressed',String(reduced));
$('#motion').onclick=()=>setReduced(!reduced);
// Some embedded browser paths update matches before delivering change; reconcile only system changes.
function syncSystemMotion(){const next=motionQuery.matches;if(next!==systemReduced){systemReduced=next;setReduced(next)}}
motionQuery.addEventListener('change',syncSystemMotion);
$('#skip').onclick=skip;$('#replay').onclick=replay;
function showSpeech(text,seconds=2.8){requestWorldFrame();$('#speech').textContent=text;$('#speech').classList.add('show');speechUntil=elapsed+seconds;}
function greet(){tapCount++;interactionTime=elapsed;interaction=(tapCount%3)+1;showSpeech(['你好呀，终于见到你了。','我在。今天想聊些什么？','偶尔走神，也挺好的。'][tapCount%3]);}
$('#hello').onclick=greet;
$('#explore').onclick=()=>{$('#about').showModal();showSpeech('这里有你，也有一点小惊喜。')};$('#close-about').onclick=()=>$('#about').close();
$('#about').addEventListener('click',e=>{if(e.target===$('#about')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
const hit=$('#ball-hit');
let placementProvider=null,hostPlacement=null,homeScreen=null,hostActivity={state:'idle',localDemo:true},placementMotion=null;let suppressActivation=false;const activationListeners=new Set(),frameTasks=new Set();
function activate(){requestWorldFrame();interaction++;tapCount++;interactionTime=elapsed;$('#speech').classList.remove('show');for(const fn of activationListeners)fn({source:'ball',actorUUID:actor.uuid,screen:{...screenBall}});}

hit.addEventListener('pointerdown',e=>{if(drag||mode!=='home')return;suppressActivation=false;drag={id:e.pointerId,x:e.clientX,start:e.clientX,startY:e.clientY,time:performance.now(),moved:false};hit.setPointerCapture(e.pointerId);showSpeech('嗯？跟你走。',1.4)});
hit.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const delta=e.clientX-drag.start;drag.moved=drag.moved||Math.hypot(delta,e.clientY-drag.startY)>6;dragTarget=Math.tanh(delta/(portrait?150:230))*.43;});
function endDrag(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;dragTarget=0;suppressActivation=moved;if(moved)showSpeech('还是这里最舒服。',1.8)}
hit.addEventListener('pointerup',endDrag);hit.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId){suppressActivation=true;drag=null;dragTarget=0}});hit.addEventListener('lostpointercapture',()=>{drag=null;dragTarget=0});
hit.addEventListener('click',()=>{if(suppressActivation){suppressActivation=false;return;}if(mode==='home'&&homeInteractive)activate();});
hit.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&mode==='home'&&homeInteractive){e.preventDefault();activate()}});
window.addEventListener('pointermove',e=>{requestWorldFrame();pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2});window.addEventListener('pointerout',e=>{if(!e.relatedTarget){pointer.x=pointer.y=0;requestWorldFrame();}});
window.addEventListener('scroll',requestWorldFrame,{passive:true});
window.addEventListener('resize',()=>{portrait=innerWidth/innerHeight<.85;layoutTarget=portrait?1:0;renderer.setSize(innerWidth,innerHeight);shadowCache.invalidate();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();resizePending=true;requestWorldFrame();});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)clock?.suspend();else{shadowCache.invalidate();requestWorldFrame();}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;clock?.suspend();bookStory?.fail('context-lost');announceWorldAvailability('lost','webgl-context-lost');});
renderer.domElement.addEventListener('webglcontextrestored',()=>{try{env.dispose();env=buildEnvironment();scene.environment=env.texture;shadowCache.invalidate();render(0);paused=false;last=performance.now();requestWorldFrame();announceWorldAvailability('ready','webgl-context-restored');}catch(error){paused=true;announceWorldAvailability('failed','renderer-recovery');console.error(error);}});
function eyeVertices(open,roll){for(let e=0;e<2;e++){const eye=eyes[e],p=eye.mesh.geometry.attributes.position;const openness=Math.max(.065,open*(e===1?1-pose.wink*.96:1));for(let i=0;i<eye.local.length;i++){const v=eye.local[i];let x=v.x+eye.cx,y=v.y*openness+.12;const xx=x*Math.cos(roll)-y*Math.sin(roll),yy=x*Math.sin(roll)+y*Math.cos(roll);const z=Math.sqrt(Math.max(.02,R*R-xx*xx-yy*yy))+.007;p.setXYZ(i,xx,yy,z);const normal=eye.mesh.geometry.attributes.normal;const len=Math.hypot(xx,yy,z);normal.setXYZ(i,xx/len,yy/len,z/len)}p.needsUpdate=true;eye.mesh.geometry.attributes.normal.needsUpdate=true;}}
let homeInteractive=false,screenBall={x:0,y:0,r:100};
let contentState={progress:0,phase:'preview',targetBounds:null,displayBounds:null},contentFocus=0,readingQuiet=false;
const worldOffset=new THREE.Vector3(),worldGoal=new THREE.Vector3(),raycaster=new THREE.Raycaster();
const worldAPI=createWorldAdapter({onTransition:s=>{contentState=s;requestWorldFrame();if(s.action==='select'){drag=null;dragTarget=0;interactionTime=-100;$('#speech').classList.remove('show')}},snapshot:()=>({focus:contentFocus,quiet:readingQuiet,offset:worldOffset.toArray(),actorUUID:actor.uuid,screen:{...screenBall},homeScreen:homeScreen&&{...homeScreen},activity:{...hostActivity},placement:hostPlacement&&JSON.parse(JSON.stringify(hostPlacement))})});
worldAPI.onFrame=fn=>{if(typeof fn!=='function')throw new TypeError('Frame subscriber required');frameTasks.add(fn);requestWorldFrame();return()=>frameTasks.delete(fn)};
worldAPI.setPlacementProvider=fn=>{placementProvider=typeof fn==='function'?fn:null;requestWorldFrame();return()=>placementProvider=null};
worldAPI.setActivity=value=>{if(value&&typeof value.state==='string'){hostActivity={state:value.state,localDemo:value.localDemo===true};requestWorldFrame();return true;}return false};
worldAPI.onActivate=fn=>{activationListeners.add(fn);return()=>activationListeners.delete(fn)};
worldAPI.registerEffect=(name,factory)=>{
 if(effects.has(name))return()=>{};
 const effect=factory({THREE,scene,actor,applyWeatherResponse,requestFrame:requestWorldFrame,setAtmosphere:paint=>window.personalOSSceneBridge?.paint(paint)||false,getState:()=>effectState()});
 if(!effect||typeof effect.update!=='function')throw new TypeError('An effect must implement update');
 effects.set(name,effect);requestWorldFrame();return()=>{if(effects.get(name)!==effect)return;effects.delete(name);effect.dispose?.();requestWorldFrame();};
};
function effectState(){return{reduced,hidden:document.hidden,readingQuiet,placement:hostPlacement,activity:{...hostActivity},phase:bookStory?.getState().phase||mode,screen:{...screenBall}};}
bookStory=createBookStory({content:window.personalOSContent,enabled:bookEnabled,reduced,bypass:['item','space','chat'].some(key=>params.has(key)),wake:requestWorldFrame,onChange:s=>{for(const fn of storyListeners)fn(s);window.dispatchEvent(new CustomEvent('personalos:story-state',{detail:s}));}});
worldAPI.story={getState:()=>bookEnabled?bookStory.getState():{phase:mode==='home'?'home':'story',time:t,duration:DURATION,reduced,active:mode!=='home',enabled:false},skip:(reason,options)=>bookEnabled?bookStory.skip(reason,options):skip(),replay:()=>replay(),setReduced,subscribe(fn){storyListeners.add(fn);return()=>storyListeners.delete(fn);}};
worldAPI.requestFrame=requestWorldFrame;
window.personalOSWorld=worldAPI;
window.dispatchEvent(new CustomEvent('personalos:world-ready',{detail:{version:2}}));
function render(dt=0,stamp){
 if(bookEnabled){bookFrame=bookStory.sample(dt,stamp);const state=bookStory.getState();mode=state.active?(state.phase==='story'?'intro':'arriving'):'home';t=state.time;pose=homePose();}
 for(const fn of frameTasks)fn(dt,stamp);
 hostPlacement=mode==='home'?placementProvider?.(homeScreen):null;
 // Native scrolling only changes the intended screen bounds. The same actor
 // integrates its displayed bounds on this renderer's clock, including a large
 // wheel step or a reversed category intent. Canvas and DOM use that projection.
 if(hostPlacement?.mode==='chat')placementMotion={pose:{...hostPlacement.bounds},v:{x:0,y:0,w:0,h:0}};
 else if(hostPlacement?.bounds){
  const intended={...hostPlacement.bounds};
  if(!placementMotion)placementMotion={pose:{...intended},v:{x:0,y:0,w:0,h:0}};
  let settled=true;const frequency=28;
  for(const k of ['x','y','w','h']){const target=intended[k],a=placementMotion.pose[k]-target,c=placementMotion.v[k]+frequency*a,e=Math.exp(-frequency*dt);placementMotion.pose[k]=reduced?target:target+(a+c*dt)*e;placementMotion.v[k]=reduced?0:(placementMotion.v[k]-frequency*c*dt)*e;if(Math.abs(placementMotion.pose[k]-target)>.03||Math.abs(placementMotion.v[k])>.1)settled=false;}
  if(settled){placementMotion.pose={...intended};placementMotion.v={x:0,y:0,w:0,h:0};}
  hostPlacement={...hostPlacement,bounds:{...placementMotion.pose},intendedBounds:intended,velocity:{...placementMotion.v},placementActive:!settled};
 }else placementMotion=null;
 const home=pose.home;const quietMotion=reduced&&!previewOnce;
 const focusGoal=smooth(clamp(contentState.progress/.6))*clamp(home);
 contentFocus=lerp(contentFocus,focusGoal,reduced?1:1-Math.exp(-dt*16));
 if(Math.abs(contentFocus-focusGoal)<.00001)contentFocus=focusGoal;
 readingQuiet=!!hostPlacement?.quiet||contentState.phase==='detail'||contentFocus>.98;
 layout=lerp(layout,layoutTarget,1-Math.exp(-dt*9));
 const h=clamp(home),p=pose;
 const reaction=reduced?0:clamp((elapsed-interactionTime)/1.2);
 const hop=!reduced&&!readingQuiet&&reaction>0&&reaction<1?Math.sin(reaction*Math.PI)**2*.18:0;
 dragX=lerp(dragX,dragTarget,reduced?1:1-Math.exp(-dt*15));
 actor.scale.setScalar(1);actor.position.set(p.bx+dragX,p.by+hop+p.lift*(1-p.attach),p.bz);
 // Camera has separately authored portrait framing, blended on resize without a new scene.
 camera.fov=lerp(34,39,layout);
 camera.position.set(lerp(p.camx,p.pcamx,layout),lerp(p.camy,p.pcamy,layout),lerp(p.camz,p.pcamz,layout));
 const target=new THREE.Vector3(lerp(p.tx,p.ptx,layout),lerp(p.ty,p.pty,layout),p.tz);
 camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 disk.rotation.set(p.drx,p.dry,p.drz);disk.scale.setScalar(p.ds);
 const diskNormal=new THREE.Vector3(0,1,0).applyEuler(disk.rotation);
 const diskMinHeight=2.2*p.ds*Math.sqrt(Math.max(0,1-diskNormal.y**2))+.16*p.ds*Math.abs(diskNormal.y)+.018;
 disk.position.set(p.dx,Math.max(p.dy,diskMinHeight),p.dz);
 if(diskNormal.y>.65){const onPlate=disk.position.y+(.115*p.ds+R-diskNormal.x*(actor.position.x-p.dx)-diskNormal.z*(p.bz-p.dz))/diskNormal.y;actor.position.y=lerp(actor.position.y,onPlate+hop+p.lift,p.attach)}
 // Translate the persistent ball and its supporting platter together. The reader owns its rectangle.
 const center=actor.position.clone().project(camera),edgePoint=actor.position.clone().add(new THREE.Vector3(R,0,0).applyQuaternion(camera.quaternion)).project(camera);
 const radiusPx=Math.abs(edgePoint.x-center.x)*innerWidth/2;
 const rect=contentState.targetBounds;
 worldGoal.set(0,0,0);
 if(!hostPlacement&&rect&&contentFocus>0){
  const left=Math.max(0,rect.x),right=Math.max(0,innerWidth-rect.x-rect.w),required=radiusPx*2+48;
  const tx=Math.max(left,right)>=required?(right>=left?innerWidth-right/2:left/2):innerWidth+radiusPx*1.35;
  raycaster.setFromCamera(new THREE.Vector2(tx/innerWidth*2-1,center.y),camera);
  const point=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-actor.position.y),point))worldGoal.copy(point).sub(actor.position);
 }
 worldGoal.multiplyScalar(contentFocus);if(hostPlacement)worldOffset.set(0,0,0);
 worldOffset.lerp(worldGoal,reduced?1:1-Math.exp(-dt*16));
 if(worldOffset.distanceTo(worldGoal)<.00001)worldOffset.copy(worldGoal);
 actor.position.add(worldOffset);disk.position.add(worldOffset);
 disk.updateMatrixWorld(true);
 body.rotation.z=p.roll+p.tilt;
 const look=contentState.displayBounds;const lookX=look?(look.x+look.w/2)/innerWidth*2-1:pointer.x,lookY=look?(look.y+look.h/2)/innerHeight*2-1:pointer.y;
 gaze.x=lerp(gaze.x,(readingQuiet?0:lookX)*.16,1-Math.exp(-dt*7));gaze.y=lerp(gaze.y,-(readingQuiet?0:lookY)*.09,1-Math.exp(-dt*7));
 face.quaternion.copy(camera.quaternion);face.rotateY(p.gx+(mode==='home'&&!reduced?gaze.x:0));face.rotateX(p.gy+(mode==='home'&&!reduced?gaze.y:0));face.rotateZ(p.tilt+(mode==='home'?dragX*.17:0));
 const blinkT=(manual?manualTime:elapsed)%(mode==='home'?12.7:5.7);
 const blink=!quietMotion&&!readingQuiet&&blinkT>3.56&&blinkT<3.78?1-Math.sin((blinkT-3.56)/.22*Math.PI)*.94:1;
 nativeEyeOpen=p.open*blink;eyeVertices(nativeEyeOpen,0);
 const height=Math.max(0,actor.position.y-R);
 ballShadow.position.x=actor.position.x;ballShadow.position.z=actor.position.z;ballShadow.scale.setScalar(2.6+height*.55);ballShadow.material.opacity=.44/(1+height*.65);
 diskShadow.position.x=disk.position.x;diskShadow.position.z=disk.position.z;diskShadow.scale.set(5.6*p.ds,5.6*p.ds,1);diskShadow.material.opacity=.42;
 const local=actor.position.clone();disk.worldToLocal(local);plateContact.position.x=local.x;plateContact.position.z=local.z;plateContact.material.opacity=.86*Math.exp(-p.lift*4.5);plateContact.scale.setScalar(.68+p.lift*1.2);
 plateContact.visible=Math.cos(p.drz)>.85;
 // Keep the complete actor visible through an aspect-ratio change while framing settles.
 const pre=actor.position.clone().project(camera);
 const preEdge=actor.position.clone().add(new THREE.Vector3(R,0,0).applyQuaternion(camera.quaternion)).project(camera);
 const halfWidth=Math.min(.85,Math.abs(preEdge.x-pre.x));
 const boundedX=clamp(pre.x,-1+halfWidth+.05,1-halfWidth-.05);
 if(contentFocus<.001&&worldOffset.length()<.001)camera.projectionMatrix.elements[8]-=boundedX-pre.x;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 // Host screen placement is consumed by this existing renderer/clock. No second actor.
 const unplaced=actor.position.clone().project(camera),unplacedEdge=actor.position.clone().add(new THREE.Vector3(R,0,0).applyQuaternion(camera.quaternion)).project(camera);
 homeScreen={x:(unplaced.x*.5+.5)*innerWidth,y:(-unplaced.y*.5+.5)*innerHeight,r:Math.abs(unplacedEdge.x-unplaced.x)*innerWidth/2};
 if(bookFrame){
  const q=bookFrame.world,u=bookFrame.blend,targetPosition=actor.position.clone(),targetCamera=camera.position.clone(),targetQuaternion=camera.quaternion.clone(),targetFov=camera.fov,targetFace=face.quaternion.clone();
  actor.position.copy(q.actor).lerp(targetPosition,u);actor.scale.setScalar(1);
  camera.position.copy(q.camera.position).lerp(targetCamera,u);camera.quaternion.copy(q.camera.quaternion).slerp(targetQuaternion,u);camera.fov=lerp(q.camera.fov,targetFov,u);camera.updateProjectionMatrix();
  if(bookFrame.viewport&&u===0)camera.projectionMatrix.copy(remapProjectionMatrix(q.camera.projectionMatrix,bookFrame.viewport,{width:innerWidth,height:innerHeight}));
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld(true);
  face.quaternion.copy(q.faceQuaternion).slerp(targetFace,u);body.rotation.z=lerp(-q.bodyRoll,p.roll+p.tilt,u);
  disk.position.set(0,.2,0);disk.rotation.set(0,0,0);disk.scale.setScalar(1.12);
  storyProps.apply(q,{opacity:1-u,papersVisible:bookFrame.papersVisible});
  ballShadow.position.x=actor.position.x;ballShadow.position.z=actor.position.z;diskShadow.position.x=0;diskShadow.position.z=0;
 }else storyProps.root.visible=false;
 if(hostPlacement?.bounds){
  const b=hostPlacement.bounds,origin=actor.position.clone();
  const scale=b.w/(homeScreen.r*2),normal=camera.getWorldDirection(new THREE.Vector3());
  raycaster.setFromCamera(new THREE.Vector2((b.x+b.w/2)/innerWidth*2-1,1-(b.y+b.h/2)/innerHeight*2),camera);
  const point=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,origin),point)){
   disk.position.sub(origin).multiplyScalar(scale).add(point);actor.position.copy(point);
   actor.scale.setScalar(scale);disk.scale.multiplyScalar(scale);disk.updateMatrixWorld(true);
  }
 }
 const foreground=mode==='home',retirement=bookFrame?.blend||0;
 // Foreground remains the same canvas. Only intro props/floor retire; no scene scroll offset.
 scene.background=bookEnabled?null:(foreground?null:new THREE.Color(THEME.background));
 floor.visible=!foreground;ballShadow.visible=!foreground;diskShadow.visible=!foreground;
 if(bookEnabled){floor.material.transparent=true;floor.material.opacity=1-retirement;disk.visible=!!bookFrame;disk.traverse(node=>{if(node.material){node.material.transparent=true;node.material.opacity=node===plateContact?0:1-retirement;}});ballShadow.material.opacity*=1-retirement;diskShadow.material.opacity*=1-retirement;}
 // Effects are procedural simulations with their own bounded-step policy. They
 // do not receive the uncapped presentation/timeline clock or replay missed frames.
 for(const effect of effects.values())effect.update(Math.min(.05,dt),effectState());
 shadowCache.prepare();
 renderer.setClearColor(THEME.background,foreground?0:1-retirement);renderer.render(scene,camera);
 // Anchor an accessible hit target to the projected existing actor; it contains no visual actor.
 const projected=actor.position.clone().project(camera);const edge=actor.position.clone().add(new THREE.Vector3(R*actor.scale.x,0,0).applyQuaternion(camera.quaternion)).project(camera);
 screenBall={x:(projected.x*.5+.5)*innerWidth,y:(-projected.y*.5+.5)*innerHeight,r:Math.abs(edge.x-projected.x)*innerWidth/2};
 hit.style.left=screenBall.x+'px';hit.style.top=screenBall.y+'px';hit.style.width=hit.style.height=screenBall.r*2.1+'px';
 $('#speech').style.left=clamp(screenBall.x,100,innerWidth-100)+'px';$('#speech').style.top=Math.max(85,screenBall.y-screenBall.r-55)+'px';
 const ui=smooth(clamp((home-.12)/.88))*(hostPlacement?1:(1-smooth(clamp(contentFocus*3))));
 $('#homepage').style.opacity=ui;$('#homepage').style.visibility=ui>0?'visible':'hidden';
 const ready=(!bookEnabled||mode==='home')&&(home>.97||mode==='home')&&(!!hostPlacement||contentFocus<.01);if(homeInteractive!==ready){homeInteractive=ready;$('#homepage').inert=!ready;}
 $('#intro').style.opacity=1-smooth(clamp(home*2));$('#intro').style.visibility=home>.6?'hidden':'visible';
 $('.intro-title').style.opacity=1-smooth(clamp((t-2.0)/1.2));$('.intro-title').style.transform=`translateY(${-12*smooth((t-2)/1.2)}px)`;
 const chapter=t<3.5?['01','让好奇，有一点分量。']:t<6.6?['02','轻一点，刚刚好。']:['03','把空间，留给你。'];$('#chapter-number').textContent=chapter[0];$('#chapter-text').textContent=chapter[1];
 $('#progress').style.width=clamp(t/DURATION)*100+'%';$('#skip').hidden=mode==='home';$('#skip').style.display=mode==='home'?'none':'flex';$('#home-state').hidden=mode!=='home';
 $('#replay-label').textContent=bridge?.after==='intro'?'回到开场':(reduced&&!previewOnce?'播放一次开场':'重播开场');
 $('#replay').setAttribute('aria-label',reduced&&!previewOnce?'播放一次开场':'重播开场');
 $('#entry-note').textContent=reduced&&!previewOnce?'已开启减少动态 · 直接进入空间':(mode==='home'?'现在，把空间留给你。':(previewOnce?'仅播放这一次 · 完成后恢复静态':'很快，带你进入空间。'));
 $('#entry-note').dataset.phase=mode==='home'?'home':'intro';
 if(elapsed>speechUntil)$('#speech').classList.remove('show');
}
function advance(dt,stamp){
 dt=Math.max(0,dt);
 if(bookEnabled){elapsed+=dt;render(dt,stamp);return;}
 elapsed+=dt;
 if(bridge){bridge.elapsed+=dt;const u=smooth(bridge.elapsed/bridge.duration);pose=mix(bridge.from,bridge.to,u);if(bridge.elapsed>=bridge.duration){const after=bridge.after;bridge=null;mode=after;if(after==='home')previewOnce=false;t=after==='home'?DURATION:0;pose=sample(t);$('#replay-label').textContent='重新看一遍';}}
 else if(mode==='intro'){t=Math.min(DURATION,t+dt);pose=sample(t);if(t>=DURATION){mode='home';previewOnce=false;}}
 else pose=homePose();
 render(dt,stamp);
}
function needsFrame(){
 if(manual||paused||worldDisposed)return false;
 const pointerActive=!reduced&&!readingQuiet&&(Math.abs(gaze.x-pointer.x*.16)>.0001||Math.abs(gaze.y+pointer.y*.09)>.0001);
 return mode!=='home'||!!bridge||frameTasks.size>0||hostPlacement?.placementActive||Math.abs(layout-layoutTarget)>.0001||Math.abs(contentFocus-smooth(clamp(contentState.progress/.6)))>.0001||!!drag||Math.abs(dragX-dragTarget)>.0001||elapsed-interactionTime<1.2||elapsed<speechUntil||pointerActive||[...effects.values()].some(effect=>effect.needsFrame?.());
}
clock=createFrameClock({step:(dt,stamp)=>{syncSystemMotion();if(!manual&&!paused){try{advance(dt,stamp);}catch(error){bookStory?.fail('render-error');paused=true;clock?.suspend();announceWorldAvailability('failed','render-error');console.error(error);}}},needsFrame});
render(0);if(!manual)clock.wake();
window.ballStudy={version:'3.0.0',ready:true,duration:DURATION,
 snapshot:()=>({story:worldAPI.story.getState(),clock:clock?.getState(),effectCount:effects.size,time:t,mode,actorUUID:actor.uuid,actorCount:scene.children.filter(c=>c.name==='Ball / persistent actor').length,position:actor.position.toArray(),scale:actor.scale.toArray(),screen:{...screenBall},layout,home:pose.home,reduced,previewOnce,entryReason:motionQuery.matches?'system-reduced-motion':'autoplay',cameraPosition:camera.position.toArray(),palette:THEME,bridge:!!bridge,interactions:tapCount,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,canvasCount:worldRoot.querySelectorAll('#world-stage canvas').length,diskPosition:disk.position.toArray(),lift:pose.lift,platterTilt:pose.drz,roll:pose.roll,contactShadowOpacity:plateContact.material.opacity,contactShadowScale:plateContact.scale.x,eyeSurfaceClearance:.007,faceScale:face.scale.toArray(),contentFocus,readingQuiet,hostPlacement:hostPlacement&&JSON.parse(JSON.stringify(hostPlacement)),homeScreen:homeScreen&&{...homeScreen},worldOffset:worldOffset.toArray()}),
 // Test-only deterministic hooks; remain local and inert in ordinary playback.
 ...(manual?{geometryQA(){let min=Infinity;for(const eye of eyes){const a=eye.mesh.geometry.attributes.position;for(let i=0;i<a.count;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=a.getX(i+j)/3;y+=a.getY(i+j)/3;z+=a.getZ(i+j)/3}min=Math.min(min,Math.hypot(x,y,z)-R)}}const n=new THREE.Vector3(0,1,0).applyEuler(disk.rotation);return{ballPlateSeparation:n.dot(actor.position.clone().sub(disk.position))-(.115*pose.ds+R),minEyeTriangleClearance:min,diskMinY:disk.position.y-2.2*pose.ds*Math.sqrt(Math.max(0,1-n.y*n.y))-.16*pose.ds*Math.abs(n.y),faceScale:face.scale.toArray()}},seek(seconds){t=clamp(seconds,0,DURATION);manualTime=t;elapsed=t;pose=sample(t);mode=t>=DURATION?'home':'intro';bridge=null;layout=layoutTarget;render(1/60);return this.snapshot()},step(seconds){advance(seconds);return this.snapshot()},skip,replay,setReduced}:{}),
 dispose(){worldDisposed=true;clock?.dispose();bookStory?.dispose();for(const effect of effects.values())effect.dispose?.();effects.clear();storyProps.dispose();worldAPI.dispose();shadowCache.dispose();paused=true;scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});noise.dispose();shadowTex.dispose();env.dispose();renderer.dispose();}
};

announceWorldAvailability('ready');
