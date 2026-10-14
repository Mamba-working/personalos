import { Color, Vector3, Vector4, type IUniform } from 'three';
import { inject, type ShaderPatch } from '../../core/patch';
import { NOISE_GLSL } from '../../core/noise';
import { FACE_GLSL, createFaceUniforms } from './faceGlsl';

/**
 * Character surface effects for any MeshStandard/Physical material:
 *   dent (vertex), procedural face decal, wetness + droplets, snow-cap rim shadow,
 *   soft subsurface / back-light rim and a gentle camera-side key light.
 *
 * Works on the procedural sphere and on GLTF meshes: the "body space" used for the
 * face, dent and snow is `(position - uBodyCenter) / uBodyRadius` in object space.
 */
export function createSurfaceUniforms() {
  return {
    ...createFaceUniforms(),
    uDent: { value: new Vector4(0, 0, 1, 0) },        // body-local dir, amount
    uSnowCap: { value: new Vector4(0, 1, 0, 0) },     // body-local dir, amount
    uWet: { value: 0 },
    // portrait key on the character: world direction toward the light and its irradiance (App aims
    // it ~70° to the side of the view, on the sun's side, so the ball shows a lit side and a core shadow)
    uKeyDir: { value: new Vector3(-0.63, 0.57, 0.52).normalize() },
    uKeyCol: { value: new Color(0, 0, 0) },
    // soft camera-side bounce that keeps the shadow side from going dead
    uFillDir: { value: new Vector3(-0.4, 0.5, 0.75).normalize() },
    uFillCol: { value: new Color(0.13, 0.125, 0.12) },
    // sky ambient/reflection scale on the body (three ignores envMapIntensity with scene.environment)
    uEnvGain: { value: 1 },
    uBodyCenter: { value: new Vector3() },
    uBodyRadius: { value: 1 },
  } satisfies Record<string, IUniform>;
}
export type SurfaceUniforms = ReturnType<typeof createSurfaceUniforms>;

export const SNOW_GLSL = /* glsl */ `
uniform vec4 uSnowCap;
// a ragged edge: broad scallops plus small chunks that break off the rim
float snowEdge(vec3 lp) {
  float edgeN = (noise3(lp * 5.0 + 2.3) - 0.5) * 0.24 + (noise3(lp * 13.0 + 7.1) - 0.5) * 0.12;
  return dot(lp, uSnowCap.xyz) - (mix(0.93, 0.4, uSnowCap.w) + edgeN);
}
// thickness: a pile of soft clumps with a lip at the edge (it rises quickly, so the rim overhangs)
float snowThick(vec3 lp) {
  if (uSnowCap.w <= 0.001) return 0.0;
  float m = smoothstep(0.0, 0.07, snowEdge(lp));
  float lumps = 0.62 + 0.55 * noise3(lp * 8.0 + 1.1) + 0.38 * noise3(lp * 21.0);
  return uSnowCap.w * 0.22 * m * lumps;
}
`;

export interface SurfaceOptions {
  face: boolean;   // draw the procedural eyes (off when a model brings its own face)
  dent: boolean;   // vertex dent on poke
}

