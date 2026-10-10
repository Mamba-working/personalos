import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {WeatherClock, sampleSun} from './weather-clock.js';
import {WeatherModel} from './weather-model.js';
import {WaterRenderer} from './water-renderer.js';
import {sunDirection, foregroundBounds, fitSunShadow} from './lighting.js';

const $ = selector => document.querySelector(selector), canvas = $('#scene');
const clock = new WeatherClock(), state = {ready:false,disposed:false,errors:[],threeRevision:THREE.REVISION,renderCount:0,pmremCaptures:0};
const frameIntervals=[],cpuSamples=[],renderSamples=[],environmentSamples=[];
const endpointMaps=new Map();let renderer,scene,root,camera,sun,sky,environmentScene,pmrem,temporaryMap,model,water,bounds,raf=0,lastTimestamp=null,lastLightingTick=-1,resizeObserver;
let diagnostics=false,hiddenResume=false,lastPanel=-1,appliedSun=null,lastEnvironmentSeconds=null;
const push = (a,n) => {a.push(n);if(a.length>600)a.shift();};
function metrics(a){if(!a.length)return {samples:0,mean:null,p50:null,p95:null,max:null};const sorted=[...a].sort((x,y)=>x-y);return {samples:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};}
function clearTemporary(){if(temporaryMap){temporaryMap.dispose();temporaryMap=null;}}
function snapshot(){return {...state,clock:clock.snapshot(),weather:model?.snapshot(),water:water?.snapshot(),lighting:{appliedSun,direction:sun?.position.clone().sub(sun.target.position).normalize().toArray(),skyDirection:sky?.material.uniforms.sunPosition.value.toArray(),environmentDirection:scene?.userData.environmentDirection,
  environmentCaptureSize:64,maximumEnvironmentUpdateHz:2,playbackIntermediateCaptureBudget:23,environmentSampleSeconds:lastEnvironmentSeconds,environmentLagSeconds:appliedSun&&lastEnvironmentSeconds!==null?appliedSun.seconds-lastEnvironmentSeconds:null,environmentAngularLagDegrees:appliedSun&&scene?.userData.environmentDirection?THREE.MathUtils.radToDeg(sunDirection(appliedSun).angleTo(new THREE.Vector3(...scene.userData.environmentDirection))):null,environmentPolicy:'Direct sun and visible sky every display frame; dirty PMREM at most2Hz, exact pause/end refresh; GPU cost unvalidated',shadowFit:state.shadowFit,directIntensity:sun?.intensity,environmentIntensity:scene?.environmentIntensity,exposure:renderer?.toneMappingExposure,temporaryTargets:Number(Boolean(temporaryMap))},
  performance:{scope:'Measured browser RAF intervals and main-thread CPU durations; NOT GPU time or a claimed device benchmark',frameIntervalsMs:metrics(frameIntervals),observedRAFHz:frameIntervals.length?1000/(frameIntervals.reduce((a,b)=>a+b,0)/frameIntervals.length):null,cpuFrameMs:metrics(cpuSamples),renderSubmissionMs:metrics(renderSamples),pmremSubmissionMs:metrics(environmentSamples),gpuTimeMs:null,rendererInfo:renderer?{memory:{...renderer.info.memory},render:{...renderer.info.render}}:null},
  viewport:renderer?{css:[canvas.clientWidth,canvas.clientHeight],drawingBuffer:[canvas.width,canvas.height],dpr:renderer.getPixelRatio(),cameraAspect:camera.aspect}:null};}
