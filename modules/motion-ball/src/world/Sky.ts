import {
  BackSide, Color, GLSL3, HalfFloatType, LinearFilter, Matrix4, Mesh, RGBAFormat, ShaderMaterial,
  SphereGeometry, Vector2, Vector3, Vector4, WebGLRenderTarget, type IUniform, type PerspectiveCamera,
  type Texture, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CloudNoise } from './clouds/CloudNoise';
import { CLOUDS_GLSL } from './clouds/cloudsGlsl';
import { atmos, ATMOS_PRELUDE } from './atmosphere';

/** Cloud parameters driven by the weather system. */
export const cloudUniforms = {
  uShapeTex: { value: null as unknown },
  uDetailTex: { value: null as unknown },
  uCloudBase: { value: 1400 },
  uCloudTop: { value: 4200 },
  uCloudCover: { value: 0.3 },
  uCloudDensity: { value: 0.8 },
  uCloudType: { value: 1 },
  uCloudStretch: { value: 0 },
  uCloudWindDir: { value: new Vector2(-0.94, 0.33) },
  uCloudOffset: { value: new Vector2() },
  uTowers: { value: 1 },
  uSunAz: { value: 0.3 },
  uCloudAmbTop: { value: new Color(0.7, 0.76, 0.86) },
  uCloudAmbBottom: { value: new Color(0.55, 0.52, 0.5) },
  uCloudTint: { value: new Color(1, 1, 1) },
  uCloudSun: { value: new Color(3.2, 2.9, 2.6) },
  uCloudAmbScale: { value: 1 },
  uCloudHaze: { value: 1 / 26000 },
  uBolt: { value: new Vector4() },
} satisfies Record<string, IUniform>;

/** The moon's near-side maps (set by EnvAssets; see moonDisc). uMoonRelief exaggerates LOLA heights ×4. */
export const moonUniforms = {
  uMoonTex: { value: null as Texture | null },
  uMoonHeight: { value: null as Texture | null },
  uMoonTexOn: { value: 0 },
  uMoonRelief: { value: 0.02 },
} satisfies Record<string, IUniform>;

/**
 * Photographed sky structure for the environment probe (set by EnvAssets): two equirect HDRs
 * being cross-faded (A → B by uHdrMix), each with a blurred copy (to extract structure) and a yaw
 * that keeps its sun on ours. uHdrOn fades the modulation in once a sky has loaded.
 */
export const envSkyUniforms = {
  uHdrOn: { value: 0 },
  uHdrMix: { value: 0 },
  uHdrA: { value: null as Texture | null },
  uHdrSmoothA: { value: null as Texture | null },
  uHdrRotA: { value: 0 },
  uHdrB: { value: null as Texture | null },
  uHdrSmoothB: { value: null as Texture | null },
  uHdrRotB: { value: 0 },
} satisfies Record<string, IUniform>;

