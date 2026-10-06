/** CPU scene-controller harness. Actual Three geometry/matrices and production
 * scene/controller execute; renderer, PMREM and 2D canvas drawing are doubles.
 * This intentionally does not create, enable, or test a WebGL context.
 */
import * as Three from '../../runtime/world/vendor/three/three.module.js';
import * as geometry from '../../runtime/story/geometry.js';
import {createStoryProps} from '../../runtime/story/props.js';
import {THEME} from '../../runtime/world/theme.js';
import {bootContent,read} from './content-fixture.mjs';
export function bootWorld({enabled=true,manual=true,reduced=false,query='',width=1180}={}){
 const f=bootContent({reduced,width,query:query|| (manual?'?manual=1':'')}),w=f.w,d=f.d,renderers=[];
 d.documentElement.dataset.storyEnabled=String(enabled);
 w.HTMLCanvasElement.prototype.getContext=function(type){if(type!=='2d')throw Error('CPU fixture never supplies WebGL');return{createRadialGradient:()=>({addColorStop(){}}),fillRect(){},fillStyle:''};};
 class Renderer{constructor(){this.domElement=d.createElement('canvas');this.shadowMap={};this.info={render:{triangles:0,calls:0}};this.disposed=false;renderers.push(this);}setPixelRatio(){}setSize(){}setClearColor(){}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);this.info.render.calls++;}dispose(){this.disposed=true;}}
 class PMREM{fromScene(){return{texture:new Three.Texture(),dispose(){}};}dispose(){}}
 w.__THREE={...Three,WebGLRenderer:Renderer,PMREMGenerator:PMREM};w.__geometry=geometry;w.__createStoryProps=createStoryProps;w.__THEME=THEME;
 const publish=(name,source)=>w.eval('(()=>{'+source.replace(/^import[^\n]+\n/gm,'').replace(/\bexport /g,'')+`;window.__${name}=${name};})()`);
 publish('createWorldAdapter',read('world/world-adapter.js'));
 publish('announceWorldAvailability',read('world-availability.js'));
 publish('createStoryLifecycle',read('story/lifecycle.js'));
 publish('createFrameClock',read('story/frame-clock.js'));
 const names=read('story/book-story.js').match(/import \{([^}]+)\} from '\.\/geometry.js'/)[1];
 publish('createBookStory',`const createStoryLifecycle=window.__createStoryLifecycle;const {${names}}=window.__geometry;`+read('story/book-story.js').replace(/^import[^\n]+\n/gm,''));
 w.eval(read('world/vendor/aora/rings.js'));
 const source=read('world/scene.js').replace(/^import[^\n]+\n/gm,'');
 w.eval('(()=>{const THREE=window.__THREE,THEME=window.__THEME,createWorldAdapter=window.__createWorldAdapter,announceWorldAvailability=window.__announceWorldAvailability,createBookStory=window.__createBookStory,createStoryProps=window.__createStoryProps,createFrameClock=window.__createFrameClock,remapProjectionMatrix=window.__geometry.remapProjectionMatrix;'+source+';window.__cpuScene={scene,camera,actor,face,eyes,renderer};})();');
 let stamp=0;
 return {...f,world:w.personalOSWorld,study:w.ballStudy,cpu:w.__cpuScene,renderers,raf(dt=16.667){stamp+=dt;const pending=[...f.frames];f.frames.clear();for(const [,fn]of pending)fn(stamp);return pending.length;},destroy(){w.ballStudy.dispose();f.close();}};
}
