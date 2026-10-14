import {
  BufferAttribute, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, Color, CustomBlending, CylinderGeometry, DoubleSide,
  Group, LineCurve3, Mesh, MeshPhysicalMaterial, OneFactor, OneMinusSrcAlphaFactor, Quaternion, SphereGeometry,
  TubeGeometry, Vector3, type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyPatches, inject, type ShaderPatch } from '../../core/patch';
import { NOISE_GLSL } from '../../core/noise';
import { atmospherePatch } from '../../world/atmosphere';
import { UMBRELLA_GEOMETRY as G, type UmbrellaPose, type UmbrellaVisual } from '../types';

const N = G.ribs;
const R = G.radius;
const CY = G.apex - G.radius;   // canopy sphere centre on the shaft (umbrella local space)
const TAU = Math.PI * 2;
const SCALLOP = 0.045;          // how far the hem lifts between two rib tips (rad)
const RUNNER_Y = 1.6;           // runner height on the shaft when open
const HANDLE = 0.5;             // straight handle, its rounded end on the ground
const HEM = 0.026;              // folded hem width
const f = (v: number) => v.toFixed(5);

/** 0 on a rib, 0.5 in the middle of a gore. */
const gore = (phi: number) => {
  const x = (phi / TAU) * N;
  return x - Math.floor(x);
};
/** Scalloped hem: the panel edge lifts between the rib tips. */
const rimTheta = (phi: number) => G.theta - SCALLOP * Math.pow(Math.sin(gore(phi) * Math.PI), 1.3);

/**
 * Point on the canopy at fraction `t` from apex (0) to hem (1). The panels are tensioned between
 * the ribs, so the dome is an octagon in section (flat-ish gores), rounder near the apex.
 */
function canopyPoint(t: number, phi: number, inset = 0): Vector3 {
  const w = (gore(phi) - 0.5) * (TAU / N);
  const flat = Math.cos(Math.PI / N) / Math.cos(w);
  const k = 0.55 * Math.min(1, t * 2.2);
  const r = R * (1 + (flat - 1) * k) - inset;
  const th = t * rimTheta(phi);
  return new Vector3(Math.sin(th) * Math.cos(phi) * r, CY + Math.cos(th) * r, Math.sin(th) * Math.sin(phi) * r);
}

/** Canopy as a grid over t ∈ [t0(phi), t1] with finite-difference normals (uv = phi, t). */
function domeGeometry(seg: number, rings: number, t0: (phi: number) => number, t1: number, inset: number): BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const e = 1e-3;
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * TAU;
      const ta = t0(phi);
      const t = ta + (t1 - ta) * (j / rings);
      const p = canopyPoint(t, phi, inset);
      // outward normal from the surface tangents (finite differences: no seam at phi = 0)
      const tt = Math.max(t, e);
      const dT = canopyPoint(Math.min(tt + e, 1), phi, inset).sub(canopyPoint(Math.max(tt - e, 0), phi, inset));
      const dP = canopyPoint(tt, phi + e, inset).sub(canopyPoint(tt, phi - e, inset));
      const n = new Vector3().crossVectors(dP, dT).normalize();
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uv.push(i / seg, t);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, d = a + seg + 1, c = d + 1;
      idx.push(a, b, d, b, c, d);   // counter-clockwise seen from outside, matching the normals
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

/** Bake a +Y-aligned geometry onto `dir`, placed at `at`. */
function along(g: BufferGeometry, at: Vector3, dir: Vector3): BufferGeometry {
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()));
  return g.translate(at.x, at.y, at.z);
}

const ATMOS_LINE = 'gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);';
// the air in front of a premultiplied layer may only add light in proportion to what the layer
// covers: applyAtmosphere(c) = c·T + A, and we want c·T + A·alpha (otherwise each wall of the
// dome adds a full extra layer of fog and mist, and the clear dome turns milky)
const PREMULT_ATMOS = /* glsl */ `
  gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld)
    - applyAtmosphere(vec3(0.0), vAtmosWorld) * (1.0 - gl_FragColor.a);`;