const SKY_LAYER_SUN = /* glsl */ `
vec3 sunDisc(vec3 d) {
  float mu = dot(d, uSunDir);
  float disc = smoothstep(0.99972, 0.99987, mu);
  return uSunCol * disc * 26.0;
}

// The moon (at night uSunDir points at it), about twice its real apparent size. With the NASA
// near-side maps (moonUniforms) it is a real globe: albedo from LROC, relief from LOLA lighting
// the craters along the terminator, Lommel–Seeliger shading (bright right to the limb, as the
// moon is) and today's phase with the lit limb tipped toward the set sun. Without the maps it
// falls back to a soft procedural disc. cover = disc coverage (it hides the stars behind it).
uniform sampler2D uMoonTex;
uniform sampler2D uMoonHeight;
uniform float uMoonTexOn;
uniform float uMoonRelief;
vec3 moonDisc(vec3 d, float fw, out float cover) {
  cover = 0.0;
  vec3 m = uSunDir;
  const float r = 0.02;
  if (dot(d, m) < 0.99) return vec3(0.0);
  vec3 rt = normalize(cross(m, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, m);
  vec2 p = vec2(dot(d, rt), dot(d, up)) / r;
  float rr = length(p);
  float aa = max(fw / r, 0.02);
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);
  if (disc <= 0.0) return vec3(0.0);
  cover = disc;
  vec2 pc = p * min(1.0, 0.999 / max(rr, 1e-4));
  float z = sqrt(max(1.0 - dot(pc, pc), 0.0));
  vec3 n0 = vec3(pc, z);
  float sp = sin(uMoonPhase);
  vec3 l = normalize(vec3(sp * 0.906, -abs(sp) * 0.423, -cos(uMoonPhase)));
  vec3 n = n0;
  vec3 alb;
  if (uMoonTexOn > 0.5) {
    float lat = asin(clamp(pc.y, -1.0, 1.0));
    float lon = atan(pc.x, max(z, 1e-4));
    vec2 uv = vec2(lon, lat) * 0.31830989 + 0.5;
    // explicit mip level: the 512-texel near side over the disc, stretched toward the limb
    float lod = log2(max(1.0, (fw / r) * 162.97 / max(z, 0.08)));
    alb = textureLod(uMoonTex, uv, lod).rgb;
    float st = exp2(lod) / 512.0;
    float h0 = textureLod(uMoonHeight, uv, lod).r;
    float he = textureLod(uMoonHeight, uv + vec2(st, 0.0), lod).r;
    float hn = textureLod(uMoonHeight, uv + vec2(0.0, st), lod).r;
    float dl = st * 3.14159265;
    vec3 east = vec3(cos(lon), 0.0, -sin(lon));
    vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
    n = normalize(n0 - ((he - h0) / (dl * max(cos(lat), 0.15)) * east + (hn - h0) / dl * north) * uMoonRelief);
  } else {
    alb = vec3(0.42) * (0.8 + 0.2 * (noise2(p * 1.7 + 4.0) * 0.6 + noise2(p * 4.3 + 1.0) * 0.4));
  }
  float mu0 = max(dot(n, l), 0.0), mu = max(z, 0.05);
  float shade = 2.0 * mu0 / (mu0 + mu);
  // a crescent reads brighter against the dark sky than the photometry says: lift thin phases a little
  float thin = 1.0 + 0.5 * (1.0 + cos(uMoonPhase)) * 0.5;
  return alb * (shade * thin + 0.015) * disc;   // + a faint earthshine on the dark side
}

// Stars: a sparse field (mostly faint, a few bright, slightly warm or cool) with a slow, faint
// twinkle; each star is a pixel-sized gaussian whose energy is kept as it is antialiased.
vec3 starField(vec3 d, float fw) {
  vec3 q = d * 260.0;
  vec3 id = floor(q);
  float h = hash13(id);
  if (h < 0.989) return vec3(0.0);
  vec3 c = id + 0.5 + (hash33(id + 3.1) - 0.5) * 0.7;
  float rr = length(q - c);
  float s = max(0.09, fw * 260.0 * 0.8);
  float g = exp(-rr * rr / (s * s)) * (0.0081 / (s * s));
  float mag = pow((h - 0.989) / 0.011, 3.0) * 2.4 + 0.25;
  float tw = 0.85 + 0.15 * sin(uTime * (0.8 + 2.0 * fract(h * 37.0)) + h * 91.0);
  vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), fract(h * 113.0));
  return tint * g * mag * tw;
}`;

const CLOUD_PASS_FRAG = /* glsl */ `
precision highp float;
${ATMOS_PRELUDE}
${CLOUDS_GLSL}
uniform mat4 uClipToDir;
uniform mat4 uPrevDirToClip;
uniform sampler2D uHistory;
uniform float uHistoryValid;
uniform float uBlend;
uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform float uFrame;
uniform int uSteps;
out vec4 outColor;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec4 c = uClipToDir * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize(c.xyz / c.w);
  float jitter = fract(ign(gl_FragCoord.xy) + uFrame * 0.6180339);
  vec4 cur = marchClouds(uCamPos, rd, jitter, uSteps, 6, true);
  vec4 pc = uPrevDirToClip * vec4(rd, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  float inside = step(0.0, pc.w) * step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  vec4 hist = texture(uHistory, puv);
  outColor = mix(cur, hist, uHistoryValid * inside * uBlend);
}
`;

