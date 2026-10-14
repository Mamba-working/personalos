import { AdditiveBlending, HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/**
 * Lens response to the sun: occlusion-aware light shafts (only from very bright pixels, so
 * clouds or the ball cut visible beams) and a thin anamorphic streak through the sun whose
 * strength follows how much of the disc is actually visible.
 */
export class LensPass extends Pass {
  rays = 0;
  streak = 0;
  readonly sunUv = new Vector2(0.8, 0.8);
  aspect = 1.6;
  private rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false });
  private raysQuad: FullScreenQuad;
  private addQuad: FullScreenQuad;
  private raysMat: ShaderMaterial;

  constructor() {
    super();
    this.raysMat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uSunUv;
        uniform float uAspect;
        uniform float uRays;
        uniform float uStreak;
        varying vec2 vUv;
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        vec3 bright(vec2 uv, float thr) { return min(max(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb - thr, 0.0), vec3(12.0)); }
        void main() {
          vec3 col = vec3(0.0);
          vec2 dv = uSunUv - vUv;
          vec2 dd = dv * vec2(uAspect, 1.0);
          if (uRays > 0.001) {
            const int N = 40;
            vec2 st = dv / float(N) * 0.94;
            vec2 uv = vUv + st * hash12(gl_FragCoord.xy);
            float decay = 1.0;
            vec3 acc = vec3(0.0);
            for (int i = 0; i < N; i++) { acc += bright(uv, 2.4) * decay; decay *= 0.955; uv += st; }
            col += acc / float(N) * uRays * exp(-dot(dd, dd) * 1.6);
          }
          if (uStreak > 0.001) {
            // visibility of the disc itself (clouds / the ball / the umbrella can hide it)
            vec3 v = vec3(0.0);
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) v += bright(uSunUv + vec2(float(i), float(j)) * 0.0025, 6.0);
            float vis = clamp(dot(v, vec3(0.2126, 0.7152, 0.0722)) / 9.0 / 12.0, 0.0, 1.0);
            float sx = abs(dd.x), sy = abs(dd.y);
            float line = exp(-sy * sy * 9000.0) * (exp(-sx * 2.2) * 0.8 + exp(-sx * 9.0) * 0.6);
            float glow = exp(-sy * sy * 900.0) * exp(-sx * 4.0) * 0.18;
            col += vec3(0.62, 0.76, 1.0) * (line + glow) * vis * uStreak * 3.0;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: { tDiffuse: { value: null }, uSunUv: { value: this.sunUv }, uAspect: { value: 1.6 }, uRays: { value: 0 }, uStreak: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    const addMat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: 'uniform sampler2D tLens; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tLens, vUv); }',
      uniforms: { tLens: { value: this.rt.texture } },
      blending: AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
    });
    this.raysQuad = new FullScreenQuad(this.raysMat);
    this.addQuad = new FullScreenQuad(addMat);
    this.needsSwap = false;
  }

  setSize(w: number, h: number) { this.rt.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); }

  render(renderer: WebGLRenderer, _write: WebGLRenderTarget, read: WebGLRenderTarget) {
    if (this.rays <= 0.001 && this.streak <= 0.001) return;
    const u = this.raysMat.uniforms;
    u.tDiffuse.value = read.texture;
    u.uAspect.value = this.aspect;
    u.uRays.value = this.rays;
    u.uStreak.value = this.streak;
    renderer.setRenderTarget(this.rt);
    this.raysQuad.render(renderer);
    // add in place (no swap) — autoClear would wipe the frame we are adding onto
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(read);
    this.addQuad.render(renderer);
    renderer.autoClear = autoClear;
  }

  dispose() { this.rt.dispose(); this.raysQuad.dispose(); this.addQuad.dispose(); }
}