const CANOPY_GLSL = /* glsl */ `
${NOISE_GLSL}
uniform float uCanopyWet;
varying vec3 vCanopyLocal;
varying float vCanopyT;
varying vec3 vCanopyBX;
varying vec3 vCanopyBY;
varying vec3 vCanopyBZ;
// canopy state shared by the injected chunks: milky scatter, bead coverage / dark rims / lens glow
float cMilk; float cBead; float cDark; float cLens; vec3 cSkyUp;

// Water sheets running down the gores: stretched along the meridians. cos/sin of the azimuth
// keep it seamless all the way round.
float canopySheet(float phi, float th, float drift) {
  return noise3(vec3(cos(phi) * 24.0, th * 5.4 - drift, sin(phi) * 24.0));
}

// One layer of water beads: a jittered grid of spheres in canopy space; a bead is where the film
// cuts one of them, so sizes vary naturally. Each bead is a little lens — dark rim (total internal
// reflection), its lower half showing the bright sky above — and tilts the normal like a cap.
// Edges are antialiased by the pixel footprint and sub-pixel beads fade out instead of shimmering.
void beadLayer(vec3 lp, vec3 nl, vec3 upT, float sc, float keep, vec2 rr, float seed, float fw,
               inout float cov, inout float rim, inout float lens, inout vec3 slope) {
  vec3 q = lp * sc;
  vec3 id = floor(q);
  vec3 h = hash33(id + seed);
  if (h.x > keep) return;
  float r = mix(rr.x, rr.y, h.y * h.y);
  vec3 c = id + r + (1.0 - 2.0 * r) * hash33(id + seed + 17.0);
  vec3 d = q - c;
  float dn = dot(d, nl);
  float rs2 = r * r - dn * dn;
  if (rs2 <= 0.0) return;
  float rs = sqrt(rs2);
  vec3 dt = d - nl * dn;
  float x = length(dt) / rs;
  float px = fw * sc;
  float m = (1.0 - smoothstep(1.0 - px / rs, 1.0 + px / rs, x)) * smoothstep(0.5, 1.5, rs / px);
  if (m <= 0.0) return;
  cov = max(cov, m);
  rim = max(rim, m * smoothstep(0.5, 0.95, x));
  lens = max(lens, m * smoothstep(-0.1, 0.6, -dot(dt / rs, upT)) * (1.0 - x * x));
  slope += dt / rs * 0.9 * m;
}
`;

/**
 * Clear vinyl and the rain on it, drawn as a premultiplied layer over the scene (reflected and
 * scattered light + background × (1 − cover)) instead of three's transmission, which would
 * re-render the scene at half resolution and blur everything behind the dome. The film has soft
 * fold creases and a white folded hem and seams; in the rain it carries running water sheets and
 * two layers of beads, larger and denser toward the hem where the water gathers.
 */
