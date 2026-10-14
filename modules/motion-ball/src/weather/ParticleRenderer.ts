import {
  BufferAttribute, CustomBlending, DoubleSide, DynamicDrawUsage, InstancedBufferGeometry, InstancedInterleavedBuffer,
  InterleavedBufferAttribute, Mesh, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector2,
} from 'three';
import { NOISE_GLSL } from '../core/noise';
import { atmos, ATMOS_CORE_GLSL } from '../world/atmosphere';
import { PARTICLE_STRIDE, type ParticleSystem } from './ParticleSystem';

const VERT = /* glsl */ `
${NOISE_GLSL}
${ATMOS_CORE_GLSL}
attribute vec2 aCorner;
attribute vec4 aPosSize;
attribute vec4 aVelAlpha;
attribute vec2 aTypeSeed;
uniform vec2 uRes;
uniform float uStreak;
uniform float uFocus;
varying vec2 vUv;
varying float vAlpha;
varying float vType;
varying float vSeed;
varying float vBlur;
varying vec3 vFogCol;
varying float vFogT;
varying vec3 vRd;
void main() {
  vec3 p = aPosSize.xyz;
  float size = aPosSize.w;
  vec3 v = aVelAlpha.xyz;
  float a = aVelAlpha.w;
  float type = aTypeSeed.x;
  vSeed = aTypeSeed.y;
  vType = type;
  vec3 toP = p - cameraPosition;
  float dist = length(toP);
  vec3 rd = toP / max(dist, 1e-4);
  vFogT = exp(-fogDepth(cameraPosition, rd, dist));
  vFogCol = fogColorDir(rd);
  vRd = rd;
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c0 = vp * vec4(p, 1.0);
  if (a <= 0.002 || c0.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; return; }
  vUv = aCorner;
  bool streak = type < 0.5 || (type > 2.5 && type < 4.5) || type > 5.5;
  if (streak) {
    // rain (0), splash (3), sand (4) and umbrella drips (6): stretched along screen-space velocity
    vec4 c1 = vp * vec4(p - v * uStreak, 1.0);
    if (c1.w < 0.05) c1 = c0;
    vec2 s0 = c0.xy / c0.w * uRes * 0.5;
    vec2 s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 dir = s0 - s1;
    float len = length(dir);
    vec2 nd = len > 1e-3 ? dir / len : vec2(0.0, 1.0);
    // (pn, nd) must stay counter-clockwise, or every streak is back-face culled
    vec2 pn = vec2(nd.y, -nd.x);
    float wpx = max(size * uRes.y * 0.9 / c0.w, type > 5.5 ? 1.5 : 0.9);
    float along = aCorner.y * 0.5 + 0.5;
    vec2 sp = mix(s1, s0, along) + nd * aCorner.y * wpx * 0.5 + pn * aCorner.x * wpx;
    float w = mix(c1.w, c0.w, along);
    gl_Position = vec4(sp / (uRes * 0.5) * w, mix(c1.z, c0.z, along), w);
    a *= min(1.0, 1.4 / wpx) * clamp(wpx, 0.5, 1.0);
    vBlur = 0.0;
  } else {
    // flakes / motes / chunks: round sprites. Ones nearer than the focus open into soft bokeh
    // discs (the post depth of field stays subtle for sharpness, so near flakes carry their own)
    float px = size * uRes.y * 0.9 / c0.w;
    float blur = clamp(max(1.0 / max(dist, 0.3) - 1.0 / uFocus, 0.0) * uRes.y * 0.048, 0.0, uRes.y * 0.024);
    float r = max(px + blur, 1.0);
    a *= clamp((px * px + 0.5) / (r * r), 0.14, 1.0);
    vBlur = clamp(blur / r, 0.0, 1.0);
    gl_Position = c0 + vec4(aCorner * r / (uRes * 0.5) * c0.w, 0.0, 0.0);
  }
  // sharp particles write depth (main pass); wide bokeh discs are a second, depth-less pass so they
  // never punch holes into the flakes behind them
  bool bokeh = !streak && vBlur > 0.35;
#ifdef BOKEH
  if (!bokeh) a = 0.0;
#else
  if (bokeh) a = 0.0;
#endif
  if (a <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vAlpha = a;
}`;