export function surfacePatch(u: SurfaceUniforms, opt: SurfaceOptions): ShaderPatch {
  return {
    key: `ballsurface-${opt.face ? 'f' : ''}${opt.dent ? 'd' : ''}`,
    uniforms: u,
    vertex: (s) => {
      s = inject(s, '#include <common>', /* glsl */ `
        uniform vec4 uDent;
        uniform vec3 uBodyCenter;
        uniform float uBodyRadius;
        varying vec3 vBodyLocal;
        varying float vBodyWorldY;
        varying vec3 vBodyX; varying vec3 vBodyY; varying vec3 vBodyZ;`);
      s = inject(s, '#include <begin_vertex>', /* glsl */ `
        vBodyLocal = (position - uBodyCenter) / uBodyRadius;
        ${opt.dent ? `{
          vec3 bd = normalize(vBodyLocal);
          transformed -= objectNormal * uDent.w * uBodyRadius * exp(-(1.0 - dot(bd, uDent.xyz)) * 9.0);
        }` : ''}
        vBodyX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vBodyY = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vBodyZ = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        vBodyWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`);
      return s;
    },
    fragment: (s) => {
      s = inject(s, '#include <common>', /* glsl */ `
        ${NOISE_GLSL}
        ${opt.face ? FACE_GLSL : ''}
        ${SNOW_GLSL}
        uniform float uWet;
        uniform vec3 uKeyDir;
        uniform vec3 uKeyCol;
        uniform vec3 uFillDir;
        uniform vec3 uFillCol;
        uniform float uEnvGain;
        varying vec3 vBodyLocal;
        varying float vBodyWorldY;
        varying vec3 vBodyX; varying vec3 vBodyY; varying vec3 vBodyZ;
        vec3 bFace; float bDrop; vec3 bDropN;`);
      s = inject(s, '#include <color_fragment>', /* glsl */ `
        {
          vec3 lp = normalize(vBodyLocal);
          ${opt.face ? `
          float aa = max(length(fwidth(lp)) * 1.2, 0.004);
          bFace = faceMask(lp, aa);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.66, 0.64), bFace.z * uEyeB.w * 0.55);
          diffuseColor.rgb *= 1.0 - bFace.y * 0.22;` : 'bFace = vec3(0.0);'}
          diffuseColor.rgb *= mix(1.0, 0.9, uWet);
          {
            // the fine, slightly uneven grain of a matte glaze (±2 %), faded before it gets sub-pixel
            float fwl = length(fwidth(lp));
            float gr = (noise3(lp * 55.0) - 0.5) * smoothstep(0.03, 0.012, fwl)
                     + (noise3(lp * 140.0 + 7.0) - 0.5) * 0.6 * smoothstep(0.012, 0.005, fwl);
            diffuseColor.rgb *= 1.0 + gr * 0.06;
          }
          // shade the shell just below an overhanging snow cap
          if (uSnowCap.w > 0.02) {
            float se = snowEdge(lp);
            diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(-0.16, 0.0, se) * smoothstep(0.04, -0.02, se) * smoothstep(0.02, 0.2, uSnowCap.w);
          }
          // rain beading on the shell
          bDrop = 0.0; bDropN = vec3(0.0);
          if (uWet > 0.02) {
            vec3 q = lp * 15.0;
            vec3 id = floor(q);
            vec3 hh = hash33(id);
            vec3 dv = fract(q) - (0.25 + 0.5 * hh);
            float rr = 0.1 + 0.16 * hh.y;
            bDrop = smoothstep(rr, rr * 0.55, length(dv)) * step(0.5, hh.x) * uWet;
            bDropN = dv;
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.013, 0.018), bFace.x);
        }`);
      s = inject(s, '#include <roughnessmap_fragment>', /* glsl */ `
        roughnessFactor = mix(roughnessFactor, 0.14, uWet);
        roughnessFactor = mix(roughnessFactor, 0.06, bDrop);
        roughnessFactor = mix(roughnessFactor, 0.9, bFace.x);`);
      s = inject(s, '#include <normal_fragment_maps>', /* glsl */ `
        if (bDrop > 0.0) {
          vec3 dvv = bDropN.x * vBodyX + bDropN.y * vBodyY + bDropN.z * vBodyZ;
          normal = normalize(normal + dvv * bDrop * 1.4);
        }`);
      s = inject(s, '#include <lights_physical_fragment>', /* glsl */ `
        // eyes are matte: no clearcoat, no specular, no sheen, so they never mirror the sky
        material.specularColor *= 1.0 - bFace.x;
        material.specularF90 *= 1.0 - bFace.x;
        #ifdef USE_CLEARCOAT
          material.clearcoat = mix(material.clearcoat, 1.0, bDrop) * (1.0 - bFace.x);
          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.06, bDrop);
        #endif
        #ifdef USE_SHEEN
          material.sheenColor *= 1.0 - bFace.x;
        #endif`);
      s = inject(s, '#include <aomap_fragment>', /* glsl */ `
        {
          // the ground hides the lower hemisphere's sky: darken toward the contact point
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float gao = 1.0 - 0.62 * exp(-max(vBodyWorldY, 0.0) * 2.6) * smoothstep(0.3, -0.85, nW.y);
          float envK = gao * uEnvGain;
          // the glaze keeps more of its sky reflection than the body keeps of the sky's light
          float envS = gao * mix(uEnvGain, 1.0, 0.5);
          reflectedLight.indirectDiffuse *= envK;
          reflectedLight.indirectSpecular *= envS;
          #ifdef USE_CLEARCOAT
            clearcoatSpecularIndirect *= envS;
          #endif
          #ifdef USE_SHEEN
            sheenSpecularIndirect *= envK;
          #endif
          // camera-side fill (a bounce card): not part of the sky probe, so not scaled by uEnvGain
          vec3 fv = normalize((viewMatrix * vec4(uFillDir, 0.0)).xyz);
          float kd = saturate(dot(normal, fv) * 0.6 + 0.4);
          reflectedLight.indirectDiffuse += uFillCol * diffuseColor.rgb * kd * kd * (1.0 - bFace.x) * mix(1.0, gao, 0.5);
        }`);
      s = inject(s, '#include <lights_fragment_end>', /* glsl */ `
        {
          vec3 V = geometryViewDir;
          #if NUM_DIR_LIGHTS > 0
            vec3 Ls = directionalLights[0].direction;
            vec3 Lc = directionalLights[0].color * RECIPROCAL_PI;
            float NoL = dot(normal, Ls);
            float sssBand = smoothstep(-0.4, 0.1, NoL) * (1.0 - smoothstep(0.1, 0.55, NoL));
            // contre-jour rim: a thin hot edge on the sun side when the sun is behind the ball,
            // brighter than the sky it sits against so the silhouette reads
            float edge = 1.0 - max(dot(normal, V), 0.0);
            float back = pow(max(dot(V, -Ls), 0.0), 2.0) * edge * edge * edge * edge * edge * saturate(NoL * 1.6 + 0.35);
            float skin = 1.0 - bFace.x;
            reflectedLight.directDiffuse += Lc * skin * (sssBand * vec3(0.32, 0.17, 0.08) * 0.55 + back * vec3(1.0, 0.86, 0.68) * 2.2);
          #endif
        }
        {
          // Portrait key (studio light on the character, not shadowed): a softly wrapped diffuse
          // falloff into a real core shadow, a warm band at the terminator where light scatters
          // under the glaze, and the glaze's broad satin highlight on the lit shoulder.
          vec3 kv = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
          float nl = dot(normal, kv);
          float wrapD = pow(saturate((nl + 0.45) / 1.45), 1.6);   // long, soft falloff into the core shadow
          float band = smoothstep(-0.25, 0.05, nl) * (1.0 - smoothstep(0.05, 0.45, nl));
          float skinK = 1.0 - bFace.x;
          reflectedLight.directDiffuse += uKeyCol * (wrapD * BRDF_Lambert(material.diffuseColor) + band * vec3(0.05, 0.022, 0.008) * skinK);
          reflectedLight.directSpecular += uKeyCol * saturate(nl) * BRDF_GGX(kv, geometryViewDir, normal, material) * skinK * 2.2;
        }`);
      return s;
    },
  };
}

