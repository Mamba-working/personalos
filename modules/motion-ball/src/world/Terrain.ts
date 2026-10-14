import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry,
  ShaderMaterial, Vector4, type IUniform, type Texture,
} from 'three';
import type { TerrainDem } from '../config/assets';
import { groundUniforms } from './Ground';
import { applyPatches, inject, type ShaderPatch } from '../core/patch';
import { fbm, ridged } from '../core/noise';
import { atmos, ATMOS_PRELUDE, atmospherePatch } from './atmosphere';

export const terrainUniforms = {
  uMtnSnow: { value: 0.15 },
  uMtnTint: { value: new Color(0.42, 0.43, 0.46) },
  uMistSheets: { value: 0 },
  // aerial perspective of the ranges: optical depth = uMtnHaze · (distance / 1 km)^1.5
  uMtnHaze: { value: 0.04 },
  // photographed rock (set by EnvAssets once loaded): triplanar at 1 / uRockTile and 4× that
  uRockTex: { value: 0 },
  uRockDiff: { value: null as Texture | null },
  uRockNor: { value: null as Texture | null },
  uRockTile: { value: 1 / 250 },
  // real landscape from elevation data (applyDem): on/off, the detail map (RG normal x/z, B
  // concavity) over the rect x0, x1, z0, z1 (terrain-local), and how to recover real elevations
  // (m) from local height y and distance r: e = y·x + y0 + r²·z (scale, base level, earth curvature)
  uDem: { value: 0 },
  uDemDetail: { value: null as Texture | null },
  uDemRect: { value: new Vector4(0, 1, 0, 1) },
  uDemElev: { value: new Vector4(1, 0, 0, 0) },
  uTerrainSwing: { value: 0 },          // rotation of the terrain group about y (portrait layout)
  uTSnowCover: groundUniforms.uSnowCover,
} satisfies Record<string, IUniform>;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const band = (r: number, c: number, w: number) => Math.exp(-(((r - c) / w) ** 2));

const bump = (az: number, r: number, a0: number, r0: number, wa: number, wr: number) =>
  Math.exp(-(((az - a0) / wa) ** 2) - (((r - r0) / wr) ** 2));

/**
 * Height (m) of the distant ranges at world (x, z), composed like a landscape plate: dark rolling
 * foothills (~1.3 km), a mid range (~3 km) and a far chain (~6 km) whose hero massif rises behind
 * and to the right of the ball, all staying low behind the headline on the left. Each layer sits
 * at a different depth so the atmosphere separates them into receding planes.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 650) return 0;
  const az = Math.atan2(x, -z);
  const rise = smooth(650, 1000, r);
  const side = smooth(-0.5, 0.35, az);    // 0 behind the headline (left) → 1 behind the ball (right)
  // gentle domain warp so ridgelines meander instead of following the noise lattice
  const wx = x + 700 * (fbm(x / 4000, z / 4000, 3, 71) - 0.5);
  const wz = z + 700 * (fbm(x / 4000 + 7.1, z / 4000, 3, 72) - 0.5);
  const foot = 62 * band(r, 1300, 300) * (0.15 + 0.85 * side) * Math.pow(0.25 + ridged(wx / 600, wz / 600, 4, 3), 1.3);
  const mid = 330 * band(r, 3000, 650) * (0.25 + 0.75 * side) * Math.pow(ridged(wx / 1000, wz / 1000, 5, 11), 1.6);
  const fr = ridged(wx / 1700, wz / 1700, 6, 23);
  const chain = 850 * band(r, 6200, 1400) * (0.55 + 0.45 * side) * Math.pow(fr, 1.6);
  const hero = 500 * bump(az, r, 0.36, 6000, 0.17, 1500) * (0.6 + 0.6 * fr);
  return rise * (foot + mid + chain + hero);
}

/**
 * Polar grid from the viewer: azimuth −1.5…1.5 rad, radius log-spaced r0…r1 (dense near, sparse far,
 * like the screen footprint). `height(i, j)` gives a sample's height; without it the procedural
 * ranges are used, with per-layer albedo in the vertex colours.
 */