const DOME_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DOME_FRAG = /* glsl */ `
${ATMOS_PRELUDE}
#ifdef ENV_MODE
${CLOUDS_GLSL}
uniform float uHdrOn;
uniform float uHdrMix;
uniform sampler2D uHdrA;
uniform sampler2D uHdrSmoothA;
uniform float uHdrRotA;
uniform sampler2D uHdrB;
uniform sampler2D uHdrSmoothB;
uniform float uHdrRotB;
// A photographed sky relative to a heavily blurred copy of itself: above 1 on lit cloud, below 1
// in blue gaps and cloud bases, ~1 on average everywhere. Our gradient keeps hue, level and the
// sun-side glow; the sun itself is clipped (the directional light already carries it).
vec3 hdrDetail(sampler2D t, sampler2D blurred, float rot, vec3 rd) {
  float c = cos(rot), s = sin(rot);
  vec3 d = vec3(c * rd.x - s * rd.z, rd.y, s * rd.x + c * rd.z);
  vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  vec3 h = min(textureLod(t, uv, 0.0).rgb, vec3(8.0));
  vec3 m = textureLod(blurred, uv, 0.0).rgb;
  return min(h / max(m, vec3(1e-3)), vec3(2.5));
}
#else
uniform sampler2D uCloudTex;
uniform vec2 uCloudSize;
uniform mat4 uDirToClip;
// Catmull-Rom upsampling (5 bilinear taps): the cloud layer is rendered below screen
// resolution; a cubic reconstruction keeps cloud edges crisp instead of bilinear-soft
vec4 cloudSample(vec2 uv) {
  vec2 p = uv * uCloudSize - 0.5;
  vec2 tc = floor(p) + 0.5;
  vec2 f = p - floor(p);
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (tc - 1.0) / uCloudSize, t3 = (tc + 2.0) / uCloudSize, t12 = (tc + w2 / w12) / uCloudSize;
  vec4 c = texture2D(uCloudTex, vec2(t12.x, t0.y)) * w12.x * w0.y
         + texture2D(uCloudTex, vec2(t0.x, t12.y)) * w0.x * w12.y
         + texture2D(uCloudTex, t12) * w12.x * w12.y
         + texture2D(uCloudTex, vec2(t3.x, t12.y)) * w3.x * w12.y
         + texture2D(uCloudTex, vec2(t12.x, t3.y)) * w12.x * w3.y;
  float wsum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return clamp(c / wsum, 0.0, 64.0);
}
uniform float uSunDiscScale;
#endif
${SKY_LAYER_SUN}
varying vec3 vWorld;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 col = skyColor(rd);
#ifdef ENV_MODE
  // the probe's own coarse clouds keep the overall level (they match the visible sky); the
  // photographed sky only modulates them with real cloud structure, ~1 on average
  vec4 cl = marchClouds(cameraPosition, rd, 0.5, 20, 3, false);
  col = col * cl.a + cl.rgb;
  if (uHdrOn > 0.001) {
    vec3 r = hdrDetail(uHdrA, uHdrSmoothA, uHdrRotA, rd);
    if (uHdrMix > 0.001) r = mix(r, hdrDetail(uHdrB, uHdrSmoothB, uHdrRotB, rd), uHdrMix);
    col *= mix(vec3(1.0), r, uHdrOn);
  }
#else
  vec4 pc = uDirToClip * vec4(rd, 1.0);
  vec2 uv = clamp(pc.xy / pc.w * 0.5 + 0.5, 0.001, 0.999);
  vec4 cl = pc.w > 0.0 ? cloudSample(uv) : vec4(0.0, 0.0, 0.0, 1.0);
  cl.a = clamp(cl.a, 0.0, 1.0);
  col = col * cl.a + cl.rgb;
  col += sunDisc(rd) * cl.a * uSunDiscScale * (1.0 - uMoonDisc);
  // night sky: stars and the moon, only where the clouds let them through (the moon hides the
  // stars behind it; the airglow in front of it stays)
  float fwd = length(fwidth(rd));
  float mcov = 0.0;
  vec3 moon = uMoonDisc > 0.001 ? moonDisc(rd, fwd, mcov) : vec3(0.0);
  if (uStars > 0.001) col += starField(rd, fwd) * cl.a * uStars * smoothstep(0.02, 0.3, rd.y) * (1.0 - mcov * uMoonDisc);
  col += moon * cl.a * uMoonDisc * 2.6;
#endif
  col = mix(col, fogColorDir(rd), exp(-max(rd.y, 0.0) * 22.0) * 0.55);
  if (rd.y < 0.0) col = fogColorDir(rd);
  if (uMist > 0.01) col = applyMist(col, cameraPosition, rd, 1e4);
  gl_FragColor = vec4(col, 1.0);
}
`;

function makeCloudRT(w: number, h: number) {
  return new WebGLRenderTarget(w, h, {
    type: HalfFloatType, format: RGBAFormat, depthBuffer: false,
    minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
  });
}

export class Sky {
  readonly noise: CloudNoise;
  readonly dome: Mesh;
  readonly envDome: Mesh;
  /** Fraction of the drawing-buffer resolution used for the cloud pass. */
  cloudScale = 0.5;
  steps = 64;