function applyLighting(force=false){
  if(!state.ready)return;const sample=clock.snapshot().sun;
  if(!force&&clock.sunTicks===lastLightingTick)return;
  lastLightingTick=clock.sunTicks;appliedSun=sample;const d=sunDirection(sample);
  // Direct illumination and the visible sky follow the current fixed timeline
  // on every rendered frame. IBL is deliberately sampled at a lower rate.
  sky.material.uniforms.sunPosition.value.copy(d);state.shadowFit=fitSunShadow(sun,bounds,d,model.groundY);
  const dirty=lastEnvironmentSeconds===null||sample.seconds<lastEnvironmentSeconds||sample.seconds-lastEnvironmentSeconds>=.5-1e-9;
  if(sample.endpoint){scene.environment=endpointMaps.get(sample.endpoint).texture;clearTemporary();lastEnvironmentSeconds=sample.seconds;scene.userData.environmentDirection=d.toArray();}
  else if(force||dirty){const start=performance.now(),next=pmrem.fromScene(environmentScene,0,.1,100000,{size:64});scene.environment=next.texture;clearTemporary();temporaryMap=next;state.pmremCaptures++;push(environmentSamples,performance.now()-start);lastEnvironmentSeconds=sample.seconds;scene.userData.environmentDirection=d.toArray();}
  // Mark after auxiliary captures, so PMREM cannot consume the main shadow update.
  sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
}
function render(){if(!state.ready||state.disposed)return;const start=performance.now();renderer.render(scene,camera);push(renderSamples,performance.now()-start);state.renderCount++;}
function stopRAF(){if(raf)cancelAnimationFrame(raf);raf=0;lastTimestamp=null;}
function schedule(){if(!raf&&state.ready&&!state.disposed&&clock.running&&(model?.enabled||clock.sunPlaying)&&!document.hidden)raf=requestAnimationFrame(frame);}
function frame(timestamp){raf=0;if(!state.ready||state.disposed||!clock.running||(!model.enabled&&!clock.sunPlaying))return;const start=performance.now();
  if(lastTimestamp!==null){const delta=(timestamp-lastTimestamp)/1000;push(frameIntervals,delta*1000);clock.advance(delta,dt=>model.step(dt));}
  lastTimestamp=timestamp;water.sync();applyLighting();render();push(cpuSamples,performance.now()-start);
  if(clock.ticks-lastPanel>=24){updateControls();lastPanel=clock.ticks;}schedule();
}
function updateControls(){
  const s=clock.snapshot(),w=model.snapshot();$('#pause').textContent=s.running?'暂停画面':'继续画面';$('#pause').setAttribute('aria-pressed',String(!s.running));
  $('#play-sun').textContent=s.sunPlaying?'日照回放中':'播放 12 秒日照';$('#play-sun').setAttribute('aria-pressed',String(s.sunPlaying));
  $('#rain').setAttribute('aria-pressed',String(model.enabled));$('#rain').textContent=model.enabled?'雨 · 开':'雨 · 关';
  $('#sun-progress').style.setProperty('--progress',`${s.sun.progress*100}%`);$('#sun-progress').setAttribute('aria-valuenow',(s.sun.progress*100).toFixed(1));$('#sun-time').textContent=`${s.sun.seconds.toFixed(1)} / 12 s`;
  $('#state-label').textContent=`${s.sun.endpoint||'日照移动'} · ${s.running?'实时雨水':'画面已暂停'}`;
  $('#status').textContent=`seed ${model.seed} · ${w.counts.rimGroundHits} 次檐滴落地`;
  $('[data-state="A"]').setAttribute('aria-pressed',String(s.sun.endpoint==='A'));$('[data-state="B"]').setAttribute('aria-pressed',String(s.sun.endpoint==='B'));
  if(diagnostics){const snap=snapshot();$('#diagnostic-text').textContent=JSON.stringify({clock:snap.clock,counts:w.counts,pools:w.pools,overflow:w.overflow,distinctRimVertices:w.distinctRimVertices,collision:w.collision,lighting:snap.lighting,performance:snap.performance,recentCausalEvents:w.recentEvents.slice(-8)},null,2);}
}
function pause(){clock.running=false;stopRAF();if(!state.ready)return snapshot();applyLighting(true);render();updateControls();return snapshot();}
function play(){clock.running=true;lastTimestamp=null;schedule();if(state.ready)updateControls();return snapshot();}
function setState(key){clock.selectSun(key);if(!model.enabled)stopRAF();applyLighting(true);render();updateControls();return snapshot();}
function playSun(){clock.playSun();lastTimestamp=null;applyLighting(true);schedule();updateControls();return snapshot();}
function setRain(enabled){model.enabled=Boolean(enabled);water.updateGround(true);water.sync();if(!model.enabled&&!clock.sunPlaying)stopRAF();else{lastTimestamp=null;schedule();}render();updateControls();return snapshot();}
function reset(seed=Number($('#seed').value)){clock.reset();model.reset(seed);$('#seed').value=String(seed);lastTimestamp=null;lastLightingTick=-1;lastPanel=-1;
  frameIntervals.length=cpuSamples.length=renderSamples.length=environmentSamples.length=0;water.updateGround(true);water.sync();applyLighting(true);render();updateControls();schedule();return snapshot();}
