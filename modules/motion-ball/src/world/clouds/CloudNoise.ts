import {
  GLSL3, LinearFilter, RepeatWrapping, RGBAFormat, ShaderMaterial, UnsignedByteType,
  WebGL3DRenderTarget, type Data3DTexture, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Tileable 3D noise volumes for the volumetric clouds, generated once on the GPU:
 *  - shape  (128³): R = Perlin-Worley, G/B/A = Worley fBm at increasing frequencies
 *  - detail (32³):  R/G/B = Worley fBm used to erode cloud edges
 */
const GEN_FRAG = /* glsl */ `
precision highp float;
uniform float uZ;
uniform float uSize;
uniform int uMode;   // 0 = shape, 1 = detail
out vec4 outColor;

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
vec3 grad3(vec3 c) { return normalize(hash33(c) * 2.0 - 1.0); }

float perlinTile(vec3 p, float rep) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n[8];
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    n[k] = dot(grad3(mod(i + o, rep)), f - o);
  }
  float x00 = mix(n[0], n[1], u.x), x10 = mix(n[2], n[3], u.x);
  float x01 = mix(n[4], n[5], u.x), x11 = mix(n[6], n[7], u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

float worleyTile(vec3 p, float rep) {
  vec3 i = floor(p), f = fract(p);
  float d = 1e9;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + hash33(mod(i + o, rep)) - f;
    d = min(d, dot(r, r));
  }
  return 1.0 - sqrt(d);
}

float worleyFbm(vec3 p, float freq) {
  return worleyTile(p * freq, freq) * 0.625
       + worleyTile(p * freq * 2.0, freq * 2.0) * 0.25
       + worleyTile(p * freq * 4.0, freq * 4.0) * 0.125;
}

float remap(float v, float lo, float hi, float nlo, float nhi) {
  return nlo + (v - lo) * (nhi - nlo) / (hi - lo);
}

void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  if (uMode == 0) {
    float pf = 0.0, amp = 1.0, fr = 4.0, nrm = 0.0;
    for (int o = 0; o < 4; o++) { pf += perlinTile(p * fr, fr) * amp; nrm += amp; amp *= 0.5; fr *= 2.0; }
    pf = clamp(pf / nrm * 0.9 + 0.5, 0.0, 1.0);
    float w = worleyFbm(p, 4.0);
    float pw = clamp(remap(pf, 0.0, 1.0, w, 1.0), 0.0, 1.0);
    outColor = vec4(pw, worleyFbm(p, 8.0), worleyFbm(p, 16.0), worleyFbm(p, 32.0));
  } else {
    outColor = vec4(worleyFbm(p, 2.0), worleyFbm(p, 4.0), worleyFbm(p, 8.0), 1.0);
  }
}
`;

function makeTarget(size: number) {
  const rt = new WebGL3DRenderTarget(size, size, size, { format: RGBAFormat, type: UnsignedByteType, depthBuffer: false });
  const t = rt.texture as Data3DTexture;
  t.wrapS = t.wrapT = t.wrapR = RepeatWrapping;
  t.minFilter = t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  return rt;
}

export class CloudNoise {
  readonly shape = makeTarget(128);
  readonly detail = makeTarget(32);

  constructor(renderer: WebGLRenderer) {
    const mat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: GEN_FRAG,
      uniforms: { uZ: { value: 0 }, uSize: { value: 128 }, uMode: { value: 0 } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new FullScreenQuad(mat);
    const prev = renderer.getRenderTarget();
    for (const [rt, mode] of [[this.shape, 0], [this.detail, 1]] as const) {
      const n = rt.width;
      mat.uniforms.uSize.value = n;
      mat.uniforms.uMode.value = mode;
      for (let z = 0; z < n; z++) {
        mat.uniforms.uZ.value = (z + 0.5) / n;
        renderer.setRenderTarget(rt, z);
        quad.render(renderer);
      }
    }
    renderer.setRenderTarget(prev);
    quad.dispose();
    mat.dispose();
  }

  dispose() { this.shape.dispose(); this.detail.dispose(); }
}
