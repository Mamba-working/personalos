import { Color, Matrix4, Mesh, MeshPhysicalMaterial, PlaneGeometry, RingGeometry, Vector2, Vector3, Vector4, type IUniform, type Texture } from 'three';
import { applyPatches, inject, type ShaderPatch } from '../core/patch';
import { NOISE_GLSL } from '../core/noise';
import { ATMOS_GLSL, atmospherePatch } from './atmosphere';

/** Ground state driven by the weather + interaction systems. */
export const groundUniforms = {
  uGroundWet: { value: 0.55 },
  uPuddle: { value: 0 },
  uSnowCover: { value: 0 },
  uDust: { value: 0 },
  uRain: { value: 0 },
  uSandCol: { value: new Color(0.5, 0.47, 0.43) },
  uGroundWind: { value: new Vector2(-0.94, 0.33) },
  uRippleGain: { value: 2.2 },
  uBallSphere: { value: new Vector4(0, 1, 0, 1) },
  uShelter: { value: new Vector4(0, 0, 1, 0) },      // xz center, radius, strength (umbrella)
  uMirror: { value: null as Texture | null },
  uMirrorMatrix: { value: new Matrix4() },
  // photo-scanned surface (set by EnvAssets): 0 until the textures arrive, procedural detail meanwhile
  uGTex: { value: 0 },
  uSnowTex: { value: 0 },
  uBaseDiff: { value: null as Texture | null },
  uBaseNor: { value: null as Texture | null },
  uMicroDiff: { value: null as Texture | null },
  uMicroNor: { value: null as Texture | null },
  uMicroRough: { value: null as Texture | null },
  uSnowDiff: { value: null as Texture | null },
  uSnowNor: { value: null as Texture | null },
  uTexTile: { value: new Vector3(1 / 18, 1 / 1.4, 1 / 2.4) },   // 1 / tile size: base, micro, snow
  uSnowMound: { value: new Vector4(0, 0, 1, 0) },                  // snow around the ball: x, z, radius, amount
} satisfies Record<string, IUniform>;