function resize(width=canvas.getBoundingClientRect().width,height=width/1.5,dpr=Math.min(window.devicePixelRatio||1,1.5)){
  if(!state.ready||state.disposed)return;const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
  if(!Number.isFinite(w+h+dpr)||dpr<=0||dpr>2)throw new Error('Invalid viewport');renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();return snapshot();
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function captureSnapshot(){const data=snapshot();saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`three-weather-seed-${model.seed}-tick-${clock.ticks}.json`);return data;}
function capturePNG(){render();canvas.toBlob(blob=>{if(blob)saveBlob(blob,`three-weather-seed-${model.seed}-tick-${clock.ticks}.png`);else{$('#status').textContent='截图不可用';}},'image/png');}
function dispose(){if(state.disposed)return;state.disposed=true;state.ready=false;clock.running=false;stopRAF();resizeObserver?.disconnect();water?.dispose();model?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();for(const r of[scene,environmentScene])r?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clearTemporary();endpointMaps.forEach(t=>t.dispose());endpointMaps.clear();pmrem?.dispose();sun?.shadow.dispose();renderer?.dispose();}
async function init(){
  if(THREE.REVISION!=='180')throw new Error('Expected local official Three r180');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=.8;renderer.transmissionResolutionScale=1;renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  const manifest=await fetch('./assets/export-manifest.json').then(r=>{if(!r.ok)throw new Error('Export manifest missing');return r.json();});
  if(state.disposed)return;const gltf=await new GLTFLoader().loadAsync('./assets/foreground.glb');if(state.disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return;}root=gltf.scene;scene=new THREE.Scene();scene.add(root);root.updateMatrixWorld(true);
  let triangles=0,meshes=0;root.traverse(o=>{if(o.isCamera)camera=o;if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
    const role=o.userData.slice_role,m=o.material;o.castShadow=!['canopy','clear-edge','ground'].includes(role);o.receiveShadow=true;
    if(['canopy','clear-edge'].includes(role)){m.transmission=.97;m.opacity=1;m.transparent=false;m.depthWrite=true;m.thickness=.0002;m.ior=1.54;m.roughness=.07;m.clearcoat=.32;m.clearcoatRoughness=.1;m.side=THREE.DoubleSide;}
    if(role==='ground'){m.roughness=.16;m.clearcoat=.88;m.clearcoatRoughness=.1;}
  });
  if(!camera||triangles!==manifest.triangleCount)throw new Error('Approved foreground contract failed');camera.near=.01;camera.far=100;camera.updateProjectionMatrix();
  state.asset={triangles,meshes,glbSHA256:manifest.glbSHA256,glbBytes:manifest.glbBytes,sourceSHA256:manifest.source_sha256};bounds=foregroundBounds(root);
  scene.environmentIntensity=.28;sun=new THREE.DirectionalLight(new THREE.Color().setRGB(1,.94,.86,THREE.LinearSRGBColorSpace),3.1);
  sun.name='Dominant shared sun';sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.000015;sun.shadow.normalBias=.00045;scene.add(sun,sun.target);
  sky=new Sky();sky.scale.setScalar(10000);Object.assign(sky.material.uniforms.turbidity,{value:3});sky.material.uniforms.rayleigh.value=1.3;sky.material.uniforms.mieCoefficient.value=.005;sky.material.uniforms.mieDirectionalG.value=.8;scene.add(sky);
  environmentScene=new THREE.Scene();const captureSky=new THREE.Mesh(sky.geometry,sky.material);captureSky.scale.copy(sky.scale);environmentScene.add(captureSky);pmrem=new THREE.PMREMGenerator(renderer);
  for(const [key,seconds]of[['A',0],['B',12]]){const c=new WeatherClock();c.selectSun(key);sky.material.uniforms.sunPosition.value.copy(sunDirection(c.snapshot().sun));endpointMaps.set(key,pmrem.fromScene(environmentScene,0,.1,100000,{size:64}));state.pmremCaptures++;}
  model=new WeatherModel({colliderRoot:root,seed:20261010});water=new WaterRenderer({scene,model});
  // Optional authored wet maps are loaded by the local material module. A missing
  // asset fails visibly rather than silently claiming the original wet art.
  const {applyCanopyWetMaps}=await import('./wet-material.js');state.wetMaterial=await applyCanopyWetMaps(root,renderer);
  if(state.disposed){root.traverse(o=>{o.material?.bumpMap?.dispose();});return;}state.ready=true;$('#status').textContent='已加载';document.querySelectorAll('button,input').forEach(e=>e.disabled=false);
  $('#pause').addEventListener('click',()=>clock.running?pause():play());$('#play-sun').addEventListener('click',playSun);
  document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>setState(b.dataset.state)));
  $('#rain').addEventListener('click',()=>setRain(!model.enabled));$('#reset').addEventListener('click',()=>{try{reset();}catch(e){$('#status').textContent=e.message;}});
  $('#diagnostics').addEventListener('change',e=>{diagnostics=e.target.checked;water.setDebug(diagnostics);$('#diagnostic-panel').hidden=!diagnostics;updateControls();render();});
  $('#snapshot').addEventListener('click',captureSnapshot);$('#capture').addEventListener('click',capturePNG);
  resizeObserver=new ResizeObserver(()=>resize());resizeObserver.observe($('.viewer'));resize();applyLighting(true);water.sync();render();updateControls();schedule();window.dispatchEvent(new Event('slice-ready'));
}
window.sliceDebug={snapshot,pause,play,playSun,setState,setRain,reset,resizeForTest:resize,captureSnapshot,capturePNG,dispose,
  stepForTest(count){if(clock.running)throw new Error('Pause before deterministic stepping');if(!Number.isInteger(count)||count<0||count>1440)throw new Error('Step budget 0–1440');clock.running=true;for(let i=0;i<count;i++)clock.advance(1/120,dt=>model.step(dt));clock.running=false;water.sync();applyLighting(true);render();updateControls();return snapshot();}};
document.addEventListener('visibilitychange',()=>{if(!state.ready)return;if(document.hidden){hiddenResume=hiddenResume||clock.running;pause();}else if(hiddenResume){hiddenResume=false;play();}else if(clock.running){lastTimestamp=null;schedule();render();}});
window.addEventListener('pagehide',e=>{if(e.persisted){hiddenResume=hiddenResume||clock.running;pause();}else dispose();});window.addEventListener('pageshow',e=>{if(e.persisted){if(state.ready)resize();if(hiddenResume){hiddenResume=false;play();}}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();clock.running=false;stopRAF();state.errors.push('WebGL context lost');$('#status').textContent='图形上下文丢失，请重新加载';});
init().catch(error=>{state.errors.push(error.message);$('#status').textContent=`未能启动：${error.message}`;$('#failure').hidden=false;$('#failure').textContent='需要浏览器正常可用的 WebGL。此处不会启用软件 GPU 或绕过图形限制。';dispose();console.error(error);});
