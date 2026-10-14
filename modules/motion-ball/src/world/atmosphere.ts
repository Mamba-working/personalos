import { Color, Vector2, Vector3, type IUniform, type Texture } from 'three';
import { inject, type ShaderPatch } from '../core/patch';
import { NOISE_GLSL } from '../core/noise';

/**
 * Global atmosphere state shared by every shader: sun, sky gradient, height fog, haze,
 * drifting mist and lightning. All materials reference these exact uniform objects,
 * so `atmos.uFogDens.value = x` updates the whole scene (including GLTF models that
 * were patched with `atmospherePatch`).
 */
export const atmos = {
  uSunDir: { value: new Vector3(0.28, 0.3, -0.91).normalize() },
  uSunCol: { value: new Color(3.4, 2.75, 2.0) },     // sun radiance (linear)
  uSunGlow: { value: 1 },
  // how much of the sun's disc is visible (0 under a full overcast): scales hard specular glints
  uSunSpec: { value: 1 },
  uZenith: { value: new Color(0.55, 0.64, 0.78) },
  uHorizon: { value: new Color(0.95, 0.9, 0.83) },
  uFogCol: { value: new Color(0.93, 0.89, 0.84) },
  uFogDens: { value: 0.006 },
  uFogFall: { value: 0.25 },
  uHaze: { value: 0.0012 },
  uMist: { value: 0 },
  uLightning: { value: 0 },
  // time of day (TimeOfDay): night amount, star visibility, moon phase angle (0 new, π full), moon disc
  uNight: { value: 0 },
  uStars: { value: 0 },
  uMoonPhase: { value: Math.PI },
  uMoonDisc: { value: 0 },
  uTime: { value: 0 },
  uNoise2D: { value: null as Texture | null },
  uInteract: { value: null as Texture | null },
  uMapCenter: { value: new Vector2() },
  uMapSize: { value: 18 },
} satisfies Record<string, IUniform>;

/** Vertex-safe part: uniforms, sky gradient, fog colour and analytic fog depth. */
export const ATMOS_CORE_GLSL = /* glsl */ `
#ifndef MB_ATMOS_CORE
#define MB_ATMOS_CORE
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uSunGlow;
uniform float uSunSpec;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFogCol;
uniform float uFogDens;
uniform float uFogFall;
uniform float uHaze;
uniform float uMist;
uniform float uLightning;
uniform float uNight;
uniform float uStars;
uniform float uMoonPhase;
uniform float uMoonDisc;
uniform float uTime;
uniform sampler2D uInteract;
uniform vec2 uMapCenter;
uniform float uMapSize;

// Mie aureole: the broad forward-scattering glow around the sun. It is what makes a backlit
// subject read — the sky behind the ball is several times brighter than the sky the ball's
// shaded face sees.
vec3 sunAureole(vec3 d, float boost) {
  float mu = max(dot(d, uSunDir), 0.0);
  // broad and soft rather than a hot core: the page is looked at for long stretches
  float a = 0.16 * pow(mu, 3.0) + 0.3 * pow(mu, 12.0) + 0.28 * pow(mu, 80.0) + 0.18 * pow(mu, 600.0);
  return uSunCol * uSunGlow * a * boost;
}

vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(y, 0.62));
  // stronger through the thicker, hazier air low in the sky
  col += sunAureole(d, 1.0 + 0.6 * exp(-y * 6.0));
  col += vec3(0.75, 0.8, 1.0) * uLightning * (0.35 + 0.5 * y);
  return col;
}

vec3 fogColorDir(vec3 d) {
  return uFogCol + sunAureole(d, 0.85) + vec3(0.7, 0.75, 0.9) * uLightning * 0.35;
}

// exponential height fog + distance haze, integrated analytically along the ray
float fogDepth(vec3 ro, vec3 rd, float t) {
  float b = uFogFall;
  float rdy = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float od = uFogDens * exp(-b * max(ro.y, 0.0)) * (1.0 - exp(-b * rdy * t)) / (b * rdy);
  return max(od, 0.0) + uHaze * t;
}

vec2 mapUV(vec2 xz) { return (xz - uMapCenter) / uMapSize + 0.5; }
float mapInside(vec2 uv) { vec2 e = min(uv, 1.0 - uv); return smoothstep(0.0, 0.03, min(e.x, e.y)); }
#endif
`;

