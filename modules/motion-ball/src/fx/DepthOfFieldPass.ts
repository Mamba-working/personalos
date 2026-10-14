import {
  HalfFloatType, LinearFilter, RGBAFormat, ShaderMaterial, Vector2, WebGLRenderTarget, type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** Signed circle of confusion in drawing-buffer pixels: + behind the focus plane, - in front. */
const COC_GLSL = /* glsl */ `
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float cocOf(float depth) { return clamp(uAperture * (1.0 - uFocus / linZ(depth)), -uMaxCoc, uMaxCoc); }
`;

// 1 · half-resolution colour + signed CoC (the most-in-front depth of the 2×2 footprint, so thin
//     foreground edges survive the downsample)
const PREFILTER_FRAG = /* glsl */ `
${COC_GLSL}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  float d = min(min(texture2D(tDepth, vUv + vec2(-o.x, -o.y)).r, texture2D(tDepth, vUv + vec2(o.x, -o.y)).r),
                min(texture2D(tDepth, vUv + vec2(-o.x, o.y)).r, texture2D(tDepth, vUv + vec2(o.x, o.y)).r));
  gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, cocOf(d));
}`;

// 2 · bokeh gather at half resolution: scatter-as-gather on a golden-angle disc. A sample nearer
//     than this pixel spreads with its own disc (foreground blur may cover a sharp subject); a
//     farther one only onto pixels that are themselves blurred, so the background never smears
//     over the in-focus ball. Highlights weigh a little more, so they open into bokeh discs.
const BOKEH_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 uHalfTexel;
uniform float uMaxCoc;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tHalf, vUv);
  float cc = c.a * 0.5;
  float rmax = uMaxCoc * 0.5;
  vec3 sum = c.rgb;
  float wsum = 1.0;
  const int N = 40;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float d = sqrt(fi / float(N)) * rmax;
    float a = fi * 2.39996323;
    vec4 s = texture2D(tHalf, vUv + vec2(cos(a), sin(a)) * d * uHalfTexel);
    float cs = s.a * 0.5;
    float reach = cs <= cc ? abs(cs) : min(abs(cs), abs(cc));
    float w = clamp(reach - d + 1.0, 0.0, 1.0);
    w *= 1.0 + 0.6 * smoothstep(1.5, 6.0, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)));
    sum += s.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}`;

// 3 · full-resolution composite: in-focus pixels stay at full resolution, defocused ones take the
//     upsampled bokeh
const COMPOSITE_FRAG = /* glsl */ `
${COC_GLSL}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
varying vec2 vUv;
void main() {
  vec4 sharp = texture2D(tDiffuse, vUv);
  float coc = abs(cocOf(texture2D(tDepth, vUv).r));
  vec3 blur = texture2D(tBlur, vUv).rgb;
  gl_FragColor = vec4(mix(sharp.rgb, blur, smoothstep(0.45, 1.6, coc)), sharp.a);
}`;

function halfTarget() {
  return new WebGLRenderTarget(4, 4, {
    type: HalfFloatType, format: RGBAFormat, depthBuffer: false,
    minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
  });
}

/**
 * Cinematic depth of field focused on the ball (rack focus follows it): a half-resolution bokeh
 * gather composited over the full-resolution image. Must run directly after the RenderPass (it
 * reads that target's depth texture).
 */
export class DepthOfFieldPass extends Pass {
  focus = 10;
  /** Blur radius (px, drawing-buffer resolution) for objects at infinity. */
  aperture = 0;
  near = 0.1;
  far = 12000;
  private half = halfTarget();
  private blur = halfTarget();
  private prefilter: ShaderMaterial;
  private bokeh: ShaderMaterial;
  private composite: ShaderMaterial;
  private quad = new FullScreenQuad();
  private lens = {
    uNear: { value: 0.1 }, uFar: { value: 12000 }, uFocus: { value: 10 }, uAperture: { value: 0 }, uMaxCoc: { value: 1 },
  };

  constructor() {
    super();
    const base = { vertexShader: VERT, depthTest: false, depthWrite: false };
    this.prefilter = new ShaderMaterial({
      ...base, fragmentShader: PREFILTER_FRAG,
      uniforms: { ...this.lens, tDiffuse: { value: null }, tDepth: { value: null }, uTexel: { value: new Vector2() } },
    });
    this.bokeh = new ShaderMaterial({
      ...base, fragmentShader: BOKEH_FRAG,
      uniforms: { uMaxCoc: this.lens.uMaxCoc, tHalf: { value: this.half.texture }, uHalfTexel: { value: new Vector2() } },
    });
    this.composite = new ShaderMaterial({
      ...base, fragmentShader: COMPOSITE_FRAG,
      uniforms: { ...this.lens, tDiffuse: { value: null }, tDepth: { value: null }, tBlur: { value: this.blur.texture } },
    });
  }

  setSize(w: number, h: number) {
    const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2));
    this.half.setSize(hw, hh);
    this.blur.setSize(hw, hh);
    (this.prefilter.uniforms.uTexel.value as Vector2).set(1 / w, 1 / h);
    (this.bokeh.uniforms.uHalfTexel.value as Vector2).set(1 / hw, 1 / hh);
  }

  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const L = this.lens;
    L.uNear.value = this.near;
    L.uFar.value = this.far;
    L.uFocus.value = this.focus;
    L.uAperture.value = this.aperture;
    // the near ground can defocus more than infinity does; cap it so the foreground stays legible
    L.uMaxCoc.value = Math.max(1, this.aperture * 1.6);

    this.prefilter.uniforms.tDiffuse.value = read.texture;
    this.prefilter.uniforms.tDepth.value = read.depthTexture;
    this.quad.material = this.prefilter;
    renderer.setRenderTarget(this.half);
    this.quad.render(renderer);

    this.quad.material = this.bokeh;
    renderer.setRenderTarget(this.blur);
    this.quad.render(renderer);

    this.composite.uniforms.tDiffuse.value = read.texture;
    this.composite.uniforms.tDepth.value = read.depthTexture;
    this.quad.material = this.composite;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    this.quad.render(renderer);
  }

  dispose() {
    this.half.dispose(); this.blur.dispose();
    this.prefilter.dispose(); this.bokeh.dispose(); this.composite.dispose();
    this.quad.dispose();
  }
}
