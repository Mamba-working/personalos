// Volumetric cloud layer (Nubis-style): coverage map × height profile × Perlin-Worley shape,
// eroded by Worley detail; lit with a short sun march, multiple-scattering octaves and
// sky/ground ambient. Shared by the half-res cloud pass and the environment probe.
export const CLOUDS_GLSL = /* glsl */ `
uniform highp sampler3D uShapeTex;
uniform highp sampler3D uDetailTex;
uniform float uCloudBase;
uniform float uCloudTop;
uniform float uCloudCover;
uniform float uCloudDensity;
uniform float uCloudType;
uniform float uCloudStretch;
uniform vec2 uCloudWindDir;
uniform vec2 uCloudOffset;
uniform float uTowers;
uniform float uSunAz;
uniform vec3 uCloudAmbTop;
uniform vec3 uCloudAmbBottom;
uniform vec3 uCloudTint;
uniform vec3 uCloudSun;      // sunlight above the cloud deck (not dimmed by the clouds themselves)
uniform float uCloudAmbScale; // < 1 on fair days: darker undersides, more sculpted cumulus
uniform float uCloudHaze;
uniform vec4 uBolt;          // xyz = flash position (m), w = intensity

const float EARTH_R = 6360000.0;
const float CPI = 3.14159265;

float cRemap(float v, float lo, float hi, float nlo, float nhi) {
  return nlo + (v - lo) * (nhi - nlo) / max(hi - lo, 1e-5);
}

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float heightFrac(vec3 p) { return (length(p) - EARTH_R - uCloudBase) / (uCloudTop - uCloudBase); }

vec2 cloudFrame(vec2 xz) {
  vec2 q = xz + uCloudOffset;
  vec2 wd = uCloudWindDir;
  return vec2(dot(q, wd) / (1.0 + uCloudStretch * 3.0), dot(q, vec2(-wd.y, wd.x)));
}

float coverageAt(vec3 p) {
  vec2 q = cloudFrame(p.xz);
  // ~2 km cells; the fbm distribution is narrow (sd ≈ 0.12) so the threshold maps cover → area
  float n = fbm2(q * 0.00015, 4);
  float lo = 0.78 - 0.5 * uCloudCover;
  float cov = smoothstep(lo - 0.06, lo + 0.06, n);
  // art direction: a few towering cumulus masses around the sun's azimuth, mid distance,
  // and (on fair days) a calmer sky on the side away from the sun, behind the headline
  float az = atan(p.x, -p.z);
  float dist = length(p.xz);
  cov *= 1.0 - uTowers * 0.85 * smoothstep(-0.25, -0.7, az - uSunAz);
  float daz = az - (uSunAz + 0.12);
  float field = mix(1.0, smoothstep(0.3, 0.55, noise2(q * 0.00007 + 3.7)), 0.5);
  float tower = uTowers * exp(-daz * daz * 4.0) * smoothstep(2500.0, 5000.0, dist) * smoothstep(22000.0, 9000.0, dist) * field;
  return mbSat(max(cov, tower * smoothstep(0.34, 0.56, n)));
}

float heightProfile(float h, float type) {
  float stratus = smoothstep(0.0, 0.1, h) * smoothstep(0.42, 0.2, h);
  float cumulus = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.45, h);
  return mix(stratus, cumulus, type);
}

float cloudDensity(vec3 p, bool detail) {
  float h = heightFrac(p);
  if (h <= 0.0 || h >= 1.0) return 0.0;
  float cov = coverageAt(p);
  if (cov <= 0.01) return 0.0;
  vec2 f = cloudFrame(p.xz);
  vec3 q = vec3(f.x, p.y - EARTH_R + uTime * 4.0, f.y) * 0.00026;
  vec4 s = texture(uShapeTex, q);
  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;
  float base = cRemap(s.r, lowFbm - 1.0, 1.0, 0.0, 1.0);
  // cumulus get round bottoms by fading the profile with the Perlin-Worley shape
  base *= heightProfile(h, uCloudType * (0.6 + 0.4 * cov));
  base = cRemap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
  if (base <= 0.0) return 0.0;
  if (detail) {
    vec3 d = texture(uDetailTex, q * 5.5 + vec3(uTime * 0.004, 0.0, 0.0)).rgb;
    float hf = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
    float m = mix(hf, 1.0 - hf, mbSat(h * 5.0));
    base = cRemap(base, m * 0.32, 1.0, 0.0, 1.0);
  }
  // hard floor: faint haze over kilometres of path would otherwise turn the sky to overcast
  return mbSat((base - 0.04) / 0.96);
}

float hgPhase(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5);   // x 1/4pi omitted: isotropic == 1
}

float sunOpticalDepth(vec3 p, float sigmaScale, int steps) {
  float od = 0.0;
  float stepL = (uCloudTop - uCloudBase) * 0.09 / max(uSunDir.y, 0.2);
  float t = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= steps) break;
    float ds = stepL * (1.0 + float(i) * 0.8);
    t += ds;
    od += cloudDensity(p + uSunDir * t, i < 2) * ds;
  }
  return od * sigmaScale;
}

// rgb = in-scattered light, a = transmittance
vec4 marchClouds(vec3 camPos, vec3 rd, float jitter, int maxSteps, int lightSteps, bool detail) {
  if (rd.y < -0.03 || uCloudCover <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 ro = vec3(camPos.x, EARTH_R + max(camPos.y, 1.0), camPos.z);
  vec2 tb = raySphere(ro, rd, EARTH_R + uCloudBase);
  vec2 tt = raySphere(ro, rd, EARTH_R + uCloudTop);
  float t0 = max(tb.y, 0.0);
  float t1 = min(tt.y, t0 + 34000.0);
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);
  int steps = int(mix(float(maxSteps), float(maxSteps) * 0.55, mbSat(rd.y * 2.5)));
  float dt = (t1 - t0) / float(steps);
  float sigmaScale = 0.02 * uCloudDensity;
  float mu = dot(rd, uSunDir);
  // softened dual-lobe phase, clamped so silver linings stay highlights instead of blooming blobs
  float phSun = min(mix(hgPhase(mu, 0.62), hgPhase(mu, -0.2), 0.45), 4.0);
  float T = 1.0;
  vec3 L = vec3(0.0);
  float tw = 0.0, wsum = 0.0;
  float t = t0 + dt * jitter;
  for (int i = 0; i < 128; i++) {
    if (i >= steps || T < 0.015) break;
    vec3 p = ro + rd * t;
    float d = cloudDensity(p, detail);
    if (d > 0.003) {
      float sigma = d * sigmaScale;
      float od = sunOpticalDepth(p, sigmaScale, lightSteps);
      // single scattering + a softer octave + diffuse transmission (algebraic decay keeps
      // thick overcast bases luminous instead of black)
      float ms = exp(-od) * phSun
               + 0.55 * exp(-od * 0.35) * mix(1.0, phSun, 0.5)
               + 0.35 / (1.0 + od * 0.12);
      float powder = 1.0 - exp(-sigma * 120.0);
      float h = heightFrac(p);
      vec3 amb = mix(uCloudAmbBottom, uCloudAmbTop, 0.35 + 0.65 * h) * (0.8 + 0.2 * h) * uCloudAmbScale;
      // 0.5: keeps sunlit tops in the tone mapper's soft shoulder instead of clipping to white
      vec3 S = (uCloudSun * 0.5 * ms * mix(0.6, 1.0, powder) + amb) * uCloudTint;
      if (uBolt.w > 0.0) S += vec3(0.75, 0.8, 1.0) * uBolt.w * 6.0 * exp(-length(p - uBolt.xyz) * 0.0009);
      float Ti = exp(-sigma * dt);
      vec3 Sint = S * (1.0 - Ti);
      L += T * Sint;
      float wgt = T * (1.0 - Ti);
      tw += wgt * t; wsum += wgt;
      T *= Ti;
    }
    t += dt;
  }
  // aerial perspective: distant clouds melt into the horizon haze
  float tm = wsum > 0.0 ? tw / wsum : t1;
  float fade = 1.0 - exp(-tm * uCloudHaze);
  vec3 hz = fogColorDir(rd);
  L = mix(L, hz * (1.0 - T), fade);
  // thin out toward the horizon so the layer does not end in a hard line
  float hor = smoothstep(-0.02, 0.06, rd.y);
  return vec4(L * hor, mix(1.0, T, hor));
}
`;