/** Full fragment-side atmosphere: core + drifting mist + applyAtmosphere(). */
export const ATMOS_GLSL = /* glsl */ `
${ATMOS_CORE_GLSL}
#ifndef MB_ATMOS
#define MB_ATMOS

// Low drifting mist (fog / rain / snow). The cursor and the ball clear it via the interaction map.
vec3 applyMist(vec3 col, vec3 ro, vec3 rd, float tEnd) {
  float tm = min(tEnd, 42.0);
  const int N = 6;
  float dt = tm / float(N);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float T = 1.0;
  vec3 L = vec3(0.0);
  vec3 mc = fogColorDir(rd) * 1.03;
  for (int i = 0; i < N; i++) {
    float t = (float(i) + jit) * dt;
    vec3 p = ro + rd * t;
    float hf = exp(-max(p.y, 0.0) * 0.75);
    vec3 q = p * 0.22 + vec3(uTime * 0.09, 0.0, uTime * 0.03);
    float n = noise3(q) * 0.62 + noise3(q * 2.7 - vec3(uTime * 0.15, 0.0, 0.0)) * 0.38;
    float dens = uMist * hf * smoothstep(0.3, 0.72, n) * 0.095 * (0.2 + 0.8 * smoothstep(5.0, 22.0, t));
    vec2 muv = mapUV(p.xz);
    dens *= 1.0 - texture(uInteract, muv).a * mapInside(muv) * smoothstep(3.5, 0.0, p.y);
    float a = 1.0 - exp(-dens * dt);
    L += T * a * mc;
    T *= 1.0 - a;
  }
  return col * T + L;
}

vec3 applyAtmosphere(vec3 col, vec3 worldPos) {
  vec3 d = worldPos - cameraPosition;
  float t = length(d);
  vec3 rd = d / max(t, 1e-4);
  col = mix(fogColorDir(rd), col, exp(-fogDepth(cameraPosition, rd, t)));
  if (uMist > 0.01) col = applyMist(col, cameraPosition, rd, t);
  return col;
}
#endif
`;

/** Patch for MeshStandard/Physical (and friends): replaces three's fog with our atmosphere. */
export const atmospherePatch: ShaderPatch = {
  key: 'atmos',
  uniforms: atmos,
  vertex: (s) => {
    s = inject(s, '#include <common>', 'varying vec3 vAtmosWorld;');
    s = inject(s, '#include <project_vertex>', /* glsl */ `
      vec4 atmosWP = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        atmosWP = batchingMatrix * atmosWP;
      #endif
      #ifdef USE_INSTANCING
        atmosWP = instanceMatrix * atmosWP;
      #endif
      vAtmosWorld = (modelMatrix * atmosWP).xyz;`);
    return s;
  },
  fragment: (s) => {
    s = inject(s, '#include <common>', `varying vec3 vAtmosWorld;\n${NOISE_GLSL}\n${ATMOS_GLSL}`);
    // Under cloud the sun is a diffuse glow, not a point: hard sun glints (wet ground, glossy ball,
    // the umbrella) fade with the visible share of the disc instead of flaring through overcast.
    s = inject(s, '#include <lights_fragment_end>', /* glsl */ `
      reflectedLight.directSpecular *= uSunSpec;
      #ifdef USE_CLEARCOAT
        clearcoatSpecularDirect *= uSunSpec;
      #endif`, 'before');
    s = inject(s, '#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);', 'replace');
    return s;
  },
};

/** GLSL prelude for hand-written ShaderMaterials that want the same atmosphere. */
export const ATMOS_PRELUDE = `${NOISE_GLSL}\n${ATMOS_GLSL}`;