  private rts: WebGLRenderTarget[] = [makeCloudRT(4, 4), makeCloudRT(4, 4)];
  private cur = 0;
  private frame = 0;
  private historyValid = 0;
  private quad: FullScreenQuad;
  private passMat: ShaderMaterial;
  private domeMat: ShaderMaterial;
  private dirToClip = new Matrix4();
  private prevDirToClip = new Matrix4();
  private clipToDir = new Matrix4();
  private rot = new Matrix4();

  constructor(renderer: WebGLRenderer) {
    this.noise = new CloudNoise(renderer);
    cloudUniforms.uShapeTex.value = this.noise.shape.texture;
    cloudUniforms.uDetailTex.value = this.noise.detail.texture;

    this.passMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: CLOUD_PASS_FRAG,
      uniforms: {
        ...atmos, ...cloudUniforms,
        uClipToDir: { value: this.clipToDir },
        uPrevDirToClip: { value: this.prevDirToClip },
        uHistory: { value: null },
        uHistoryValid: { value: 0 },
        uBlend: { value: 0.88 },
        uResolution: { value: new Vector2(4, 4) },
        uCamPos: { value: new Vector3() },
        uFrame: { value: 0 },
        uSteps: { value: this.steps },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.passMat);

    const geo = new SphereGeometry(9000, 48, 24);
    this.domeMat = new ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: { ...atmos, ...moonUniforms, uCloudTex: { value: null }, uCloudSize: { value: new Vector2(4, 4) }, uDirToClip: { value: this.dirToClip }, uSunDiscScale: { value: 1 } },
      side: BackSide, depthWrite: false, depthTest: false,
    });
    this.dome = new Mesh(geo, this.domeMat);
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.dome.onBeforeRender = (_r, _s, cam) => { this.dome.position.copy(cam.position); this.dome.updateMatrixWorld(); };

    const envMat = new ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      defines: { ENV_MODE: 1 },
      uniforms: { ...atmos, ...cloudUniforms, ...envSkyUniforms, ...moonUniforms },
      side: BackSide, depthWrite: false, depthTest: false,
    });
    this.envDome = new Mesh(geo, envMat);
    this.envDome.renderOrder = -1000;
    this.envDome.frustumCulled = false;
    this.envDome.onBeforeRender = (_r, _s, cam) => { this.envDome.position.copy(cam.position); this.envDome.updateMatrixWorld(); };
  }

  setSize(drawW: number, drawH: number) {
    const w = Math.max(16, Math.round(drawW * this.cloudScale));
    const h = Math.max(16, Math.round(drawH * this.cloudScale));
    (this.domeMat.uniforms.uCloudSize.value as Vector2).set(w, h);
    for (const rt of this.rts) rt.setSize(w, h);
    (this.passMat.uniforms.uResolution.value as Vector2).set(w, h);
    this.historyValid = 0;
  }

  /** Render the half-res cloud layer for this frame (temporal accumulation + reprojection). */
  update(renderer: WebGLRenderer, camera: PerspectiveCamera) {
    this.rot.extractRotation(camera.matrixWorldInverse);
    this.dirToClip.multiplyMatrices(camera.projectionMatrix, this.rot);
    this.clipToDir.copy(this.dirToClip).invert();

    const src = this.rts[this.cur];
    const dst = this.rts[1 - this.cur];
    const u = this.passMat.uniforms;
    u.uHistory.value = src.texture;
    u.uHistoryValid.value = this.historyValid;
    u.uFrame.value = this.frame++ % 1024;
    u.uSteps.value = this.steps;
    (u.uCamPos.value as Vector3).copy(camera.position);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(dst);
    this.quad.render(renderer);
    renderer.setRenderTarget(prev);
    this.cur = 1 - this.cur;
    this.historyValid = 1;
    this.prevDirToClip.copy(this.dirToClip);
    this.domeMat.uniforms.uCloudTex.value = dst.texture;
  }

  /** The mirror skips the disc: the ground's own sun specular already draws the glint. */
  setSunDisc(scale: number) { this.domeMat.uniforms.uSunDiscScale.value = scale; }

  /** Cameras other than the main one (mirror) sample the same cloud layer through `uDirToClip`. */
  resetHistory() { this.historyValid = 0; }

  get cloudTexture() { return this.rts[this.cur].texture; }

  dispose() {
    this.rts.forEach((r) => r.dispose());
    this.noise.dispose();
    this.quad.dispose();
  }
}
