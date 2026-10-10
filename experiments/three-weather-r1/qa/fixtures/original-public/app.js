import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ForegroundRain } from './foreground-rain.js';
import { SUN_STATES as states, PLAYBACK_SECONDS, ENVIRONMENT_INTERVAL_SECONDS, SunPlaybackClock, environmentCaptureDue } from './sun-playback.js';

// Independent migration experiment. The renderer, PBR, PMREM, transmission and
// shadows are unmodified official Three r180. No source image is a material.
const width=900,height=600;
const canvas=document.querySelector('#scene'),status=document.querySelector('#status'),playButton=document.querySelector('#play-sun');
const info={ready:false,threeRevision:THREE.REVISION,state:null,states,renderCount:0,errors:[],disposed:false,pmremGenerations:0,playbackPMREMGenerations:0};
const environmentMaps=new Map(),clock=new SunPlaybackClock();
let renderer,scene,camera,sun,sky,environmentScene,pmrem,manifest,temporaryEnvironment=null,lastEnvironmentElapsed=null,animationFrame=0,rain=null,lastFrameSeconds=null,sunShadowDirty=true;
function direction(state){const a=THREE.MathUtils.degToRad(state.azimuth),e=THREE.MathUtils.degToRad(state.elevation);return new THREE.Vector3(Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a));}
function draw(){
 if(!info.ready||info.disposed)return;
 // Mark the main sun after any sky-only PMREM work, so an auxiliary render
 // cannot consume the main-view shadow update request.
 if(sunShadowDirty){sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;}
 renderer.render(scene,camera);sunShadowDirty=false;info.renderCount++;info.memory={...renderer.info.memory};info.render={...renderer.info.render};
}
function snapshot(){return {...info,rain:rain?.snapshot(),playback:{...clock.state(),durationSeconds:PLAYBACK_SECONDS,environmentIntervalSeconds:ENVIRONMENT_INTERVAL_SECONDS,lastEnvironmentElapsed,temporaryEnvironmentLive:Boolean(temporaryEnvironment)},direction:sun?sun.position.clone().sub(sun.target.position).normalize().toArray():null,skyDirection:sky?.material.uniforms.sunPosition.value.toArray(),environmentState:scene?.userData.environmentState,environmentDirection:scene?.userData.environmentDirection,shadowMapReady:Boolean(sun?.shadow.map),exposure:renderer?.toneMappingExposure,environmentIntensity:scene?.environmentIntensity,lightIntensity:sun?.intensity,renderer:renderer?{vendor:renderer.getContext().getParameter(renderer.getContext().VENDOR),renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER),drawingBuffer:[canvas.width,canvas.height]}:null};}
function clearTemporaryEnvironment(){if(temporaryEnvironment){temporaryEnvironment.dispose();temporaryEnvironment=null;}}
function updateControls(state){
 const endpointLabel=state.endpoint?states[state.endpoint].label:'太阳移动中';
 document.querySelector('#state-label').textContent=endpointLabel+' · 前景 / 天空 / 投影共享光向';
 document.querySelectorAll('[data-state]').forEach(b=>{const active=!state.running&&b.dataset.state===state.endpoint;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 playButton.textContent=state.running?'暂停太阳':state.progress===1?'重新播放 12 秒':state.progress>0?'继续太阳回放':'播放 12 秒太阳移动';
 playButton.setAttribute('aria-pressed',String(state.running));
 const bar=document.querySelector('#sun-progress');bar.style.setProperty('--progress',`${state.progress*100}%`);bar.setAttribute('aria-valuenow',(state.progress*100).toFixed(1));bar.setAttribute('aria-valuetext',`${state.elapsed.toFixed(1)} / ${PLAYBACK_SECONDS} 秒`);
 document.querySelector('#sun-time').textContent=`${state.elapsed.toFixed(1)} / ${PLAYBACK_SECONDS}s`;
 status.textContent=(state.running?'加速测试 · ':state.progress===1?'终态稳定 · ':state.progress>0?'已暂停 · ':'两态对照 · ')+'固定曝光';
}
function applySunState(state,{forceEnvironment=false}={}){
 const d=direction(state);
 // The visible sky and capture sky share the official Sky material, so both
 // receive this exact uniform. The sole directional light uses the same vector.
 sky.material.uniforms.sunPosition.value.copy(d);sun.position.copy(sun.target.position).addScaledVector(d,6);sun.updateMatrixWorld();sunShadowDirty=true;
 if(state.endpoint){
  scene.environment=environmentMaps.get(state.endpoint).texture;scene.userData.environmentState=state.endpoint;scene.userData.environmentDirection=d.toArray();lastEnvironmentElapsed=state.elapsed;clearTemporaryEnvironment();
 }else if(environmentCaptureDue(state.elapsed,lastEnvironmentElapsed,forceEnvironment)){
  const next=pmrem.fromScene(environmentScene,0,.1,100000,{size:128});
  scene.environment=next.texture;clearTemporaryEnvironment();temporaryEnvironment=next;lastEnvironmentElapsed=state.elapsed;
  info.pmremGenerations++;info.playbackPMREMGenerations++;scene.userData.environmentState=`playback:${state.elapsed.toFixed(4)}`;scene.userData.environmentDirection=d.toArray();
 }
 info.state=state.endpoint||'playback';updateControls(state);draw();
}
function stopFrame(){if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameSeconds=null;}
function ensureAnimationFrame(){if(!animationFrame&&!info.disposed&&!document.hidden&&(clock.running||rain?.enabled))animationFrame=requestAnimationFrame(frame);}
function updateRainControls(){if(!rain)return;const r=rain.snapshot();document.querySelector('#toggle-rain').textContent=r.enabled?'关闭前景雨':'开启前景雨';document.querySelector('#toggle-rain').setAttribute('aria-pressed',String(r.enabled));const diagnostic=document.querySelector('#toggle-impacts');diagnostic.disabled=!r.enabled;diagnostic.setAttribute('aria-pressed',String(r.debugMarkers));diagnostic.textContent=r.debugMarkers?'隐藏接触点':'显示接触点';document.querySelector('#rain-status').textContent=r.enabled?`首次接触：伞 ${r.impactCounts.canopy} · 球 ${r.impactCounts.ball} · 地面 ${r.impactCounts.ground}`:'雨默认关闭 · 独立开关';}
function frame(timestamp){animationFrame=0;if(info.disposed)return;const now=timestamp/1000,dt=lastFrameSeconds===null?0:Math.max(0,now-lastFrameSeconds);lastFrameSeconds=now;if(rain?.enabled){rain.update(dt);if(info.renderCount%6===0)updateRainControls();}if(clock.running)applySunState(clock.tick(now));else if(rain?.enabled)draw();ensureAnimationFrame();}
function setState(key){if(!info.ready||info.disposed)throw new Error('Scene not ready');stopFrame();applySunState(clock.selectEndpoint(key));ensureAnimationFrame();return snapshot();}
function play(){if(!info.ready||info.disposed)throw new Error('Scene not ready');if(clock.running)return snapshot();applySunState(clock.play(performance.now()/1000));ensureAnimationFrame();return snapshot();}
function pause(){if(!info.ready||info.disposed)return snapshot();stopFrame();applySunState(clock.pause(performance.now()/1000),{forceEnvironment:true});ensureAnimationFrame();return snapshot();}
function setRain(enabled){if(!info.ready||info.disposed)throw new Error('Scene not ready');rain.setEnabled(enabled);updateRainControls();if(!clock.running&&!rain.enabled)stopFrame();draw();ensureAnimationFrame();return snapshot();}
function setImpactMarkers(enabled){if(!rain)throw new Error('Scene not ready');rain.setDebugMarkers(enabled);updateRainControls();draw();return snapshot();}
function dispose(){if(info.disposed)return;stopFrame();clock.running=false;rain?.dispose();info.disposed=true;const geometries=new Set(),materials=new Set();for(const root of [scene,environmentScene])root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clearTemporaryEnvironment();environmentMaps.forEach(rt=>rt.dispose());pmrem?.dispose();sun?.shadow.dispose();renderer?.dispose();}
async function init(){
 if(THREE.REVISION!=='180')throw new Error('Version drift: expected Three r180');
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=.8;renderer.transmissionResolutionScale=.5;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');info.gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'Unavailable';
 manifest=await fetch('./assets/export-manifest.json').then(r=>{if(!r.ok)throw new Error('Manifest fetch failed');return r.json();});
 const gltf=await new GLTFLoader().loadAsync('./assets/foreground.glb');scene=new THREE.Scene();scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
 const cameras=[];gltf.scene.traverse(o=>{if(o.isCamera)cameras.push(o);});camera=cameras[0];if(!camera)throw new Error('Exported camera missing');camera.aspect=width/height;camera.near=.01;camera.far=100;camera.updateProjectionMatrix();
 let triangles=0,meshCount=0;
 scene.traverse(o=>{if(!o.isMesh)return;meshCount++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;const role=o.userData.slice_role;o.castShadow=!['canopy','clear-edge','ground'].includes(role);o.receiveShadow=true;o.frustumCulled=true;const m=o.material;if(['canopy','clear-edge'].includes(role)){if(!m.isMeshPhysicalMaterial||m.transmission<=0)throw new Error('Transmission material was not exported');m.thickness=.0002;m.transparent=false;m.opacity=1;m.depthWrite=true;m.side=THREE.DoubleSide;}if(role==='ground'){o.castShadow=false;m.roughness=.2;}});
 if(triangles!==manifest.triangleCount||triangles>150000)throw new Error('Triangle contract failed');
 info.triangles=triangles;info.meshCount=meshCount;info.sourceSHA256=manifest.source_sha256;info.projection={fov:camera.fov,aspect:camera.aspect,position:camera.getWorldPosition(new THREE.Vector3()).toArray()};
 scene.environmentIntensity=.35;
 sun=new THREE.DirectionalLight(new THREE.Color().setRGB(1,.93,.83,THREE.LinearSRGBColorSpace),3);sun.name='Shared single sun';sun.target.position.set(.55,.2,-.35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:14});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00003;sun.shadow.normalBias=.001;scene.add(sun,sun.target);
 environmentScene=new THREE.Scene();sky=new Sky();sky.scale.setScalar(10000);sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.3;sky.material.uniforms.mieCoefficient.value=.005;sky.material.uniforms.mieDirectionalG.value=.8;scene.add(sky);
 // Two scene objects share the unchanged official sky geometry/material.
 // The capture scene permanently contains only sky, never the foreground.
 const captureSky=new THREE.Mesh(sky.geometry,sky.material);captureSky.scale.copy(sky.scale);environmentScene.add(captureSky);pmrem=new THREE.PMREMGenerator(renderer);
 for(const [key,value] of Object.entries(states)){sky.material.uniforms.sunPosition.value.copy(direction(value));environmentMaps.set(key,pmrem.fromScene(environmentScene,0,.1,100000,{size:128}));info.pmremGenerations++;}
 rain=new ForegroundRain({scene,colliderRoot:gltf.scene,capacity:96});
 info.ready=true;document.querySelector('#toggle-rain').disabled=false;document.querySelector('#toggle-rain').addEventListener('click',()=>setRain(!rain.enabled));document.querySelector('#toggle-impacts').addEventListener('click',()=>setImpactMarkers(!rain.debugMarkers));updateRainControls();document.querySelectorAll('[data-state]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>setState(b.dataset.state));});playButton.disabled=false;playButton.addEventListener('click',()=>clock.running?pause():play());document.querySelector('#stats').textContent=`${triangles.toLocaleString()} 三角面 · ${meshCount} 网格 · 900×600 / DPR 1 · PMREM 128 / 回放≤2Hz · 2048太阳阴影 · 半分辨率透射`;
 setState('A');window.dispatchEvent(new Event('slice-ready'));
}
window.sliceDebug={snapshot,setState,play,pause,setRain,setImpactMarkers,draw,dispose,resizeForTest(w,h,dpr=1){if(!info.ready)throw new Error('not ready');renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();return snapshot();}};
window.addEventListener('pagehide',e=>{if(e.persisted){if(clock.running)pause();stopFrame();}else dispose();});window.addEventListener('pageshow',e=>{if(e.persisted&&info.ready){draw();ensureAnimationFrame();}});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(clock.running)pause();stopFrame();}else if(info.ready){draw();ensureAnimationFrame();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopFrame();clock.running=false;info.errors.push('WebGL context lost');status.textContent='图形上下文丢失，请重新加载';});
init().catch(e=>{info.errors.push(e.message);status.textContent='切片未完成：'+e.message;console.error(e);});
