import {
  Color, DepthTexture, HalfFloatType, Matrix4, Vector2, WebGLRenderTarget, type Camera, type PerspectiveCamera,
  type Scene, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DepthOfFieldPass } from './DepthOfFieldPass';
import { LensPass } from './LensPass';
import { BLOOM_HIGHPASS_FRAG, GradeShader, OpticsShader, PrecipShader } from './shaders';

/**
 * Post chain (HDR until OutputPass):
 *   scene (MSAA + depth) → depth of field → distant precipitation → sun shafts / anamorphic streak
 *   → bloom → lens vignetting → AgX tone mapping (OutputPass) → film grade (halation, grain).
 */
export class PostFX {
  readonly composer: EffectComposer;
  readonly dof: DepthOfFieldPass;
  readonly precip: ShaderPass;
  readonly lens: LensPass;
  readonly bloom: UnrealBloomPass;
  readonly optics: ShaderPass;
  readonly grade: ShaderPass;
  private rot = new Matrix4();

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    const rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: 4, depthTexture: new DepthTexture(4, 4) });
    this.composer = new EffectComposer(renderer, rt);
    this.dof = new DepthOfFieldPass();
    this.precip = new ShaderPass(PrecipShader);
    this.lens = new LensPass();
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.3, 0.4, 2.2);
    // Stock high-pass forwards the *whole* pixel once it crosses the threshold, so a bright sun
    // or glare sheet veils the entire frame. Forward only the light above the threshold instead
    // (soft knee), like an over-exposed highlight spilling inside the lens.
    this.bloom.materialHighPassFilter.uniforms.smoothWidth.value = 0.6;
    this.bloom.materialHighPassFilter.fragmentShader = BLOOM_HIGHPASS_FRAG;
    this.bloom.materialHighPassFilter.needsUpdate = true;
    this.optics = new ShaderPass(OpticsShader);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.dof);        // must directly follow the RenderPass (reads its depth)
    this.composer.addPass(this.precip);
    this.composer.addPass(this.lens);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.optics);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
  }

  setSize(cssW: number, cssH: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(cssW, cssH);
    this.lens.aspect = cssW / cssH;
    this.optics.uniforms.uAspect.value = cssW / cssH;
    (this.grade.uniforms.uRes.value as Vector2).set(cssW * pixelRatio, cssH * pixelRatio);
  }

  /** Distant precipitation needs the view rays of the main camera. */
  setPrecip(camera: PerspectiveCamera, rain: number, snow: number, wind: number, time: number, sky: Color) {
    const u = this.precip.uniforms;
    this.precip.enabled = rain > 0.01 || snow > 0.01;
    this.rot.extractRotation(camera.matrixWorldInverse);
    (u.uClipToDir.value as Matrix4).multiplyMatrices(camera.projectionMatrix, this.rot).invert();
    u.uRain.value = rain; u.uSnow.value = snow; u.uWind.value = wind; u.uTime.value = time;
    (u.uSkyCol.value as Color).copy(sky);
  }

  /** Focus on the subject; `aperture` is the blur radius (px) at infinity, 0 disables the pass. */
  setFocus(camera: PerspectiveCamera, distance: number, aperturePx: number) {
    this.dof.enabled = aperturePx > 0.05;
    this.dof.focus = distance;
    this.dof.aperture = aperturePx;
    this.dof.near = camera.near;
    this.dof.far = camera.far;
  }

  render(dt: number) { this.composer.render(dt); }
}