const GROUND_FUNCS = /* glsl */ `
uniform float uGroundWet;
uniform float uPuddle;
uniform float uSnowCover;
uniform float uDust;
uniform float uRain;
uniform vec3 uSandCol;
uniform vec2 uGroundWind;
uniform float uRippleGain;
uniform vec4 uBallSphere;
uniform vec4 uShelter;
uniform sampler2D uMirror;
uniform float uGTex;
uniform float uSnowTex;
uniform sampler2D uBaseDiff;
uniform sampler2D uBaseNor;
uniform sampler2D uMicroDiff;
uniform sampler2D uMicroNor;
uniform sampler2D uMicroRough;
uniform sampler2D uSnowDiff;
uniform sampler2D uSnowNor;
uniform vec3 uTexTile;
varying vec3 vGWorld;
varying vec4 vMirrorCoord;

// ---- photo-scanned texture sets, laid out with u = +x, v = -z
// colour relative to the map's own average (its last mip): the preset keeps hue and level
vec3 texTone(sampler2D t, vec2 uv) {
  return texture2D(t, uv).rgb / max(textureLod(t, vec2(0.5), 16.0).rgb, vec3(0.02));
}
// blending two uncorrelated samples halves their contrast mid-way (a soft, smeared patch);
// scaling the blended deviation by this keeps the variance constant across the blend
float vpGain(float w) { return inversesqrt(w * w + (1.0 - w) * (1.0 - w)); }

// Tile variation for the small near-field tiles (after iq's "texture repetition"): a slowly
// varying index picks one of 8 offset + rotation variants of the tile and the two nearest are
// blended, so the pattern never lines up with itself. Gradients come from the continuous
// coordinate, so switching variants leaves no mip seams.
vec2 tvUV[2]; vec2 tvDx[2]; vec2 tvDy[2]; mat2 tvRT[2]; float tvW; float tvVP;
void tileVariants(vec2 p, float invTile, float k) {
  float idx = k * 8.0, i = floor(idx);
  vec2 q = p * invTile, qx = dFdx(q), qy = dFdy(q);
  for (int j = 0; j < 2; j++) {
    float n = i + float(j), a = n * 2.39996;   // golden angle: neighbouring variants never align
    float c = cos(a), s = sin(a);
    mat2 R = mat2(c, s, -s, c);
    tvUV[j] = R * q + sin(vec2(3.0, 7.0) * n);
    tvDx[j] = R * qx; tvDy[j] = R * qy;
    tvRT[j] = mat2(c, -s, s, c);
  }
  tvW = smoothstep(0.2, 0.8, fract(idx));
  tvVP = vpGain(tvW);
}
vec3 tvTone(sampler2D t) {
  vec3 m = max(textureLod(t, vec2(0.5), 16.0).rgb, vec3(0.02));
  vec3 a = textureGrad(t, tvUV[0], tvDx[0], tvDy[0]).rgb, b = textureGrad(t, tvUV[1], tvDx[1], tvDy[1]).rgb;
  return 1.0 + (mix(a, b, tvW) / m - 1.0) * tvVP;
}
float tvDev(sampler2D t) {
  float m = max(textureLod(t, vec2(0.5), 16.0).r, 0.02);
  float a = textureGrad(t, tvUV[0], tvDx[0], tvDy[0]).r, b = textureGrad(t, tvUV[1], tvDx[1], tvDy[1]).r;
  return (mix(a, b, tvW) / m - 1.0) * tvVP;
}
vec2 tvSlope(sampler2D t) {
  vec2 m = textureLod(t, vec2(0.5), 16.0).xy * 2.0 - 1.0;
  vec2 s = vec2(0.0);
  for (int j = 0; j < 2; j++) {
    vec3 n = textureGrad(t, tvUV[j], tvDx[j], tvDy[j]).xyz * 2.0 - 1.0;
    vec2 g = tvRT[j] * (-(n.xy - m) / max(n.z, 0.35));
    s += vec2(g.x, -g.y) * (j == 0 ? 1.0 - tvW : tvW);
  }
  return s * tvVP;
}
// tangent-space normal → slope (dh/dx, dh/dz). rt undoes the sampling rotation; the map's mean
// normal is removed so a tilt baked into a scan does not lean the whole ground
vec2 texSlope(sampler2D t, vec2 uv, mat2 rt) {
  vec3 n = texture2D(t, uv).xyz * 2.0 - 1.0;
  n.xy -= textureLod(t, vec2(0.5), 16.0).xy * 2.0 - 1.0;
  vec2 s = rt * (-n.xy / max(n.z, 0.35));
  return vec2(s.x, -s.y);
}

float sphOcclusion(vec3 pos, vec3 nor, vec4 sph) {
  vec3 di = sph.xyz - pos;
  float l = length(di);
  float nl = dot(nor, di / l);
  float h = l / sph.w;
  float h2 = h * h;
  float k2 = 1.0 - h2 * nl * nl;
  float res = max(0.0, nl) / h2;
  if (k2 > 0.001) { res = (nl * h + 1.0) / h2; res = 0.33 * res * res; }
  return res;
}

float groundH(vec2 p, float fp) {
  float h = (noise2(p * 0.9) - 0.5) * 0.03 * smoothstep(1.4, 0.2, fp * 0.9);
  if (uGTex > 0.5) return h;   // ripples and grain come from the photo textures
  float ph = dot(p, uGroundWind) * 7.0 + noise2(p * 1.3) * 4.0;
  h += sin(ph) * 0.0035 * smoothstep(0.7, 0.1, fp * 7.0);
  h += (noise2(p * 4.3 + 3.1) - 0.5) * 0.009 * smoothstep(0.6, 0.1, fp * 4.3);
  h += (noise2(p * 11.0 + 7.7) - 0.5) * 0.004 * smoothstep(0.6, 0.1, fp * 11.0);
  h += (noise2(p * 27.0 + 1.3) - 0.5) * 0.0018 * smoothstep(0.6, 0.1, fp * 27.0);
  return h;
}
float snowH(vec2 p) {
  float h = fbm2(p * 0.4, 3) * 0.1;   // drifts
  return uSnowTex > 0.5 ? h : h + noise2(p * 2.5) * 0.014 + noise2(p * 7.0) * 0.004;
}


vec2 rainRipples(vec2 uv, float t) {
  vec2 g = vec2(0.0);
  vec2 id = floor(uv);
  vec2 f = fract(uv);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash22(id + o);
      float ph = fract(t * (0.9 + 0.4 * h.y) + h.x);
      vec2 d = f - (o + 0.5 + (h - 0.5) * 0.7);
      float r = length(d);
      float rad = ph * 0.75;
      float w = sin((r - rad) * 38.0) * smoothstep(0.12, 0.0, abs(r - rad)) * (1.0 - ph) * (1.0 - ph);
      g += d / max(r, 1e-3) * w;
    }
  }
  return g;
}

// Ice crystals in the snow crust: a few grains carry a facet that flashes when it faces the viewer.
// The flash follows the view direction smoothly (no on/off popping as the camera drifts) and each
// speck is a pixel or two across, antialiased by the footprint.
float sparkle(vec3 P, vec3 rd, float fp) {
  vec2 q = P.xz * 20.0;
  vec2 id = floor(q);
  if (hash12(id) < 0.93) return 0.0;
  float px = fp * 20.0;
  float dotm = 1.0 - smoothstep(0.3 - px * 0.5, 0.3 + px * 0.5, length(fract(q) - 0.5));
  vec2 t = (hash22(id + 1.7) - 0.5) * 1.5;
  vec3 facet = normalize(vec3(t.x, 1.0, t.y));
  return pow(max(dot(-rd, facet), 0.0), 30.0) * dotm * smoothstep(0.06, 0.01, fp);
}

// lumpy crust: clods with hollows between them, and finer grains on top (0..1)
float snowClump(vec2 p) { return noise2(p * 3.2) * 0.5 + noise2(p * 8.5 + 1.3) * 0.32 + noise2(p * 23.0 + 3.0) * 0.18; }

vec3 gN; vec3 gNl; vec3 gNc; vec3 gAlb; float gRough; float gFilm; float gFilmRough; float gAO; float gSpark; float gSnow; float gCav;

void groundSurface(vec3 P) {
  vec2 xz = P.xz;
  gCav = 0.0;
  vec3 rd = normalize(P - cameraPosition);
  float tCam = length(P - cameraPosition);
  float fp = max(length(fwidth(xz)), 1e-4);
  float big = fbm2(xz * 0.05 + 1.3, 3);
  float mid = noise2(xz * 0.45 + 2.7);
  vec3 alb = uSandCol * (0.84 + 0.26 * big + 0.1 * (mid - 0.5));
  vec2 gTex = vec2(0.0);     // photographed relief (ripples): the water film follows part of it
  vec2 gGrain = vec2(0.0);   // fine grain near the ball: shading only, the film smooths over it
  float roughDev = 0.0;      // grain roughness relative to its mean
  if (uGTex > 0.5) {
    vec2 p = vec2(xz.x, -xz.y);
    // base layer at two scales, blended by low-frequency noise so the tile never reads as a grid
    float wB = smoothstep(0.3, 0.7, noise2(xz * 0.019 + 5.3)), vB = vpGain(wB);
    vec2 uvA = p * uTexTile.x, uvB = p * (uTexTile.x * 0.382) + vec2(0.37, 0.71);
    vec3 tone = 1.0 + (mix(texTone(uBaseDiff, uvA), texTone(uBaseDiff, uvB), wB) - 1.0) * vB;
    alb *= max(1.0 + (tone - 1.0) * 1.8, vec3(0.0));   // a low-contrast scan: lift its tone a little
    gTex = mix(texSlope(uBaseNor, uvA, mat2(1.0)), texSlope(uBaseNor, uvB, mat2(1.0)), wB) * (0.5 * vB);
    // micro layer: crisp grain at the ball's feet, faded out with distance
    float near = smoothstep(42.0, 10.0, tCam);
    tileVariants(p, uTexTile.y, noise2(xz * (uTexTile.y * 0.13) + 1.9));
    alb *= mix(vec3(1.0), tvTone(uMicroDiff), 0.28 * near);
    gGrain = tvSlope(uMicroNor) * (0.45 * near);
    roughDev = tvDev(uMicroRough) * near;
  } else {
    // salt-crust flecks give the procedural flat a photographic grain
    float fleck = smoothstep(0.72, 0.9, noise2(xz * 3.1 + 9.0)) * smoothstep(0.3, 0.02, fp);
    alb *= 1.0 + fleck * 0.16;
  }
  if (uDust > 0.01) {
    vec2 wq = vec2(dot(xz, uGroundWind), dot(xz, vec2(-uGroundWind.y, uGroundWind.x)));
    float s = noise2(vec2(wq.x * 0.35 - uTime * 2.6, wq.y * 4.0)) * noise2(vec2(wq.x * 0.8 - uTime * 3.5, wq.y * 9.0 + 3.0));
    alb = mix(alb, uSandCol * 1.18, smoothstep(0.22, 0.5, s) * uDust * 0.7 * smoothstep(0.25, 0.02, fp));
  }

  float e = max(0.012, fp * 0.6);
  float h0 = groundH(xz, fp);
  vec2 g = vec2(groundH(xz + vec2(e, 0.0), fp) - h0, groundH(xz + vec2(0.0, e), fp) - h0) / e + gTex;

  vec2 muv = mapUV(xz);
  float inside = mapInside(muv);
  vec4 im = inside > 0.0 ? texture2D(uInteract, muv) * inside : vec4(0.0);

  float wet = mbSat(uGroundWet * (0.75 + 0.5 * (big - 0.5)));
  float pud = uPuddle > 0.01 ? smoothstep(0.6 - uPuddle * 0.28, 0.65 - uPuddle * 0.28, fbm2(xz * 0.2 + 4.0, 3)) * mbSat(uPuddle * 3.0) : 0.0;
  float shelter = uShelter.w * smoothstep(uShelter.z + 0.15, uShelter.z - 0.35, length(xz - uShelter.xy));
  wet *= 1.0 - shelter * 0.75;
  pud *= 1.0 - shelter;

  float snowC = 0.0, dent = 0.0;
  vec3 snowTone = vec3(1.0);
  if (uSnowCover > 0.001) {
    snowC = mbSat(uSnowCover * 1.3 - 0.3 + (big - 0.5) * 0.8 * (1.0 - uSnowCover));
    float sh0 = snowH(xz);
    vec2 sg = vec2(snowH(xz + vec2(e, 0.0)) - sh0, snowH(xz + vec2(0.0, e)) - sh0) / e;
    if (uSnowTex > 0.5) {
      tileVariants(vec2(xz.x, -xz.y), uTexTile.z, noise2(xz * (uTexTile.z * 0.13) + 8.1));
      sg += tvSlope(uSnowNor) * 0.8;
      snowTone = tvTone(uSnowDiff);
    }
    // the snow piled around the ball: same height field as the mound mesh, so they shade alike
    if (uSnowMound.w > 0.01) {
      float m0 = moundH(xz);
      const float me = 0.01;
      sg += vec2(moundH(xz + vec2(me, 0.0)) - m0, moundH(xz + vec2(0.0, me)) - m0) / me;
    }
    // near the camera the crust breaks into lumps; their hollows only see the (blue) skylight
    float nearS = smoothstep(32.0, 8.0, tCam) * smoothstep(0.05, 0.012, fp);
    if (nearS > 0.0) {
      float c0 = snowClump(xz);
      const float ce = 0.006;
      sg += vec2(snowClump(xz + vec2(ce, 0.0)) - c0, snowClump(xz + vec2(0.0, ce)) - c0) / ce * 0.07 * nearS;
      gCav = smoothstep(0.5, 0.2, c0) * nearS;
    }
    if (inside > 0.0) {
      dent = im.b;
      float de = 1.5 / 512.0;
      vec2 dg = vec2(texture2D(uInteract, muv + vec2(de, 0.0)).b - texture2D(uInteract, muv - vec2(de, 0.0)).b,
                     texture2D(uInteract, muv + vec2(0.0, de)).b - texture2D(uInteract, muv - vec2(0.0, de)).b);
      sg -= dg * inside * 1.6;
    }
    g = mix(g, sg, snowC);
  }

  vec2 rg = vec2(0.0);
  if (uRain > 0.01) rg += rainRipples(xz * 1.6, uTime) * uRain * (1.0 - shelter) * smoothstep(35.0, 6.0, tCam) * 0.45;
  if (inside > 0.0) {
    float te = 1.0 / 512.0;
    vec2 sgr = vec2(texture2D(uInteract, muv + vec2(te, 0.0)).r - texture2D(uInteract, muv - vec2(te, 0.0)).r,
                    texture2D(uInteract, muv + vec2(0.0, te)).r - texture2D(uInteract, muv - vec2(0.0, te)).r);
    rg += sgr * inside * uRippleGain;
  }
  float wetAll = max(wet, pud) * (1.0 - snowC);
  float flat_ = 1.0 - pud * 0.85 * (1.0 - snowC);
  vec2 gt = g * flat_ + rg * (0.25 + 0.75 * wetAll) * (1.0 - snowC);
  gNl = normalize(vec3(-gt.x, 1.0, -gt.y));
  gt += gGrain * flat_ * (1.0 - snowC);
  gN = normalize(vec3(-gt.x, 1.0, -gt.y));
  // water film: flat in puddles (with ripples), hugging the sand elsewhere
  vec2 gf = mix(g * 0.6, vec2(0.0), pud) + rg;
  gNc = normalize(vec3(-gf.x, 1.0, -gf.y));

  alb *= mix(1.0, 0.6, wet * 0.85) * mix(1.0, 0.72, pud);
  vec3 snowAlb = mix(vec3(0.94, 0.955, 0.985), vec3(0.66, 0.75, 0.9), mbSat(dent * 0.75));
  snowAlb = min(snowAlb * (1.0 + (snowTone - 1.0) * 0.8), vec3(0.98));
  gAlb = mix(alb, snowAlb, snowC);
  gRough = mix(clamp(mix(0.82, 0.6, wet) * (1.0 + roughDev * 0.8), 0.3, 1.0), 0.9, snowC);
  // the film beads up on the rougher grain and pools on the smoother patches
  gFilm = mbSat(wet * 0.75 + pud) * (1.0 - snowC) * mbSat(1.0 - roughDev * 1.6 * (1.0 - pud));
  // a smooth film keeps the sun's glint a narrow path instead of a broad glare sheet
  gFilmRough = mix(mix(0.2, 0.075, wet), 0.02, pud);
  gAO = 1.0 - mbSat(sphOcclusion(P, vec3(0.0, 1.0, 0.0), uBallSphere));
  gSnow = snowC;
  gCav *= snowC;
  gSpark = snowC > 0.0 ? sparkle(P, rd, fp) * snowC : 0.0;
}
`;