function canopyWaterPatch(wet: { value: number }): ShaderPatch {
  return {
    key: 'umbrella-water',
    uniforms: { uCanopyWet: wet },
    vertex: (s) => {
      s = inject(s, '#include <common>', 'varying vec3 vCanopyLocal;\nvarying float vCanopyT;\nvarying vec3 vCanopyBX;\nvarying vec3 vCanopyBY;\nvarying vec3 vCanopyBZ;');
      // normalMatrix columns: canopy-space axes in view space, to turn bead / crease tilts into normals
      s = inject(s, '#include <begin_vertex>', 'vCanopyLocal = position;\nvCanopyT = uv.y;\nvCanopyBX = normalMatrix[0];\nvCanopyBY = normalMatrix[1];\nvCanopyBZ = normalMatrix[2];');
      return s;
    },
    fragment: (s) => {
      s = inject(s, '#include <common>', CANOPY_GLSL);
      s = inject(s, '#include <normal_fragment_maps>', /* glsl */ `
        cMilk = 0.02; cBead = 0.0; cDark = 0.0; cLens = 0.0;
        {
          vec3 lp = vCanopyLocal;
          vec3 nl = normalize(lp - vec3(0.0, ${f(CY)}, 0.0));
          float th = acos(clamp(nl.y, -1.0, 1.0));
          float phi = atan(lp.z, lp.x);
          mat3 L2V = mat3(normalize(vCanopyBX), normalize(vCanopyBY), normalize(vCanopyBZ));
          vec3 upL = transpose(L2V) * (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
          vec3 upT = upL - nl * dot(upL, nl);
          float fw = max(length(fwidth(lp)), 1e-5);
          vec3 sl = vec3(0.0);
          {
            // vinyl is never optically flat: soft creases left by folding
            vec3 p = lp * 2.6;
            const float e = 0.05;
            float n0 = noise3(p);
            vec3 g = (vec3(noise3(p + vec3(e, 0.0, 0.0)), noise3(p + vec3(0.0, e, 0.0)), noise3(p + vec3(0.0, 0.0, e))) - n0) / e;
            sl -= (g - nl * dot(g, nl)) * 0.035;
          }
          if (uCanopyWet > 0.01) {
            float w = uCanopyWet;
            float drift = uTime * 0.05;
            const float da = 0.004;
            float s0 = canopySheet(phi, th, drift), s1 = canopySheet(phi + da, th, drift);
            sl += vec3(-sin(phi), 0.0, cos(phi)) * ((s1 - s0) / (da * 24.0)) * 0.06 * w;
            // the film of water: sheets along the gores and irregular wet patches between them
            float patchy = noise3(lp * 7.0 + 2.3) * 0.65 + noise3(lp * 19.0) * 0.35;
            cMilk += (smoothstep(0.4, 0.85, s0) * 0.1 + smoothstep(0.45, 0.8, patchy) * 0.07) * w;
            float hemw = smoothstep(0.65, 1.0, vCanopyT);
            float cov = 0.0, rim = 0.0, lens = 0.0;
            vec3 bs = vec3(0.0);
            beadLayer(lp, nl, upT, 26.0, 0.75, vec2(0.18, 0.36), 0.0, fw, cov, rim, lens, bs);
            beadLayer(lp, nl, upT, 11.0, 0.45 + 0.4 * hemw, vec2(0.15, 0.3 + 0.08 * hemw), 41.0, fw, cov, rim, lens, bs);
            cBead = cov * w; cDark = rim * w; cLens = lens * w;
            sl += bs * w;
            cMilk += 0.04 * w;   // micro-droplets below a pixel: a faint wet haze
          }
          // folded hem and the welded seams over the ribs read as thin white lines
          float tw = fwidth(vCanopyT);
          float hw = ${f(HEM / (R * G.theta))};
          cMilk += smoothstep(1.0 - hw - tw, 1.0 - hw + tw, vCanopyT) * 0.3;
          float gr = fract(phi / 6.2831853 * ${N}.0);
          float seam = min(gr, 1.0 - gr) * ${f((TAU / N) * R)} * sin(th);
          cMilk += (1.0 - smoothstep(0.004, 0.004 + fw, seam)) * 0.12 * smoothstep(0.08, 0.2, th);
          normal = normalize(normal + faceDirection * (L2V * sl));
        }`);
      s = inject(s, '#include <roughnessmap_fragment>', 'roughnessFactor = mix(roughnessFactor, 0.02, cBead);');
      // the inside of the far wall mirrors the umbrella's dim, sheltered interior, not the open sky
      // the environment probe saw (it was captured without the umbrella)
      s = inject(s, '#include <aomap_fragment>', 'if (!gl_FrontFacing) { reflectedLight.indirectSpecular *= 0.3; reflectedLight.indirectDiffuse *= 0.7; }');
      s = inject(s, '#include <emissivemap_fragment>', /* glsl */ `
        {
          // light from the overcast above (the probe's upper hemisphere): under cloud the sky
          // overhead is brighter than the low sky seen behind the umbrella, so the wet film and its
          // beads read lighter than the background, as they do in the rain
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          #ifdef USE_ENVMAP
            cSkyUp = getIBLIrradiance(upV) * RECIPROCAL_PI;
          #else
            cSkyUp = uZenith;
          #endif
          vec3 V = normalize(vViewPosition);
          float rim = pow(1.0 - abs(dot(normal, V)), 3.0);
          // a bead mirrors the bright sky overhead in a small glint and refracts it in its lower half
          float glint = cBead * smoothstep(0.75, 0.97, dot(reflect(-V, normal), upV));
          totalEmissiveRadiance += cSkyUp * (rim * 0.04 + cLens * 1.1 + cBead * 0.15 + glint * 2.2);
        }`);
      s = inject(s, '#include <opaque_fragment>', /* glsl */ `
        {
          #ifdef CANOPY_DEPTH
            // depth-only pass: beads, hem and seams are surfaces at the umbrella's distance, so the
            // depth of field keeps them in focus (the rest of the clear film takes the background's)
            if (cBead < 0.35 && cMilk < 0.2) discard;
          #endif
          float nv = abs(dot(normal, normalize(vViewPosition)));
          float refl = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
          float a = clamp(refl * 0.85 + cMilk + cDark * 0.45 + cLens * 0.25, 0.0, 1.0);
          // scattered light (white film lit by sky and key light); forward scattering through the wet
          // film favours the bright light above, so it reads lighter than the low sky behind it
          gl_FragColor = vec4((totalDiffuse + cSkyUp * 0.5) * cMilk * 1.4 + totalSpecular + totalEmissiveRadiance, a);
        }`, 'replace');
      s = inject(s, ATMOS_LINE, PREMULT_ATMOS, 'replace');
      return s;
    },
  };
}

