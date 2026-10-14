import { BackSide as e, Box3 as t, BufferAttribute as n, BufferGeometry as r, CapsuleGeometry as i, CatmullRomCurve3 as a, Color as o, CustomBlending as s, CylinderGeometry as c, DataTexture as l, DoubleSide as u, GLSL3 as d, Group as f, HalfFloatType as p, LineCurve3 as m, LinearFilter as h, Matrix4 as g, Mesh as _, MeshPhysicalMaterial as v, MeshStandardMaterial as y, NoColorSpace as b, OneFactor as ee, OneMinusSrcAlphaFactor as te, PlaneGeometry as ne, Quaternion as x, RGBAFormat as re, RepeatWrapping as ie, RingGeometry as ae, ShaderMaterial as S, SphereGeometry as C, TubeGeometry as oe, UnsignedByteType as se, Vector2 as w, Vector3 as T, Vector4 as E, WebGL3DRenderTarget as ce, WebGLRenderTarget as le } from "three";
import { FullScreenQuad as ue } from "three/addons/postprocessing/Pass.js";
import { GLTFLoader as de } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder as fe } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries as D } from "three/addons/utils/BufferGeometryUtils.js";
//#region src/core/math.ts
var O = (e, t, n) => Math.min(n, Math.max(t, e)), k = (e, t, n) => e + (t - e) * n, A = (e, t, n, r) => k(e, t, 1 - Math.exp(-n * r)), pe = (e = 0, t = 1) => e + Math.random() * (t - e), me = (e, t) => [
	e[0] + t[0],
	e[1] + t[1],
	e[2] + t[2]
], he = (e, t) => [
	e[0] - t[0],
	e[1] - t[1],
	e[2] - t[2]
], ge = (e, t) => [
	e[0] * t,
	e[1] * t,
	e[2] * t
], _e = (e, t) => e[0] * t[0] + e[1] * t[1] + e[2] * t[2], ve = (e, t) => [
	e[1] * t[2] - e[2] * t[1],
	e[2] * t[0] - e[0] * t[2],
	e[0] * t[1] - e[1] * t[0]
], ye = (e) => Math.hypot(e[0], e[1], e[2]), be = (e) => {
	let t = ye(e) || 1;
	return [
		e[0] / t,
		e[1] / t,
		e[2] / t
	];
}, xe = () => [
	0,
	0,
	0,
	1
];
function Se(e, t) {
	return [
		e[3] * t[0] + e[0] * t[3] + e[1] * t[2] - e[2] * t[1],
		e[3] * t[1] - e[0] * t[2] + e[1] * t[3] + e[2] * t[0],
		e[3] * t[2] + e[0] * t[1] - e[1] * t[0] + e[2] * t[3],
		e[3] * t[3] - e[0] * t[0] - e[1] * t[1] - e[2] * t[2]
	];
}
function Ce(e, t) {
	let n = Math.sin(t / 2);
	return [
		e[0] * n,
		e[1] * n,
		e[2] * n,
		Math.cos(t / 2)
	];
}
function we(e) {
	let t = Math.hypot(e[0], e[1], e[2], e[3]) || 1;
	return [
		e[0] / t,
		e[1] / t,
		e[2] / t,
		e[3] / t
	];
}
var Te = (e) => [
	-e[0],
	-e[1],
	-e[2],
	e[3]
];
function Ee(e, t, n) {
	let r = ye(t) * n;
	return r < 1e-8 ? e : we(Se(Ce(be(t), r), e));
}
function De(e, t) {
	let n = Se(t, Te(e));
	n[3] < 0 && (n = [
		-n[0],
		-n[1],
		-n[2],
		-n[3]
	]);
	let r = Math.hypot(n[0], n[1], n[2]);
	if (r < 1e-8) return [
		0,
		0,
		0
	];
	let i = 2 * Math.atan2(r, n[3]);
	return [
		n[0] / r * i,
		n[1] / r * i,
		n[2] / r * i
	];
}
function Oe(e, t) {
	let [n, r, i, a] = e, o = a * t[0] + r * t[2] - i * t[1], s = a * t[1] + i * t[0] - n * t[2], c = a * t[2] + n * t[1] - r * t[0], l = -n * t[0] - r * t[1] - i * t[2];
	return [
		o * a + l * -n + s * -i - c * -r,
		s * a + l * -r + c * -n - o * -i,
		c * a + l * -i + o * -r - s * -n
	];
}
//#endregion
//#region src/core/noise.ts
function ke(e = 256) {
	let t = new Uint8Array(e * e), n = new Uint8Array(e * e), r = 1337, i = () => (r = r * 1664525 + 1013904223 >>> 0) >>> 24;
	for (let e = 0; e < t.length; e++) t[e] = i(), n[e] = i();
	let a = new Uint8Array(e * e * 4);
	for (let r = 0; r < e; r++) for (let i = 0; i < e; i++) {
		let o = r * e + i, s = (r + 17) % e * e + (i + 37) % e;
		a[o * 4] = t[o], a[o * 4 + 1] = t[s], a[o * 4 + 2] = n[o], a[o * 4 + 3] = n[s];
	}
	let o = new l(a, e, e, re, se);
	return o.wrapS = o.wrapT = ie, o.minFilter = o.magFilter = h, o.generateMipmaps = !1, o.colorSpace = b, o.needsUpdate = !0, o;
}
var j = "\n#ifndef MB_NOISE\n#define MB_NOISE\nuniform sampler2D uNoise2D;\nfloat mbSat(float x) { return clamp(x, 0.0, 1.0); }\nfloat hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }\nfloat hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }\nvec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat noise2(vec2 x) {\n  vec2 p = floor(x); vec2 f = fract(x);\n  f = f * f * (3.0 - 2.0 * f);\n  return textureLod(uNoise2D, (p + f + 0.5) / 256.0, 0.0).x;\n}\nfloat noise3(vec3 x) {\n  vec3 p = floor(x); vec3 f = fract(x);\n  f = f * f * (3.0 - 2.0 * f);\n  vec2 uv = (p.xy + vec2(37.0, 17.0) * p.z) + f.xy;\n  vec2 rg = textureLod(uNoise2D, (uv + 0.5) / 256.0, 0.0).xy;\n  return mix(rg.x, rg.y, f.z);\n}\nfloat fbm2(vec2 p, int oct) {\n  float s = 0.0, a = 0.5, n = 0.0;\n  for (int i = 0; i < 8; i++) {\n    if (i >= oct) break;\n    s += a * noise2(p); n += a;\n    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + vec2(1.7, 9.2);\n    a *= 0.5;\n  }\n  return s / n;\n}\n#endif\n";
function M(e, t, n) {
	let r = e * 374761393 + t * 668265263 + n * 2147483647 | 0;
	return r = Math.imul(r ^ r >>> 13, 1274126177), ((r ^ r >>> 16) >>> 0) / 4294967295;
}
function Ae(e, t, n = 0) {
	let r = Math.floor(e), i = Math.floor(t), a = e - r, o = t - i, s = a * a * (3 - 2 * a), c = o * o * (3 - 2 * o), l = M(r, i, n), u = M(r + 1, i, n), d = M(r, i + 1, n), f = M(r + 1, i + 1, n);
	return l + (u - l) * s + (d - l) * c + (l - u - d + f) * s * c;
}
function N(e, t, n, r = 0) {
	let i = 0, a = .5, o = 1, s = 1, c = 0;
	for (let l = 0; l < n; l++) {
		let n = Ae(e * o + l * 17.3, t * o - l * 9.1, r + l);
		n = 1 - Math.abs(n * 2 - 1), n *= n, n *= s, s = Math.min(1, n * 1.8), i += n * a, c += a, a *= .5, o *= 2.03;
	}
	return i / c;
}
function je(e, t, n, r = 0) {
	let i = 0, a = .5, o = 1, s = 0;
	for (let c = 0; c < n; c++) i += Ae(e * o, t * o, r + c * 31) * a, s += a, a *= .5, o *= 2.02;
	return i / s;
}
//#endregion
//#region src/core/patch.ts
function P(e, t) {
	let n = e, r = [...n.userData.__patches ?? [], ...t.filter((e) => !(n.userData.__patches ?? []).some((t) => t.key === e.key))];
	n.userData.__patches = r, e.onBeforeCompile = (e) => {
		for (let t of r) t.uniforms && Object.assign(e.uniforms, t.uniforms), t.vertex && (e.vertexShader = t.vertex(e.vertexShader)), t.fragment && (e.fragmentShader = t.fragment(e.fragmentShader));
	};
	let i = r.map((e) => e.key).join("|");
	return e.customProgramCacheKey = () => i, e.needsUpdate = !0, e;
}
function F(e, t, n, r = "after") {
	return e.includes(t) ? r === "replace" ? e.replace(t, n) : e.replace(t, r === "before" ? `${n}\n${t}` : `${t}\n${n}`) : (console.warn(`[shader patch] anchor not found: ${t}`), e);
}
//#endregion
//#region src/world/atmosphere.ts
var I = {
	uSunDir: { value: new T(.28, .3, -.91).normalize() },
	uSunCol: { value: new o(3.4, 2.75, 2) },
	uSunGlow: { value: 1 },
	uSunSpec: { value: 1 },
	uZenith: { value: new o(.55, .64, .78) },
	uHorizon: { value: new o(.95, .9, .83) },
	uFogCol: { value: new o(.93, .89, .84) },
	uFogDens: { value: .006 },
	uFogFall: { value: .25 },
	uHaze: { value: .0012 },
	uMist: { value: 0 },
	uLightning: { value: 0 },
	uNight: { value: 0 },
	uStars: { value: 0 },
	uMoonPhase: { value: Math.PI },
	uMoonDisc: { value: 0 },
	uTime: { value: 0 },
	uNoise2D: { value: null },
	uInteract: { value: null },
	uMapCenter: { value: new w() },
	uMapSize: { value: 18 }
}, Me = "\n#ifndef MB_ATMOS_CORE\n#define MB_ATMOS_CORE\nuniform vec3 uSunDir;\nuniform vec3 uSunCol;\nuniform float uSunGlow;\nuniform float uSunSpec;\nuniform vec3 uZenith;\nuniform vec3 uHorizon;\nuniform vec3 uFogCol;\nuniform float uFogDens;\nuniform float uFogFall;\nuniform float uHaze;\nuniform float uMist;\nuniform float uLightning;\nuniform float uNight;\nuniform float uStars;\nuniform float uMoonPhase;\nuniform float uMoonDisc;\nuniform float uTime;\nuniform sampler2D uInteract;\nuniform vec2 uMapCenter;\nuniform float uMapSize;\n\n// Mie aureole: the broad forward-scattering glow around the sun. It is what makes a backlit\n// subject read — the sky behind the ball is several times brighter than the sky the ball's\n// shaded face sees.\nvec3 sunAureole(vec3 d, float boost) {\n  float mu = max(dot(d, uSunDir), 0.0);\n  // broad and soft rather than a hot core: the page is looked at for long stretches\n  float a = 0.16 * pow(mu, 3.0) + 0.3 * pow(mu, 12.0) + 0.28 * pow(mu, 80.0) + 0.18 * pow(mu, 600.0);\n  return uSunCol * uSunGlow * a * boost;\n}\n\nvec3 skyColor(vec3 d) {\n  float y = max(d.y, 0.0);\n  vec3 col = mix(uHorizon, uZenith, pow(y, 0.62));\n  // stronger through the thicker, hazier air low in the sky\n  col += sunAureole(d, 1.0 + 0.6 * exp(-y * 6.0));\n  col += vec3(0.75, 0.8, 1.0) * uLightning * (0.35 + 0.5 * y);\n  return col;\n}\n\nvec3 fogColorDir(vec3 d) {\n  return uFogCol + sunAureole(d, 0.85) + vec3(0.7, 0.75, 0.9) * uLightning * 0.35;\n}\n\n// exponential height fog + distance haze, integrated analytically along the ray\nfloat fogDepth(vec3 ro, vec3 rd, float t) {\n  float b = uFogFall;\n  float rdy = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;\n  float od = uFogDens * exp(-b * max(ro.y, 0.0)) * (1.0 - exp(-b * rdy * t)) / (b * rdy);\n  return max(od, 0.0) + uHaze * t;\n}\n\nvec2 mapUV(vec2 xz) { return (xz - uMapCenter) / uMapSize + 0.5; }\nfloat mapInside(vec2 uv) { vec2 e = min(uv, 1.0 - uv); return smoothstep(0.0, 0.03, min(e.x, e.y)); }\n#endif\n", L = `
${Me}
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
`, R = {
	key: "atmos",
	uniforms: I,
	vertex: (e) => (e = F(e, "#include <common>", "varying vec3 vAtmosWorld;"), e = F(e, "#include <project_vertex>", "\n      vec4 atmosWP = vec4(transformed, 1.0);\n      #ifdef USE_BATCHING\n        atmosWP = batchingMatrix * atmosWP;\n      #endif\n      #ifdef USE_INSTANCING\n        atmosWP = instanceMatrix * atmosWP;\n      #endif\n      vAtmosWorld = (modelMatrix * atmosWP).xyz;"), e),
	fragment: (e) => (e = F(e, "#include <common>", `varying vec3 vAtmosWorld;\n${j}\n${L}`), e = F(e, "#include <lights_fragment_end>", "\n      reflectedLight.directSpecular *= uSunSpec;\n      #ifdef USE_CLEARCOAT\n        clearcoatSpecularDirect *= uSunSpec;\n      #endif", "before"), e = F(e, "#include <fog_fragment>", "gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);", "replace"), e)
}, z = `${j}\n${L}`, Ne = "\nprecision highp float;\nuniform float uZ;\nuniform float uSize;\nuniform int uMode;   // 0 = shape, 1 = detail\nout vec4 outColor;\n\nvec3 hash33(vec3 p3) {\n  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));\n  p3 += dot(p3, p3.yxz + 33.33);\n  return fract((p3.xxy + p3.yxx) * p3.zyx);\n}\nvec3 grad3(vec3 c) { return normalize(hash33(c) * 2.0 - 1.0); }\n\nfloat perlinTile(vec3 p, float rep) {\n  vec3 i = floor(p), f = fract(p);\n  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\n  float n[8];\n  for (int k = 0; k < 8; k++) {\n    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));\n    n[k] = dot(grad3(mod(i + o, rep)), f - o);\n  }\n  float x00 = mix(n[0], n[1], u.x), x10 = mix(n[2], n[3], u.x);\n  float x01 = mix(n[4], n[5], u.x), x11 = mix(n[6], n[7], u.x);\n  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);\n}\n\nfloat worleyTile(vec3 p, float rep) {\n  vec3 i = floor(p), f = fract(p);\n  float d = 1e9;\n  for (int z = -1; z <= 1; z++)\n  for (int y = -1; y <= 1; y++)\n  for (int x = -1; x <= 1; x++) {\n    vec3 o = vec3(float(x), float(y), float(z));\n    vec3 r = o + hash33(mod(i + o, rep)) - f;\n    d = min(d, dot(r, r));\n  }\n  return 1.0 - sqrt(d);\n}\n\nfloat worleyFbm(vec3 p, float freq) {\n  return worleyTile(p * freq, freq) * 0.625\n       + worleyTile(p * freq * 2.0, freq * 2.0) * 0.25\n       + worleyTile(p * freq * 4.0, freq * 4.0) * 0.125;\n}\n\nfloat remap(float v, float lo, float hi, float nlo, float nhi) {\n  return nlo + (v - lo) * (nhi - nlo) / (hi - lo);\n}\n\nvoid main() {\n  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);\n  if (uMode == 0) {\n    float pf = 0.0, amp = 1.0, fr = 4.0, nrm = 0.0;\n    for (int o = 0; o < 4; o++) { pf += perlinTile(p * fr, fr) * amp; nrm += amp; amp *= 0.5; fr *= 2.0; }\n    pf = clamp(pf / nrm * 0.9 + 0.5, 0.0, 1.0);\n    float w = worleyFbm(p, 4.0);\n    float pw = clamp(remap(pf, 0.0, 1.0, w, 1.0), 0.0, 1.0);\n    outColor = vec4(pw, worleyFbm(p, 8.0), worleyFbm(p, 16.0), worleyFbm(p, 32.0));\n  } else {\n    outColor = vec4(worleyFbm(p, 2.0), worleyFbm(p, 4.0), worleyFbm(p, 8.0), 1.0);\n  }\n}\n";
function Pe(e) {
	let t = new ce(e, e, e, {
		format: re,
		type: se,
		depthBuffer: !1
	}), n = t.texture;
	return n.wrapS = n.wrapT = n.wrapR = ie, n.minFilter = n.magFilter = h, n.generateMipmaps = !1, t;
}
var Fe = class {
	shape = Pe(128);
	detail = Pe(32);
	constructor(e) {
		let t = new S({
			glslVersion: d,
			vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
			fragmentShader: Ne,
			uniforms: {
				uZ: { value: 0 },
				uSize: { value: 128 },
				uMode: { value: 0 }
			},
			depthTest: !1,
			depthWrite: !1
		}), n = new ue(t), r = e.getRenderTarget();
		for (let [r, i] of [[this.shape, 0], [this.detail, 1]]) {
			let a = r.width;
			t.uniforms.uSize.value = a, t.uniforms.uMode.value = i;
			for (let i = 0; i < a; i++) t.uniforms.uZ.value = (i + .5) / a, e.setRenderTarget(r, i), n.render(e);
		}
		e.setRenderTarget(r), n.dispose(), t.dispose();
	}
	dispose() {
		this.shape.dispose(), this.detail.dispose();
	}
}, Ie = "\nuniform highp sampler3D uShapeTex;\nuniform highp sampler3D uDetailTex;\nuniform float uCloudBase;\nuniform float uCloudTop;\nuniform float uCloudCover;\nuniform float uCloudDensity;\nuniform float uCloudType;\nuniform float uCloudStretch;\nuniform vec2 uCloudWindDir;\nuniform vec2 uCloudOffset;\nuniform float uTowers;\nuniform float uSunAz;\nuniform vec3 uCloudAmbTop;\nuniform vec3 uCloudAmbBottom;\nuniform vec3 uCloudTint;\nuniform vec3 uCloudSun;      // sunlight above the cloud deck (not dimmed by the clouds themselves)\nuniform float uCloudAmbScale; // < 1 on fair days: darker undersides, more sculpted cumulus\nuniform float uCloudHaze;\nuniform vec4 uBolt;          // xyz = flash position (m), w = intensity\n\nconst float EARTH_R = 6360000.0;\nconst float CPI = 3.14159265;\n\nfloat cRemap(float v, float lo, float hi, float nlo, float nhi) {\n  return nlo + (v - lo) * (nhi - nlo) / max(hi - lo, 1e-5);\n}\n\nvec2 raySphere(vec3 ro, vec3 rd, float r) {\n  float b = dot(ro, rd);\n  float c = dot(ro, ro) - r * r;\n  float h = b * b - c;\n  if (h < 0.0) return vec2(-1.0);\n  h = sqrt(h);\n  return vec2(-b - h, -b + h);\n}\n\nfloat heightFrac(vec3 p) { return (length(p) - EARTH_R - uCloudBase) / (uCloudTop - uCloudBase); }\n\nvec2 cloudFrame(vec2 xz) {\n  vec2 q = xz + uCloudOffset;\n  vec2 wd = uCloudWindDir;\n  return vec2(dot(q, wd) / (1.0 + uCloudStretch * 3.0), dot(q, vec2(-wd.y, wd.x)));\n}\n\nfloat coverageAt(vec3 p) {\n  vec2 q = cloudFrame(p.xz);\n  // ~2 km cells; the fbm distribution is narrow (sd ≈ 0.12) so the threshold maps cover → area\n  float n = fbm2(q * 0.00015, 4);\n  float lo = 0.78 - 0.5 * uCloudCover;\n  float cov = smoothstep(lo - 0.06, lo + 0.06, n);\n  // art direction: a few towering cumulus masses around the sun's azimuth, mid distance,\n  // and (on fair days) a calmer sky on the side away from the sun, behind the headline\n  float az = atan(p.x, -p.z);\n  float dist = length(p.xz);\n  cov *= 1.0 - uTowers * 0.85 * smoothstep(-0.25, -0.7, az - uSunAz);\n  float daz = az - (uSunAz + 0.12);\n  float field = mix(1.0, smoothstep(0.3, 0.55, noise2(q * 0.00007 + 3.7)), 0.5);\n  float tower = uTowers * exp(-daz * daz * 4.0) * smoothstep(2500.0, 5000.0, dist) * smoothstep(22000.0, 9000.0, dist) * field;\n  return mbSat(max(cov, tower * smoothstep(0.34, 0.56, n)));\n}\n\nfloat heightProfile(float h, float type) {\n  float stratus = smoothstep(0.0, 0.1, h) * smoothstep(0.42, 0.2, h);\n  float cumulus = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.45, h);\n  return mix(stratus, cumulus, type);\n}\n\nfloat cloudDensity(vec3 p, bool detail) {\n  float h = heightFrac(p);\n  if (h <= 0.0 || h >= 1.0) return 0.0;\n  float cov = coverageAt(p);\n  if (cov <= 0.01) return 0.0;\n  vec2 f = cloudFrame(p.xz);\n  vec3 q = vec3(f.x, p.y - EARTH_R + uTime * 4.0, f.y) * 0.00026;\n  vec4 s = texture(uShapeTex, q);\n  float lowFbm = s.g * 0.625 + s.b * 0.25 + s.a * 0.125;\n  float base = cRemap(s.r, lowFbm - 1.0, 1.0, 0.0, 1.0);\n  // cumulus get round bottoms by fading the profile with the Perlin-Worley shape\n  base *= heightProfile(h, uCloudType * (0.6 + 0.4 * cov));\n  base = cRemap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;\n  if (base <= 0.0) return 0.0;\n  if (detail) {\n    vec3 d = texture(uDetailTex, q * 5.5 + vec3(uTime * 0.004, 0.0, 0.0)).rgb;\n    float hf = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;\n    float m = mix(hf, 1.0 - hf, mbSat(h * 5.0));\n    base = cRemap(base, m * 0.32, 1.0, 0.0, 1.0);\n  }\n  // hard floor: faint haze over kilometres of path would otherwise turn the sky to overcast\n  return mbSat((base - 0.04) / 0.96);\n}\n\nfloat hgPhase(float c, float g) {\n  float g2 = g * g;\n  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5);   // x 1/4pi omitted: isotropic == 1\n}\n\nfloat sunOpticalDepth(vec3 p, float sigmaScale, int steps) {\n  float od = 0.0;\n  float stepL = (uCloudTop - uCloudBase) * 0.09 / max(uSunDir.y, 0.2);\n  float t = 0.0;\n  for (int i = 0; i < 6; i++) {\n    if (i >= steps) break;\n    float ds = stepL * (1.0 + float(i) * 0.8);\n    t += ds;\n    od += cloudDensity(p + uSunDir * t, i < 2) * ds;\n  }\n  return od * sigmaScale;\n}\n\n// rgb = in-scattered light, a = transmittance\nvec4 marchClouds(vec3 camPos, vec3 rd, float jitter, int maxSteps, int lightSteps, bool detail) {\n  if (rd.y < -0.03 || uCloudCover <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);\n  vec3 ro = vec3(camPos.x, EARTH_R + max(camPos.y, 1.0), camPos.z);\n  vec2 tb = raySphere(ro, rd, EARTH_R + uCloudBase);\n  vec2 tt = raySphere(ro, rd, EARTH_R + uCloudTop);\n  float t0 = max(tb.y, 0.0);\n  float t1 = min(tt.y, t0 + 34000.0);\n  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);\n  int steps = int(mix(float(maxSteps), float(maxSteps) * 0.55, mbSat(rd.y * 2.5)));\n  float dt = (t1 - t0) / float(steps);\n  float sigmaScale = 0.02 * uCloudDensity;\n  float mu = dot(rd, uSunDir);\n  // softened dual-lobe phase, clamped so silver linings stay highlights instead of blooming blobs\n  float phSun = min(mix(hgPhase(mu, 0.62), hgPhase(mu, -0.2), 0.45), 4.0);\n  float T = 1.0;\n  vec3 L = vec3(0.0);\n  float tw = 0.0, wsum = 0.0;\n  float t = t0 + dt * jitter;\n  for (int i = 0; i < 128; i++) {\n    if (i >= steps || T < 0.015) break;\n    vec3 p = ro + rd * t;\n    float d = cloudDensity(p, detail);\n    if (d > 0.003) {\n      float sigma = d * sigmaScale;\n      float od = sunOpticalDepth(p, sigmaScale, lightSteps);\n      // single scattering + a softer octave + diffuse transmission (algebraic decay keeps\n      // thick overcast bases luminous instead of black)\n      float ms = exp(-od) * phSun\n               + 0.55 * exp(-od * 0.35) * mix(1.0, phSun, 0.5)\n               + 0.35 / (1.0 + od * 0.12);\n      float powder = 1.0 - exp(-sigma * 120.0);\n      float h = heightFrac(p);\n      vec3 amb = mix(uCloudAmbBottom, uCloudAmbTop, 0.35 + 0.65 * h) * (0.8 + 0.2 * h) * uCloudAmbScale;\n      // 0.5: keeps sunlit tops in the tone mapper's soft shoulder instead of clipping to white\n      vec3 S = (uCloudSun * 0.5 * ms * mix(0.6, 1.0, powder) + amb) * uCloudTint;\n      if (uBolt.w > 0.0) S += vec3(0.75, 0.8, 1.0) * uBolt.w * 6.0 * exp(-length(p - uBolt.xyz) * 0.0009);\n      float Ti = exp(-sigma * dt);\n      vec3 Sint = S * (1.0 - Ti);\n      L += T * Sint;\n      float wgt = T * (1.0 - Ti);\n      tw += wgt * t; wsum += wgt;\n      T *= Ti;\n    }\n    t += dt;\n  }\n  // aerial perspective: distant clouds melt into the horizon haze\n  float tm = wsum > 0.0 ? tw / wsum : t1;\n  float fade = 1.0 - exp(-tm * uCloudHaze);\n  vec3 hz = fogColorDir(rd);\n  L = mix(L, hz * (1.0 - T), fade);\n  // thin out toward the horizon so the layer does not end in a hard line\n  float hor = smoothstep(-0.02, 0.06, rd.y);\n  return vec4(L * hor, mix(1.0, T, hor));\n}\n", B = {
	uShapeTex: { value: null },
	uDetailTex: { value: null },
	uCloudBase: { value: 1400 },
	uCloudTop: { value: 4200 },
	uCloudCover: { value: .3 },
	uCloudDensity: { value: .8 },
	uCloudType: { value: 1 },
	uCloudStretch: { value: 0 },
	uCloudWindDir: { value: new w(-.94, .33) },
	uCloudOffset: { value: new w() },
	uTowers: { value: 1 },
	uSunAz: { value: .3 },
	uCloudAmbTop: { value: new o(.7, .76, .86) },
	uCloudAmbBottom: { value: new o(.55, .52, .5) },
	uCloudTint: { value: new o(1, 1, 1) },
	uCloudSun: { value: new o(3.2, 2.9, 2.6) },
	uCloudAmbScale: { value: 1 },
	uCloudHaze: { value: 1 / 26e3 },
	uBolt: { value: new E() }
}, V = {
	uMoonTex: { value: null },
	uMoonHeight: { value: null },
	uMoonTexOn: { value: 0 },
	uMoonRelief: { value: .02 }
}, Le = {
	uHdrOn: { value: 0 },
	uHdrMix: { value: 0 },
	uHdrA: { value: null },
	uHdrSmoothA: { value: null },
	uHdrRotA: { value: 0 },
	uHdrB: { value: null },
	uHdrSmoothB: { value: null },
	uHdrRotB: { value: 0 }
}, Re = "\nvec3 sunDisc(vec3 d) {\n  float mu = dot(d, uSunDir);\n  float disc = smoothstep(0.99972, 0.99987, mu);\n  return uSunCol * disc * 26.0;\n}\n\n// The moon (at night uSunDir points at it), about twice its real apparent size. With the NASA\n// near-side maps (moonUniforms) it is a real globe: albedo from LROC, relief from LOLA lighting\n// the craters along the terminator, Lommel–Seeliger shading (bright right to the limb, as the\n// moon is) and today's phase with the lit limb tipped toward the set sun. Without the maps it\n// falls back to a soft procedural disc. cover = disc coverage (it hides the stars behind it).\nuniform sampler2D uMoonTex;\nuniform sampler2D uMoonHeight;\nuniform float uMoonTexOn;\nuniform float uMoonRelief;\nvec3 moonDisc(vec3 d, float fw, out float cover) {\n  cover = 0.0;\n  vec3 m = uSunDir;\n  const float r = 0.02;\n  if (dot(d, m) < 0.99) return vec3(0.0);\n  vec3 rt = normalize(cross(m, vec3(0.0, 1.0, 0.0)));\n  vec3 up = cross(rt, m);\n  vec2 p = vec2(dot(d, rt), dot(d, up)) / r;\n  float rr = length(p);\n  float aa = max(fw / r, 0.02);\n  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);\n  if (disc <= 0.0) return vec3(0.0);\n  cover = disc;\n  vec2 pc = p * min(1.0, 0.999 / max(rr, 1e-4));\n  float z = sqrt(max(1.0 - dot(pc, pc), 0.0));\n  vec3 n0 = vec3(pc, z);\n  float sp = sin(uMoonPhase);\n  vec3 l = normalize(vec3(sp * 0.906, -abs(sp) * 0.423, -cos(uMoonPhase)));\n  vec3 n = n0;\n  vec3 alb;\n  if (uMoonTexOn > 0.5) {\n    float lat = asin(clamp(pc.y, -1.0, 1.0));\n    float lon = atan(pc.x, max(z, 1e-4));\n    vec2 uv = vec2(lon, lat) * 0.31830989 + 0.5;\n    // explicit mip level: the 512-texel near side over the disc, stretched toward the limb\n    float lod = log2(max(1.0, (fw / r) * 162.97 / max(z, 0.08)));\n    alb = textureLod(uMoonTex, uv, lod).rgb;\n    float st = exp2(lod) / 512.0;\n    float h0 = textureLod(uMoonHeight, uv, lod).r;\n    float he = textureLod(uMoonHeight, uv + vec2(st, 0.0), lod).r;\n    float hn = textureLod(uMoonHeight, uv + vec2(0.0, st), lod).r;\n    float dl = st * 3.14159265;\n    vec3 east = vec3(cos(lon), 0.0, -sin(lon));\n    vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));\n    n = normalize(n0 - ((he - h0) / (dl * max(cos(lat), 0.15)) * east + (hn - h0) / dl * north) * uMoonRelief);\n  } else {\n    alb = vec3(0.42) * (0.8 + 0.2 * (noise2(p * 1.7 + 4.0) * 0.6 + noise2(p * 4.3 + 1.0) * 0.4));\n  }\n  float mu0 = max(dot(n, l), 0.0), mu = max(z, 0.05);\n  float shade = 2.0 * mu0 / (mu0 + mu);\n  // a crescent reads brighter against the dark sky than the photometry says: lift thin phases a little\n  float thin = 1.0 + 0.5 * (1.0 + cos(uMoonPhase)) * 0.5;\n  return alb * (shade * thin + 0.015) * disc;   // + a faint earthshine on the dark side\n}\n\n// Stars: a sparse field (mostly faint, a few bright, slightly warm or cool) with a slow, faint\n// twinkle; each star is a pixel-sized gaussian whose energy is kept as it is antialiased.\nvec3 starField(vec3 d, float fw) {\n  vec3 q = d * 260.0;\n  vec3 id = floor(q);\n  float h = hash13(id);\n  if (h < 0.989) return vec3(0.0);\n  vec3 c = id + 0.5 + (hash33(id + 3.1) - 0.5) * 0.7;\n  float rr = length(q - c);\n  float s = max(0.09, fw * 260.0 * 0.8);\n  float g = exp(-rr * rr / (s * s)) * (0.0081 / (s * s));\n  float mag = pow((h - 0.989) / 0.011, 3.0) * 2.4 + 0.25;\n  float tw = 0.85 + 0.15 * sin(uTime * (0.8 + 2.0 * fract(h * 37.0)) + h * 91.0);\n  vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), fract(h * 113.0));\n  return tint * g * mag * tw;\n}", ze = `
precision highp float;
${z}
${Ie}
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
`, Be = "\nvarying vec3 vWorld;\nvoid main() {\n  vec4 wp = modelMatrix * vec4(position, 1.0);\n  vWorld = wp.xyz;\n  gl_Position = projectionMatrix * viewMatrix * wp;\n}\n", Ve = `
${z}
#ifdef ENV_MODE
${Ie}
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
${Re}
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
function He(e, t) {
	return new le(e, t, {
		type: p,
		format: re,
		depthBuffer: !1,
		minFilter: h,
		magFilter: h,
		generateMipmaps: !1
	});
}
var Ue = class {
	noise;
	dome;
	envDome;
	cloudScale = .5;
	steps = 64;
	rts = [He(4, 4), He(4, 4)];
	cur = 0;
	frame = 0;
	historyValid = 0;
	quad;
	passMat;
	domeMat;
	dirToClip = new g();
	prevDirToClip = new g();
	clipToDir = new g();
	rot = new g();
	constructor(t) {
		this.noise = new Fe(t), B.uShapeTex.value = this.noise.shape.texture, B.uDetailTex.value = this.noise.detail.texture, this.passMat = new S({
			glslVersion: d,
			vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
			fragmentShader: ze,
			uniforms: {
				...I,
				...B,
				uClipToDir: { value: this.clipToDir },
				uPrevDirToClip: { value: this.prevDirToClip },
				uHistory: { value: null },
				uHistoryValid: { value: 0 },
				uBlend: { value: .88 },
				uResolution: { value: new w(4, 4) },
				uCamPos: { value: new T() },
				uFrame: { value: 0 },
				uSteps: { value: this.steps }
			},
			depthTest: !1,
			depthWrite: !1
		}), this.quad = new ue(this.passMat);
		let n = new C(9e3, 48, 24);
		this.domeMat = new S({
			vertexShader: Be,
			fragmentShader: Ve,
			uniforms: {
				...I,
				...V,
				uCloudTex: { value: null },
				uCloudSize: { value: new w(4, 4) },
				uDirToClip: { value: this.dirToClip },
				uSunDiscScale: { value: 1 }
			},
			side: e,
			depthWrite: !1,
			depthTest: !1
		}), this.dome = new _(n, this.domeMat), this.dome.renderOrder = -1e3, this.dome.frustumCulled = !1, this.dome.onBeforeRender = (e, t, n) => {
			this.dome.position.copy(n.position), this.dome.updateMatrixWorld();
		};
		let r = new S({
			vertexShader: Be,
			fragmentShader: Ve,
			defines: { ENV_MODE: 1 },
			uniforms: {
				...I,
				...B,
				...Le,
				...V
			},
			side: e,
			depthWrite: !1,
			depthTest: !1
		});
		this.envDome = new _(n, r), this.envDome.renderOrder = -1e3, this.envDome.frustumCulled = !1, this.envDome.onBeforeRender = (e, t, n) => {
			this.envDome.position.copy(n.position), this.envDome.updateMatrixWorld();
		};
	}
	setSize(e, t) {
		let n = Math.max(16, Math.round(e * this.cloudScale)), r = Math.max(16, Math.round(t * this.cloudScale));
		this.domeMat.uniforms.uCloudSize.value.set(n, r);
		for (let e of this.rts) e.setSize(n, r);
		this.passMat.uniforms.uResolution.value.set(n, r), this.historyValid = 0;
	}
	update(e, t) {
		this.rot.extractRotation(t.matrixWorldInverse), this.dirToClip.multiplyMatrices(t.projectionMatrix, this.rot), this.clipToDir.copy(this.dirToClip).invert();
		let n = this.rts[this.cur], r = this.rts[1 - this.cur], i = this.passMat.uniforms;
		i.uHistory.value = n.texture, i.uHistoryValid.value = this.historyValid, i.uFrame.value = this.frame++ % 1024, i.uSteps.value = this.steps, i.uCamPos.value.copy(t.position);
		let a = e.getRenderTarget();
		e.setRenderTarget(r), this.quad.render(e), e.setRenderTarget(a), this.cur = 1 - this.cur, this.historyValid = 1, this.prevDirToClip.copy(this.dirToClip), this.domeMat.uniforms.uCloudTex.value = r.texture;
	}
	setSunDisc(e) {
		this.domeMat.uniforms.uSunDiscScale.value = e;
	}
	resetHistory() {
		this.historyValid = 0;
	}
	get cloudTexture() {
		return this.rts[this.cur].texture;
	}
	dispose() {
		this.rts.forEach((e) => e.dispose()), this.noise.dispose(), this.quad.dispose();
	}
}, H = {
	uGroundWet: { value: .55 },
	uPuddle: { value: 0 },
	uSnowCover: { value: 0 },
	uDust: { value: 0 },
	uRain: { value: 0 },
	uSandCol: { value: new o(.5, .47, .43) },
	uGroundWind: { value: new w(-.94, .33) },
	uRippleGain: { value: 2.2 },
	uBallSphere: { value: new E(0, 1, 0, 1) },
	uShelter: { value: new E(0, 0, 1, 0) },
	uMirror: { value: null },
	uMirrorMatrix: { value: new g() },
	uGTex: { value: 0 },
	uSnowTex: { value: 0 },
	uBaseDiff: { value: null },
	uBaseNor: { value: null },
	uMicroDiff: { value: null },
	uMicroNor: { value: null },
	uMicroRough: { value: null },
	uSnowDiff: { value: null },
	uSnowNor: { value: null },
	uTexTile: { value: new T(1 / 18, 1 / 1.4, 1 / 2.4) },
	uSnowMound: { value: new E(0, 0, 1, 0) }
}, We = "\nuniform float uGroundWet;\nuniform float uPuddle;\nuniform float uSnowCover;\nuniform float uDust;\nuniform float uRain;\nuniform vec3 uSandCol;\nuniform vec2 uGroundWind;\nuniform float uRippleGain;\nuniform vec4 uBallSphere;\nuniform vec4 uShelter;\nuniform sampler2D uMirror;\nuniform float uGTex;\nuniform float uSnowTex;\nuniform sampler2D uBaseDiff;\nuniform sampler2D uBaseNor;\nuniform sampler2D uMicroDiff;\nuniform sampler2D uMicroNor;\nuniform sampler2D uMicroRough;\nuniform sampler2D uSnowDiff;\nuniform sampler2D uSnowNor;\nuniform vec3 uTexTile;\nvarying vec3 vGWorld;\nvarying vec4 vMirrorCoord;\n\n// ---- photo-scanned texture sets, laid out with u = +x, v = -z\n// colour relative to the map's own average (its last mip): the preset keeps hue and level\nvec3 texTone(sampler2D t, vec2 uv) {\n  return texture2D(t, uv).rgb / max(textureLod(t, vec2(0.5), 16.0).rgb, vec3(0.02));\n}\n// blending two uncorrelated samples halves their contrast mid-way (a soft, smeared patch);\n// scaling the blended deviation by this keeps the variance constant across the blend\nfloat vpGain(float w) { return inversesqrt(w * w + (1.0 - w) * (1.0 - w)); }\n\n// Tile variation for the small near-field tiles (after iq's \"texture repetition\"): a slowly\n// varying index picks one of 8 offset + rotation variants of the tile and the two nearest are\n// blended, so the pattern never lines up with itself. Gradients come from the continuous\n// coordinate, so switching variants leaves no mip seams.\nvec2 tvUV[2]; vec2 tvDx[2]; vec2 tvDy[2]; mat2 tvRT[2]; float tvW; float tvVP;\nvoid tileVariants(vec2 p, float invTile, float k) {\n  float idx = k * 8.0, i = floor(idx);\n  vec2 q = p * invTile, qx = dFdx(q), qy = dFdy(q);\n  for (int j = 0; j < 2; j++) {\n    float n = i + float(j), a = n * 2.39996;   // golden angle: neighbouring variants never align\n    float c = cos(a), s = sin(a);\n    mat2 R = mat2(c, s, -s, c);\n    tvUV[j] = R * q + sin(vec2(3.0, 7.0) * n);\n    tvDx[j] = R * qx; tvDy[j] = R * qy;\n    tvRT[j] = mat2(c, -s, s, c);\n  }\n  tvW = smoothstep(0.2, 0.8, fract(idx));\n  tvVP = vpGain(tvW);\n}\nvec3 tvTone(sampler2D t) {\n  vec3 m = max(textureLod(t, vec2(0.5), 16.0).rgb, vec3(0.02));\n  vec3 a = textureGrad(t, tvUV[0], tvDx[0], tvDy[0]).rgb, b = textureGrad(t, tvUV[1], tvDx[1], tvDy[1]).rgb;\n  return 1.0 + (mix(a, b, tvW) / m - 1.0) * tvVP;\n}\nfloat tvDev(sampler2D t) {\n  float m = max(textureLod(t, vec2(0.5), 16.0).r, 0.02);\n  float a = textureGrad(t, tvUV[0], tvDx[0], tvDy[0]).r, b = textureGrad(t, tvUV[1], tvDx[1], tvDy[1]).r;\n  return (mix(a, b, tvW) / m - 1.0) * tvVP;\n}\nvec2 tvSlope(sampler2D t) {\n  vec2 m = textureLod(t, vec2(0.5), 16.0).xy * 2.0 - 1.0;\n  vec2 s = vec2(0.0);\n  for (int j = 0; j < 2; j++) {\n    vec3 n = textureGrad(t, tvUV[j], tvDx[j], tvDy[j]).xyz * 2.0 - 1.0;\n    vec2 g = tvRT[j] * (-(n.xy - m) / max(n.z, 0.35));\n    s += vec2(g.x, -g.y) * (j == 0 ? 1.0 - tvW : tvW);\n  }\n  return s * tvVP;\n}\n// tangent-space normal → slope (dh/dx, dh/dz). rt undoes the sampling rotation; the map's mean\n// normal is removed so a tilt baked into a scan does not lean the whole ground\nvec2 texSlope(sampler2D t, vec2 uv, mat2 rt) {\n  vec3 n = texture2D(t, uv).xyz * 2.0 - 1.0;\n  n.xy -= textureLod(t, vec2(0.5), 16.0).xy * 2.0 - 1.0;\n  vec2 s = rt * (-n.xy / max(n.z, 0.35));\n  return vec2(s.x, -s.y);\n}\n\nfloat sphOcclusion(vec3 pos, vec3 nor, vec4 sph) {\n  vec3 di = sph.xyz - pos;\n  float l = length(di);\n  float nl = dot(nor, di / l);\n  float h = l / sph.w;\n  float h2 = h * h;\n  float k2 = 1.0 - h2 * nl * nl;\n  float res = max(0.0, nl) / h2;\n  if (k2 > 0.001) { res = (nl * h + 1.0) / h2; res = 0.33 * res * res; }\n  return res;\n}\n\nfloat groundH(vec2 p, float fp) {\n  float h = (noise2(p * 0.9) - 0.5) * 0.03 * smoothstep(1.4, 0.2, fp * 0.9);\n  if (uGTex > 0.5) return h;   // ripples and grain come from the photo textures\n  float ph = dot(p, uGroundWind) * 7.0 + noise2(p * 1.3) * 4.0;\n  h += sin(ph) * 0.0035 * smoothstep(0.7, 0.1, fp * 7.0);\n  h += (noise2(p * 4.3 + 3.1) - 0.5) * 0.009 * smoothstep(0.6, 0.1, fp * 4.3);\n  h += (noise2(p * 11.0 + 7.7) - 0.5) * 0.004 * smoothstep(0.6, 0.1, fp * 11.0);\n  h += (noise2(p * 27.0 + 1.3) - 0.5) * 0.0018 * smoothstep(0.6, 0.1, fp * 27.0);\n  return h;\n}\nfloat snowH(vec2 p) {\n  float h = fbm2(p * 0.4, 3) * 0.1;   // drifts\n  return uSnowTex > 0.5 ? h : h + noise2(p * 2.5) * 0.014 + noise2(p * 7.0) * 0.004;\n}\n\n\nvec2 rainRipples(vec2 uv, float t) {\n  vec2 g = vec2(0.0);\n  vec2 id = floor(uv);\n  vec2 f = fract(uv);\n  for (int j = -1; j <= 1; j++) {\n    for (int i = -1; i <= 1; i++) {\n      vec2 o = vec2(float(i), float(j));\n      vec2 h = hash22(id + o);\n      float ph = fract(t * (0.9 + 0.4 * h.y) + h.x);\n      vec2 d = f - (o + 0.5 + (h - 0.5) * 0.7);\n      float r = length(d);\n      float rad = ph * 0.75;\n      float w = sin((r - rad) * 38.0) * smoothstep(0.12, 0.0, abs(r - rad)) * (1.0 - ph) * (1.0 - ph);\n      g += d / max(r, 1e-3) * w;\n    }\n  }\n  return g;\n}\n\n// Ice crystals in the snow crust: a few grains carry a facet that flashes when it faces the viewer.\n// The flash follows the view direction smoothly (no on/off popping as the camera drifts) and each\n// speck is a pixel or two across, antialiased by the footprint.\nfloat sparkle(vec3 P, vec3 rd, float fp) {\n  vec2 q = P.xz * 20.0;\n  vec2 id = floor(q);\n  if (hash12(id) < 0.93) return 0.0;\n  float px = fp * 20.0;\n  float dotm = 1.0 - smoothstep(0.3 - px * 0.5, 0.3 + px * 0.5, length(fract(q) - 0.5));\n  vec2 t = (hash22(id + 1.7) - 0.5) * 1.5;\n  vec3 facet = normalize(vec3(t.x, 1.0, t.y));\n  return pow(max(dot(-rd, facet), 0.0), 30.0) * dotm * smoothstep(0.06, 0.01, fp);\n}\n\n// lumpy crust: clods with hollows between them, and finer grains on top (0..1)\nfloat snowClump(vec2 p) { return noise2(p * 3.2) * 0.5 + noise2(p * 8.5 + 1.3) * 0.32 + noise2(p * 23.0 + 3.0) * 0.18; }\n\nvec3 gN; vec3 gNl; vec3 gNc; vec3 gAlb; float gRough; float gFilm; float gFilmRough; float gAO; float gSpark; float gSnow; float gCav;\n\nvoid groundSurface(vec3 P) {\n  vec2 xz = P.xz;\n  gCav = 0.0;\n  vec3 rd = normalize(P - cameraPosition);\n  float tCam = length(P - cameraPosition);\n  float fp = max(length(fwidth(xz)), 1e-4);\n  float big = fbm2(xz * 0.05 + 1.3, 3);\n  float mid = noise2(xz * 0.45 + 2.7);\n  vec3 alb = uSandCol * (0.84 + 0.26 * big + 0.1 * (mid - 0.5));\n  vec2 gTex = vec2(0.0);     // photographed relief (ripples): the water film follows part of it\n  vec2 gGrain = vec2(0.0);   // fine grain near the ball: shading only, the film smooths over it\n  float roughDev = 0.0;      // grain roughness relative to its mean\n  if (uGTex > 0.5) {\n    vec2 p = vec2(xz.x, -xz.y);\n    // base layer at two scales, blended by low-frequency noise so the tile never reads as a grid\n    float wB = smoothstep(0.3, 0.7, noise2(xz * 0.019 + 5.3)), vB = vpGain(wB);\n    vec2 uvA = p * uTexTile.x, uvB = p * (uTexTile.x * 0.382) + vec2(0.37, 0.71);\n    vec3 tone = 1.0 + (mix(texTone(uBaseDiff, uvA), texTone(uBaseDiff, uvB), wB) - 1.0) * vB;\n    alb *= max(1.0 + (tone - 1.0) * 1.8, vec3(0.0));   // a low-contrast scan: lift its tone a little\n    gTex = mix(texSlope(uBaseNor, uvA, mat2(1.0)), texSlope(uBaseNor, uvB, mat2(1.0)), wB) * (0.5 * vB);\n    // micro layer: crisp grain at the ball's feet, faded out with distance\n    float near = smoothstep(42.0, 10.0, tCam);\n    tileVariants(p, uTexTile.y, noise2(xz * (uTexTile.y * 0.13) + 1.9));\n    alb *= mix(vec3(1.0), tvTone(uMicroDiff), 0.28 * near);\n    gGrain = tvSlope(uMicroNor) * (0.45 * near);\n    roughDev = tvDev(uMicroRough) * near;\n  } else {\n    // salt-crust flecks give the procedural flat a photographic grain\n    float fleck = smoothstep(0.72, 0.9, noise2(xz * 3.1 + 9.0)) * smoothstep(0.3, 0.02, fp);\n    alb *= 1.0 + fleck * 0.16;\n  }\n  if (uDust > 0.01) {\n    vec2 wq = vec2(dot(xz, uGroundWind), dot(xz, vec2(-uGroundWind.y, uGroundWind.x)));\n    float s = noise2(vec2(wq.x * 0.35 - uTime * 2.6, wq.y * 4.0)) * noise2(vec2(wq.x * 0.8 - uTime * 3.5, wq.y * 9.0 + 3.0));\n    alb = mix(alb, uSandCol * 1.18, smoothstep(0.22, 0.5, s) * uDust * 0.7 * smoothstep(0.25, 0.02, fp));\n  }\n\n  float e = max(0.012, fp * 0.6);\n  float h0 = groundH(xz, fp);\n  vec2 g = vec2(groundH(xz + vec2(e, 0.0), fp) - h0, groundH(xz + vec2(0.0, e), fp) - h0) / e + gTex;\n\n  vec2 muv = mapUV(xz);\n  float inside = mapInside(muv);\n  vec4 im = inside > 0.0 ? texture2D(uInteract, muv) * inside : vec4(0.0);\n\n  float wet = mbSat(uGroundWet * (0.75 + 0.5 * (big - 0.5)));\n  float pud = uPuddle > 0.01 ? smoothstep(0.6 - uPuddle * 0.28, 0.65 - uPuddle * 0.28, fbm2(xz * 0.2 + 4.0, 3)) * mbSat(uPuddle * 3.0) : 0.0;\n  float shelter = uShelter.w * smoothstep(uShelter.z + 0.15, uShelter.z - 0.35, length(xz - uShelter.xy));\n  wet *= 1.0 - shelter * 0.75;\n  pud *= 1.0 - shelter;\n\n  float snowC = 0.0, dent = 0.0;\n  vec3 snowTone = vec3(1.0);\n  if (uSnowCover > 0.001) {\n    snowC = mbSat(uSnowCover * 1.3 - 0.3 + (big - 0.5) * 0.8 * (1.0 - uSnowCover));\n    float sh0 = snowH(xz);\n    vec2 sg = vec2(snowH(xz + vec2(e, 0.0)) - sh0, snowH(xz + vec2(0.0, e)) - sh0) / e;\n    if (uSnowTex > 0.5) {\n      tileVariants(vec2(xz.x, -xz.y), uTexTile.z, noise2(xz * (uTexTile.z * 0.13) + 8.1));\n      sg += tvSlope(uSnowNor) * 0.8;\n      snowTone = tvTone(uSnowDiff);\n    }\n    // the snow piled around the ball: same height field as the mound mesh, so they shade alike\n    if (uSnowMound.w > 0.01) {\n      float m0 = moundH(xz);\n      const float me = 0.01;\n      sg += vec2(moundH(xz + vec2(me, 0.0)) - m0, moundH(xz + vec2(0.0, me)) - m0) / me;\n    }\n    // near the camera the crust breaks into lumps; their hollows only see the (blue) skylight\n    float nearS = smoothstep(32.0, 8.0, tCam) * smoothstep(0.05, 0.012, fp);\n    if (nearS > 0.0) {\n      float c0 = snowClump(xz);\n      const float ce = 0.006;\n      sg += vec2(snowClump(xz + vec2(ce, 0.0)) - c0, snowClump(xz + vec2(0.0, ce)) - c0) / ce * 0.07 * nearS;\n      gCav = smoothstep(0.5, 0.2, c0) * nearS;\n    }\n    if (inside > 0.0) {\n      dent = im.b;\n      float de = 1.5 / 512.0;\n      vec2 dg = vec2(texture2D(uInteract, muv + vec2(de, 0.0)).b - texture2D(uInteract, muv - vec2(de, 0.0)).b,\n                     texture2D(uInteract, muv + vec2(0.0, de)).b - texture2D(uInteract, muv - vec2(0.0, de)).b);\n      sg -= dg * inside * 1.6;\n    }\n    g = mix(g, sg, snowC);\n  }\n\n  vec2 rg = vec2(0.0);\n  if (uRain > 0.01) rg += rainRipples(xz * 1.6, uTime) * uRain * (1.0 - shelter) * smoothstep(35.0, 6.0, tCam) * 0.45;\n  if (inside > 0.0) {\n    float te = 1.0 / 512.0;\n    vec2 sgr = vec2(texture2D(uInteract, muv + vec2(te, 0.0)).r - texture2D(uInteract, muv - vec2(te, 0.0)).r,\n                    texture2D(uInteract, muv + vec2(0.0, te)).r - texture2D(uInteract, muv - vec2(0.0, te)).r);\n    rg += sgr * inside * uRippleGain;\n  }\n  float wetAll = max(wet, pud) * (1.0 - snowC);\n  float flat_ = 1.0 - pud * 0.85 * (1.0 - snowC);\n  vec2 gt = g * flat_ + rg * (0.25 + 0.75 * wetAll) * (1.0 - snowC);\n  gNl = normalize(vec3(-gt.x, 1.0, -gt.y));\n  gt += gGrain * flat_ * (1.0 - snowC);\n  gN = normalize(vec3(-gt.x, 1.0, -gt.y));\n  // water film: flat in puddles (with ripples), hugging the sand elsewhere\n  vec2 gf = mix(g * 0.6, vec2(0.0), pud) + rg;\n  gNc = normalize(vec3(-gf.x, 1.0, -gf.y));\n\n  alb *= mix(1.0, 0.6, wet * 0.85) * mix(1.0, 0.72, pud);\n  vec3 snowAlb = mix(vec3(0.94, 0.955, 0.985), vec3(0.66, 0.75, 0.9), mbSat(dent * 0.75));\n  snowAlb = min(snowAlb * (1.0 + (snowTone - 1.0) * 0.8), vec3(0.98));\n  gAlb = mix(alb, snowAlb, snowC);\n  gRough = mix(clamp(mix(0.82, 0.6, wet) * (1.0 + roughDev * 0.8), 0.3, 1.0), 0.9, snowC);\n  // the film beads up on the rougher grain and pools on the smoother patches\n  gFilm = mbSat(wet * 0.75 + pud) * (1.0 - snowC) * mbSat(1.0 - roughDev * 1.6 * (1.0 - pud));\n  // a smooth film keeps the sun's glint a narrow path instead of a broad glare sheet\n  gFilmRough = mix(mix(0.2, 0.075, wet), 0.02, pud);\n  gAO = 1.0 - mbSat(sphOcclusion(P, vec3(0.0, 1.0, 0.0), uBallSphere));\n  gSnow = snowC;\n  gCav *= snowC;\n  gSpark = snowC > 0.0 ? sparkle(P, rd, fp) * snowC : 0.0;\n}\n", Ge = "\nuniform vec4 uSnowMound;\nfloat moundH(vec2 xz) {\n  if (uSnowMound.w < 0.01) return 0.0;\n  vec2 d = xz - uSnowMound.xy;\n  float r = length(d) / uSnowMound.z;\n  if (r > 2.0) return 0.0;\n  float a = atan(d.y, d.x);\n  float n = noise2(vec2(cos(a), sin(a)) * 2.5 + 3.0) * 0.6 + noise2(d * 6.0) * 0.4;\n  float prof = smoothstep(0.55, 0.98, r) * smoothstep(1.9, 1.0, r);\n  return uSnowMound.w * uSnowMound.z * 0.16 * prof * (0.55 + 0.9 * n);\n}\n", Ke = {
	key: "ground",
	uniforms: H,
	vertex: (e) => (e = F(e, "#include <common>", `varying vec3 vGWorld;\nvarying vec4 vMirrorCoord;\nuniform mat4 uMirrorMatrix;\n${j}\n${Ge}`), e = F(e, "#include <project_vertex>", "transformed.y += moundH((modelMatrix * vec4(transformed, 1.0)).xz);", "before"), e = F(e, "#include <project_vertex>", "\n      vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n      vMirrorCoord = uMirrorMatrix * vec4(vGWorld, 1.0);"), e),
	fragment: (e) => (e = F(e, "#include <common>", `${j}\n${L}\n${Ge}\n${We}`), e = F(e, "#include <color_fragment>", "groundSurface(vGWorld);\ndiffuseColor.rgb = gAlb;"), e = F(e, "#include <roughnessmap_fragment>", "roughnessFactor = gRough;"), e = F(e, "#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);"), e = F(e, "#include <clearcoat_normal_fragment_maps>", "clearcoatNormal = normalize((viewMatrix * vec4(gNc, 0.0)).xyz);"), e = F(e, "#include <lights_physical_fragment>", "\n      material.clearcoat = gFilm;\n      material.clearcoatRoughness = clamp(gFilmRough, 0.03, 1.0);\n      material.clearcoatF0 = vec3(0.02);"), e = F(e, "#include <lights_fragment_maps>", "\n      {\n        // mirror reflection (includes sky, mountains, the ball and its umbrella)\n        vec2 muv = vMirrorCoord.xy / vMirrorCoord.w;\n        vec2 dc = (viewMatrix * vec4(gNc, 0.0)).xy;\n        vec2 db = (viewMatrix * vec4(gNl, 0.0)).xy;   // without the grain: no pixel-scale jitter\n        clearcoatRadiance = textureLod(uMirror, clamp(muv + dc * 0.08, 0.001, 0.999), gFilmRough * 7.0).rgb;\n        vec3 blurred = textureLod(uMirror, clamp(muv + db * 0.12, 0.001, 0.999), 2.5 + gRough * 4.0).rgb;\n        radiance = mix(radiance, blurred, 0.6);\n      }"), e = F(e, "#include <lights_fragment_end>", "\n      // a calm, readable glint: soft-clipped instead of a blown-out sheet\n      reflectedLight.directSpecular = 1.4 * reflectedLight.directSpecular / (1.4 + reflectedLight.directSpecular);\n      #ifdef USE_CLEARCOAT\n        clearcoatSpecularDirect = 1.4 * clearcoatSpecularDirect / (1.4 + clearcoatSpecularDirect);\n      #endif", "before"), e = F(e, "#include <aomap_fragment>", "\n      reflectedLight.indirectDiffuse *= gAO * (1.0 - 0.4 * gCav);\n      reflectedLight.indirectSpecular *= mix(gAO, 1.0, 0.5);\n      reflectedLight.directDiffuse *= 1.0 - 0.6 * gCav;"), e = F(e, "#include <emissivemap_fragment>", "totalEmissiveRadiance += gSpark * (uSunCol * 0.35 + vec3(0.6));"), e)
};
function qe() {
	let e = new ne(6e4, 6e4, 1, 1);
	e.rotateX(-Math.PI / 2);
	let t = new v({
		color: 16777215,
		roughness: .8,
		metalness: 0,
		clearcoat: 1,
		clearcoatRoughness: .1,
		ior: 1.45,
		specularIntensity: .6
	});
	P(t, [R, Ke]);
	let n = new _(e, t);
	return n.receiveShadow = !0, n.name = "ground", n;
}
function Je(e) {
	let t = new ae(.45, 2, 96, 24);
	t.rotateX(-Math.PI / 2);
	let n = new _(t, e.material);
	return n.receiveShadow = !0, n.name = "ground-mound", n.position.y = -.002, n.visible = !1, n;
}
//#endregion
//#region src/world/Terrain.ts
var U = {
	uMtnSnow: { value: .15 },
	uMtnTint: { value: new o(.42, .43, .46) },
	uMistSheets: { value: 0 },
	uMtnHaze: { value: .04 },
	uRockTex: { value: 0 },
	uRockDiff: { value: null },
	uRockNor: { value: null },
	uRockTile: { value: 1 / 250 },
	uDem: { value: 0 },
	uDemDetail: { value: null },
	uDemRect: { value: new E(0, 1, 0, 1) },
	uDemElev: { value: new E(1, 0, 0, 0) },
	uTerrainSwing: { value: 0 },
	uTSnowCover: H.uSnowCover
}, W = (e, t, n) => {
	let r = Math.min(1, Math.max(0, (n - e) / (t - e)));
	return r * r * (3 - 2 * r);
}, G = (e, t, n) => Math.exp(-(((e - t) / n) ** 2)), Ye = (e, t, n, r, i, a) => Math.exp(-(((e - n) / i) ** 2) - ((t - r) / a) ** 2);
function Xe(e, t) {
	let n = Math.hypot(e, t);
	if (n < 650) return 0;
	let r = Math.atan2(e, -t), i = W(650, 1e3, n), a = W(-.5, .35, r), o = e + 700 * (je(e / 4e3, t / 4e3, 3, 71) - .5), s = t + 700 * (je(e / 4e3 + 7.1, t / 4e3, 3, 72) - .5), c = 62 * G(n, 1300, 300) * (.15 + .85 * a) * (.25 + N(o / 600, s / 600, 4, 3)) ** 1.3, l = 330 * G(n, 3e3, 650) * (.25 + .75 * a) * N(o / 1e3, s / 1e3, 5, 11) ** 1.6, u = N(o / 1700, s / 1700, 6, 23), d = 850 * G(n, 6200, 1400) * (.55 + .45 * a) * u ** 1.6, f = 500 * Ye(r, n, .36, 6e3, .17, 1500) * (.6 + .6 * u);
	return i * (c + l + d + f);
}
function Ze(e = 760, t = 150, i = 650, a = 9e3, o) {
	let s = new Float32Array((e + 1) * (t + 1) * 3), c = new Float32Array((e + 1) * (t + 1) * 3), l = 0;
	for (let n = 0; n <= t; n++) {
		let r = i * (a / i) ** +(n / t), u = 1 - W(1700, 2400, r), d = [
			.62 - .26 * u,
			.6 - .24 * u,
			.6 - .3 * u
		];
		for (let t = 0; t <= e; t++) {
			let i = -1.5 + t / e * 3, a = Math.sin(i) * r, u = -Math.cos(i) * r, f = (o ? o(t, n) : Xe(a, u)) + .8;
			s[l] = a, s[l + 1] = f, s[l + 2] = u;
			let p = o ? 1 : .9 + .3 * je(a / 260, u / 260, 3, 41) - .22 * N(a / 140, u / 140, 2, 77), m = o ? [
				1,
				1,
				1
			] : d;
			c[l] = m[0] * p, c[l + 1] = m[1] * p, c[l + 2] = m[2] * p, l += 3;
		}
	}
	let u = [];
	for (let n = 0; n < t; n++) for (let t = 0; t < e; t++) {
		let r = n * (e + 1) + t, i = r + 1, a = r + e + 1, o = a + 1;
		u.push(r, i, a, i, o, a);
	}
	let d = new r();
	return d.setAttribute("position", new n(s, 3)), d.setAttribute("color", new n(c, 3)), d.setIndex(u), d.computeVertexNormals(), d;
}
var Qe = {
	key: "terrain",
	uniforms: U,
	vertex: (e) => (e = F(e, "#include <common>", "varying vec3 vTWorld;\nvarying vec3 vTNormal;\nvarying vec3 vTLocal;"), e = F(e, "#include <project_vertex>", "vTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTNormal = normalize(mat3(modelMatrix) * objectNormal);\nvTLocal = transformed;"), e),
	fragment: (e) => (e = F(e, "#include <common>", "\n      uniform float uMtnSnow;\n      uniform vec3 uMtnTint;\n      uniform float uMtnHaze;\n      uniform float uRockTex;\n      uniform sampler2D uRockDiff;\n      uniform sampler2D uRockNor;\n      uniform float uRockTile;\n      uniform float uDem;\n      uniform sampler2D uDemDetail;\n      uniform vec4 uDemRect;\n      uniform vec4 uDemElev;\n      uniform float uTerrainSwing;\n      uniform float uTSnowCover;\n      varying vec3 vTWorld;\n      varying vec3 vTNormal;\n      varying vec3 vTLocal;\n      vec3 tRockN;\n      float tCv;\n      float tSnow;\n\n      // Triplanar photographed rock at scale s, weight w: tone relative to the map's mean (the\n      // preset keeps the colour) and a whiteout-blended normal, so steep faces are not smeared.\n      void rockTriplanar(vec3 P, vec3 N, vec3 bw, float s, float w, inout vec3 tone, inout vec3 nrm) {\n        vec2 uvX = P.zy * s, uvY = P.xz * s, uvZ = P.xy * s;\n        vec3 t = texture2D(uRockDiff, uvX).rgb * bw.x + texture2D(uRockDiff, uvY).rgb * bw.y + texture2D(uRockDiff, uvZ).rgb * bw.z;\n        tone += w * t / max(textureLod(uRockDiff, vec2(0.5), 16.0).rgb, vec3(0.02));\n        vec2 m = textureLod(uRockNor, vec2(0.5), 16.0).xy * 2.0 - 1.0;\n        vec3 nX = texture2D(uRockNor, uvX).xyz * 2.0 - 1.0;\n        vec3 nY = texture2D(uRockNor, uvY).xyz * 2.0 - 1.0;\n        vec3 nZ = texture2D(uRockNor, uvZ).xyz * 2.0 - 1.0;\n        const float k = 0.85;   // relief strength\n        nX = vec3((nX.xy - m) * k + N.zy, abs(nX.z) * N.x);\n        nY = vec3((nY.xy - m) * k + N.xz, abs(nY.z) * N.y);\n        nZ = vec3((nZ.xy - m) * k + N.xy, abs(nZ.z) * N.z);\n        nrm += w * normalize(nX.zyx * bw.x + nY.xzy * bw.y + nZ.xyz * bw.z);\n      }"), e = F(e, "void main() {", "\n      // Landscape-plate aerial perspective: near ranges keep their dark value, each farther one is\n      // a step lighter (power curve), so the ranges stack into planes instead of dissolving into\n      // the scene fog. Only a capped share of the ground-hugging fog reaches the ranges' feet.\n      vec3 applyRangeAtmosphere(vec3 col, vec3 wp) {\n        vec3 d = wp - cameraPosition;\n        float t = length(d);\n        vec3 rd = d / max(t, 1e-4);\n        float km = t * 0.001;\n        float low = max(fogDepth(cameraPosition, rd, t) - uHaze * t, 0.0);\n        float od = uMtnHaze * km * sqrt(km) + min(low, 0.5) * 0.25;\n        col = mix(fogColorDir(rd), col, exp(-od));\n        if (uMist > 0.01) col = applyMist(col, cameraPosition, rd, t);\n        return col;\n      }", "before"), e = F(e, "gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);", "gl_FragColor.rgb = applyRangeAtmosphere(gl_FragColor.rgb, vAtmosWorld);", "replace"), e = F(e, "#include <color_fragment>", "\n      tCv = 0.0; tSnow = 0.0;\n      if (uDem < 0.5) {\n        // Rock detail below the mesh resolution: erosion gullies and ledges at ~15-60 m from a\n        // world-space height field, faded by the pixel footprint so distant ranges never shimmer.\n        // It drives the shading normal, crevice darkening and where snow can lie.\n        vec3 P = vTWorld;\n        vec3 N0 = normalize(vTNormal);\n        float fw = length(fwidth(P));\n        float k1 = smoothstep(120.0, 25.0, fw), k2 = smoothstep(40.0, 8.0, fw);\n        #define TH(q) (noise3((q) * 0.022) * 0.65 + noise3((q) * 0.067 + 3.1) * 0.35 * k2)\n        float h = TH(P);\n        const float e = 3.0;\n        vec3 g = vec3(TH(P + vec3(e, 0.0, 0.0)) - h, TH(P + vec3(0.0, e, 0.0)) - h, TH(P + vec3(0.0, 0.0, e)) - h) / e;\n        g -= N0 * dot(N0, g);\n        tRockN = normalize(N0 - g * 38.0 * k1);\n        float crevice = smoothstep(0.62, 0.3, h) * k1;\n        vec3 tone = vec3(1.0);\n        if (uRockTex > 0.5) {\n          // photographed rock: gullies on the near ranges, buttresses (4× the tile) on the far chain\n          vec3 bw = pow(abs(tRockN), vec3(4.0));\n          bw /= bw.x + bw.y + bw.z;\n          float far = smoothstep(1800.0, 3600.0, length(P - cameraPosition));\n          vec3 tsum = vec3(0.0), nsum = vec3(0.0);\n          rockTriplanar(P, tRockN, bw, uRockTile, 1.0 - far, tsum, nsum);\n          rockTriplanar(P, tRockN, bw, uRockTile * 0.25, far, tsum, nsum);\n          tone = mix(vec3(1.0), tsum, 0.85);\n          tRockN = normalize(nsum);\n        }\n        float n = noise2(P.xz * 0.006) * 0.6 + noise2(P.xz * 0.025) * 0.4;\n        float line = mix(1250.0, 30.0, uMtnSnow) + (n - 0.5) * 160.0;\n        float slope = smoothstep(0.42, 0.8, tRockN.y);\n        // snow fills the gullies first and is blown off the ridges\n        float snow = smoothstep(line, line + 60.0, P.y + crevice * 40.0) * slope * step(0.02, uMtnSnow);\n        vec3 rock = uMtnTint * diffuseColor.rgb * tone * (0.78 + 0.34 * (1.0 - crevice) + 0.12 * (h - 0.5));\n        diffuseColor.rgb = mix(rock, vec3(0.9, 0.92, 0.96) * (0.92 + 0.08 * h), snow);\n      } else {\n        // Real landscape (applyDem). Shape and shading come from the elevation data: the detail map\n        // carries the ~25 m normals (ravines, lava ridges, the crater) and the concavity; materials\n        // follow real elevation like the actual mountain: dark forest up to the treeline (higher in\n        // the gullies), fields on the flat lowlands, bare rock above, reddish-brown scoria on the\n        // upper cone, and snow above the weather's snow line, reaching down the gullies in fingers.\n        vec3 L = vTLocal;\n        vec3 N0 = normalize(vTNormal);\n        float e = L.y * uDemElev.x + uDemElev.y + dot(L.xz, L.xz) * uDemElev.z;\n        vec2 duv = vec2((L.x - uDemRect.x) / (uDemRect.y - uDemRect.x), 1.0 - (L.z - uDemRect.z) / (uDemRect.w - uDemRect.z));\n        float inR = smoothstep(0.0, 0.03, min(min(duv.x, 1.0 - duv.x), min(duv.y, 1.0 - duv.y)));\n        vec3 det = texture2D(uDemDetail, clamp(duv, 0.0, 1.0)).rgb;\n        vec3 nl = vec3(det.r * 2.0 - 1.0, 0.0, det.g * 2.0 - 1.0);\n        nl.y = sqrt(max(1.0 - nl.x * nl.x - nl.z * nl.z, 0.02));\n        float cs = cos(uTerrainSwing), sn = sin(uTerrainSwing);\n        tRockN = normalize(mix(N0, vec3(cs * nl.x + sn * nl.z, nl.y, -sn * nl.x + cs * nl.z), inR));\n        float cv = (det.b * 2.0 - 1.0) * inR;\n        tCv = max(cv, 0.0);\n        float slope = tRockN.y;\n        float n1 = noise2(L.xz * 0.0035), n2 = noise2(L.xz * 0.017 + 3.0), n3 = noise2(L.xz * 0.06 + 7.0);\n        float tree = 2350.0 + (n1 - 0.5) * 320.0 + cv * 180.0;\n        float forest = smoothstep(tree + 140.0, tree - 140.0, e) * smoothstep(0.62, 0.85, slope);\n        float field = smoothstep(1150.0, 950.0, e) * smoothstep(0.97, 0.995, slope) * smoothstep(0.35, 0.65, n2);\n        vec3 cForest = vec3(0.03, 0.042, 0.03) * (0.75 + 0.5 * n3);\n        vec3 cField = vec3(0.07, 0.068, 0.045) * (0.85 + 0.3 * n3);\n        vec3 cRock = mix(vec3(0.085, 0.08, 0.075), vec3(0.12, 0.078, 0.06), smoothstep(1800.0, 2600.0, e))\n                   * (0.8 + 0.25 * n2 + 0.15 * (n3 - 0.5));\n        vec3 alb = mix(cRock, cForest, forest);\n        alb = mix(alb, cField, field * (1.0 - 0.5 * forest));\n        alb *= 1.0 - 0.18 * max(cv, 0.0) + 0.06 * max(-cv, 0.0);   // hollows hold shadow, ridges catch light\n        float line = mix(3650.0, 1250.0, uMtnSnow) + (n1 - 0.5) * 260.0 + (n2 - 0.5) * 120.0 - cv * 520.0;\n        line = mix(line, 880.0 + (n1 - 0.5) * 200.0, uTSnowCover);   // fresh snow down to the lake\n        float snow = smoothstep(line, line + 140.0, e) * smoothstep(0.32, 0.62, slope);\n        snow *= mix(1.0, 0.55, forest * (1.0 - smoothstep(line + 200.0, line + 600.0, e)));   // trees poke through\n        diffuseColor.rgb = mix(alb * (uMtnTint / 0.35), vec3(0.86, 0.88, 0.92) * (0.94 + 0.06 * n3), snow);\n        tSnow = snow;\n      }"), e = F(e, "#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(tRockN, 0.0)).xyz);"), e = F(e, "#include <aomap_fragment>", "\n      if (uDem > 0.5) {\n        // forest and rough volcanic ground barely mirror the sky: without this, the grazing view of\n        // distant slopes picks up a pale sheen that flattens the whole mountain toward the sky\n        reflectedLight.indirectSpecular *= 0.2;\n        reflectedLight.directSpecular *= 0.3;\n        reflectedLight.indirectDiffuse *= 1.0 - 0.35 * tCv;   // ravines see less of the sky\n      }"), e = F(e, "#include <emissivemap_fragment>", "totalEmissiveRadiance += (uZenith + uHorizon) * 0.5 * tSnow * uNight * 0.9;"), e)
}, $e = "\nvarying vec3 vWorld;\nvarying vec2 vUv;\nvoid main() {\n  vUv = uv;\n  vec4 wp = modelMatrix * vec4(position, 1.0);\n  vWorld = wp.xyz;\n  gl_Position = projectionMatrix * viewMatrix * wp;\n}", et = `
${z}
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
}`, tt = class {
	group = new f();
	mesh;
	mist = [];
	constructor() {
		let e = new y({
			vertexColors: !0,
			roughness: .94,
			metalness: 0
		});
		P(e, [R, Qe]), this.mesh = new _(Ze(), e), this.mesh.name = "terrain", this.mesh.frustumCulled = !1, this.group.add(this.mesh);
		for (let [e, t, n] of [
			[
				800,
				26,
				.3
			],
			[
				1900,
				140,
				1.7
			],
			[
				4300,
				360,
				3.1
			]
		]) {
			let r = new ne(e * 3.2, t, 1, 1);
			r.translate(0, t * .5 - 4, 0);
			let i = new S({
				vertexShader: $e,
				fragmentShader: et,
				uniforms: {
					...I,
					...U,
					uSeed: { value: n }
				},
				transparent: !0,
				depthWrite: !1,
				premultipliedAlpha: !0,
				side: u
			}), a = new _(r, i);
			a.position.set(0, 0, -e), a.name = "mist-sheet", a.renderOrder = 2, this.mist.push(a), this.group.add(a);
		}
	}
	applyDem(e, t, n) {
		let { az: r, rad: i } = t;
		if (e.length !== (r + 1) * (i + 1)) throw Error(`terrain heights: expected ${(r + 1) * (i + 1)} samples, got ${e.length}`);
		let a = Ze(r, i, t.r0, t.r1, (t, n) => {
			let i = e[n * (r + 1) + t] / 20 - 50;
			return i - 15 * (1 - W(4, 14, i));
		}), o = this.mesh.geometry;
		this.mesh.geometry = a, o.dispose();
		let s = U;
		s.uDemDetail.value = n, s.uDemRect.value.set(t.detail.x0, t.detail.x1, t.detail.z0, t.detail.z1), s.uDemElev.value.set(1 / (t.scale * t.vex), t.base, 1 / (2 * t.earthRadius * t.scale * t.scale), 0), s.uDem.value = 1;
	}
	setLayers(e) {
		e(this.mesh), this.mist.forEach(e);
	}
}, nt = [
	"sunny",
	"cloudy",
	"windy",
	"rain",
	"snow",
	"fog"
], rt = {
	sunny: "SUNNY · 晴",
	cloudy: "CLOUDY · 多云",
	windy: "WINDY · 大风",
	rain: "RAIN · 雨",
	snow: "SNOW · 雪",
	fog: "FOG · 雾"
}, K = {
	sunEl: .42,
	sunAz: -1.55,
	sunI: 2.6,
	sunColor: [
		1,
		.95,
		.86
	],
	sunGlow: .45,
	zenith: [
		.16,
		.34,
		.78
	],
	horizon: [
		.62,
		.72,
		.86
	],
	fogCol: [
		.68,
		.76,
		.86
	],
	fogDens: .003,
	fogFall: .25,
	haze: 8e-5,
	mist: 0,
	cloudCover: .24,
	cloudDens: 1.1,
	cloudBase: 1300,
	cloudTop: 3400,
	cloudType: 1,
	cloudStretch: 0,
	cloudSpeed: 6,
	towers: 0,
	cloudTint: [
		1,
		1,
		1
	],
	cloudAmb: .8,
	mtnSnow: .25,
	mtnTint: [
		.36,
		.35,
		.35
	],
	mtnHaze: .014,
	mistSheets: .12,
	sandCol: [
		.5,
		.47,
		.43
	],
	groundWet: .65,
	puddle: .18,
	snowCover: 0,
	dust: 0,
	envI: 1,
	fill: [
		0,
		0,
		0
	],
	key: [
		4,
		3.8,
		3.55
	],
	shadowRadius: 7,
	ballEnv: .25,
	rainRate: 0,
	snowRate: 0,
	sandRate: 0,
	motes: .4,
	wind: .15,
	windAngle: 2.8,
	exposure: 1.05,
	bloom: .12,
	bloomRadius: .15,
	threshold: 4,
	rays: 0,
	streak: 0,
	dof: .35,
	lift: [
		0,
		.006,
		.014
	],
	gain: [
		1,
		.99,
		.975
	],
	sat: 1.06,
	contrast: 1.04,
	curve: .12,
	white: .96,
	halation: .08,
	vignette: .25,
	grain: .005
}, it = {
	sunny: K,
	cloudy: {
		...K,
		sunEl: .5,
		sunAz: .5,
		sunI: 1.25,
		sunColor: [
			1,
			.96,
			.92
		],
		sunGlow: .35,
		zenith: [
			.55,
			.62,
			.74
		],
		horizon: [
			.82,
			.84,
			.88
		],
		fogCol: [
			.8,
			.83,
			.88
		],
		fogDens: .004,
		haze: 1e-4,
		cloudCover: .42,
		cloudDens: 1,
		cloudBase: 1100,
		cloudTop: 2700,
		cloudType: .75,
		cloudSpeed: 10,
		towers: .6,
		cloudTint: [
			.97,
			.98,
			1
		],
		cloudAmb: .95,
		mtnSnow: .6,
		mtnTint: [
			.32,
			.33,
			.36
		],
		mtnHaze: .042,
		mistSheets: .3,
		sandCol: [
			.44,
			.44,
			.45
		],
		groundWet: .72,
		puddle: .28,
		envI: 1,
		fill: [
			.03,
			.03,
			.035
		],
		key: [
			3.4,
			3.25,
			3.05
		],
		shadowRadius: 14,
		ballEnv: .2,
		motes: 0,
		wind: .3,
		exposure: 1.5,
		bloom: .25,
		threshold: 2,
		rays: .06,
		streak: 0,
		dof: .5,
		halation: .15,
		lift: [
			0,
			.006,
			.016
		],
		gain: [
			.97,
			.99,
			1.03
		],
		sat: .92
	},
	windy: {
		...K,
		sunEl: .42,
		sunAz: .6,
		sunI: 1.9,
		sunColor: [
			1,
			.95,
			.88
		],
		sunGlow: .6,
		zenith: [
			.55,
			.62,
			.74
		],
		horizon: [
			.88,
			.88,
			.88
		],
		fogCol: [
			.86,
			.83,
			.79
		],
		fogDens: .006,
		haze: 14e-5,
		cloudCover: .34,
		cloudDens: .7,
		cloudBase: 1600,
		cloudTop: 2700,
		cloudType: .35,
		cloudStretch: 1,
		cloudSpeed: 45,
		towers: .2,
		cloudTint: [
			1,
			.99,
			.98
		],
		cloudAmb: .85,
		mtnSnow: .2,
		mtnTint: [
			.42,
			.37,
			.32
		],
		mtnHaze: .052,
		mistSheets: 0,
		sandCol: [
			.5,
			.47,
			.42
		],
		groundWet: .15,
		puddle: 0,
		dust: 1,
		envI: 1,
		fill: [
			.03,
			.03,
			.035
		],
		key: [
			3.2,
			3,
			2.75
		],
		shadowRadius: 9,
		ballEnv: .22,
		sandRate: 1,
		motes: 0,
		wind: 1,
		exposure: 1.42,
		bloom: .25,
		threshold: 2.2,
		rays: .1,
		streak: .08,
		dof: .5,
		halation: .2,
		gain: [
			.99,
			.98,
			.97
		],
		sat: .92
	},
	rain: {
		...K,
		sunEl: .5,
		sunAz: -1.75,
		sunI: 1.5,
		sunColor: [
			1,
			.96,
			.9
		],
		sunGlow: .1,
		zenith: [
			.24,
			.27,
			.35
		],
		horizon: [
			.22,
			.25,
			.32
		],
		fogCol: [
			.19,
			.22,
			.29
		],
		fogDens: .009,
		haze: 16e-5,
		mist: .2,
		cloudCover: 1,
		cloudDens: 1.4,
		cloudBase: 700,
		cloudTop: 3800,
		cloudType: .2,
		cloudSpeed: 12,
		towers: 0,
		cloudTint: [
			.4,
			.43,
			.5
		],
		cloudAmb: .85,
		mtnSnow: .35,
		mtnTint: [
			.26,
			.27,
			.3
		],
		mtnHaze: .05,
		mistSheets: .5,
		sandCol: [
			.36,
			.37,
			.39
		],
		groundWet: 1,
		puddle: .9,
		envI: 1,
		fill: [
			.03,
			.03,
			.035
		],
		key: [
			2,
			1.78,
			1.5
		],
		shadowRadius: 18,
		ballEnv: .25,
		rainRate: 1,
		motes: 0,
		wind: .3,
		exposure: 1.6,
		bloom: .25,
		threshold: 1.8,
		rays: 0,
		streak: 0,
		dof: .8,
		halation: .1,
		lift: [
			0,
			.008,
			.02
		],
		gain: [
			.98,
			.99,
			1.01
		],
		sat: .8
	},
	snow: {
		...K,
		sunEl: .6,
		sunAz: -1.75,
		sunI: 2.8,
		sunColor: [
			1,
			.9,
			.78
		],
		sunGlow: .3,
		zenith: [
			.36,
			.46,
			.66
		],
		horizon: [
			.8,
			.84,
			.9
		],
		fogCol: [
			.82,
			.85,
			.91
		],
		fogDens: .005,
		haze: 1e-4,
		mist: .15,
		cloudCover: .7,
		cloudDens: .8,
		cloudBase: 900,
		cloudTop: 2600,
		cloudType: .15,
		cloudSpeed: 6,
		towers: .15,
		cloudTint: [
			1,
			1,
			1
		],
		cloudAmb: .9,
		mtnSnow: .45,
		mtnTint: [
			.24,
			.25,
			.29
		],
		mtnHaze: .035,
		mistSheets: .35,
		sandCol: [
			.46,
			.46,
			.48
		],
		groundWet: .2,
		puddle: 0,
		snowCover: 1,
		envI: .7,
		fill: [
			0,
			0,
			0
		],
		key: [
			2.6,
			2.4,
			2.1
		],
		shadowRadius: 16,
		ballEnv: .35,
		snowRate: 1,
		motes: 0,
		wind: .2,
		exposure: .92,
		bloom: .3,
		threshold: 2,
		rays: .04,
		streak: 0,
		dof: .6,
		halation: .15,
		lift: [
			0,
			.006,
			.016
		],
		gain: [
			.98,
			.99,
			1.02
		],
		sat: .95
	},
	fog: {
		...K,
		sunEl: .55,
		sunAz: .25,
		sunI: .6,
		sunColor: [
			1,
			.97,
			.93
		],
		sunGlow: .3,
		zenith: [
			.7,
			.74,
			.8
		],
		horizon: [
			.84,
			.86,
			.89
		],
		fogCol: [
			.8,
			.82,
			.86
		],
		fogDens: .008,
		fogFall: .2,
		haze: 2e-4,
		mist: .85,
		cloudCover: .55,
		cloudDens: .4,
		cloudBase: 2500,
		cloudTop: 4e3,
		cloudType: 0,
		towers: 0,
		cloudAmb: 1,
		mtnSnow: .35,
		mtnTint: [
			.26,
			.27,
			.3
		],
		mtnHaze: .065,
		mistSheets: .95,
		sandCol: [
			.6,
			.61,
			.63
		],
		groundWet: .72,
		puddle: .45,
		envI: 1,
		fill: [
			.03,
			.03,
			.035
		],
		key: [
			2.8,
			2.75,
			2.7
		],
		shadowRadius: 16,
		ballEnv: .22,
		motes: 0,
		wind: .08,
		exposure: 1.38,
		bloom: .35,
		threshold: 1.2,
		rays: .04,
		streak: 0,
		dof: .7,
		halation: .1,
		gain: [
			.98,
			.99,
			1.02
		],
		sat: .75
	}
}, at = {
	duskStart: 17.5,
	duskEnd: 19.25,
	dawnStart: 4.75,
	dawnEnd: 6.5
}, q = {
	moonAz: .36,
	moonEl: .21,
	moonColor: [
		.62,
		.72,
		.95
	],
	moonI: .32,
	moonPhase: "real",
	skyScale: .035,
	skyTint: [
		.55,
		.72,
		1.35
	],
	skyFloor: [
		.012,
		.018,
		.04
	],
	cloudLight: .025,
	exposure: 1.7,
	key: [
		.42,
		.5,
		.7
	],
	stars: 1
}, ot = [
	.42,
	.16,
	.05
], st = [
	1,
	.62,
	.38
], ct = 29.530588853, lt = Date.UTC(2e3, 0, 6, 18, 14), J = (e, t, n) => {
	let r = O((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
};
function ut(e) {
	let t = at;
	return e >= 12 ? J(t.duskStart, t.duskEnd, e) : 1 - J(t.dawnStart, t.dawnEnd, e);
}
function dt(e) {
	return ((e.getTime() - lt) / 864e5 / ct % 1 + 1) % 1;
}
var ft = class {
	now;
	mode = "auto";
	night = 0;
	twilight = 0;
	phase = .5;
	illum = 1;
	moonOverride = null;
	moonAz = q.moonAz;
	moonEl = q.moonEl;
	out = null;
	constructor(e = () => /* @__PURE__ */ new Date()) {
		this.now = e;
	}
	setMode(e) {
		this.mode = e, this.moonOverride = null;
	}
	snap() {
		this.night = this.target(), this.twilight = 0;
	}
	get isNight() {
		return this.night > .5;
	}
	target() {
		if (this.mode === "day") return 0;
		if (this.mode === "night") return 1;
		let e = this.now();
		return ut(e.getHours() + e.getMinutes() / 60 + e.getSeconds() / 3600);
	}
	update(e) {
		this.night = A(this.night, this.target(), .7, e), Math.abs(this.night - Math.round(this.night)) < .001 && (this.night = Math.round(this.night)), this.twilight = Math.sin(Math.PI * O(this.night, 0, 1));
		let t = q.moonPhase === "real" ? dt(this.now()) : q.moonPhase, n = (1 - Math.cos(2 * Math.PI * t)) / 2, r = .14;
		if (n < r) {
			let e = t < .5, n = Math.acos(1 - 2 * r) / (2 * Math.PI);
			this.phase = e ? n : 1 - n;
		} else this.phase = t;
		this.illum = (1 - Math.cos(2 * Math.PI * this.phase)) / 2;
		let i = this.moonOverride;
		this.moonAz = A(this.moonAz, i ? i.az : q.moonAz, i ? 9 : .9, e), this.moonEl = A(this.moonEl, i ? i.el : q.moonEl, i ? 9 : .9, e);
	}
	apply(e) {
		let t = this.night, n = this.out ??= pt(e);
		if (mt(e, n), t <= 0 && this.twilight <= 0) return n;
		let r = this.twilight * (1 - .7 * e.cloudCover), i = q, a = (e, n, a) => {
			for (let o = 0; o < 3; o++) {
				let s = e[o] * i.skyScale * i.skyTint[o] + i.skyFloor[o];
				n[o] = k(e[o], s, t) + r * ot[o] * a * (1 - .6 * t);
			}
		};
		a(e.zenith, n.zenith, .25), a(e.horizon, n.horizon, 1), a(e.fogCol, n.fogCol, .7);
		let o = 1 - J(0, .5, t), s = J(.5, 1, t);
		if (t < .5) {
			n.sunI = e.sunI * o;
			for (let t = 0; t < 3; t++) n.sunColor[t] = k(e.sunColor[t], st[t], O(this.twilight * 1.2, 0, 1));
		} else {
			n.sunAz = this.moonAz, n.sunEl = this.moonEl, n.sunI = i.moonI * (.6 + .4 * this.illum) * (1 - .75 * e.cloudCover) * s;
			for (let e = 0; e < 3; e++) n.sunColor[e] = i.moonColor[e];
		}
		n.sunGlow = k(e.sunGlow, .15, t), n.exposure = e.exposure * k(1, i.exposure, t);
		for (let r = 0; r < 3; r++) n.key[r] = e.key[r] * k(1, i.key[r], t), n.fill[r] = e.fill[r] * (1 - .6 * t), n.lift[r] = e.lift[r] + t * [
			0,
			.004,
			.012
		][r];
		return n.motes = e.motes * (1 - t), n.rays = e.rays * (1 - t), n.streak = e.streak * (1 - t), n.sat = e.sat * k(1, .88, t), n.vignette = e.vignette + .12 * t, n.halation = e.halation + .06 * t, n;
	}
	cloudLight() {
		return k(1, q.cloudLight, this.night);
	}
	stars(e) {
		return q.stars * J(.55, .95, this.night) * O(1 - e.cloudCover * 1.15, 0, 1) * (1 - e.mist);
	}
	moonDisc() {
		return J(.5, .9, this.night);
	}
};
function pt(e) {
	let t = {};
	for (let n in e) {
		let r = e[n];
		t[n] = Array.isArray(r) ? [...r] : r;
	}
	return t;
}
function mt(e, t) {
	let n = e, r = t;
	for (let e in n) {
		let t = n[e];
		if (Array.isArray(t)) {
			let n = r[e];
			n[0] = t[0], n[1] = t[1], n[2] = t[2];
		} else r[e] = t;
	}
}
//#endregion
//#region src/characters/types.ts
var Y = {
	apex: 2.45,
	below: 1.05,
	radius: 2.45,
	theta: .86,
	ribs: 8
};
//#endregion
//#region src/characters/ball/faceGlsl.ts
function ht() {
	return {
		uGaze: { value: new w() },
		uEyeA: { value: new E(1, 0, 0, 0) },
		uEyeB: { value: new E() },
		uEyeTilt: { value: .1 }
	};
}
var gt = "\nuniform vec2 uGaze;\nuniform vec4 uEyeA;\nuniform vec4 uEyeB;\nuniform float uEyeTilt;\n\nmat2 faceRot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }\nfloat sdCapsuleV(vec2 p, float r, float h) { p.y -= clamp(p.y, -h, h); return length(p) - r; }\nfloat sdSeg(vec2 p, vec2 a, vec2 b) {\n  vec2 pa = p - a, ba = b - a;\n  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));\n}\nfloat sdArc(vec2 p, float ap, float ra, float rb) {\n  vec2 sc = vec2(sin(ap), cos(ap));\n  p.x = abs(p.x);\n  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;\n}\n\nfloat eyeShape(vec2 p, float side) {\n  p = faceRot2(uEyeTilt) * p;\n  float open = uEyeA.x * (1.0 - 0.55 * uEyeA.w);\n  float sy = max(open, 0.07);\n  float r = mix(0.088, 0.112, uEyeA.z);\n  float h = mix(0.108, 0.085, uEyeA.z);\n  float d = sdCapsuleV(vec2(p.x, p.y / sy), r, h) * sy;\n  float dHappy = sdArc(p + vec2(0.0, 0.06), 1.15, 0.11, 0.03);\n  float dSleepy = sdArc(vec2(p.x, -p.y) + vec2(0.0, 0.07), 0.95, 0.1, 0.022);\n  float dX = min(sdSeg(p, vec2(-0.085, -0.09), vec2(0.085, 0.09)), sdSeg(p, vec2(-0.085, 0.09), vec2(0.085, -0.09))) - 0.026;\n  vec2 pc = vec2(-side * p.x, p.y);\n  float dChev = min(sdSeg(pc, vec2(-0.075, 0.095), vec2(0.07, 0.0)), sdSeg(pc, vec2(-0.075, -0.095), vec2(0.07, 0.0))) - 0.028;\n  d = mix(d, dHappy, uEyeA.y);\n  d = mix(d, dSleepy, uEyeB.x);\n  d = mix(d, dX, uEyeB.y);\n  d = mix(d, dChev, uEyeB.z);\n  return d;\n}\n\nvec3 faceMask(vec3 lp, float aa) {\n  vec3 res = vec3(0.0);\n  for (int i = 0; i < 2; i++) {\n    float side = i == 0 ? -1.0 : 1.0;\n    float yaw = uGaze.x + side * 0.26;\n    float pitch = uGaze.y + 0.1;\n    vec3 e = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));\n    if (dot(lp, e) < 0.75) continue;\n    vec3 tx = vec3(cos(yaw), 0.0, -sin(yaw));\n    vec3 ty = cross(e, tx);\n    vec2 p = vec2(dot(lp, tx), dot(lp, ty));\n    float d = eyeShape(p, side);\n    res.x = max(res.x, 1.0 - smoothstep(-aa, aa, d));\n    res.y = max(res.y, smoothstep(0.05, 0.0, d) * smoothstep(-0.01, 0.008, d));\n    vec2 bp = (p - vec2(side * 0.12, -0.25)) * vec2(1.0, 1.5);\n    res.z = max(res.z, exp(-dot(bp, bp) / 0.006));\n  }\n  return res;\n}\n";
//#endregion
//#region src/characters/ball/surfacePatch.ts
function _t() {
	return {
		...ht(),
		uDent: { value: new E(0, 0, 1, 0) },
		uSnowCap: { value: new E(0, 1, 0, 0) },
		uWet: { value: 0 },
		uKeyDir: { value: new T(-.63, .57, .52).normalize() },
		uKeyCol: { value: new o(0, 0, 0) },
		uFillDir: { value: new T(-.4, .5, .75).normalize() },
		uFillCol: { value: new o(.13, .125, .12) },
		uEnvGain: { value: 1 },
		uBodyCenter: { value: new T() },
		uBodyRadius: { value: 1 }
	};
}
var vt = "\nuniform vec4 uSnowCap;\n// a ragged edge: broad scallops plus small chunks that break off the rim\nfloat snowEdge(vec3 lp) {\n  float edgeN = (noise3(lp * 5.0 + 2.3) - 0.5) * 0.24 + (noise3(lp * 13.0 + 7.1) - 0.5) * 0.12;\n  return dot(lp, uSnowCap.xyz) - (mix(0.93, 0.4, uSnowCap.w) + edgeN);\n}\n// thickness: a pile of soft clumps with a lip at the edge (it rises quickly, so the rim overhangs)\nfloat snowThick(vec3 lp) {\n  if (uSnowCap.w <= 0.001) return 0.0;\n  float m = smoothstep(0.0, 0.07, snowEdge(lp));\n  float lumps = 0.62 + 0.55 * noise3(lp * 8.0 + 1.1) + 0.38 * noise3(lp * 21.0);\n  return uSnowCap.w * 0.22 * m * lumps;\n}\n";
function yt(e, t) {
	return {
		key: `ballsurface-${t.face ? "f" : ""}${t.dent ? "d" : ""}`,
		uniforms: e,
		vertex: (e) => (e = F(e, "#include <common>", "\n        uniform vec4 uDent;\n        uniform vec3 uBodyCenter;\n        uniform float uBodyRadius;\n        varying vec3 vBodyLocal;\n        varying float vBodyWorldY;\n        varying vec3 vBodyX; varying vec3 vBodyY; varying vec3 vBodyZ;"), e = F(e, "#include <begin_vertex>", `
        vBodyLocal = (position - uBodyCenter) / uBodyRadius;
        ${t.dent ? "{\n          vec3 bd = normalize(vBodyLocal);\n          transformed -= objectNormal * uDent.w * uBodyRadius * exp(-(1.0 - dot(bd, uDent.xyz)) * 9.0);\n        }" : ""}
        vBodyX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vBodyY = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vBodyZ = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        vBodyWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`), e),
		fragment: (e) => (e = F(e, "#include <common>", `
        ${j}
        ${t.face ? gt : ""}
        ${vt}
        uniform float uWet;
        uniform vec3 uKeyDir;
        uniform vec3 uKeyCol;
        uniform vec3 uFillDir;
        uniform vec3 uFillCol;
        uniform float uEnvGain;
        varying vec3 vBodyLocal;
        varying float vBodyWorldY;
        varying vec3 vBodyX; varying vec3 vBodyY; varying vec3 vBodyZ;
        vec3 bFace; float bDrop; vec3 bDropN;`), e = F(e, "#include <color_fragment>", `
        {
          vec3 lp = normalize(vBodyLocal);
          ${t.face ? "\n          float aa = max(length(fwidth(lp)) * 1.2, 0.004);\n          bFace = faceMask(lp, aa);\n          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.66, 0.64), bFace.z * uEyeB.w * 0.55);\n          diffuseColor.rgb *= 1.0 - bFace.y * 0.22;" : "bFace = vec3(0.0);"}
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
        }`), e = F(e, "#include <roughnessmap_fragment>", "\n        roughnessFactor = mix(roughnessFactor, 0.14, uWet);\n        roughnessFactor = mix(roughnessFactor, 0.06, bDrop);\n        roughnessFactor = mix(roughnessFactor, 0.9, bFace.x);"), e = F(e, "#include <normal_fragment_maps>", "\n        if (bDrop > 0.0) {\n          vec3 dvv = bDropN.x * vBodyX + bDropN.y * vBodyY + bDropN.z * vBodyZ;\n          normal = normalize(normal + dvv * bDrop * 1.4);\n        }"), e = F(e, "#include <lights_physical_fragment>", "\n        // eyes are matte: no clearcoat, no specular, no sheen, so they never mirror the sky\n        material.specularColor *= 1.0 - bFace.x;\n        material.specularF90 *= 1.0 - bFace.x;\n        #ifdef USE_CLEARCOAT\n          material.clearcoat = mix(material.clearcoat, 1.0, bDrop) * (1.0 - bFace.x);\n          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.06, bDrop);\n        #endif\n        #ifdef USE_SHEEN\n          material.sheenColor *= 1.0 - bFace.x;\n        #endif"), e = F(e, "#include <aomap_fragment>", "\n        {\n          // the ground hides the lower hemisphere's sky: darken toward the contact point\n          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);\n          float gao = 1.0 - 0.62 * exp(-max(vBodyWorldY, 0.0) * 2.6) * smoothstep(0.3, -0.85, nW.y);\n          float envK = gao * uEnvGain;\n          // the glaze keeps more of its sky reflection than the body keeps of the sky's light\n          float envS = gao * mix(uEnvGain, 1.0, 0.5);\n          reflectedLight.indirectDiffuse *= envK;\n          reflectedLight.indirectSpecular *= envS;\n          #ifdef USE_CLEARCOAT\n            clearcoatSpecularIndirect *= envS;\n          #endif\n          #ifdef USE_SHEEN\n            sheenSpecularIndirect *= envK;\n          #endif\n          // camera-side fill (a bounce card): not part of the sky probe, so not scaled by uEnvGain\n          vec3 fv = normalize((viewMatrix * vec4(uFillDir, 0.0)).xyz);\n          float kd = saturate(dot(normal, fv) * 0.6 + 0.4);\n          reflectedLight.indirectDiffuse += uFillCol * diffuseColor.rgb * kd * kd * (1.0 - bFace.x) * mix(1.0, gao, 0.5);\n        }"), e = F(e, "#include <lights_fragment_end>", "\n        {\n          vec3 V = geometryViewDir;\n          #if NUM_DIR_LIGHTS > 0\n            vec3 Ls = directionalLights[0].direction;\n            vec3 Lc = directionalLights[0].color * RECIPROCAL_PI;\n            float NoL = dot(normal, Ls);\n            float sssBand = smoothstep(-0.4, 0.1, NoL) * (1.0 - smoothstep(0.1, 0.55, NoL));\n            // contre-jour rim: a thin hot edge on the sun side when the sun is behind the ball,\n            // brighter than the sky it sits against so the silhouette reads\n            float edge = 1.0 - max(dot(normal, V), 0.0);\n            float back = pow(max(dot(V, -Ls), 0.0), 2.0) * edge * edge * edge * edge * edge * saturate(NoL * 1.6 + 0.35);\n            float skin = 1.0 - bFace.x;\n            reflectedLight.directDiffuse += Lc * skin * (sssBand * vec3(0.32, 0.17, 0.08) * 0.55 + back * vec3(1.0, 0.86, 0.68) * 2.2);\n          #endif\n        }\n        {\n          // Portrait key (studio light on the character, not shadowed): a softly wrapped diffuse\n          // falloff into a real core shadow, a warm band at the terminator where light scatters\n          // under the glaze, and the glaze's broad satin highlight on the lit shoulder.\n          vec3 kv = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);\n          float nl = dot(normal, kv);\n          float wrapD = pow(saturate((nl + 0.45) / 1.45), 1.6);   // long, soft falloff into the core shadow\n          float band = smoothstep(-0.25, 0.05, nl) * (1.0 - smoothstep(0.05, 0.45, nl));\n          float skinK = 1.0 - bFace.x;\n          reflectedLight.directDiffuse += uKeyCol * (wrapD * BRDF_Lambert(material.diffuseColor) + band * vec3(0.05, 0.022, 0.008) * skinK);\n          reflectedLight.directSpecular += uKeyCol * saturate(nl) * BRDF_GGX(kv, geometryViewDir, normal, material) * skinK * 2.2;\n        }"), e)
	};
}
function bt(e) {
	return {
		key: "snowcap",
		uniforms: e,
		vertex: (e) => (e = F(e, "#include <common>", `${j}\n${vt}\nuniform vec4 uDent;\nvarying float vSnowT;\nvarying vec3 vSnowLocal;\nvarying vec3 vSnowBX;\nvarying vec3 vSnowBY;\nvarying vec3 vSnowBZ;`), e = F(e, "#include <beginnormal_vertex>", "\n        vec3 sd0 = normalize(position);\n        vec3 st = normalize(abs(sd0.y) < 0.95 ? cross(sd0, vec3(0.0, 1.0, 0.0)) : cross(sd0, vec3(1.0, 0.0, 0.0)));\n        vec3 sb = cross(sd0, st);\n        float dentAt = uDent.w * exp(-(1.0 - dot(sd0, uDent.xyz)) * 9.0);\n        float t0 = snowThick(sd0);\n        vec3 p0 = sd0 * (1.0 + t0 * 1.0 - dentAt);\n        vec3 d1 = normalize(sd0 + st * 0.02);\n        vec3 d2 = normalize(sd0 + sb * 0.02);\n        vec3 p1 = d1 * (1.0 + snowThick(d1) - dentAt);\n        vec3 p2 = d2 * (1.0 + snowThick(d2) - dentAt);\n        vec3 snowN = normalize(cross(p1 - p0, p2 - p0));\n        if (dot(snowN, sd0) < 0.0) snowN = -snowN;\n        vSnowT = t0;\n        vSnowLocal = sd0;\n        // body-space axes in view space, to turn grain tilts into view-space normals\n        vSnowBX = normalMatrix[0]; vSnowBY = normalMatrix[1]; vSnowBZ = normalMatrix[2];\n        objectNormal = snowN;"), e = F(e, "#include <begin_vertex>", "transformed = p0 * 1.004;"), e),
		fragment: (e) => (e = F(e, "#include <common>", `${j}
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
        float snowGrainH(vec3 p) { return noise3(p * 26.0) * 0.55 + noise3(p * 61.0 + 4.0) * 0.45; }`), e = F(e, "#include <clipping_planes_fragment>", "if (vSnowT < 0.004) discard;"), e = F(e, "#include <normal_fragment_maps>", "\n        {\n          // granular snow below the mesh resolution: clumps and grains tilt the normal, and the\n          // hollows between them see only the (blue) skylight. Faded by the pixel footprint.\n          vec3 p = vSnowLocal;\n          float k = smoothstep(0.03, 0.006, length(fwidth(p)));\n          float h = snowGrainH(p);\n          const float e = 0.004;\n          vec3 g = (vec3(snowGrainH(p + vec3(e, 0.0, 0.0)), snowGrainH(p + vec3(0.0, e, 0.0)), snowGrainH(p + vec3(0.0, 0.0, e))) - h) / e;\n          g -= p * dot(p, g);\n          sL2V = mat3(normalize(vSnowBX), normalize(vSnowBY), normalize(vSnowBZ));\n          normal = normalize(normal - (sL2V * g) * 0.012 * k);\n          sCav = smoothstep(0.5, 0.2, h) * k;\n        }"), e = F(e, "#include <aomap_fragment>", "\n        reflectedLight.indirectDiffuse *= min(1.0, uEnvGain + 0.1) * (1.0 - 0.2 * sCav);\n        reflectedLight.indirectSpecular *= min(1.0, uEnvGain + 0.1);\n        reflectedLight.directDiffuse *= 1.0 - 0.55 * sCav;\n        {\n          // the portrait key lights the cap as it lights the ball (snow wraps light more softly)\n          vec3 kv = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);\n          reflectedLight.directDiffuse += uKeyCol * saturate((dot(normal, kv) + 0.3) / 1.3) * BRDF_Lambert(material.diffuseColor) * (1.0 - 0.55 * sCav);\n        }"), e = F(e, "#include <emissivemap_fragment>", "\n        {\n          // fresh snow scatters light inside the pack: a little lift, bluish, less in the hollows\n          totalEmissiveRadiance += (uFillCol * 1.1 + vec3(0.08, 0.09, 0.11)) * (1.0 - 0.6 * sCav);\n          // ice crystals: a few grains have a facet that flashes when it faces the viewer; the\n          // flash follows the view smoothly (no popping) and is at least a pixel or two across\n          vec3 q = vSnowLocal * 90.0;\n          vec3 id = floor(q);\n          float px = length(fwidth(q));   // outside the branch: derivatives need uniform control flow\n          if (hash13(id) > 0.93) {\n            vec3 f = fract(q) - 0.5;\n            float dotm = 1.0 - smoothstep(0.3 - px * 0.5, 0.3 + px * 0.5, length(f));\n            vec3 facet = normalize(sL2V * normalize(normalize(vSnowLocal) + (hash33(id + 3.1) - 0.5) * 1.6));\n            float tw = pow(max(dot(normalize(vViewPosition), facet), 0.0), 24.0);\n            totalEmissiveRadiance += (vec3(1.1) + uSunCol * uSunSpec * 0.4) * tw * dotm;\n          }\n        }"), e)
	};
}
//#endregion
//#region src/characters/ball/GltfBall.ts
var xt = (e) => e.isMeshStandardMaterial === !0, St = class {
	root = new f();
	radius;
	uniforms = _t();
	squash = new f();
	body = new f();
	morphTargets = [];
	cap = null;
	meshes = [];
	constructor(e, n) {
		this.radius = n.radius ?? 1, this.uniforms.uBodyRadius.value = this.radius;
		let r = e.scene;
		r.updateMatrixWorld(!0);
		let i = new t().setFromObject(r, !0).getCenter(new T()), a = 0, o = new T();
		r.traverse((e) => {
			let t = e, n = t.isMesh ? t.geometry.getAttribute("position") : null;
			if (n) for (let e = 0; e < n.count; e++) a = Math.max(a, o.fromBufferAttribute(n, e).applyMatrix4(t.matrixWorld).distanceTo(i));
		}), a ||= 1;
		let s = n.fit === void 0 || n.fit === "auto" ? this.radius / a : n.fit, c = new g().makeScale(s, s, s).multiply(new g().makeTranslation(-i.x, -i.y, -i.z));
		if (n.forward) {
			let e = new x().setFromUnitVectors(new T(...n.forward).normalize(), new T(0, 0, 1));
			c.premultiply(new g().makeRotationFromQuaternion(e));
		}
		let l = n.face?.mode ?? "procedural", u = yt(this.uniforms, {
			face: l === "procedural",
			dent: !1
		}), d = new f();
		r.traverse((e) => {
			let t = e;
			if (t.isMesh && (t.isSkinnedMesh || (t.geometry = t.geometry.clone(), t.geometry.applyMatrix4(new g().multiplyMatrices(c, t.matrixWorld)), t.position.set(0, 0, 0), t.quaternion.identity(), t.scale.set(1, 1, 1)), (Array.isArray(t.material) ? t.material : [t.material]).forEach((e) => {
				xt(e) && P(e, [R, u]);
			}), t.castShadow = !0, this.meshes.push(t), l === "morph" && t.morphTargetDictionary && n.face?.morphs)) {
				let e = {};
				for (let [r, i] of Object.entries(n.face.morphs)) {
					let n = t.morphTargetDictionary[i];
					n !== void 0 && (e[r] = n);
				}
				this.morphTargets.push({
					mesh: t,
					map: e
				});
			}
		});
		for (let e of this.meshes) e.isSkinnedMesh || d.add(e);
		if (this.meshes.some((e) => e.isSkinnedMesh) && (r.applyMatrix4(c), d.add(r)), n.snowShell !== !1) {
			let e = new y({
				color: 16185599,
				roughness: .88
			});
			P(e, [R, bt(this.uniforms)]), this.cap = new _(new C(this.radius * 1, 192, 144), e), this.cap.visible = !1, d.add(this.cap);
		}
		this.body.add(d), this.squash.add(this.body), this.root.add(this.squash), this.root.name = "ball-root";
	}
	setEnvIntensity(e) {
		this.uniforms.uEnvGain.value = e;
	}
	forEachMesh(e) {
		this.meshes.forEach(e), this.cap && e(this.cap);
	}
	update(e) {
		this.root.position.fromArray(e.position), this.squash.scale.fromArray(e.scale).multiplyScalar(1 / this.radius), this.body.quaternion.fromArray(e.quaternion);
		let t = this.uniforms;
		t.uSnowCap.value.set(e.snow.dir[0], e.snow.dir[1], e.snow.dir[2], e.snow.amount), t.uWet.value = e.wet, t.uGaze.value.set(e.gaze[0], e.gaze[1]);
		let n = e.expression;
		t.uEyeA.value.set(n.open, n.happy, n.surprise, n.squint), t.uEyeB.value.set(n.sleepy, n.dizzy, n.squeeze, n.blush), this.cap && (this.cap.visible = e.snow.amount > .004);
		for (let { mesh: e, map: t } of this.morphTargets) {
			let r = e.morphTargetInfluences;
			if (!r) continue;
			let i = (e, n) => {
				let i = t[e];
				i !== void 0 && (r[i] = n);
			};
			i("blink", 1 - n.open), i("happy", n.happy), i("surprise", n.surprise), i("squint", n.squint), i("sleepy", n.sleepy), i("dizzy", n.dizzy), i("squeeze", n.squeeze), i("blush", n.blush);
		}
	}
	dispose() {
		this.meshes.forEach((e) => e.geometry.dispose()), this.cap?.geometry.dispose();
	}
}, Ct = class {
	root = new f();
	radius = 1;
	uniforms = _t();
	squash = new f();
	body = new f();
	shell;
	cap;
	constructor() {
		let e = new v({
			color: new o().setRGB(.87, .85, .81),
			roughness: .4,
			clearcoat: .28,
			clearcoatRoughness: .32,
			sheen: .3,
			sheenRoughness: .8,
			sheenColor: new o(1, 1, 1)
		});
		P(e, [R, yt(this.uniforms, {
			face: !0,
			dent: !0
		})]), this.shell = new _(new C(1, 160, 112), e), this.shell.castShadow = !0, this.shell.name = "ball";
		let t = new y({
			color: new o().setRGB(.97, .98, 1),
			roughness: .88
		});
		P(t, [R, bt(this.uniforms)]), this.cap = new _(new C(1, 192, 144), t), this.cap.name = "ball-snowcap", this.cap.visible = !1, this.body.add(this.shell, this.cap), this.squash.add(this.body), this.root.add(this.squash), this.root.name = "ball-root";
	}
	forEachMesh(e) {
		e(this.shell), e(this.cap);
	}
	setEnvIntensity(e) {
		this.uniforms.uEnvGain.value = e;
	}
	update(e) {
		this.root.position.fromArray(e.position), this.squash.scale.fromArray(e.scale), this.body.quaternion.fromArray(e.quaternion);
		let t = this.uniforms;
		t.uDent.value.set(e.dent.dir[0], e.dent.dir[1], e.dent.dir[2], e.dent.amount), t.uSnowCap.value.set(e.snow.dir[0], e.snow.dir[1], e.snow.dir[2], e.snow.amount), t.uWet.value = e.wet, t.uGaze.value.set(e.gaze[0], e.gaze[1]);
		let n = e.expression;
		t.uEyeA.value.set(n.open, n.happy, n.surprise, n.squint), t.uEyeB.value.set(n.sleepy, n.dizzy, n.squeeze, n.blush), this.cap.visible = e.snow.amount > .004;
	}
	dispose() {
		this.shell.geometry.dispose(), this.shell.material.dispose(), this.cap.geometry.dispose(), this.cap.material.dispose();
	}
}, wt = class {
	root = new f();
	spin;
	meshes = [];
	q = new x();
	y = new T(0, 1, 0);
	axis = new T();
	baseScale;
	constructor(e, t) {
		this.baseScale = t.scale ?? 1;
		let n = e.scene;
		this.spin = n.getObjectByName(t.spinNode ?? "canopy") ?? null, n.traverse((e) => {
			let n = e;
			n.isMesh && (this.meshes.push(n), n.castShadow = !(t.transmissive ?? []).includes(n.name), (Array.isArray(n.material) ? n.material : [n.material]).forEach((e) => {
				e.isMeshStandardMaterial && P(e, [R]);
			}));
		}), this.root.add(n), this.root.visible = !1, this.root.name = "umbrella";
	}
	forEachMesh(e) {
		this.meshes.forEach(e);
	}
	update(e, t) {
		this.root.visible = e.visible && e.open > .01, this.root.visible && (this.root.position.fromArray(e.anchor), this.axis.fromArray(e.axis), this.root.quaternion.copy(this.q.setFromUnitVectors(this.y, this.axis)), this.root.scale.setScalar(e.open * this.baseScale), this.spin && (this.spin.rotation.y = e.spin));
	}
	dispose() {
		this.meshes.forEach((e) => e.geometry.dispose());
	}
}, X = Y.ribs, Tt = Y.radius, Et = Y.apex - Y.radius, Z = Math.PI * 2, Dt = .045, Ot = 1.6, kt = .5, At = .026, jt = (e) => e.toFixed(5), Mt = (e) => {
	let t = e / Z * X;
	return t - Math.floor(t);
}, Nt = (e) => Y.theta - Dt * Math.sin(Mt(e) * Math.PI) ** 1.3;
function Q(e, t, n = 0) {
	let r = (Mt(t) - .5) * (Z / X), i = Math.cos(Math.PI / X) / Math.cos(r), a = .55 * Math.min(1, e * 2.2), o = Tt * (1 + (i - 1) * a) - n, s = e * Nt(t);
	return new T(Math.sin(s) * Math.cos(t) * o, Et + Math.cos(s) * o, Math.sin(s) * Math.sin(t) * o);
}
function Pt(e, t, i, a, o) {
	let s = [], c = [], l = [], u = .001;
	for (let n = 0; n <= t; n++) for (let r = 0; r <= e; r++) {
		let d = r / e * Z, f = i(d), p = f + (a - f) * (n / t), m = Q(p, d, o), h = Math.max(p, u), g = Q(Math.min(h + u, 1), d, o).sub(Q(Math.max(h - u, 0), d, o)), _ = Q(h, d + u, o).sub(Q(h, d - u, o)), v = new T().crossVectors(_, g).normalize();
		s.push(m.x, m.y, m.z), c.push(v.x, v.y, v.z), l.push(r / e, p);
	}
	let d = [];
	for (let n = 0; n < t; n++) for (let t = 0; t < e; t++) {
		let r = n * (e + 1) + t, i = r + 1, a = r + e + 1, o = a + 1;
		d.push(r, i, a, i, o, a);
	}
	let f = new r();
	return f.setAttribute("position", new n(new Float32Array(s), 3)), f.setAttribute("normal", new n(new Float32Array(c), 3)), f.setAttribute("uv", new n(new Float32Array(l), 2)), f.setIndex(d), f;
}
function Ft(e, t, n) {
	return e.applyQuaternion(new x().setFromUnitVectors(new T(0, 1, 0), n.clone().normalize())), e.translate(t.x, t.y, t.z);
}
var It = "gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld);", Lt = "\n  gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmosWorld)\n    - applyAtmosphere(vec3(0.0), vAtmosWorld) * (1.0 - gl_FragColor.a);", Rt = `
${j}
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
function zt(e) {
	return {
		key: "umbrella-water",
		uniforms: { uCanopyWet: e },
		vertex: (e) => (e = F(e, "#include <common>", "varying vec3 vCanopyLocal;\nvarying float vCanopyT;\nvarying vec3 vCanopyBX;\nvarying vec3 vCanopyBY;\nvarying vec3 vCanopyBZ;"), e = F(e, "#include <begin_vertex>", "vCanopyLocal = position;\nvCanopyT = uv.y;\nvCanopyBX = normalMatrix[0];\nvCanopyBY = normalMatrix[1];\nvCanopyBZ = normalMatrix[2];"), e),
		fragment: (e) => (e = F(e, "#include <common>", Rt), e = F(e, "#include <normal_fragment_maps>", `
        cMilk = 0.02; cBead = 0.0; cDark = 0.0; cLens = 0.0;
        {
          vec3 lp = vCanopyLocal;
          vec3 nl = normalize(lp - vec3(0.0, ${jt(Et)}, 0.0));
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
          float hw = ${jt(At / (Tt * Y.theta))};
          cMilk += smoothstep(1.0 - hw - tw, 1.0 - hw + tw, vCanopyT) * 0.3;
          float gr = fract(phi / 6.2831853 * ${X}.0);
          float seam = min(gr, 1.0 - gr) * ${jt(Z / X * Tt)} * sin(th);
          cMilk += (1.0 - smoothstep(0.004, 0.004 + fw, seam)) * 0.12 * smoothstep(0.08, 0.2, th);
          normal = normalize(normal + faceDirection * (L2V * sl));
        }`), e = F(e, "#include <roughnessmap_fragment>", "roughnessFactor = mix(roughnessFactor, 0.02, cBead);"), e = F(e, "#include <aomap_fragment>", "if (!gl_FrontFacing) { reflectedLight.indirectSpecular *= 0.3; reflectedLight.indirectDiffuse *= 0.7; }"), e = F(e, "#include <emissivemap_fragment>", "\n        {\n          // light from the overcast above (the probe's upper hemisphere): under cloud the sky\n          // overhead is brighter than the low sky seen behind the umbrella, so the wet film and its\n          // beads read lighter than the background, as they do in the rain\n          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);\n          #ifdef USE_ENVMAP\n            cSkyUp = getIBLIrradiance(upV) * RECIPROCAL_PI;\n          #else\n            cSkyUp = uZenith;\n          #endif\n          vec3 V = normalize(vViewPosition);\n          float rim = pow(1.0 - abs(dot(normal, V)), 3.0);\n          // a bead mirrors the bright sky overhead in a small glint and refracts it in its lower half\n          float glint = cBead * smoothstep(0.75, 0.97, dot(reflect(-V, normal), upV));\n          totalEmissiveRadiance += cSkyUp * (rim * 0.04 + cLens * 1.1 + cBead * 0.15 + glint * 2.2);\n        }"), e = F(e, "#include <opaque_fragment>", "\n        {\n          #ifdef CANOPY_DEPTH\n            // depth-only pass: beads, hem and seams are surfaces at the umbrella's distance, so the\n            // depth of field keeps them in focus (the rest of the clear film takes the background's)\n            if (cBead < 0.35 && cMilk < 0.2) discard;\n          #endif\n          float nv = abs(dot(normal, normalize(vViewPosition)));\n          float refl = 0.04 + 0.96 * pow(1.0 - nv, 5.0);\n          float a = clamp(refl * 0.85 + cMilk + cDark * 0.45 + cLens * 0.25, 0.0, 1.0);\n          // scattered light (white film lit by sky and key light); forward scattering through the wet\n          // film favours the bright light above, so it reads lighter than the low sky behind it\n          gl_FragColor = vec4((totalDiffuse + cSkyUp * 0.5) * cMilk * 1.4 + totalSpecular + totalEmissiveRadiance, a);\n        }", "replace"), e = F(e, It, Lt, "replace"), e)
	};
}
var Bt = {
	key: "umbrella-drop",
	fragment: (e) => (e = F(e, "#include <emissivemap_fragment>", "totalEmissiveRadiance += (uZenith * 0.6 + uHorizon * 0.4) * 0.4;"), e = F(e, "#include <opaque_fragment>", "\n      {\n        float nv = abs(dot(normal, normalize(vViewPosition)));\n        gl_FragColor = vec4(totalSpecular + totalEmissiveRadiance, clamp(0.3 + 0.7 * pow(1.0 - nv, 3.0), 0.0, 1.0));\n      }", "replace"), e = F(e, It, Lt, "replace"), e)
}, Vt = {
	transparent: !0,
	depthWrite: !1,
	blending: s,
	blendSrc: ee,
	blendDst: te,
	blendSrcAlpha: ee,
	blendDstAlpha: te
}, Ht = class {
	root = new f();
	wet = { value: 1 };
	spinGroup = new f();
	materials = [];
	meshes = [];
	drops = [];
	tips = [];
	time = 0;
	q = new x();
	qs = new x();
	yAxis = new T(0, 1, 0);
	yNeg = new T(0, -1, 0);
	axis = new T();
	down = new T();
	constructor() {
		let e = new v({
			color: 16777215,
			roughness: .045,
			ior: 1.5,
			metalness: 0,
			specularIntensity: 1,
			side: u,
			...Vt
		});
		P(e, [R, zt(this.wet)]);
		let t = new v({
			color: 0,
			roughness: .03,
			ior: 1.33,
			...Vt
		});
		P(t, [R, Bt]);
		let n = new v({
			color: new o().setRGB(.84, .83, .8),
			metalness: .9,
			roughness: .3,
			clearcoat: .3,
			clearcoatRoughness: .2
		}), r = new v({
			color: new o().setRGB(.92, .92, .93),
			metalness: 1,
			roughness: .16
		}), s = new v({
			color: new o().setRGB(.88, .89, .9),
			roughness: .4,
			clearcoat: .6,
			clearcoatRoughness: .18
		});
		for (let e of [
			n,
			r,
			s
		]) P(e, [R]);
		this.materials.push(e, t, n, r, s);
		let l = (e, t, n = !0) => (t.castShadow = n, e.add(t), t), d = new _(Pt(X * 24, 48, () => 0, 1, 0), e);
		d.name = "umbrella-canopy", l(this.spinGroup, d, !1);
		let f = new v({
			color: 16777215,
			roughness: .045,
			side: u,
			colorWrite: !1
		});
		f.defines = { CANOPY_DEPTH: 1 }, P(f, [R, zt(this.wet)]), this.materials.push(f), l(this.spinGroup, new _(d.geometry, f), !1).name = "umbrella-canopy-depth";
		let p = [], h = [];
		for (let e = 0; e < X; e++) {
			let t = e / X * Z, n = Array.from({ length: 28 }, (e, n) => Q(.025 + n / 27 * .975, t, .017));
			p.push(new oe(new a(n), 80, .011, 8, !1));
			let r = n[n.length - 1], o = r.clone().sub(n[n.length - 3]).normalize();
			h.push(Ft(new i(.015, .05, 4, 12), r.clone().addScaledVector(o, .02), o)), this.tips.push(r.clone().addScaledVector(o, .055));
			let s = new T(Math.cos(t), 0, Math.sin(t)), c = new T(0, 1.6500000000000001, 0).addScaledVector(s, .036), l = Q(.42, t, .03);
			p.push(new oe(new m(c, l), 10, .0075, 8, !1)), p.push(new C(.014, 12, 8).translate(l.x, l.y, l.z));
		}
		p.push(new c(.009, .013, .2, 12).translate(0, Y.apex + .11, 0)), h.push(new c(.046, .03, .07, 20).translate(0, Y.apex - .05, 0), new c(.05, .05, .014, 24).translate(0, Y.apex + .007, 0), new C(.017, 14, 10).translate(0, Y.apex + .215, 0), new c(.034, .034, .13, 20).translate(0, Ot, 0), new c(.042, .042, .03, 20).translate(0, 1.6500000000000001, 0)), l(this.spinGroup, new _(D(p), n)), l(this.spinGroup, new _(D(h), s)), [...p, ...h].forEach((e) => e.dispose());
		let g = new C(1, 16, 12);
		for (let e = 0; e < X; e++) {
			let e = l(this.spinGroup, new _(g, t), !1);
			e.renderOrder = 1, this.drops.push(e);
		}
		let y = -Y.below + kt, b = Y.apex - .08 - y;
		l(this.root, new _(D([new c(.02, .02, b, 16).translate(0, y + b / 2, 0), new c(.038, .036, .03, 20).translate(0, y + .015, 0)]), r)), l(this.root, new _(new i(.033, .434, 8, 20).translate(0, -Y.below + kt / 2, 0), s)), this.root.add(this.spinGroup), this.root.name = "umbrella", this.root.visible = !1, this.root.traverse((e) => {
			e.isMesh && this.meshes.push(e);
		});
	}
	forEachMesh(e) {
		this.meshes.forEach(e);
	}
	update(e, t = 1 / 60) {
		if (this.root.visible = e.visible && e.open > .01, !this.root.visible) return;
		this.root.position.fromArray(e.anchor), this.axis.fromArray(e.axis), this.q.setFromUnitVectors(this.yAxis, this.axis), this.root.quaternion.copy(this.q), this.root.scale.setScalar(e.open), this.spinGroup.rotation.y = e.spin, this.time += t;
		let n = this.wet.value;
		this.qs.setFromAxisAngle(this.yAxis, e.spin).premultiply(this.q).invert(), this.down.copy(this.yNeg).applyQuaternion(this.qs);
		for (let e = 0; e < this.drops.length; e++) {
			let t = this.drops[e], r = n * (.45 + .55 * ((this.time * (.75 + .09 * (e * 3 % 5)) + e * .618) % 1) ** .7);
			t.visible = r > .05, t.scale.set(.004 + .014 * r, .006 + .022 * r, .004 + .014 * r), t.quaternion.setFromUnitVectors(this.yNeg, this.down), t.position.copy(this.tips[e]).addScaledVector(this.down, t.scale.y * .7);
		}
	}
	dispose() {
		this.meshes.forEach((e) => e.geometry.dispose()), this.materials.forEach((e) => e.dispose());
	}
}, $ = null;
function Ut() {
	return $ || ($ = new de(), $.setMeshoptDecoder(fe)), $;
}
async function Wt(e) {
	if (e.kind === "gltf") try {
		return new St(await Ut().loadAsync(e.url), e);
	} catch (t) {
		console.warn(`[assets] ball model "${e.url}" failed to load, using the procedural ball`, t);
	}
	return new Ct();
}
async function Gt(e) {
	if (e.kind === "gltf") try {
		return new wt(await Ut().loadAsync(e.url), e);
	} catch (t) {
		console.warn(`[assets] umbrella model "${e.url}" failed to load, using the procedural umbrella`, t);
	}
	return new Ht();
}
function Kt(e) {
	return Ut().parseAsync(e, "");
}
//#endregion
export { A, Se as B, R as C, me as D, ke as E, Ce as F, pe as H, Te as I, De as L, ye as M, k as N, O, be as P, xe as R, I as S, j as T, ge as U, Oe as V, he as W, Ue as _, Y as a, V as b, ft as c, nt as d, tt as f, H as g, Je as h, St as i, _e as j, ve as k, rt as l, qe as m, Gt as n, at as o, U as p, Kt as r, q as s, Wt as t, it as u, B as v, P as w, Me as x, Le as y, Ee as z };