/**
 * Snow piled around the resting ball (uSnowMound: x, z, ball radius, amount): a lumpy rim that
 * hugs its base, rising to ~0.16 R at the contact and fading out by ~1.9 R. Inside the ball's
 * footprint it stays below the ball's surface, so the ball looks sunk into the snow.
 */
const MOUND_GLSL = /* glsl */ `
uniform vec4 uSnowMound;
float moundH(vec2 xz) {
  if (uSnowMound.w < 0.01) return 0.0;
  vec2 d = xz - uSnowMound.xy;
  float r = length(d) / uSnowMound.z;
  if (r > 2.0) return 0.0;
  float a = atan(d.y, d.x);
  float n = noise2(vec2(cos(a), sin(a)) * 2.5 + 3.0) * 0.6 + noise2(d * 6.0) * 0.4;
  float prof = smoothstep(0.55, 0.98, r) * smoothstep(1.9, 1.0, r);
  return uSnowMound.w * uSnowMound.z * 0.16 * prof * (0.55 + 0.9 * n);
}
`;

const groundPatch: ShaderPatch = {
  key: 'ground',
  uniforms: groundUniforms,
  vertex: (s) => {
    s = inject(s, '#include <common>', `varying vec3 vGWorld;\nvarying vec4 vMirrorCoord;\nuniform mat4 uMirrorMatrix;\n${NOISE_GLSL}\n${MOUND_GLSL}`);
    // the snow mound (only the mound mesh is fine enough to show it; the ground plane has 4 vertices)
    s = inject(s, '#include <project_vertex>', 'transformed.y += moundH((modelMatrix * vec4(transformed, 1.0)).xz);', 'before');
    s = inject(s, '#include <project_vertex>', /* glsl */ `
      vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vMirrorCoord = uMirrorMatrix * vec4(vGWorld, 1.0);`);
    return s;
  },
  fragment: (s) => {
    s = inject(s, '#include <common>', `${NOISE_GLSL}\n${ATMOS_GLSL}\n${MOUND_GLSL}\n${GROUND_FUNCS}`);
    s = inject(s, '#include <color_fragment>', 'groundSurface(vGWorld);\ndiffuseColor.rgb = gAlb;');
    s = inject(s, '#include <roughnessmap_fragment>', 'roughnessFactor = gRough;');
    s = inject(s, '#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);');
    s = inject(s, '#include <clearcoat_normal_fragment_maps>', 'clearcoatNormal = normalize((viewMatrix * vec4(gNc, 0.0)).xyz);');
    s = inject(s, '#include <lights_physical_fragment>', /* glsl */ `
      material.clearcoat = gFilm;
      material.clearcoatRoughness = clamp(gFilmRough, 0.03, 1.0);
      material.clearcoatF0 = vec3(0.02);`);
    s = inject(s, '#include <lights_fragment_maps>', /* glsl */ `
      {
        // mirror reflection (includes sky, mountains, the ball and its umbrella)
        vec2 muv = vMirrorCoord.xy / vMirrorCoord.w;
        vec2 dc = (viewMatrix * vec4(gNc, 0.0)).xy;
        vec2 db = (viewMatrix * vec4(gNl, 0.0)).xy;   // without the grain: no pixel-scale jitter
        clearcoatRadiance = textureLod(uMirror, clamp(muv + dc * 0.08, 0.001, 0.999), gFilmRough * 7.0).rgb;
        vec3 blurred = textureLod(uMirror, clamp(muv + db * 0.12, 0.001, 0.999), 2.5 + gRough * 4.0).rgb;
        radiance = mix(radiance, blurred, 0.6);
      }`);
    s = inject(s, '#include <lights_fragment_end>', /* glsl */ `
      // a calm, readable glint: soft-clipped instead of a blown-out sheet
      reflectedLight.directSpecular = 1.4 * reflectedLight.directSpecular / (1.4 + reflectedLight.directSpecular);
      #ifdef USE_CLEARCOAT
        clearcoatSpecularDirect = 1.4 * clearcoatSpecularDirect / (1.4 + clearcoatSpecularDirect);
      #endif`, 'before');
    s = inject(s, '#include <aomap_fragment>', /* glsl */ `
      reflectedLight.indirectDiffuse *= gAO * (1.0 - 0.4 * gCav);
      reflectedLight.indirectSpecular *= mix(gAO, 1.0, 0.5);
      reflectedLight.directDiffuse *= 1.0 - 0.6 * gCav;`);
    s = inject(s, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += gSpark * (uSunCol * 0.35 + vec3(0.6));');
    return s;
  },
};

export function createGround(): Mesh {
  const geo = new PlaneGeometry(60000, 60000, 1, 1);   // under the whole terrain (lowlands sink below it)
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.8, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    ior: 1.45, specularIntensity: 0.6,
  });
  applyPatches(mat, [atmospherePatch, groundPatch]);
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/**
 * The displaced ring that carries the snow mound around the ball (see MOUND_GLSL). It shares the
 * ground material, so it shades exactly like the snow next to it, and sits 2 mm low: wherever the
 * mound is thinner than that, the ground plane covers it and there is no seam or z-fighting.
 * Move it with the ball (x, z) and set `groundUniforms.uSnowMound`.
 */
export function createSnowMound(ground: Mesh): Mesh {
  const geo = new RingGeometry(0.45, 2.0, 96, 24);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, ground.material);
  mesh.receiveShadow = true;
  mesh.name = 'ground-mound';
  mesh.position.y = -0.002;
  mesh.visible = false;
  return mesh;
}