/** A water drop hanging from a rib tip: clear, rimmed by reflection, glowing with refracted sky. */
const dropPatch: ShaderPatch = {
  key: 'umbrella-drop',
  fragment: (s) => {
    s = inject(s, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += (uZenith * 0.6 + uHorizon * 0.4) * 0.4;');
    s = inject(s, '#include <opaque_fragment>', /* glsl */ `
      {
        float nv = abs(dot(normal, normalize(vViewPosition)));
        gl_FragColor = vec4(totalSpecular + totalEmissiveRadiance, clamp(0.3 + 0.7 * pow(1.0 - nv, 3.0), 0.0, 1.0));
      }`, 'replace');
    s = inject(s, ATMOS_LINE, PREMULT_ATMOS, 'replace');
    return s;
  },
};

const PREMULT = {
  transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

/**
 * Clear stick umbrella, built like the classic vinyl one: tensioned octagonal PVC canopy with a
 * scalloped, folded hem; eight satin-silver ribs with white tip caps, stretchers on a white runner;
 * top notch, cap and a silver ferrule; a chrome shaft and a straight white handle that rests on the
 * ground. In the rain a drop swells and falls at every rib tip.
 */
export class ProceduralUmbrella implements UmbrellaVisual {
  readonly root = new Group();
  readonly wet = { value: 1 };
  private spinGroup = new Group();
  private materials: Material[] = [];
  private meshes: Mesh[] = [];
  private drops: Mesh[] = [];
  private tips: Vector3[] = [];
  private time = 0;
  private q = new Quaternion();
  private qs = new Quaternion();
  private yAxis = new Vector3(0, 1, 0);
  private yNeg = new Vector3(0, -1, 0);
  private axis = new Vector3();
  private down = new Vector3();

  constructor() {
    const vinyl = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.045, ior: 1.5, metalness: 0, specularIntensity: 1, side: DoubleSide, ...PREMULT });
    applyPatches(vinyl, [atmospherePatch, canopyWaterPatch(this.wet)]);
    const water = new MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, ior: 1.33, ...PREMULT });
    applyPatches(water, [atmospherePatch, dropPatch]);
    const silver = new MeshPhysicalMaterial({ color: new Color().setRGB(0.84, 0.83, 0.8), metalness: 0.9, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.2 });
    const chrome = new MeshPhysicalMaterial({ color: new Color().setRGB(0.92, 0.92, 0.93), metalness: 1, roughness: 0.16 });
    const plastic = new MeshPhysicalMaterial({ color: new Color().setRGB(0.88, 0.89, 0.9), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.18 });
    for (const m of [silver, chrome, plastic]) applyPatches(m, [atmospherePatch]);
    this.materials.push(vinyl, water, silver, chrome, plastic);
    const add = (parent: Group, m: Mesh, shadow = true) => { m.castShadow = shadow; parent.add(m); return m; };

    // ---- canopy (spins with the frame)
    const canopy = new Mesh(domeGeometry(N * 24, 48, () => 0, 1, 0), vinyl);
    canopy.name = 'umbrella-canopy';
    add(this.spinGroup, canopy, false);
    // depth for the water and hem only (drawn in the opaque pass, before the film itself)
    const filmDepth = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.045, side: DoubleSide, colorWrite: false });
    filmDepth.defines = { CANOPY_DEPTH: 1 };
    applyPatches(filmDepth, [atmospherePatch, canopyWaterPatch(this.wet)]);
    this.materials.push(filmDepth);
    add(this.spinGroup, new Mesh(canopy.geometry, filmDepth), false).name = 'umbrella-canopy-depth';

    // ---- frame: ribs, stretchers and their joints (silver); tip caps, notch, runner (white plastic)
    const metal: BufferGeometry[] = [], fittings: BufferGeometry[] = [];
    for (let k = 0; k < N; k++) {
      const phi = (k / N) * TAU;
      const pts = Array.from({ length: 28 }, (_, i) => canopyPoint(0.025 + 0.975 * (i / 27), phi, 0.017));
      metal.push(new TubeGeometry(new CatmullRomCurve3(pts), 80, 0.011, 8, false));
      const end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 3]).normalize();
      fittings.push(along(new CapsuleGeometry(0.015, 0.05, 4, 12), end.clone().addScaledVector(dir, 0.02), dir));
      this.tips.push(end.clone().addScaledVector(dir, 0.055));
      const out = new Vector3(Math.cos(phi), 0, Math.sin(phi));
      const a = new Vector3(0, RUNNER_Y + 0.05, 0).addScaledVector(out, 0.036);
      const b = canopyPoint(0.42, phi, 0.03);
      metal.push(new TubeGeometry(new LineCurve3(a, b), 10, 0.0075, 8, false));
      metal.push(new SphereGeometry(0.014, 12, 8).translate(b.x, b.y, b.z));
    }
    metal.push(new CylinderGeometry(0.009, 0.013, 0.2, 12).translate(0, G.apex + 0.11, 0));   // ferrule
    fittings.push(
      new CylinderGeometry(0.046, 0.03, 0.07, 20).translate(0, G.apex - 0.05, 0),     // top notch, under the vinyl
      new CylinderGeometry(0.05, 0.05, 0.014, 24).translate(0, G.apex + 0.007, 0),    // cap over the vinyl
      new SphereGeometry(0.017, 14, 10).translate(0, G.apex + 0.215, 0),               // ferrule tip
      new CylinderGeometry(0.034, 0.034, 0.13, 20).translate(0, RUNNER_Y, 0),          // runner
      new CylinderGeometry(0.042, 0.042, 0.03, 20).translate(0, RUNNER_Y + 0.05, 0),
    );
    add(this.spinGroup, new Mesh(mergeGeometries(metal), silver));
    add(this.spinGroup, new Mesh(mergeGeometries(fittings), plastic));
    [...metal, ...fittings].forEach((g) => g.dispose());

    // ---- hanging drops at the rib tips (posed every frame so they point down)
    const dropGeo = new SphereGeometry(1, 16, 12);
    for (let k = 0; k < N; k++) {
      const d = add(this.spinGroup, new Mesh(dropGeo, water), false);
      d.renderOrder = 1;
      this.drops.push(d);
    }

    // ---- chrome shaft with a collar, and the straight handle (do not spin)
    const shaftBot = -G.below + HANDLE, shaftTop = G.apex - 0.08, shaftLen = shaftTop - shaftBot;
    add(this.root, new Mesh(mergeGeometries([
      new CylinderGeometry(0.02, 0.02, shaftLen, 16).translate(0, shaftBot + shaftLen / 2, 0),
      new CylinderGeometry(0.038, 0.036, 0.03, 20).translate(0, shaftBot + 0.015, 0),
    ]), chrome));
    add(this.root, new Mesh(new CapsuleGeometry(0.033, HANDLE - 0.066, 8, 20).translate(0, -G.below + HANDLE / 2, 0), plastic));

    this.root.add(this.spinGroup);
    this.root.name = 'umbrella';
    this.root.visible = false;
    this.root.traverse((o) => { if ((o as Mesh).isMesh) this.meshes.push(o as Mesh); });
  }

  forEachMesh(fn: (m: Mesh) => void) { this.meshes.forEach(fn); }

  update(pose: UmbrellaPose, dt = 1 / 60) {
    this.root.visible = pose.visible && pose.open > 0.01;
    if (!this.root.visible) return;
    this.root.position.fromArray(pose.anchor);
    this.axis.fromArray(pose.axis);
    this.q.setFromUnitVectors(this.yAxis, this.axis);
    this.root.quaternion.copy(this.q);
    this.root.scale.setScalar(pose.open);
    this.spinGroup.rotation.y = pose.spin;

    // each tip drop swells for about a second and lets go; world "down" in canopy space
    this.time += dt;
    const w = this.wet.value;
    this.qs.setFromAxisAngle(this.yAxis, pose.spin).premultiply(this.q).invert();
    this.down.copy(this.yNeg).applyQuaternion(this.qs);
    for (let k = 0; k < this.drops.length; k++) {
      const d = this.drops[k];
      const ph = (this.time * (0.75 + 0.09 * ((k * 3) % 5)) + k * 0.618) % 1;
      const sz = w * (0.45 + 0.55 * Math.pow(ph, 0.7));
      d.visible = sz > 0.05;
      d.scale.set(0.004 + 0.014 * sz, 0.006 + 0.022 * sz, 0.004 + 0.014 * sz);
      d.quaternion.setFromUnitVectors(this.yNeg, this.down);
      d.position.copy(this.tips[k]).addScaledVector(this.down, d.scale.y * 0.7);
    }
  }

  dispose() {
    this.meshes.forEach((m) => m.geometry.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
