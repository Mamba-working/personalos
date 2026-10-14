import {
  GLSL3, HalfFloatType, LinearFilter, RGBAFormat, ShaderMaterial, Vector2, Vector4,
  WebGLRenderTarget, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { atmos } from './atmosphere';

/**
 * World-space interaction map around the ball's playground (ping-pong, half floats):
 *   r/g = water ripple height (now / previous) — a damped 2D wave equation
 *   b   = snow compression left by the ball (tracks)
 *   a   = mist cleared by the cursor and the ball
 */
const SIM_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uCenter;
uniform float uSize;
uniform vec4 uImpulses[32];
uniform int uImpulseCount;
uniform vec4 uBallContact;
uniform vec4 uFogBrush;
uniform vec4 uFogBrush2;
uniform float uDt;
uniform float uSnowing;
uniform float uSnowCover;
uniform float uDamping;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 c = texture(uPrev, uv);
  float s = texture(uPrev, uv + vec2(uTexel.x, 0.0)).r + texture(uPrev, uv - vec2(uTexel.x, 0.0)).r
          + texture(uPrev, uv + vec2(0.0, uTexel.y)).r + texture(uPrev, uv - vec2(0.0, uTexel.y)).r;
  float hn = (s * 0.5 - c.g) * uDamping;
  vec2 wp = uCenter + (uv - 0.5) * uSize;
  for (int i = 0; i < 32; i++) {
    if (i >= uImpulseCount) break;
    vec4 im = uImpulses[i];
    vec2 dd = wp - im.xy;
    hn += im.w * exp(-dot(dd, dd) / (im.z * im.z));
  }
  vec2 ed = min(uv, 1.0 - uv);
  hn *= smoothstep(0.0, 0.06, min(ed.x, ed.y));

  float dent = c.b * (1.0 - uDt * (0.012 + 0.05 * uSnowing));
  dent *= mix(1.0 - uDt * 0.8, 1.0, uSnowCover);
  float dc = length(wp - uBallContact.xy);
  dent = max(dent, uBallContact.w * smoothstep(uBallContact.z, uBallContact.z * 0.35, dc));

  float fc = c.a * (1.0 - uDt * 0.22);
  fc = max(fc, uFogBrush.w * smoothstep(uFogBrush.z, uFogBrush.z * 0.2, length(wp - uFogBrush.xy)));
  fc = max(fc, uFogBrush2.w * smoothstep(uFogBrush2.z, uFogBrush2.z * 0.2, length(wp - uFogBrush2.xy)));
  outColor = vec4(hn, c.r, dent, fc);
}
`;

export interface InteractionInputs {
  impulses: number[][];          // [x, z, radius, strength]
  ballContact: [number, number, number, number];
  fogBrush: [number, number, number, number];
  fogBrush2: [number, number, number, number];
  dt: number;
  snowing: number;
  snowCover: number;
}

export class InteractionMap {
  readonly size: number;
  readonly worldSize = 18;
  readonly center = new Vector2();
  private rts: WebGLRenderTarget[];
  private idx = 0;
  private mat: ShaderMaterial;
  private quad: FullScreenQuad;
  private impulseData = Array.from({ length: 32 }, () => new Vector4());

  constructor(size = 512) {
    this.size = size;
    const make = () => new WebGLRenderTarget(size, size, {
      type: HalfFloatType, format: RGBAFormat, depthBuffer: false,
      minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
    });
    this.rts = [make(), make()];
    this.mat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: SIM_FRAG,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new Vector2(1 / size, 1 / size) },
        uCenter: { value: this.center },
        uSize: { value: this.worldSize },
        uImpulses: { value: this.impulseData },
        uImpulseCount: { value: 0 },
        uBallContact: { value: new Vector4() },
        uFogBrush: { value: new Vector4() },
        uFogBrush2: { value: new Vector4() },
        uDt: { value: 0 },
        uSnowing: { value: 0 },
        uSnowCover: { value: 0 },
        uDamping: { value: 0.984 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
    atmos.uMapSize.value = this.worldSize;
  }

  get texture() { return this.rts[this.idx].texture; }

  clear(renderer: WebGLRenderer) {
    const prev = renderer.getRenderTarget();
    for (const rt of this.rts) { renderer.setRenderTarget(rt); renderer.clear(true, false, false); }
    renderer.setRenderTarget(prev);
  }

  setCenter(x: number, z: number) {
    this.center.set(x, z);
    atmos.uMapCenter.value.set(x, z);
  }

  /** Two half steps per frame so ripples travel faster than one texel per frame. */
  step(renderer: WebGLRenderer, inp: InteractionInputs) {
    const u = this.mat.uniforms;
    const n = Math.min(32, inp.impulses.length);
    for (let i = 0; i < n; i++) this.impulseData[i].fromArray(inp.impulses[i]);
    (u.uBallContact.value as Vector4).fromArray(inp.ballContact);
    (u.uFogBrush.value as Vector4).fromArray(inp.fogBrush);
    (u.uFogBrush2.value as Vector4).fromArray(inp.fogBrush2);
    u.uDt.value = inp.dt * 0.5;
    u.uSnowing.value = inp.snowing;
    u.uSnowCover.value = inp.snowCover;
    const prev = renderer.getRenderTarget();
    for (let s = 0; s < 2; s++) {
      u.uPrev.value = this.rts[this.idx].texture;
      u.uImpulseCount.value = s === 0 ? n : 0;
      renderer.setRenderTarget(this.rts[1 - this.idx]);
      this.quad.render(renderer);
      this.idx = 1 - this.idx;
    }
    renderer.setRenderTarget(prev);
    atmos.uInteract.value = this.texture;
  }

  /** Debug readback of one texel at a world position: [ripple, prev, snowDent, mistCleared]. */
  read(renderer: WebGLRenderer, x: number, z: number): number[] {
    const u = (x - this.center.x) / this.worldSize + 0.5;
    const v = (z - this.center.y) / this.worldSize + 0.5;
    const out = new Uint16Array(4);
    renderer.readRenderTargetPixels(this.rts[this.idx], Math.floor(u * this.size), Math.floor(v * this.size), 1, 1, out);
    return Array.from(out, (h) => +halfToFloat(h).toFixed(3));
  }
}

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : (s ? -1 : 1) * Infinity;
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