/** Snow cap shell: displaced outward by the cap thickness, invisible where there is no snow. */
export function snowCapPatch(u: SurfaceUniforms): ShaderPatch {
  return {
    key: 'snowcap',
    uniforms: u,
    vertex: (s) => {
      s = inject(s, '#include <common>', `${NOISE_GLSL}\n${SNOW_GLSL}\nuniform vec4 uDent;\nvarying float vSnowT;\nvarying vec3 vSnowLocal;\nvarying vec3 vSnowBX;\nvarying vec3 vSnowBY;\nvarying vec3 vSnowBZ;`);
      s = inject(s, '#include <beginnormal_vertex>', /* glsl */ `
        vec3 sd0 = normalize(position);
        vec3 st = normalize(abs(sd0.y) < 0.95 ? cross(sd0, vec3(0.0, 1.0, 0.0)) : cross(sd0, vec3(1.0, 0.0, 0.0)));
        vec3 sb = cross(sd0, st);
        float dentAt = uDent.w * exp(-(1.0 - dot(sd0, uDent.xyz)) * 9.0);
        float t0 = snowThick(sd0);
        vec3 p0 = sd0 * (1.0 + t0 * 1.0 - dentAt);
        vec3 d1 = normalize(sd0 + st * 0.02);
        vec3 d2 = normalize(sd0 + sb * 0.02);
        vec3 p1 = d1 * (1.0 + snowThick(d1) - dentAt);
        vec3 p2 = d2 * (1.0 + snowThick(d2) - dentAt);
        vec3 snowN = normalize(cross(p1 - p0, p2 - p0));
        if (dot(snowN, sd0) < 0.0) snowN = -snowN;
        vSnowT = t0;
        vSnowLocal = sd0;
        // body-space axes in view space, to turn grain tilts into view-space normals
        vSnowBX = normalMatrix[0]; vSnowBY = normalMatrix[1]; vSnowBZ = normalMatrix[2];
        objectNormal = snowN;`);
      s = inject(s, '#include <begin_vertex>', 'transformed = p0 * 1.004;');
      return s;
    },
    fragment: (s) => {
      s = inject(s, '#include <common>', /* glsl */ `${NOISE_GLSL}
        uniform vec3 uKeyDir;
        uniform vec3 uKeyCol;
        uniform vec3 uFillCol;
        uniform float uEnvGain;
        varying float vSnowT;
        varying vec3 vSnowLocal;
        varying vec3 vSnowBX;
        varying vec3 vSnowBY;
        varying vec3 vSnowBZ;
        float sCav; mat3 sL2V;
        float snowGrainH(vec3 p) { return noise3(p * 26.0) * 0.55 + noise3(p * 61.0 + 4.0) * 0.45; }`);
      s = inject(s, '#include <clipping_planes_fragment>', 'if (vSnowT < 0.004) discard;');
      s = inject(s, '#include <normal_fragment_maps>', /* glsl */ `
        {
          // granular snow below the mesh resolution: clumps and grains tilt the normal, and the
          // hollows between them see only the (blue) skylight. Faded by the pixel footprint.
          vec3 p = vSnowLocal;
          float k = smoothstep(0.03, 0.006, length(fwidth(p)));
          float h = snowGrainH(p);
          const float e = 0.004;
          vec3 g = (vec3(snowGrainH(p + vec3(e, 0.0, 0.0)), snowGrainH(p + vec3(0.0, e, 0.0)), snowGrainH(p + vec3(0.0, 0.0, e))) - h) / e;
          g -= p * dot(p, g);
          sL2V = mat3(normalize(vSnowBX), normalize(vSnowBY), normalize(vSnowBZ));
          normal = normalize(normal - (sL2V * g) * 0.012 * k);
          sCav = smoothstep(0.5, 0.2, h) * k;
        }`);
      s = inject(s, '#include <aomap_fragment>', /* glsl */ `
        reflectedLight.indirectDiffuse *= min(1.0, uEnvGain + 0.1) * (1.0 - 0.2 * sCav);
        reflectedLight.indirectSpecular *= min(1.0, uEnvGain + 0.1);
        reflectedLight.directDiffuse *= 1.0 - 0.55 * sCav;
        {
          // the portrait key lights the cap as it lights the ball (snow wraps light more softly)
          vec3 kv = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
          reflectedLight.directDiffuse += uKeyCol * saturate((dot(normal, kv) + 0.3) / 1.3) * BRDF_Lambert(material.diffuseColor) * (1.0 - 0.55 * sCav);
        }`);
      s = inject(s, '#include <emissivemap_fragment>', /* glsl */ `
        {
          // fresh snow scatters light inside the pack: a little lift, bluish, less in the hollows
          totalEmissiveRadiance += (uFillCol * 1.1 + vec3(0.08, 0.09, 0.11)) * (1.0 - 0.6 * sCav);
          // ice crystals: a few grains have a facet that flashes when it faces the viewer; the
          // flash follows the view smoothly (no popping) and is at least a pixel or two across
          vec3 q = vSnowLocal * 90.0;
          vec3 id = floor(q);
          float px = length(fwidth(q));   // outside the branch: derivatives need uniform control flow
          if (hash13(id) > 0.93) {
            vec3 f = fract(q) - 0.5;
            float dotm = 1.0 - smoothstep(0.3 - px * 0.5, 0.3 + px * 0.5, length(f));
            vec3 facet = normalize(sL2V * normalize(normalize(vSnowLocal) + (hash33(id + 3.1) - 0.5) * 1.6));
            float tw = pow(max(dot(normalize(vViewPosition), facet), 0.0), 24.0);
            totalEmissiveRadiance += (vec3(1.1) + uSunCol * uSunSpec * 0.4) * tw * dotm;
          }
        }`);
      return s;
    },
  };
}