const FRAG = /* glsl */ `
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform vec3 uAmbCol;
varying vec2 vUv;
varying float vAlpha;
varying float vType;
varying float vSeed;
varying float vBlur;
varying vec3 vFogCol;
varying float vFogT;
varying vec3 vRd;
void main() {
  float a = vAlpha;
  vec3 col;
  float r = length(vUv);
  float t = vType;
  if (t < 0.5) {                        // rain streak
    float across = exp(-vUv.x * vUv.x * 3.0);
    float along = smoothstep(-1.0, -0.3, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    a *= across * along * 0.65;
    col = uAmbCol * 1.4 + uSunCol * 0.14;
  } else if (t < 1.5) {                 // snowflake (a soft disc with a faint rim when out of focus)
    float soft = mix(0.35, 0.6, vBlur);
    a *= smoothstep(1.0, 1.0 - soft, r) * mix(1.0, 0.8 + 0.25 * smoothstep(0.3, 0.85, r), vBlur);
    col = uAmbCol * 1.12 + uSunCol * 0.32;
  } else if (t < 2.5) {                 // sun mote (additive)
    float g = exp(-r * r * 5.0);
    float fwd = 0.25 + 0.8 * pow(max(dot(vRd, uSunDir), 0.0), 2.0);
    if (g < 0.35) discard;
    col = uSunCol * g * fwd * 0.22 * a * (0.6 + 0.4 * sin(vSeed * 40.0));
    gl_FragColor = vec4(col * vFogT, 0.0);
    return;
  } else if (t < 3.5) {                 // splash droplet
    float across = exp(-vUv.x * vUv.x * 2.5);
    a *= across * smoothstep(1.0, 0.4, abs(vUv.y)) * 0.8;
    col = uAmbCol * 1.45 + uSunCol * 0.2;
  } else if (t < 4.5) {                 // sand grain
    float across = exp(-vUv.x * vUv.x * 2.0);
    a *= across * smoothstep(1.0, 0.3, abs(vUv.y)) * 0.75;
    col = vec3(0.78, 0.71, 0.61) * (uAmbCol * 0.95 + uSunCol * 0.35);
  } else if (t > 5.5) {                 // drip off the umbrella: a bright refracting bead, short tail
    float across = exp(-vUv.x * vUv.x * 2.2);
    float along = smoothstep(-1.0, 0.2, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    a *= across * along * 0.8;
    col = uAmbCol * 1.35 + uSunCol * 0.12;
  } else {                              // snow chunk / puff
    a *= smoothstep(1.0, 0.55, r);
    col = uAmbCol * 1.15 + uSunCol * 0.35;
  }
  // only the solid core writes depth (see depthWrite below)
#ifdef BOKEH
  if (a < 0.004) discard;
#else
  if (a < 0.16) discard;
#endif
  col = mix(vFogCol, col, vFogT);
  gl_FragColor = vec4(col * a, a);
}`;

export class ParticleRenderer {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private buffer: InstancedInterleavedBuffer;
  private geo: InstancedBufferGeometry;

  constructor(private system: ParticleSystem) {
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
    geo.setAttribute('aCorner', new BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    this.buffer = new InstancedInterleavedBuffer(system.inst, PARTICLE_STRIDE, 1);
    this.buffer.setUsage(DynamicDrawUsage);
    geo.setAttribute('aPosSize', new InterleavedBufferAttribute(this.buffer, 4, 0));
    geo.setAttribute('aVelAlpha', new InterleavedBufferAttribute(this.buffer, 4, 4));
    geo.setAttribute('aTypeSeed', new InterleavedBufferAttribute(this.buffer, 2, 8));
    geo.instanceCount = 0;
    this.geo = geo;

    const uniforms = {
      ...atmos,
      uRes: { value: new Vector2(1, 1) },
      uStreak: { value: 0.02 },
      uFocus: { value: 9 },   // camera focus distance (App keeps it on the ball)
      uAmbCol: { value: atmos.uFogCol.value.clone() },
    };
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      // Particles write depth so the depth of field blurs each drop at its own distance; without
      // it a drop would take the CoC of the far background behind it and dissolve.
      depthWrite: true,
      side: DoubleSide,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.name = 'particles';
    // out-of-focus flakes near the camera: same instances, drawn after, without depth
    const bokeh = new Mesh(geo, new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { BOKEH: 1 },
      transparent: true, depthWrite: false, side: DoubleSide,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
    }));
    bokeh.frustumCulled = false;
    bokeh.renderOrder = 11;
    bokeh.name = 'particles';
    this.mesh.add(bokeh);
  }

  setFocus(dist: number) { this.material.uniforms.uFocus.value = dist; }

  setResolution(w: number, h: number) { (this.material.uniforms.uRes.value as Vector2).set(w, h); }

  upload() {
    const n = this.system.writeInstances();
    this.buffer.clearUpdateRanges();
    this.buffer.addUpdateRange(0, Math.max(1, n) * PARTICLE_STRIDE);
    this.buffer.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}
