import { Color, Matrix4, Vector2 } from 'three';

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** Distant rain streaks / snowflakes beyond the particle volume, drawn in view-direction space. */
export const PrecipShader = {
  uniforms: {
    tDiffuse: { value: null },
    uClipToDir: { value: new Matrix4() },
    uRain: { value: 0 },
    uSnow: { value: 0 },
    uWind: { value: 0 },
    uTime: { value: 0 },
    uSkyCol: { value: new Color(0.7, 0.72, 0.78) },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform mat4 uClipToDir;
    uniform float uRain;
    uniform float uSnow;
    uniform float uWind;
    uniform float uTime;
    uniform vec3 uSkyCol;
    varying vec2 vUv;
    float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
    vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec4 c = uClipToDir * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
      vec3 rd = normalize(c.xyz / c.w);
      float az = atan(rd.x, -rd.z);
      float el = rd.y;
      if (uRain > 0.01) {
        float acc = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float sc = 1.0 + fi * 0.7;
          vec2 uv = vec2(az * 90.0 * sc, el * 7.0 * sc);
          uv.x += uv.y * uWind * 0.9 * 13.0 / sc;
          uv.y += uTime * (8.0 + fi * 2.0);
          float cx = floor(uv.x);
          float h = hash11(cx + fi * 71.0);
          float y = fract(uv.y * 0.18 + h * 7.0);
          float seg = smoothstep(0.0, 0.05, y) * smoothstep(0.4, 0.06, y);
          float xw = smoothstep(0.5, 0.05, abs(fract(uv.x) - 0.5));
          acc += seg * xw * step(0.55, h) * (0.55 - fi * 0.12);
        }
        col += uSkyCol * acc * uRain * 0.16;
      }
      if (uSnow > 0.01) {
        float acc = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float sc = 22.0 + fi * 14.0;
          vec2 uv = vec2(az, el) * sc;
          uv.y += uTime * (0.28 + fi * 0.08) * sc * 0.06;
          uv.x += sin(uv.y * 0.7 + fi) * 0.3 + uTime * uWind * 0.4;
          vec2 id = floor(uv);
          vec2 o = hash22(id + fi * 13.0);
          float d = length(fract(uv) - o);
          acc += smoothstep(0.09, 0.0, d) * step(0.6, o.x) * (0.9 - fi * 0.2);
        }
        float l = dot(uSkyCol, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(0.97, 0.98, 1.0) * l * 1.2, clamp(acc * uSnow * 0.7, 0.0, 1.0));
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** Bloom input: only the energy above the threshold, with a soft knee of `smoothWidth`. */
export const BLOOM_HIGHPASS_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float x = max(l - luminosityThreshold, 0.0);
    float k = x * x / (x + smoothWidth);
    gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
  }`;

/**
 * Lens optics in scene-linear light (before tone mapping): natural cos⁴-style falloff. Done here
 * rather than after AgX so bright sky toward the corners rolls off instead of turning grey.
 */
export const OpticsShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAspect: { value: 1 },
    uVignette: { value: 0.3 },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAspect;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec2 vc = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0);
      float v = 1.0 / pow(1.0 + dot(vc, vc) * 0.16, 2.0);
      gl_FragColor = vec4(col * mix(1.0, v, min(uVignette * 1.4, 1.0)), 1.0);
    }`,
};

/**
 * Film-style finishing in display space (after AgX): split-tone lift/gain, gentle S-curve,
 * halation (warm glow bleeding off bright edges, like light scattering back through film),
 * luminance-weighted clumped grain and a lightning flash.
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new Vector2(1, 1) },
    uLift: { value: new Color(0, 0, 0) },
    uGain: { value: new Color(1, 1, 1) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uCurve: { value: 0.15 },
    uWhite: { value: 1 },
    uHalation: { value: 0.3 },
    uGrain: { value: 0.012 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform vec3 uLift;
    uniform vec3 uGain;
    uniform float uSat;
    uniform float uContrast;
    uniform float uCurve;
    uniform float uWhite;
    uniform float uHalation;
    uniform float uGrain;
    uniform float uFlash;
    uniform float uTime;
    varying vec2 vUv;
    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // halation: light from brighter neighbours spills a warm fringe onto darker edges only,
      // so flat bright sky is left alone (two rings of taps)
      if (uHalation > 0.001) {
        float h = 0.0;
        vec2 px = 1.0 / uRes;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5235988;
          vec2 dir = vec2(cos(a), sin(a));
          float s1 = luma(texture2D(tDiffuse, vUv + dir * px * 3.0).rgb);
          float s2 = luma(texture2D(tDiffuse, vUv + dir * px * 8.0).rgb);
          h += max(s1 - 0.78, 0.0) * 0.6 + max(s2 - 0.78, 0.0) * 0.4;
        }
        float spill = max(h / 12.0 - max(luma(col) - 0.78, 0.0), 0.0);
        col += spill * uHalation * vec3(1.0, 0.42, 0.18) * 1.6;
      }

      col += uFlash * (1.0 - col) * 0.6;
      float l = luma(col);
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col = mix(col, col * col * (3.0 - 2.0 * col), uCurve);
      col = col * uGain + uLift * (1.0 - col);

      // print-stock shoulder: highlights roll off toward uWhite instead of clipping to pure white
      // (narrow knee so only the top of the range is touched; a wide one flattens the whole sky)
      vec3 hk = vec3(uWhite - 0.08);
      vec3 over = max(col - hk, 0.0);
      col = min(col, hk) + 0.08 * (1.0 - exp(-over / 0.08));

      // clumped grain, strongest in the mid-tones
      vec2 gp = floor(gl_FragCoord.xy / 1.6) + fract(uTime * 7.31) * 513.0;
      float g = (hash12(gp) + hash12(gp + 17.3) - 1.0);
      float lw = 4.0 * l * (1.0 - l);
      col += g * (uGrain * (0.35 + lw)) + (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};