function buildGeometry(AZ = 760, RAD = 150, r0 = 650, r1 = 9000, height?: (i: number, j: number) => number): BufferGeometry {
  const az0 = -1.5, az1 = 1.5;
  const pos = new Float32Array((AZ + 1) * (RAD + 1) * 3);
  const col = new Float32Array((AZ + 1) * (RAD + 1) * 3);
  let k = 0;
  for (let j = 0; j <= RAD; j++) {
    const r = r0 * Math.pow(r1 / r0, j / RAD);
    // albedo by depth layer (× uMtnTint): dark, slightly olive foothills; grey rock behind. Kept
    // well below the sky's brightness so every range reads as a silhouette the haze then lifts.
    const nearW = 1 - smooth(1700, 2400, r);
    const base: [number, number, number] = [0.62 - 0.26 * nearW, 0.6 - 0.24 * nearW, 0.6 - 0.3 * nearW];
    for (let i = 0; i <= AZ; i++) {
      const a = az0 + (az1 - az0) * (i / AZ);
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      const y = (height ? height(i, j) : terrainHeight(x, z)) + 0.8;   // clear of the ground plane
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      // strata variation; darker crevices from a second noise (the real terrain shades in the shader)
      const v = height ? 1 : 0.9 + 0.3 * fbm(x / 260, z / 260, 3, 41) - 0.22 * ridged(x / 140, z / 140, 2, 77);
      const b = height ? [1, 1, 1] : base;
      col[k] = b[0] * v; col[k + 1] = b[1] * v; col[k + 2] = b[2] * v;
      k += 3;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < RAD; j++) {
    for (let i = 0; i < AZ; i++) {
      const a = j * (AZ + 1) + i, b = a + 1, c = a + AZ + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);   // counter-clockwise seen from above: faces and normals point up
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const terrainPatch: ShaderPatch = {
  key: 'terrain',
  uniforms: terrainUniforms,
  vertex: (s) => {
    s = inject(s, '#include <common>', 'varying vec3 vTWorld;\nvarying vec3 vTNormal;\nvarying vec3 vTLocal;');
    s = inject(s, '#include <project_vertex>', 'vTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTNormal = normalize(mat3(modelMatrix) * objectNormal);\nvTLocal = transformed;');
    return s;
  },
  fragment: (s) => {
    s = inject(s, '#include <common>', /* glsl */ `
      uniform float uMtnSnow;
      uniform vec3 uMtnTint;
      uniform float uMtnHaze;
      uniform float uRockTex;
      uniform sampler2D uRockDiff;
      uniform sampler2D uRockNor;
      uniform float uRockTile;
      uniform float uDem;
      uniform sampler2D uDemDetail;
      uniform vec4 uDemRect;
      uniform vec4 uDemElev;
      uniform float uTerrainSwing;
      uniform float uTSnowCover;
      varying vec3 vTWorld;
      varying vec3 vTNormal;
      varying vec3 vTLocal;
      vec3 tRockN;
      float tCv;
      float tSnow;

      // Triplanar photographed rock at scale s, weight w: tone relative to the map's mean (the
      // preset keeps the colour) and a whiteout-blended normal, so steep faces are not smeared.
      void rockTriplanar(vec3 P, vec3 N, vec3 bw, float s, float w, inout vec3 tone, inout vec3 nrm) {
        vec2 uvX = P.zy * s, uvY = P.xz * s, uvZ = P.xy * s;
        vec3 t = texture2D(uRockDiff, uvX).rgb * bw.x + texture2D(uRockDiff, uvY).rgb * bw.y + texture2D(uRockDiff, uvZ).rgb * bw.z;
        tone += w * t / max(textureLod(uRockDiff, vec2(0.5), 16.0).rgb, vec3(0.02));
        vec2 m = textureLod(uRockNor, vec2(0.5), 16.0).xy * 2.0 - 1.0;
        vec3 nX = texture2D(uRockNor, uvX).xyz * 2.0 - 1.0;
        vec3 nY = texture2D(uRockNor, uvY).xyz * 2.0 - 1.0;
        vec3 nZ = texture2D(uRockNor, uvZ).xyz * 2.0 - 1.0;
        const float k = 0.85;   // relief strength
        nX = vec3((nX.xy - m) * k + N.zy, abs(nX.z) * N.x);
        nY = vec3((nY.xy - m) * k + N.xz, abs(nY.z) * N.y);
        nZ = vec3((nZ.xy - m) * k + N.xy, abs(nZ.z) * N.z);
        nrm += w * normalize(nX.zyx * bw.x + nY.xzy * bw.y + nZ.xyz * bw.z);
      }`);
    // after the atmosphere chunk (injected at <common> before us), so its helpers are declared
    s = inject(s, 'void main() {', /* glsl */ `
      // Landscape-plate aerial perspective: near ranges keep their dark value, each farther one is
      // a step lighter (power curve), so the ranges stack into planes instead of dissolving into
      // the scene fog. Only a capped share of the ground-hugging fog reaches the ranges' feet.
      vec3 applyRangeAtmosphere(vec3 col, vec3 wp) {
        vec3 d = wp - cameraPosition;
        float t = length(d);
        vec3 rd = d / max(t, 1e-4);
        float km = t * 0.001;
        float low = max(fogDepth(cameraPosition, rd, t) - uHaze * t, 0.0);
        float od = uMtnHaze * km * sqrt(km) + min(low, 0.5) * 0.25;
        col = mix(fogColorDir(rd), col, exp(-od));
        if (uMist > 0.01) col = applyMist(col, cameraPosition, rd, t);
        return col;
      }`, 'before');
    s = inject(s, 'gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);', 'gl_FragColor.rgb = applyRangeAtmosphere(gl_FragColor.rgb, vAtmosWorld);', 'replace');
    s = inject(s, '#include <color_fragment>', /* glsl */ `
      tCv = 0.0; tSnow = 0.0;
      if (uDem < 0.5) {
        // Rock detail below the mesh resolution: erosion gullies and ledges at ~15-60 m from a
        // world-space height field, faded by the pixel footprint so distant ranges never shimmer.
        // It drives the shading normal, crevice darkening and where snow can lie.
        vec3 P = vTWorld;
        vec3 N0 = normalize(vTNormal);
        float fw = length(fwidth(P));
        float k1 = smoothstep(120.0, 25.0, fw), k2 = smoothstep(40.0, 8.0, fw);
        #define TH(q) (noise3((q) * 0.022) * 0.65 + noise3((q) * 0.067 + 3.1) * 0.35 * k2)
        float h = TH(P);
        const float e = 3.0;
        vec3 g = vec3(TH(P + vec3(e, 0.0, 0.0)) - h, TH(P + vec3(0.0, e, 0.0)) - h, TH(P + vec3(0.0, 0.0, e)) - h) / e;
        g -= N0 * dot(N0, g);
        tRockN = normalize(N0 - g * 38.0 * k1);
        float crevice = smoothstep(0.62, 0.3, h) * k1;
        vec3 tone = vec3(1.0);
        if (uRockTex > 0.5) {
          // photographed rock: gullies on the near ranges, buttresses (4× the tile) on the far chain
          vec3 bw = pow(abs(tRockN), vec3(4.0));
          bw /= bw.x + bw.y + bw.z;
          float far = smoothstep(1800.0, 3600.0, length(P - cameraPosition));
          vec3 tsum = vec3(0.0), nsum = vec3(0.0);
          rockTriplanar(P, tRockN, bw, uRockTile, 1.0 - far, tsum, nsum);
          rockTriplanar(P, tRockN, bw, uRockTile * 0.25, far, tsum, nsum);
          tone = mix(vec3(1.0), tsum, 0.85);
          tRockN = normalize(nsum);
        }
        float n = noise2(P.xz * 0.006) * 0.6 + noise2(P.xz * 0.025) * 0.4;
        float line = mix(1250.0, 30.0, uMtnSnow) + (n - 0.5) * 160.0;
        float slope = smoothstep(0.42, 0.8, tRockN.y);
        // snow fills the gullies first and is blown off the ridges
        float snow = smoothstep(line, line + 60.0, P.y + crevice * 40.0) * slope * step(0.02, uMtnSnow);
        vec3 rock = uMtnTint * diffuseColor.rgb * tone * (0.78 + 0.34 * (1.0 - crevice) + 0.12 * (h - 0.5));
        diffuseColor.rgb = mix(rock, vec3(0.9, 0.92, 0.96) * (0.92 + 0.08 * h), snow);
      } else {
        // Real landscape (applyDem). Shape and shading come from the elevation data: the detail map
        // carries the ~25 m normals (ravines, lava ridges, the crater) and the concavity; materials
        // follow real elevation like the actual mountain: dark forest up to the treeline (higher in
        // the gullies), fields on the flat lowlands, bare rock above, reddish-brown scoria on the
        // upper cone, and snow above the weather's snow line, reaching down the gullies in fingers.
        vec3 L = vTLocal;
        vec3 N0 = normalize(vTNormal);
        float e = L.y * uDemElev.x + uDemElev.y + dot(L.xz, L.xz) * uDemElev.z;
        vec2 duv = vec2((L.x - uDemRect.x) / (uDemRect.y - uDemRect.x), 1.0 - (L.z - uDemRect.z) / (uDemRect.w - uDemRect.z));
        float inR = smoothstep(0.0, 0.03, min(min(duv.x, 1.0 - duv.x), min(duv.y, 1.0 - duv.y)));
        vec3 det = texture2D(uDemDetail, clamp(duv, 0.0, 1.0)).rgb;
        vec3 nl = vec3(det.r * 2.0 - 1.0, 0.0, det.g * 2.0 - 1.0);
        nl.y = sqrt(max(1.0 - nl.x * nl.x - nl.z * nl.z, 0.02));
        float cs = cos(uTerrainSwing), sn = sin(uTerrainSwing);
        tRockN = normalize(mix(N0, vec3(cs * nl.x + sn * nl.z, nl.y, -sn * nl.x + cs * nl.z), inR));
        float cv = (det.b * 2.0 - 1.0) * inR;
        tCv = max(cv, 0.0);
        float slope = tRockN.y;
        float n1 = noise2(L.xz * 0.0035), n2 = noise2(L.xz * 0.017 + 3.0), n3 = noise2(L.xz * 0.06 + 7.0);
        float tree = 2350.0 + (n1 - 0.5) * 320.0 + cv * 180.0;
        float forest = smoothstep(tree + 140.0, tree - 140.0, e) * smoothstep(0.62, 0.85, slope);
        float field = smoothstep(1150.0, 950.0, e) * smoothstep(0.97, 0.995, slope) * smoothstep(0.35, 0.65, n2);
        vec3 cForest = vec3(0.03, 0.042, 0.03) * (0.75 + 0.5 * n3);
        vec3 cField = vec3(0.07, 0.068, 0.045) * (0.85 + 0.3 * n3);
        vec3 cRock = mix(vec3(0.085, 0.08, 0.075), vec3(0.12, 0.078, 0.06), smoothstep(1800.0, 2600.0, e))
                   * (0.8 + 0.25 * n2 + 0.15 * (n3 - 0.5));
        vec3 alb = mix(cRock, cForest, forest);
        alb = mix(alb, cField, field * (1.0 - 0.5 * forest));
        alb *= 1.0 - 0.18 * max(cv, 0.0) + 0.06 * max(-cv, 0.0);   // hollows hold shadow, ridges catch light
        float line = mix(3650.0, 1250.0, uMtnSnow) + (n1 - 0.5) * 260.0 + (n2 - 0.5) * 120.0 - cv * 520.0;
        line = mix(line, 880.0 + (n1 - 0.5) * 200.0, uTSnowCover);   // fresh snow down to the lake
        float snow = smoothstep(line, line + 140.0, e) * smoothstep(0.32, 0.62, slope);
        snow *= mix(1.0, 0.55, forest * (1.0 - smoothstep(line + 200.0, line + 600.0, e)));   // trees poke through
        diffuseColor.rgb = mix(alb * (uMtnTint / 0.35), vec3(0.86, 0.88, 0.92) * (0.94 + 0.06 * n3), snow);
        tSnow = snow;
      }`);
    s = inject(s, '#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tRockN, 0.0)).xyz);');
    s = inject(s, '#include <aomap_fragment>', /* glsl */ `
      if (uDem > 0.5) {
        // forest and rough volcanic ground barely mirror the sky: without this, the grazing view of
        // distant slopes picks up a pale sheen that flattens the whole mountain toward the sky
        reflectedLight.indirectSpecular *= 0.2;
        reflectedLight.directSpecular *= 0.3;
        reflectedLight.indirectDiffuse *= 1.0 - 0.35 * tCv;   // ravines see less of the sky
      }`);
    // at night the moon stands behind the mountains (it is in frame, to the south): snowfields still
    // catch the open sky overhead, so the cap reads as a pale shape instead of vanishing
    s = inject(s, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += (uZenith + uHorizon) * 0.5 * tSnow * uNight * 0.9;');
    return s;
  },
};

const MIST_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const MIST_FRAG = /* glsl */ `
${ATMOS_PRELUDE}
uniform float uMistSheets;
uniform float uSeed;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vWorld.x * 0.0022 + uTime * 0.004 + uSeed, vUv.y * 2.2);
  float n = fbm2(p * vec2(1.0, 1.4) + vec2(0.0, uSeed), 5);
  float body = smoothstep(0.32, 0.72, n);
  float vert = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
  float side = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float a = body * vert * side * uMistSheets;
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 col = fogColorDir(rd) * 1.04;
  gl_FragColor = vec4(col * a, a);
}`;

export class Terrain {
  readonly group = new Group();
  readonly mesh: Mesh;
  readonly mist: Mesh[] = [];

  constructor() {
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
    applyPatches(mat, [atmospherePatch, terrainPatch]);
    this.mesh = new Mesh(buildGeometry(), mat);
    this.mesh.name = 'terrain';
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    // layered valley mist between the ranges (fog / rain / snow)
    // a thin band on the flat, then in the valleys behind the foothills and the mid range, so each
    // range's foot sinks into mist while the range in front stays dark
    const sheets: [number, number, number][] = [[800, 26, 0.3], [1900, 140, 1.7], [4300, 360, 3.1]];
    for (const [dist, height, seed] of sheets) {
      const geo = new PlaneGeometry(dist * 3.2, height, 1, 1);
      geo.translate(0, height * 0.5 - 4, 0);
      const m = new ShaderMaterial({
        vertexShader: MIST_VERT, fragmentShader: MIST_FRAG,
        uniforms: { ...atmos, ...terrainUniforms, uSeed: { value: seed } },
        transparent: true, depthWrite: false, premultipliedAlpha: true, side: DoubleSide,
      });
      const sheet = new Mesh(geo, m);
      sheet.position.set(0, 0, -dist);
      sheet.name = 'mist-sheet';
      sheet.renderOrder = 2;
      this.mist.push(sheet);
      this.group.add(sheet);
    }
  }

  /**
   * Replace the procedural ranges with a real landscape (see `TerrainDem`): the mesh is rebuilt on
   * the DEM's polar grid and the shader switches to the elevation-driven materials.
   */
  applyDem(heights: Uint16Array, cfg: TerrainDem, detail: Texture) {
    const { az, rad } = cfg;
    if (heights.length !== (az + 1) * (rad + 1)) throw new Error(`terrain heights: expected ${(az + 1) * (rad + 1)} samples, got ${heights.length}`);
    const geo = buildGeometry(az, rad, cfg.r0, cfg.r1, (i, j) => {
      const h = heights[j * (az + 1) + i] / 20 - 50;
      // flat lowlands sink under the ground plane (the lake / plain) so they never z-fight with it
      return h - 15 * (1 - smooth(4, 14, h));
    });
    const old = this.mesh.geometry;
    this.mesh.geometry = geo;
    old.dispose();
    const u = terrainUniforms;
    u.uDemDetail.value = detail;
    u.uDemRect.value.set(cfg.detail.x0, cfg.detail.x1, cfg.detail.z0, cfg.detail.z1);
    u.uDemElev.value.set(1 / (cfg.scale * cfg.vex), cfg.base, 1 / (2 * cfg.earthRadius * cfg.scale * cfg.scale), 0);
    u.uDem.value = 1;
  }

  setLayers(enable: (o: Mesh) => void) {
    enable(this.mesh);
    this.mist.forEach(enable);
  }
}
