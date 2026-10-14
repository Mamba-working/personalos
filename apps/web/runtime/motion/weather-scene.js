import { A as e, B as t, C as n, D as r, E as i, F as a, H as o, I as s, L as c, M as l, N as u, O as d, P as f, R as p, S as m, T as h, U as g, V as _, W as v, _ as y, a as b, b as x, c as S, d as C, f as w, g as T, h as E, j as D, k as O, l as k, m as ee, n as te, o as A, p as j, s as M, t as ne, u as N, v as re, w as ie, x as ae, y as P, z as oe } from "./factory-fttR10Kb.js";
import { AdditiveBlending as se, AgXToneMapping as ce, BufferAttribute as le, CircleGeometry as ue, Color as de, CubeCamera as fe, CustomBlending as pe, DataTexture as me, DataUtils as he, DepthTexture as ge, DirectionalLight as _e, DoubleSide as ve, DynamicDrawUsage as ye, GLSL3 as be, HalfFloatType as F, InstancedBufferGeometry as xe, InstancedInterleavedBuffer as Se, InterleavedBufferAttribute as Ce, LinearFilter as I, LinearMipmapLinearFilter as we, MathUtils as Te, Matrix4 as Ee, Mesh as L, MeshStandardMaterial as De, NoColorSpace as Oe, OneFactor as R, OneMinusSrcAlphaFactor as ke, PMREMGenerator as Ae, PerspectiveCamera as je, Plane as Me, RGBAFormat as z, RepeatWrapping as Ne, SRGBColorSpace as Pe, Scene as Fe, ShaderMaterial as B, TextureLoader as Ie, VSMShadowMap as Le, Vector2 as V, Vector3 as H, Vector4 as U, WebGLCubeRenderTarget as Re, WebGLRenderTarget as W, WebGLRenderer as ze } from "three";
import { FullScreenQuad as Be, Pass as Ve } from "three/addons/postprocessing/Pass.js";
import { HDRLoader as He } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer as Ue } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass as We } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass as Ge } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass as Ke } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass as qe } from "three/addons/postprocessing/ShaderPass.js";
//#region src/world/Lighting.ts
var Je = class {
	sun;
	envScene = new Fe();
	envSun;
	envGround;
	cubeRT = new Re(128, {
		type: F,
		generateMipmaps: !1
	});
	cubeCam = new fe(.5, 4e4, this.cubeRT);
	pmrem;
	pmremRT = null;
	frames = 0;
	updateEvery = 6;
	constructor(e, t, r) {
		this.sun = new _e(16777215, 10), this.sun.castShadow = !0;
		let i = this.sun.shadow.camera;
		i.left = -9, i.right = 9, i.top = 9, i.bottom = -9, i.near = 1, i.far = 140, this.sun.shadow.mapSize.set(2048, 2048), this.sun.shadow.radius = 9, this.sun.shadow.blurSamples = 20, this.sun.shadow.bias = -4e-4, this.sun.shadow.normalBias = .02, this.pmrem = new Ae(e), this.envSun = new _e(16777215, 10);
		let a = new De({
			color: 7829367,
			roughness: .9
		});
		ie(a, [n]), this.envGround = new L(new ue(6e3, 48), a), this.envGround.rotation.x = -Math.PI / 2, this.envScene.add(t, r, this.envGround, this.envSun, this.envSun.target);
	}
	setSun(e, t, n, r) {
		this.sun.color.copy(t), this.sun.intensity = n, this.sun.target.position.copy(r), this.sun.position.copy(r).addScaledVector(e, 60), this.sun.target.updateMatrixWorld(), this.envSun.color.copy(t), this.envSun.intensity = n, this.envSun.position.copy(e).multiplyScalar(100);
	}
	setGroundAlbedo(e) {
		this.envGround.material.color.copy(e);
	}
	updateEnvironment(e, t, n, r = !1) {
		if (!r && this.frames++ % this.updateEvery !== 0) return;
		this.cubeCam.position.set(n.x, 1.2, n.z);
		let i = this.envScene.environment;
		this.envScene.environment = t.environment, this.cubeCam.update(e, this.envScene), this.envScene.environment = i, this.pmremRT = this.pmrem.fromCubemap(this.cubeRT.texture, this.pmremRT), t.environment = this.pmremRT.texture;
	}
}, Ye = class {
	renderer;
	cfg;
	enabled = !0;
	loader = new Ie();
	hdrLoader = new He();
	hdris = /* @__PURE__ */ new Map();
	ready = /* @__PURE__ */ new Map();
	weather = "sunny";
	a = null;
	b = null;
	snowRequested = !1;
	moonRequested = !1;
	status = {};
	neutral;
	constructor(e, t) {
		this.renderer = e, this.cfg = t, this.neutral = new me(new Uint8Array([
			255,
			255,
			255,
			255
		]), 1, 1, z), this.neutral.needsUpdate = !0;
		let n = T;
		for (let e of [
			n.uBaseDiff,
			n.uBaseNor,
			n.uMicroDiff,
			n.uMicroNor,
			n.uMicroRough,
			n.uSnowDiff,
			n.uSnowNor,
			j.uRockDiff,
			j.uRockNor
		]) e.value = this.neutral;
		let r = P;
		for (let e of [
			r.uHdrA,
			r.uHdrSmoothA,
			r.uHdrB,
			r.uHdrSmoothB
		]) e.value = this.neutral;
	}
	start(e) {
		if (this.weather = e, !this.enabled) return;
		let { ground: t, rock: n } = this.cfg, r = T.uTexTile.value;
		t.base && (r.x = 1 / t.base.tile), t.micro && (r.y = 1 / t.micro.tile), t.snow && (r.z = 1 / t.snow.tile), t.base && Promise.all([this.loadSet("ground.base", t.base, {
			diff: T.uBaseDiff,
			nor: T.uBaseNor
		}), !t.micro || this.loadSet("ground.micro", t.micro, {
			diff: T.uMicroDiff,
			nor: T.uMicroNor,
			rough: T.uMicroRough
		})]).then(([e]) => {
			e && (T.uGTex.value = 1);
		}), n && (j.uRockTile.value = 1 / n.tile, this.loadSet("rock", n, {
			diff: j.uRockDiff,
			nor: j.uRockNor
		}, 1).then((e) => {
			e && (j.uRockTex.value = 1);
		})), this.setWeather(e);
	}
	setWeather(e) {
		if (this.weather = e, !this.enabled) return;
		let t = this.cfg.hdri[e];
		t && this.hdri(t), e === "snow" && !this.snowRequested && this.cfg.ground.snow && (this.snowRequested = !0, this.loadSet("ground.snow", this.cfg.ground.snow, {
			diff: T.uSnowDiff,
			nor: T.uSnowNor
		}).then((e) => {
			e && (T.uSnowTex.value = 1);
		}));
	}
	update(t, n) {
		let r = P, i = this.enabled ? this.cfg.hdri[this.weather] : void 0, a = i ? this.ready.get(i) ?? null : null;
		a && (this.a ? a === this.a ? this.b && (r.uHdrMix.value = Math.max(0, r.uHdrMix.value - t / 2.5), r.uHdrMix.value <= 0 && (this.b = null)) : (this.b !== a && (this.b = a, r.uHdrMix.value = 0), r.uHdrMix.value = Math.min(1, r.uHdrMix.value + t / 2.5), r.uHdrMix.value >= 1 && (this.a = a, this.b = null, r.uHdrMix.value = 0)) : (this.a = a, r.uHdrMix.value = 0)), r.uHdrOn.value = e(r.uHdrOn.value, a || i && this.a ? 1 : 0, 2, t);
		let o = Math.atan2(n.z, n.x), s = (e) => e ? 2 * Math.PI * (e.sunU - .5) - o : 0;
		r.uHdrA.value = this.a?.tex ?? this.neutral, r.uHdrSmoothA.value = this.a?.smooth ?? this.neutral, r.uHdrRotA.value = s(this.a), r.uHdrB.value = this.b?.tex ?? this.neutral, r.uHdrSmoothB.value = this.b?.smooth ?? this.neutral, r.uHdrRotB.value = s(this.b);
	}
	requestMoon() {
		let e = this.cfg.moon;
		if (!this.enabled || !e || this.moonRequested) return;
		this.moonRequested = !0;
		let t = (e, t) => this.loader.loadAsync(e).then((e) => (e.colorSpace = t ? Pe : Oe, e.needsUpdate = !0, this.renderer.initTexture(e), e));
		Promise.all([t(e.albedo, !0), e.height ? t(e.height, !1) : Promise.resolve(null)]).then(([e, t]) => {
			x.uMoonTex.value = e, x.uMoonHeight.value = t ?? e, x.uMoonTexOn.value = 1, x.uMoonRelief.value = t ? x.uMoonRelief.value : 0, this.status.moon = "ok";
		}).catch((e) => {
			console.warn("[assets] moon maps failed to load, keeping the procedural moon", e), this.status.moon = "failed";
		});
	}
	describe() {
		return {
			loads: { ...this.status },
			on: {
				ground: T.uGTex.value,
				rock: j.uRockTex.value,
				snow: T.uSnowTex.value,
				sky: +P.uHdrOn.value.toFixed(2)
			}
		};
	}
	setActive(e) {
		this.enabled = e;
		let t = (t) => e && this.status[t] === "ok";
		T.uGTex.value = +!!t("ground.base"), T.uSnowTex.value = +!!t("ground.snow"), j.uRockTex.value = +!!t("rock"), P.uHdrOn.value = e && this.a ? 1 : 0, e && this.setWeather(this.weather);
	}
	async loadSet(e, t, n, r = 4) {
		let i = Object.keys(n).filter((e) => t[e]);
		try {
			let a = await Promise.all(i.map((e) => this.loader.loadAsync(t[e]))), o = Math.min(r, this.renderer.capabilities.getMaxAnisotropy());
			return a.forEach((e, t) => {
				e.wrapS = e.wrapT = Ne, e.anisotropy = o, e.colorSpace = i[t] === "diff" ? Pe : Oe, e.needsUpdate = !0, this.renderer.initTexture(e), n[i[t]].value = e;
			}), this.status[e] = "ok", i.length > 0;
		} catch (t) {
			return console.warn(`[assets] texture set "${e}" failed to load, keeping the procedural surface`, t), this.status[e] = "failed", !1;
		}
	}
	hdri(e) {
		let t = this.hdris.get(e);
		return t || (t = this.hdrLoader.loadAsync(e).then((t) => {
			let n = Xe(t);
			return this.renderer.initTexture(n.tex), this.renderer.initTexture(n.smooth), this.ready.set(e, n), this.status[e] = "ok", n;
		}).catch((t) => (console.warn(`[assets] sky "${e}" failed to load, keeping the procedural environment`, t), this.status[e] = "failed", null)), this.hdris.set(e, t)), t;
	}
};
function Xe(e) {
	let { width: t, height: n } = e.image, r = e.image.data, i = r.length / (t * n), a = r instanceof Uint16Array, o = (e) => a ? he.fromHalfFloat(r[e]) : r[e], s = t / 32, c = n / 16, l = /* @__PURE__ */ new Float32Array(1536), u = -1, d = 0;
	for (let e = 0; e < n; e++) for (let r = 0; r < t; r++) {
		let a = (e * t + r) * i, f = o(a), p = o(a + 1), m = o(a + 2), h = (Math.floor(e / c) * 32 + Math.floor(r / s)) * 3;
		l[h] += Math.min(f, 8), l[h + 1] += Math.min(p, 8), l[h + 2] += Math.min(m, 8);
		let g = .2126 * f + .7152 * p + .0722 * m;
		e < n / 2 && g > u && (u = g, d = r);
	}
	let f = /* @__PURE__ */ new Uint16Array(2048);
	for (let e = 0; e < 512; e++) {
		for (let t = 0; t < 3; t++) f[e * 4 + t] = he.toHalfFloat(l[e * 3 + t] / (s * c));
		f[e * 4 + 3] = he.toHalfFloat(1);
	}
	let p = new me(f, 32, 16, z, F);
	return p.flipY = e.flipY, p.wrapS = Ne, p.minFilter = p.magFilter = I, p.generateMipmaps = !1, p.needsUpdate = !0, e.wrapS = Ne, e.needsUpdate = !0, {
		tex: e,
		smooth: p,
		sunU: (d + .5) / t
	};
}
var Ze = class {
	camera = new je();
	target;
	textureMatrix = new Ee();
	resolutionScale = .7;
	normal = new H(0, 1, 0);
	plane = new Me();
	clipPlane = new U();
	q = new U();
	view = new H();
	lookAt = new H();
	targetPos = new H();
	camWorld = new H();
	rot = new Ee();
	constructor() {
		this.target = new W(4, 4, {
			type: F,
			format: z,
			samples: 0,
			minFilter: we,
			magFilter: I,
			generateMipmaps: !0
		}), this.camera.layers.set(1);
	}
	get texture() {
		return this.target.texture;
	}
	setSize(e, t) {
		this.target.setSize(Math.max(8, Math.round(e * this.resolutionScale)), Math.max(8, Math.round(t * this.resolutionScale)));
	}
	render(e, t, n) {
		let r = this.camera;
		if (this.camWorld.setFromMatrixPosition(n.matrixWorld), this.camWorld.y <= .01) return;
		this.view.copy(this.camWorld), this.view.y = -this.view.y, this.rot.extractRotation(n.matrixWorld), this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.camWorld), this.targetPos.copy(this.lookAt), this.targetPos.y = -this.targetPos.y, r.position.copy(this.view), r.up.set(0, 1, 0).applyMatrix4(this.rot), r.up.y = -r.up.y, r.lookAt(this.targetPos), r.near = n.near, r.far = n.far, r.updateMatrixWorld(), r.projectionMatrix.copy(n.projectionMatrix), this.textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1), this.textureMatrix.multiply(r.projectionMatrix).multiply(r.matrixWorldInverse), this.plane.setFromNormalAndCoplanarPoint(this.normal, new H(0, 0, 0)), this.plane.applyMatrix4(r.matrixWorldInverse), this.clipPlane.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
		let i = r.projectionMatrix.elements;
		this.q.x = (Math.sign(this.clipPlane.x) + i[8]) / i[0], this.q.y = (Math.sign(this.clipPlane.y) + i[9]) / i[5], this.q.z = -1, this.q.w = (1 + i[10]) / i[14], this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q)), i[2] = this.clipPlane.x, i[6] = this.clipPlane.y, i[10] = this.clipPlane.z + 1, i[14] = this.clipPlane.w, r.projectionMatrixInverse.copy(r.projectionMatrix).invert();
		let a = e.getRenderTarget(), o = e.xr.enabled, s = e.shadowMap.autoUpdate;
		e.xr.enabled = !1, e.shadowMap.autoUpdate = !1, e.setRenderTarget(this.target), e.state.buffers.depth.setMask(!0), e.clear(), e.render(t, r), e.xr.enabled = o, e.shadowMap.autoUpdate = s, e.setRenderTarget(a);
	}
	dispose() {
		this.target.dispose();
	}
}, Qe = "\nprecision highp float;\nuniform sampler2D uPrev;\nuniform vec2 uTexel;\nuniform vec2 uCenter;\nuniform float uSize;\nuniform vec4 uImpulses[32];\nuniform int uImpulseCount;\nuniform vec4 uBallContact;\nuniform vec4 uFogBrush;\nuniform vec4 uFogBrush2;\nuniform float uDt;\nuniform float uSnowing;\nuniform float uSnowCover;\nuniform float uDamping;\nout vec4 outColor;\nvoid main() {\n  vec2 uv = gl_FragCoord.xy * uTexel;\n  vec4 c = texture(uPrev, uv);\n  float s = texture(uPrev, uv + vec2(uTexel.x, 0.0)).r + texture(uPrev, uv - vec2(uTexel.x, 0.0)).r\n          + texture(uPrev, uv + vec2(0.0, uTexel.y)).r + texture(uPrev, uv - vec2(0.0, uTexel.y)).r;\n  float hn = (s * 0.5 - c.g) * uDamping;\n  vec2 wp = uCenter + (uv - 0.5) * uSize;\n  for (int i = 0; i < 32; i++) {\n    if (i >= uImpulseCount) break;\n    vec4 im = uImpulses[i];\n    vec2 dd = wp - im.xy;\n    hn += im.w * exp(-dot(dd, dd) / (im.z * im.z));\n  }\n  vec2 ed = min(uv, 1.0 - uv);\n  hn *= smoothstep(0.0, 0.06, min(ed.x, ed.y));\n\n  float dent = c.b * (1.0 - uDt * (0.012 + 0.05 * uSnowing));\n  dent *= mix(1.0 - uDt * 0.8, 1.0, uSnowCover);\n  float dc = length(wp - uBallContact.xy);\n  dent = max(dent, uBallContact.w * smoothstep(uBallContact.z, uBallContact.z * 0.35, dc));\n\n  float fc = c.a * (1.0 - uDt * 0.22);\n  fc = max(fc, uFogBrush.w * smoothstep(uFogBrush.z, uFogBrush.z * 0.2, length(wp - uFogBrush.xy)));\n  fc = max(fc, uFogBrush2.w * smoothstep(uFogBrush2.z, uFogBrush2.z * 0.2, length(wp - uFogBrush2.xy)));\n  outColor = vec4(hn, c.r, dent, fc);\n}\n", $e = class {
	size;
	worldSize = 18;
	center = new V();
	rts;
	idx = 0;
	mat;
	quad;
	impulseData = Array.from({ length: 32 }, () => new U());
	constructor(e = 512) {
		this.size = e;
		let t = () => new W(e, e, {
			type: F,
			format: z,
			depthBuffer: !1,
			minFilter: I,
			magFilter: I,
			generateMipmaps: !1
		});
		this.rts = [t(), t()], this.mat = new B({
			glslVersion: be,
			vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
			fragmentShader: Qe,
			uniforms: {
				uPrev: { value: null },
				uTexel: { value: new V(1 / e, 1 / e) },
				uCenter: { value: this.center },
				uSize: { value: this.worldSize },
				uImpulses: { value: this.impulseData },
				uImpulseCount: { value: 0 },
				uBallContact: { value: new U() },
				uFogBrush: { value: new U() },
				uFogBrush2: { value: new U() },
				uDt: { value: 0 },
				uSnowing: { value: 0 },
				uSnowCover: { value: 0 },
				uDamping: { value: .984 }
			},
			depthTest: !1,
			depthWrite: !1
		}), this.quad = new Be(this.mat), m.uMapSize.value = this.worldSize;
	}
	get texture() {
		return this.rts[this.idx].texture;
	}
	clear(e) {
		let t = e.getRenderTarget();
		for (let t of this.rts) e.setRenderTarget(t), e.clear(!0, !1, !1);
		e.setRenderTarget(t);
	}
	setCenter(e, t) {
		this.center.set(e, t), m.uMapCenter.value.set(e, t);
	}
	step(e, t) {
		let n = this.mat.uniforms, r = Math.min(32, t.impulses.length);
		for (let e = 0; e < r; e++) this.impulseData[e].fromArray(t.impulses[e]);
		n.uBallContact.value.fromArray(t.ballContact), n.uFogBrush.value.fromArray(t.fogBrush), n.uFogBrush2.value.fromArray(t.fogBrush2), n.uDt.value = t.dt * .5, n.uSnowing.value = t.snowing, n.uSnowCover.value = t.snowCover;
		let i = e.getRenderTarget();
		for (let t = 0; t < 2; t++) n.uPrev.value = this.rts[this.idx].texture, n.uImpulseCount.value = t === 0 ? r : 0, e.setRenderTarget(this.rts[1 - this.idx]), this.quad.render(e), this.idx = 1 - this.idx;
		e.setRenderTarget(i), m.uInteract.value = this.texture;
	}
	read(e, t, n) {
		let r = (t - this.center.x) / this.worldSize + .5, i = (n - this.center.y) / this.worldSize + .5, a = /* @__PURE__ */ new Uint16Array(4);
		return e.readRenderTargetPixels(this.rts[this.idx], Math.floor(r * this.size), Math.floor(i * this.size), 1, 1, a), Array.from(a, (e) => +et(e).toFixed(3));
	}
};
function et(e) {
	let t = (e & 32768) >> 15, n = (e & 31744) >> 10, r = e & 1023;
	return n === 0 ? (t ? -1 : 1) * 2 ** -14 * (r / 1024) : n === 31 ? r ? NaN : (t ? -1 : 1) * Infinity : (t ? -1 : 1) * 2 ** (n - 15) * (1 + r / 1024);
}
//#endregion
//#region src/weather/Weather.ts
var tt = {
	groundWet: [.7, .12],
	puddle: [.5, .1],
	snowCover: [.22, .18]
};
function nt(e) {
	let t = {};
	for (let n in e) {
		let r = e[n];
		t[n] = Array.isArray(r) ? [...r] : r;
	}
	return t;
}
var rt = class {
	name;
	p;
	sunOverride = null;
	cloudOffset = [0, 0];
	time = 0;
	lightning = 0;
	bolt = [
		0,
		2e3,
		-8e3
	];
	gust = 0;
	onLightning = null;
	nextBolt = 6;
	boltT = -1;
	constructor(e = "sunny") {
		this.name = e, this.p = nt(N[e]);
	}
	set(e) {
		return !N[e] || e === this.name ? !1 : (this.name = e, this.sunOverride = null, this.nextBolt = 3 + Math.random() * 4, !0);
	}
	snap() {
		this.p = nt(N[this.name]);
	}
	update(t) {
		this.time += t;
		let n = N[this.name], r = this.p, i = 1.15;
		for (let a in n) {
			let o = a, s = n[o];
			if (Array.isArray(s)) {
				let n = r[o];
				for (let r = 0; r < s.length; r++) n[r] = e(n[r], s[r], i, t);
			} else if (tt[o]) {
				let [n, i] = tt[o], a = r[o];
				r[o] = e(a, s, s > a ? n : i, t);
			} else if (o === "sunEl" || o === "sunAz") {
				let n = this.sunOverride ? this.sunOverride[o === "sunEl" ? "el" : "az"] : s;
				r[o] = e(r[o], n, this.sunOverride ? 9 : .9, t);
			} else r[o] = e(r[o], s, i, t);
		}
		let a = this.time;
		this.gust = d(.5 + .5 * Math.sin(a * .7) * Math.sin(a * .23 + 1.3) + .25 * Math.sin(a * 1.9 + .4), 0, 1.3);
		let o = this.windDir(), s = this.p.cloudSpeed * (.6 + .4 * this.gust);
		if (this.cloudOffset[0] -= o[0] * s * t, this.cloudOffset[1] -= o[1] * s * t, this.name === "rain" && this.p.cloudCover > .8 && (this.nextBolt -= t, this.nextBolt <= 0 && (this.boltT = 0, this.nextBolt = 9 + Math.random() * 14, this.bolt = [
			(Math.random() - .5) * 14e3,
			this.p.cloudBase + 500 + Math.random() * 900,
			-5e3 - Math.random() * 9e3
		], this.onLightning?.())), this.boltT >= 0) {
			this.boltT += t;
			let e = this.boltT;
			this.lightning = .55 * (Math.exp(-e * 6) * 1.2 + (e > .16 ? Math.exp(-(e - .16) * 5) * .8 : 0)), e > 1.5 && (this.boltT = -1, this.lightning = 0);
		}
	}
	windDir() {
		return [Math.cos(this.p.windAngle), Math.sin(this.p.windAngle)];
	}
	windStrength() {
		return this.p.wind * (.55 + .6 * this.gust);
	}
	sunDir(e = this.p) {
		let { sunEl: t, sunAz: n } = e;
		return [
			Math.sin(n) * Math.cos(t),
			Math.sin(t),
			-Math.cos(n) * Math.cos(t)
		];
	}
	sunColor(e = this.p, t = !0) {
		let n = t ? d(1 - e.sunEl / .6, 0, 1) : 0, r = [
			1,
			u(1, .86, n),
			u(1, .68, n)
		], i = d(e.sunEl * 6 + .25, 0, 1);
		return [
			0,
			1,
			2
		].map((t) => e.sunColor[t] * r[t] * e.sunI * i);
	}
}, G = {
	RAIN: 0,
	SNOW: 1,
	MOTE: 2,
	SPLASH: 3,
	SAND: 4,
	CHUNK: 5,
	DRIP: 6
}, it = class {
	max;
	n = 0;
	quality = 1;
	inst;
	impulses = [];
	px;
	py;
	pz;
	vx;
	vy;
	vz;
	age;
	life;
	size;
	seed;
	type;
	acc = {
		rain: 0,
		snow: 0,
		sand: 0,
		mote: 0,
		drip: 0
	};
	time = 0;
	constructor(e = 14e3) {
		this.max = e;
		let t = () => new Float32Array(e);
		this.px = t(), this.py = t(), this.pz = t(), this.vx = t(), this.vy = t(), this.vz = t(), this.age = t(), this.life = t(), this.size = t(), this.seed = t(), this.type = new Uint8Array(e), this.inst = new Float32Array(e * 10);
	}
	spawn(e, t, n, r, i, a, o, s, c) {
		if (this.n >= this.max) return -1;
		let l = this.n++;
		return this.px[l] = t, this.py[l] = n, this.pz[l] = r, this.vx[l] = i, this.vy[l] = a, this.vz[l] = o, this.age[l] = 0, this.life[l] = s, this.size[l] = c, this.type[l] = e, this.seed[l] = Math.random(), l;
	}
	kill(e) {
		let t = --this.n;
		e !== t && (this.px[e] = this.px[t], this.py[e] = this.py[t], this.pz[e] = this.pz[t], this.vx[e] = this.vx[t], this.vy[e] = this.vy[t], this.vz[e] = this.vz[t], this.age[e] = this.age[t], this.life[e] = this.life[t], this.size[e] = this.size[t], this.type[e] = this.type[t], this.seed[e] = this.seed[t]);
	}
	impulse(e, t, n, r) {
		this.impulses.length < 32 && this.impulses.push([
			e,
			t,
			n,
			r
		]);
	}
	splashRing(e, t, n, r) {
		for (let i = 0; i < n; i++) {
			let n = Math.random() * Math.PI * 2, i = (.6 + Math.random()) * r;
			this.spawn(G.SPLASH, e + Math.cos(n) * .7, .03, t + Math.sin(n) * .7, Math.cos(n) * i * 1.4, (1.5 + Math.random() * 2.2) * r, Math.sin(n) * i * 1.4, .5 + Math.random() * .3, .012);
		}
	}
	dustPuff(e, t, n, r) {
		for (let i = 0; i < n; i++) {
			let n = Math.random() * Math.PI * 2, i = (.4 + Math.random()) * r;
			this.spawn(G.SAND, e + Math.cos(n) * .8, .05, t + Math.sin(n) * .8, Math.cos(n) * i, .4 + Math.random() * r, Math.sin(n) * i, .9 + Math.random() * .6, .01);
		}
	}
	snowPuff(e, t, n, r, i, a = [
		0,
		1,
		0
	]) {
		for (let o = 0; o < r; o++) {
			let r = Math.random() * Math.PI * 2, o = (.3 + Math.random()) * i;
			this.spawn(G.CHUNK, e + Math.cos(r) * .5, t, n + Math.sin(r) * .5, Math.cos(r) * o + a[0] * i, a[1] * i * (.5 + Math.random()) + 1.2, Math.sin(r) * o + a[2] * i, 1.2 + Math.random() * .8, .018 + Math.random() * .03);
		}
	}
	rimDrops(e, t) {
		let n = e.axis, r = ot(at(n, Math.abs(n[1]) < .9 ? [
			0,
			1,
			0
		] : [
			1,
			0,
			0
		])), i = at(n, r), a = Math.cos(e.canopyTheta), o = Math.sin(e.canopyTheta);
		for (let s = 0; s < t; s++) {
			let t = Math.random() * Math.PI * 2, s = [
				r[0] * Math.cos(t) + i[0] * Math.sin(t),
				r[1] * Math.cos(t) + i[1] * Math.sin(t),
				r[2] * Math.cos(t) + i[2] * Math.sin(t)
			], c = [
				0,
				1,
				2
			].map((t) => e.canopyCenter[t] + e.canopyRadius * (n[t] * a + s[t] * o)), l = at(n, s);
			this.spawn(G.SPLASH, c[0], c[1], c[2], l[0] * 3 + s[0], 1 + Math.random(), l[2] * 3 + s[2], .8, .009);
		}
	}
	update(e, t) {
		this.time += e, this.impulses.length = 0;
		let n = t.weather, r = t.ball, i = this.quality, a = t.windStrength, o = t.wind[0] * a, s = t.wind[1] * a, { x0: c, x1: l, z0: u, z1: d, top: f } = t.region;
		for (this.acc.rain += n.rainRate * 2600 * i * e; this.acc.rain >= 1;) {
			--this.acc.rain;
			let e = f * (.75 + Math.random() * .25), t = e / 17;
			this.spawn(G.RAIN, c + Math.random() * (l - c) - o * 5 * t, e, u + Math.random() * (d - u) - s * 5 * t, o * 5 + (Math.random() - .5) * .4, -16 - Math.random() * 3, s * 5, 3, .006 + Math.random() * .004);
		}
		for (this.acc.snow += n.snowRate * 300 * i * e; this.acc.snow >= 1;) --this.acc.snow, this.spawn(G.SNOW, c + Math.random() * (l - c) - o * 4, f * (.85 + Math.random() * .15), u + Math.random() * (d - u) - s * 4, o * 1.4, -.9 - Math.random() * .7, s * 1.4, 30, .014 + Math.random() ** 3 * .035);
		for (this.acc.sand += n.sandRate * 900 * i * e * (.4 + .8 * t.gust); this.acc.sand >= 1;) {
			--this.acc.sand;
			let e = t.wind[0] < 0 ? l + Math.random() * 2 : c - Math.random() * 2, n = Math.random() ** 2.5 * 2.2 + .02;
			this.spawn(G.SAND, Math.random() < .6 ? e : c + Math.random() * (l - c), n, u + Math.random() * (d - u), o * (6 + Math.random() * 5), (Math.random() - .3) * 1.5, s * (6 + Math.random() * 5), 4 + Math.random() * 3, .006 + Math.random() * .008);
		}
		for (this.acc.mote += n.motes * 22 * i * e; this.acc.mote >= 1;) {
			--this.acc.mote;
			let e = r.pos;
			this.spawn(G.MOTE, e[0] + (Math.random() - .6) * 10, .2 + Math.random() * 4, e[2] + (Math.random() - .4) * 9, (Math.random() - .5) * .1, (Math.random() - .4) * .08, (Math.random() - .5) * .1, 5 + Math.random() * 5, .01 + Math.random() * .018);
		}
		let p = t.umbPose;
		if (p && n.rainRate > .05 && p.open > .7) for (this.acc.drip += n.rainRate * 7 * i * e * p.ribTips.length; this.acc.drip >= 1;) {
			--this.acc.drip;
			let e = p.ribTips[Math.random() * p.ribTips.length | 0];
			this.spawn(G.DRIP, e[0], e[1] - .012, e[2], o * .15 + (Math.random() - .5) * .06, -.2 - Math.random() * .45, s * .15 + (Math.random() - .5) * .06, 2.5, .011 + Math.random() * .007);
		}
		if (n.sandRate > .3 && t.gust > .6 && Math.random() < e * 40 * n.sandRate) {
			let e = r.pos;
			for (let n = 0; n < 3; n++) {
				let n = (Math.random() - .5) * 2.4, r = [Math.cos(n) * -t.wind[0] - Math.sin(n) * -t.wind[1], Math.sin(n) * -t.wind[0] + Math.cos(n) * -t.wind[1]];
				this.spawn(G.SAND, e[0] + r[0] * 1.05, .05 + Math.random() * .4, e[2] + r[1] * 1.05, o * 5 + r[1] * 2, 1.5 + Math.random() * 3, s * 5 - r[0] * 2, 1.5, .007);
			}
		}
		this.simulate(e, t, o, s);
	}
	simulate(e, t, n, r) {
		let { ball: i, cam: a, cursor: o, region: s, mapRect: c } = t, l = t.ballCenter, u = t.ballScale, d = t.umbPose, f = d ? Math.cos(d.canopyTheta) : 0, p = this.time, m = this.quality, { px: h, py: g, pz: _, vx: v, vy: y, vz: b } = this, x = 1 + i.snow * .18;
		for (let S = 0; S < this.n; S++) {
			let C = this.type[S];
			if (this.age[S] += e, this.age[S] > this.life[S]) {
				this.kill(S), S--;
				continue;
			}
			let w = h[S], T = g[S], E = _[S], D = v[S], O = y[S], k = b[S];
			if (C === G.SNOW) {
				let t = this.seed[S] * 6.283;
				D += (Math.sin(p * 1.3 + t) * .45 + n * 1.4 - D) * e * 1.5, k += (Math.cos(p * 1.1 + t * 1.3) * .35 + r * 1.4 - k) * e * 1.5;
			} else if (C === G.MOTE) {
				D += (Math.random() - .5) * .4 * e, O += (Math.random() - .5) * .3 * e, k += (Math.random() - .5) * .4 * e;
				let t = Math.exp(-e * .6);
				D *= t, O *= t, k *= t;
			} else if (C === G.SPLASH) O -= 20 * e;
			else if (C === G.DRIP) O -= 9.8 * e, D += (n * .6 - D) * e * .4, k += (r * .6 - k) * e * .4;
			else if (C === G.SAND) O -= 5 * e, D += (n * 8 - D) * e * .7, k += (r * 8 - k) * e * .7;
			else if (C === G.CHUNK) {
				O -= 13 * e;
				let t = Math.exp(-e * .6);
				D *= t, k *= t;
			}
			if (o.active && C !== G.SPLASH) {
				let t = w - a[0], n = T - a[1], r = E - a[2], i = t * o.dir[0] + n * o.dir[1] + r * o.dir[2];
				if (i > .5) {
					let a = t - o.dir[0] * i, s = n - o.dir[1] * i, c = r - o.dir[2] * i, l = .35 + i * .07, u = a * a + s * s + c * c;
					if (u < l * l) {
						let t = (1 - Math.sqrt(u) / l) * (C === G.RAIN ? .5 : 1), n = Math.min(1, t * e * 9);
						D += (o.vel[0] * i - D) * n, O += (o.vel[1] * i - O) * n * (C === G.RAIN ? .2 : 1), k += (o.vel[2] * i - k) * n;
					}
				}
			}
			let ee = (w - l[0]) / u[0], te = (T - l[1]) / u[1], A = (E - l[2]) / u[2], j = ee * ee + te * te + A * A;
			if ((C === G.SAND || C === G.SNOW || C === G.MOTE) && j < 5 && j > 1) {
				let e = Math.sqrt(j), t = ee / e, n = te / e, r = A / e, i = D * t + O * n + k * r;
				if (i < 0) {
					let a = Math.min(1, 1.15 / (e * e * e));
					D -= i * t * a, O -= i * n * a, k -= i * r * a, C === G.SAND && (O += Math.abs(i) * a * .35);
				}
			}
			w += D * e, T += O * e, E += k * e;
			let M = (w - l[0]) / u[0], ne = (T - l[1]) / u[1], N = (E - l[2]) / u[2], re = M * M + ne * ne + N * N;
			if (re < x * x) {
				let e = Math.sqrt(re) || 1, t = M / e, n = ne / e, r = N / e;
				if (C === G.RAIN || C === G.DRIP) {
					if (Math.random() < .7 * m) for (let e = 0; e < 2; e++) this.spawn(G.SPLASH, w, T, E, t * 1.8 + (Math.random() - .5) * 1.5, n * 1.4 + 1.2 + Math.random(), r * 1.8 + (Math.random() - .5) * 1.5, .35, .008);
					this.kill(S), S--;
					continue;
				}
				if (C === G.SNOW) {
					n > .2 && i.accumulateSnow(.0012 * n), this.kill(S), S--;
					continue;
				}
				let a = D * t + O * n + k * r;
				a < 0 && (D -= 1.5 * a * t, O -= 1.5 * a * n, k -= 1.5 * a * r), w = l[0] + t * u[0] * x, T = l[1] + n * u[1] * x, E = l[2] + r * u[2] * x;
			}
			if (d && (C === G.RAIN || C === G.SNOW)) {
				let t = d.canopyCenter, n = d.canopyRadius, r = d.axis, i = w - t[0], a = T - t[1], o = E - t[2], s = i * i + a * a + o * o;
				if (s < n * n) {
					let c = i - D * e, l = a - O * e, u = o - k * e, p = Math.sqrt(s), h = (i * r[0] + a * r[1] + o * r[2]) / p;
					if (c * c + l * l + u * u >= n * n * .97 && h > f) {
						let e = i / p, s = a / p, c = o / p;
						if (C === G.RAIN && Math.random() < .85 * m) for (let t = 0; t < 2; t++) this.spawn(G.SPLASH, w, T, E, e * 1.4 + (Math.random() - .5) * 1.6, s * 1.4 + 1 + Math.random() * 1.2, c * 1.4 + (Math.random() - .5) * 1.6, .3 + Math.random() * .15, .011 + Math.random() * .005);
						if (C === G.RAIN && Math.random() < .07) {
							let i = e - r[0] * h, a = s - r[1] * h, o = c - r[2] * h, l = Math.hypot(i, a, o) || 1;
							i /= l, a /= l, o /= l;
							let u = Math.sin(d.canopyTheta);
							this.spawn(G.DRIP, t[0] + n * (r[0] * f + i * u), t[1] + n * (r[1] * f + a * u), t[2] + n * (r[2] * f + o * u), i * .3, -.6, o * .3, 2.5, .011);
						}
						this.kill(S), S--;
						continue;
					}
				}
			}
			if (T <= 0) {
				if (C === G.RAIN) {
					if ((w - a[0]) ** 2 + (E - a[2]) ** 2 < 500 && Math.random() < .45 * m) {
						let e = 1 + +(Math.random() < .4);
						for (let t = 0; t < e; t++) {
							let e = Math.random() * 6.283;
							this.spawn(G.SPLASH, w, .01, E, Math.cos(e) * .9, 1.4 + Math.random() * 1.4, Math.sin(e) * .9, .3, .007);
						}
					}
					w > c[0] && w < c[1] && E > c[2] && E < c[3] && Math.random() < .08 && this.impulse(w, E, .09, -.22), this.kill(S), S--;
					continue;
				}
				if (C === G.DRIP) {
					if (Math.random() < .8 * m) for (let e = 0; e < 2; e++) {
						let e = Math.random() * 6.283;
						this.spawn(G.SPLASH, w, .01, E, Math.cos(e) * .8, 1.2 + Math.random() * 1.2, Math.sin(e) * .8, .28, .008);
					}
					w > c[0] && w < c[1] && E > c[2] && E < c[3] && this.impulse(w, E, .08, -.26), this.kill(S), S--;
					continue;
				}
				if (C === G.SNOW || C === G.SPLASH || C === G.CHUNK) {
					this.kill(S), S--;
					continue;
				}
				C === G.SAND ? (T = .005, O = Math.abs(O) * .3 + (Math.random() < .25 ? Math.random() * 2.2 * (.3 + t.gust) : 0)) : C === G.MOTE && (T = .01, O = Math.abs(O));
			}
			w < s.x0 - 5 || w > s.x1 + 5 || E < s.z0 - 5 || E > s.z1 + 3 || T > s.top + 3 ? (this.kill(S), S--) : (h[S] = w, g[S] = T, _[S] = E, v[S] = D, y[S] = O, b[S] = k);
		}
	}
	writeInstances() {
		let e = this.inst;
		for (let t = 0; t < this.n; t++) {
			let n = t * 10, r = this.type[t], i = this.age[t], a = this.life[t], o = r === G.SNOW || r === G.SAND || r === G.MOTE ? Math.min(1, i * 1.5) * Math.min(1, (a - i) * 1.2) : Math.min(1, i * 12) * Math.min(1, (a - i) * 5);
			e[n] = this.px[t], e[n + 1] = this.py[t], e[n + 2] = this.pz[t], e[n + 3] = this.size[t], e[n + 4] = this.vx[t], e[n + 5] = this.vy[t], e[n + 6] = this.vz[t], e[n + 7] = o, e[n + 8] = r, e[n + 9] = this.seed[t];
		}
		return this.n;
	}
};
function at(e, t) {
	return [
		e[1] * t[2] - e[2] * t[1],
		e[2] * t[0] - e[0] * t[2],
		e[0] * t[1] - e[1] * t[0]
	];
}
function ot(e) {
	let t = Math.hypot(e[0], e[1], e[2]) || 1;
	return [
		e[0] / t,
		e[1] / t,
		e[2] / t
	];
}
//#endregion
//#region src/weather/ParticleRenderer.ts
var st = `
${h}
${ae}
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
}`, ct = "\nuniform vec3 uSunCol;\nuniform vec3 uSunDir;\nuniform vec3 uAmbCol;\nvarying vec2 vUv;\nvarying float vAlpha;\nvarying float vType;\nvarying float vSeed;\nvarying float vBlur;\nvarying vec3 vFogCol;\nvarying float vFogT;\nvarying vec3 vRd;\nvoid main() {\n  float a = vAlpha;\n  vec3 col;\n  float r = length(vUv);\n  float t = vType;\n  if (t < 0.5) {                        // rain streak\n    float across = exp(-vUv.x * vUv.x * 3.0);\n    float along = smoothstep(-1.0, -0.3, vUv.y) * smoothstep(1.0, 0.75, vUv.y);\n    a *= across * along * 0.65;\n    col = uAmbCol * 1.4 + uSunCol * 0.14;\n  } else if (t < 1.5) {                 // snowflake (a soft disc with a faint rim when out of focus)\n    float soft = mix(0.35, 0.6, vBlur);\n    a *= smoothstep(1.0, 1.0 - soft, r) * mix(1.0, 0.8 + 0.25 * smoothstep(0.3, 0.85, r), vBlur);\n    col = uAmbCol * 1.12 + uSunCol * 0.32;\n  } else if (t < 2.5) {                 // sun mote (additive)\n    float g = exp(-r * r * 5.0);\n    float fwd = 0.25 + 0.8 * pow(max(dot(vRd, uSunDir), 0.0), 2.0);\n    if (g < 0.35) discard;\n    col = uSunCol * g * fwd * 0.22 * a * (0.6 + 0.4 * sin(vSeed * 40.0));\n    gl_FragColor = vec4(col * vFogT, 0.0);\n    return;\n  } else if (t < 3.5) {                 // splash droplet\n    float across = exp(-vUv.x * vUv.x * 2.5);\n    a *= across * smoothstep(1.0, 0.4, abs(vUv.y)) * 0.8;\n    col = uAmbCol * 1.45 + uSunCol * 0.2;\n  } else if (t < 4.5) {                 // sand grain\n    float across = exp(-vUv.x * vUv.x * 2.0);\n    a *= across * smoothstep(1.0, 0.3, abs(vUv.y)) * 0.75;\n    col = vec3(0.78, 0.71, 0.61) * (uAmbCol * 0.95 + uSunCol * 0.35);\n  } else if (t > 5.5) {                 // drip off the umbrella: a bright refracting bead, short tail\n    float across = exp(-vUv.x * vUv.x * 2.2);\n    float along = smoothstep(-1.0, 0.2, vUv.y) * smoothstep(1.0, 0.7, vUv.y);\n    a *= across * along * 0.8;\n    col = uAmbCol * 1.35 + uSunCol * 0.12;\n  } else {                              // snow chunk / puff\n    a *= smoothstep(1.0, 0.55, r);\n    col = uAmbCol * 1.15 + uSunCol * 0.35;\n  }\n  // only the solid core writes depth (see depthWrite below)\n#ifdef BOKEH\n  if (a < 0.004) discard;\n#else\n  if (a < 0.16) discard;\n#endif\n  col = mix(vFogCol, col, vFogT);\n  gl_FragColor = vec4(col * a, a);\n}", lt = class {
	system;
	mesh;
	material;
	buffer;
	geo;
	constructor(e) {
		this.system = e;
		let t = new xe();
		t.setAttribute("position", new le(new Float32Array([
			-1,
			-1,
			0,
			1,
			-1,
			0,
			-1,
			1,
			0,
			1,
			1,
			0
		]), 3)), t.setAttribute("aCorner", new le(new Float32Array([
			-1,
			-1,
			1,
			-1,
			-1,
			1,
			1,
			1
		]), 2)), t.setIndex([
			0,
			1,
			2,
			2,
			1,
			3
		]), this.buffer = new Se(e.inst, 10, 1), this.buffer.setUsage(ye), t.setAttribute("aPosSize", new Ce(this.buffer, 4, 0)), t.setAttribute("aVelAlpha", new Ce(this.buffer, 4, 4)), t.setAttribute("aTypeSeed", new Ce(this.buffer, 2, 8)), t.instanceCount = 0, this.geo = t;
		let n = {
			...m,
			uRes: { value: new V(1, 1) },
			uStreak: { value: .02 },
			uFocus: { value: 9 },
			uAmbCol: { value: m.uFogCol.value.clone() }
		};
		this.material = new B({
			vertexShader: st,
			fragmentShader: ct,
			uniforms: n,
			transparent: !0,
			depthWrite: !0,
			side: ve,
			blending: pe,
			blendSrc: R,
			blendDst: ke,
			blendSrcAlpha: R,
			blendDstAlpha: ke
		}), this.mesh = new L(t, this.material), this.mesh.frustumCulled = !1, this.mesh.renderOrder = 10, this.mesh.name = "particles";
		let r = new L(t, new B({
			vertexShader: st,
			fragmentShader: ct,
			uniforms: n,
			defines: { BOKEH: 1 },
			transparent: !0,
			depthWrite: !1,
			side: ve,
			blending: pe,
			blendSrc: R,
			blendDst: ke,
			blendSrcAlpha: R,
			blendDstAlpha: ke
		}));
		r.frustumCulled = !1, r.renderOrder = 11, r.name = "particles", this.mesh.add(r);
	}
	setFocus(e) {
		this.material.uniforms.uFocus.value = e;
	}
	setResolution(e, t) {
		this.material.uniforms.uRes.value.set(e, t);
	}
	upload() {
		let e = this.system.writeInstances();
		this.buffer.clearUpdateRanges(), this.buffer.addUpdateRange(0, Math.max(1, e) * 10), this.buffer.needsUpdate = !0, this.geo.instanceCount = e;
	}
}, K = [
	0,
	1,
	0
], ut = 26, dt = [
	"open",
	"happy",
	"surprise",
	"squint",
	"sleepy",
	"dizzy",
	"squeeze",
	"blush"
], ft = class {
	R = 1;
	home = [
		3,
		1,
		0
	];
	baseHome = [
		3,
		1,
		0
	];
	pos = [
		3,
		1,
		0
	];
	vel = [
		0,
		0,
		0
	];
	q = p();
	w = [
		0,
		0,
		0
	];
	squash = 1;
	squashV = 0;
	dentDir = [
		0,
		0,
		1
	];
	dent = 0;
	dentV = 0;
	snowDir = [
		0,
		1,
		0
	];
	snow = 0;
	wet = 0;
	grounded = !0;
	airSpinFree = 0;
	grabbed = !1;
	grabTarget = [
		3,
		1,
		0
	];
	goTo = null;
	goToTimer = 0;
	homing = !1;
	hopCooldown = 0;
	calmTime = 0;
	lookTarget = [
		0,
		1.2,
		10
	];
	gaze = [0, 0];
	bodyYaw = 0;
	bodyPitch = 0;
	saccadeT = 1.5;
	wanderTarget = null;
	expr = {
		open: 1,
		happy: 0,
		surprise: 0,
		squint: 0,
		sleepy: 0,
		dizzy: 0,
		squeeze: 0,
		blush: 0
	};
	timers = {
		happy: 0,
		surprise: 0,
		dizzy: 0,
		squeeze: 0,
		startle: 0,
		shake: 0
	};
	blinkT = 2.5;
	blink = 0;
	blinkPhase = -1;
	doubleBlink = !1;
	hover = !1;
	hoverTime = 0;
	pet = 0;
	idle = 0;
	sleeping = !1;
	time = 0;
	lean = [
		0,
		0,
		0
	];
	events = [];
	placed = !1;
	setHome(e, t) {
		Number.isFinite(e) && Number.isFinite(t) && (this.home = [
			e,
			this.R,
			t
		], this.baseHome = [
			e,
			this.R,
			t
		], (!this.placed || !this.pos.every(Number.isFinite)) && (this.placed = !0, this.pos = [
			e,
			this.R,
			t
		], this.vel = [
			0,
			0,
			0
		]));
	}
	emit(e) {
		this.events.push(e);
	}
	say(e, t = 1.8) {
		this.emit({
			type: "say",
			text: e,
			dur: t
		});
	}
	boop(e, t) {
		if (this.wake(), this.dentDir = e, this.dentV += 2.6, this.grounded && !this.grabbed) {
			let e = f([
				this.pos[0] - t[0],
				0,
				this.pos[2] - t[2]
			]);
			this.vel = r(this.vel, [
				e[0] * 1.2,
				4.6,
				e[2] * 1.2
			]), this.grounded = !1;
		}
		this.squashV -= 1.2, this.snow > .12 ? this.shakeOff() : Math.random() < .5 ? this.timers.happy = .9 : this.timers.surprise = .5, this.emit({ type: "boop" });
	}
	flip() {
		this.grabbed || (this.wake(), this.vel[1] = 10.5, this.grounded = !1, this.w = [
			-8.2,
			0,
			0
		], this.airSpinFree = 1, this.timers.happy = 1.6, this.snow > .05 && this.shakeOff(), this.emit({ type: "flip" }));
	}
	jump() {
		this.grounded && !this.grabbed && (this.wake(), this.vel[1] = 8.5, this.grounded = !1, this.squashV -= 2.5, this.timers.happy = .8, this.emit({
			type: "hop",
			big: !0
		}));
	}
	push(e, t) {
		this.grabbed || (this.wake(), this.vel[0] += e, this.vel[2] += t, this.goTo = null, this.calmTime = -1.2);
	}
	shakeOff() {
		this.timers.shake = .7, this.snow > .02 && this.emit({
			type: "shed",
			amount: this.snow,
			dir: this.capWorldDir()
		}), this.snow = 0, this.say("brrr…", 1.2);
	}
	startGrab() {
		this.grabbed = !0, this.goTo = null, this.grounded = !1, this.wake(), this.timers.squeeze = 99, this.emit({ type: "grab" });
	}
	endGrab() {
		if (!this.grabbed) return;
		this.grabbed = !1, this.timers.squeeze = 0;
		let e = l(this.vel);
		e > 6 && (this.airSpinFree = 1.2, this.w = r(this.w, g(f(O(K, this.vel)), e * .9)), this.timers.surprise = 1.2, this.say(e > 14 ? "哇啊——" : "呜！", 1)), this.calmTime = -1.5, this.emit({
			type: "release",
			speed: e
		});
	}
	sendTo(e) {
		this.wake(), this.goTo = [
			e[0],
			this.R,
			e[2]
		], this.goToTimer = 7, this.calmTime = 1;
	}
	setHover(e) {
		e && !this.hover && (this.hoverTime = 0, this.squashV += .6), this.hover = e;
	}
	addPet(e) {
		this.pet = Math.min(this.pet + e * .004, 2);
	}
	pointerActivity() {
		this.idle = 0, this.sleeping && this.wake(!0);
	}
	wake(e = !1) {
		this.sleeping && (this.sleeping = !1, e && (this.timers.startle = .6, this.say("！", .8))), this.idle = 0;
	}
	startle() {
		this.timers.startle = .7, this.grounded && !this.grabbed && (this.vel[1] = 4, this.grounded = !1, this.squashV -= 1.5);
	}
	headBasis() {
		let e = this.gaze[0], t = this.gaze[1], n = [
			Math.sin(e) * Math.cos(t),
			Math.sin(t),
			Math.cos(e) * Math.cos(t)
		], r = [
			Math.cos(e),
			0,
			-Math.sin(e)
		];
		return [
			r,
			O(n, r),
			n
		];
	}
	headToBody(e) {
		let [t, n, r] = this.headBasis();
		return [
			t[0] * e[0] + n[0] * e[1] + r[0] * e[2],
			t[1] * e[0] + n[1] * e[1] + r[1] * e[2],
			t[2] * e[0] + n[2] * e[1] + r[2] * e[2]
		];
	}
	bodyToHead(e) {
		let [t, n, r] = this.headBasis();
		return [
			D(e, t),
			D(e, n),
			D(e, r)
		];
	}
	capWorldDir() {
		return _(this.q, this.headToBody(this.snowDir));
	}
	localUp() {
		return _(s(this.q), K);
	}
	scaleVec() {
		let e = this.squash, t = 1 / Math.sqrt(e);
		return [
			t * this.R,
			e * this.R,
			t * this.R
		];
	}
	renderPos() {
		let e = d(1 - (this.pos[1] - this.R) / .35, 0, 1);
		return [
			this.pos[0],
			this.pos[1] - this.R * (1 - this.squash) * e,
			this.pos[2]
		];
	}
	hit(e, t) {
		let n = this.scaleVec(), i = this.renderPos(), a = [
			(e[0] - i[0]) / n[0],
			(e[1] - i[1]) / n[1],
			(e[2] - i[2]) / n[2]
		], o = [
			t[0] / n[0],
			t[1] / n[1],
			t[2] / n[2]
		], c = D(o, o), l = D(a, o), u = D(a, a) - 1.06, d = l * l - c * u;
		if (d < 0) return null;
		let p = (-l - Math.sqrt(d)) / c;
		if (p < 0) return null;
		let m = r(e, g(t, p)), h = f([
			(m[0] - i[0]) / n[0],
			(m[1] - i[1]) / n[1],
			(m[2] - i[2]) / n[2]
		]);
		return {
			t: p,
			point: m,
			local: _(s(this.q), h)
		};
	}
	accumulateSnow(e, t = this.bodyToHead(this.localUp())) {
		this.snowDir = this.snow < .01 ? t : f(r(g(this.snowDir, this.snow), g(t, e))), this.snow = Math.min(1, this.snow + e);
	}
	update(e, t) {
		this.time += e;
		let n = this.timers;
		for (let t of Object.keys(n)) n[t] > 0 && n[t] < 90 && (n[t] = Math.max(0, n[t] - e));
		this.idle += e, !this.sleeping && this.idle > 30 && !this.grabbed && !this.goTo && (this.sleeping = !0, this.say("zzz…", 2.4));
		let r = Math.max(1, Math.ceil(e / (1 / 120))), i = e / r;
		this.lean = this.computeLean(t);
		for (let e = 0; e < r; e++) this.step(i, t);
		this.updateFace(e, t), this.updateSurface(e, t);
	}
	step(e, t) {
		let n = this.R, r = this.pos, i = this.vel;
		if (this.grabbed) {
			let t = this.grabTarget;
			for (let n = 0; n < 3; n++) i[n] += ((t[n] - r[n]) * 170 - i[n] * 19) * e;
		} else {
			i[1] -= ut * e;
			let n = Math.max(0, t.windStrength - .35) * 2.4;
			n > 0 && this.grounded && (i[0] += t.wind[0] * n * e, i[2] += t.wind[1] * n * e);
			let a = this.goTo ?? this.home, o = a[0] - r[0], s = a[2] - r[2], c = Math.hypot(o, s);
			if (this.grounded && Math.hypot(i[0], i[2]) < 1.2 && (this.calmTime += e), !this.homing && c > .5 && this.calmTime > .6 && !this.sleeping && (this.homing = !0), this.homing) {
				if (c < .4 && this.grounded) this.homing = !1, i[0] *= .15, i[2] *= .15, this.goTo && (this.timers.happy = .6);
				else if (this.grounded && this.hopCooldown <= 0 && c >= .4) {
					let e = c > 1.5 ? 5.6 : 4.2, t = Math.min(c * .9 / (2 * e / ut), 4.4);
					i[0] = o / c * t, i[2] = s / c * t, i[1] = e, this.grounded = !1, this.hopCooldown = .38, this.squashV -= 1.3, this.emit({
						type: "hop",
						pos: [
							r[0],
							0,
							r[2]
						]
					});
				}
			}
			this.hopCooldown > 0 && (this.hopCooldown -= e), this.goTo && (this.goToTimer -= e, this.goToTimer <= 0 && (this.goTo = null, this.calmTime = .4));
		}
		if (r[0] += i[0] * e, r[1] += i[1] * e, r[2] += i[2] * e, r[1] <= n) {
			if (r[1] = n, i[1] < -1.6 && !this.grabbed) {
				let e = -i[1];
				i[1] = e > 3.2 ? e * .36 : 0, this.squashV -= e * .085, this.emit({
					type: "land",
					pos: [
						r[0],
						0,
						r[2]
					],
					impact: e
				}), e > 12 && this.airSpinFree > 0 && (this.timers.dizzy = 1.8, this.say("晕…", 1.4)), this.snow > .1 && e > 8 && this.shakeOff();
			} else i[1] < 0 && (i[1] = 0);
			if (this.grounded = i[1] <= .01, this.grounded) {
				let n = Math.exp(-(this.homing ? 14 : t.friction) * e);
				i[0] *= n, i[2] *= n, this.airSpinFree > 0 && (this.airSpinFree = Math.max(0, this.airSpinFree - e * 1.4));
			}
		} else this.grounded = !1;
		let a = t.bounds;
		r[0] < a.x0 && (r[0] = a.x0, i[0] = Math.abs(i[0]) * .45), r[0] > a.x1 && (r[0] = a.x1, i[0] = -Math.abs(i[0]) * .45), r[2] < a.z0 && (r[2] = a.z0, i[2] = Math.abs(i[2]) * .45), r[2] > a.z1 && (r[2] = a.z1, i[2] = -Math.abs(i[2]) * .45), r[1] > a.y1 && (r[1] = a.y1, i[1] = Math.min(i[1], 0)), this.stepRotation(e);
	}
	stepRotation(e) {
		let n = t(a(K, this.bodyYaw), a([
			1,
			0,
			0
		], -this.bodyPitch)), r = l(this.lean);
		r > 1e-5 && (n = t(a(g(this.lean, 1 / r), r), n));
		let i = c(this.q, n), o = this.airSpinFree > 0 && !this.grounded, s = o ? 3 : this.grabbed ? 45 : 72, f = o ? .2 : this.grabbed ? 6 : 9;
		for (let t = 0; t < 3; t++) this.w[t] += (i[t] * s - this.w[t] * f) * e;
		if (this.grounded && !this.grabbed && !this.homing) {
			let t = this.vel, n = Math.hypot(t[0], t[2]), r = d((n - 1.4) / 3, 0, 1);
			if (r > 0) {
				let n = g(O(K, [
					t[0],
					0,
					t[2]
				]), 1 / this.R), i = Math.min(1, r * e * 25);
				for (let e = 0; e < 3; e++) this.w[e] = u(this.w[e], n[e], i);
			}
		}
		this.q = oe(this.q, this.w, e);
	}
	computeLean(e) {
		let t = this.time, n = [
			0,
			0,
			0
		], i = e.windStrength;
		if (i > .05 && !this.grabbed) {
			let a = f(O(K, [
				-e.wind[0],
				0,
				-e.wind[1]
			]));
			n = r(n, g(a, (.08 + .06 * e.gust) * i + Math.sin(t * 9.3) * .015 * i));
		}
		if (this.grabbed) {
			let e = this.vel, i = Math.hypot(e[0], e[2]);
			i > .05 && (n = r(n, g(f(O(K, [
				-e[0],
				0,
				-e[2]
			])), Math.min(i * .035, .5)))), n[2] += Math.sin(t * 13) * .05;
		}
		let a = this.timers;
		return a.shake > 0 && (n[2] += Math.sin(t * 42) * .22 * (a.shake / .7)), e.weather === "snow" && !this.sleeping && (n[2] += Math.sin(t * 57) * .012 * (.4 + .6 * (Math.sin(t * .7) > .6))), this.pet > .3 && (n[2] += Math.sin(t * 7.5) * .07 * Math.min(this.pet, 1)), this.hover && !this.grabbed && (n[2] += Math.sin(t * 3.2) * .03), a.dizzy > 0 && (n[0] += Math.sin(t * 6) * .12, n[2] += Math.cos(t * 6) * .12), this.sleeping && (n[2] += Math.sin(t * 1.3) * .04 + .06), n;
	}
	pickWander(e) {
		let t = this.renderPos(), n = Math.random();
		if (n < .32) return [...e.camPos];
		if (n < .52) return r(e.camPos, [
			-5.5,
			2.4,
			-5
		]);
		if (n < .8) switch (e.weather) {
			case "sunny": return r(t, g(e.sunDir, 12));
			case "rain": return r(t, [
				o(.4, 1.6),
				3.2,
				o(-.5, 1)
			]);
			case "snow": return r(t, [
				o(-2, 2),
				o(4, 6),
				o(0, 3)
			]);
			case "windy": return r(t, [
				-e.wind[0] * 6,
				.6,
				-e.wind[1] * 6
			]);
			case "cloudy": return r(t, [
				o(-4, 4),
				6,
				o(-6, -2)
			]);
			default: return r(t, [
				o(-6, 6),
				o(0, 1.5),
				o(-8, 2)
			]);
		}
		return r(t, [
			o(-5, 5),
			o(-.5, 2),
			o(-4, 5)
		]);
	}
	updateFace(t, n) {
		let i = this.timers, a = this.renderPos(), c;
		this.sleeping ? c = r(a, [
			0,
			-.8,
			3
		]) : this.grabbed ? c = n.camPos : this.homing ? c = r(this.goTo ?? this.home, [
			0,
			.6,
			0
		]) : n.cursorActive && n.cursorTarget ? c = n.cursorTarget : (this.saccadeT -= t, (this.saccadeT <= 0 || !this.wanderTarget) && (this.wanderTarget = this.pickWander(n), this.saccadeT = o(1.4, 3.8)), c = this.wanderTarget), this.homing && l(v(c, a)) < 1.2 && (c = n.camPos);
		for (let n = 0; n < 3; n++) this.lookTarget[n] = e(this.lookTarget[n], c[n], 9, t);
		let u = f(v(this.lookTarget, a)), p = Math.atan2(u[0], u[2]), m = Math.asin(d(u[1], -1, 1));
		this.bodyYaw = e(this.bodyYaw, d(p * .5, -.95, .95), 4.5, t), this.bodyPitch = e(this.bodyPitch, d(m * .32, -.25, .32), 4.5, t);
		let h = _(s(this.q), u);
		this.gaze[0] = e(this.gaze[0], d(Math.atan2(h[0], h[2]), -.55, .55), 15, t), this.gaze[1] = e(this.gaze[1], d(Math.asin(d(h[1], -1, 1)) - .06, -.36, .42), 15, t), this.hover && (this.hoverTime += t), this.pet = Math.max(0, this.pet - t * .55);
		let g = {
			open: 1,
			happy: 0,
			surprise: 0,
			squint: 0,
			sleepy: 0,
			dizzy: 0,
			squeeze: 0,
			blush: 0
		};
		n.weather === "sunny" && (g.squint = d((D(u, n.sunDir) - .55) * 1.6, 0, .6) * n.sunBright), n.weather === "windy" && (g.squint = Math.max(g.squint, .3 + .25 * n.gust)), n.weather === "snow" && (g.squint = Math.max(g.squint, .1)), this.hover && this.hoverTime > .25 && (g.happy = 1), this.pet > .45 && (g.happy = 1, g.blush = d((this.pet - .35) * 1.5, 0, 1)), i.happy > 0 && (g.happy = 1), !this.grounded && !this.grabbed && l(this.vel) > 7.5 && (g.surprise = 1, g.happy = 0), (i.surprise > 0 || i.startle > 0) && (g.surprise = 1, g.happy = 0, g.squint = 0), this.grabbed && (g.squeeze = 1, g.happy = 0, g.surprise = 0), i.dizzy > 0 && (g.dizzy = 1, g.happy = 0, g.squeeze = 0, g.surprise = 0), this.sleeping && (g.sleepy = 1, g.happy = 0, g.squint = 0, g.surprise = 0), (g.happy > 0 || g.squeeze > 0 || g.dizzy > 0 || g.sleepy > 0) && (g.squint = 0);
		for (let n of dt) this.expr[n] = e(this.expr[n], g[n], n === "blush" ? 3 : 13, t);
		this.blinkT -= t, this.blinkT <= 0 && this.blinkPhase < 0 && (this.blinkPhase = 0, this.blinkT = o(1.8, 5.2), this.doubleBlink = Math.random() < .22), this.blinkPhase >= 0 && (this.blinkPhase += t / .15, this.blink = Math.sin(Math.min(this.blinkPhase, 1) * Math.PI), this.blinkPhase >= 1 && (this.blinkPhase = -1, this.blink = 0, this.doubleBlink && (this.doubleBlink = !1, this.blinkT = .1)));
		let y = 1 + Math.sin(this.time * (this.sleeping ? 1.5 : 2.6)) * .009;
		!this.grounded && !this.grabbed && (y += d(Math.abs(this.vel[1]) * .01, 0, .12)), this.grabbed && (y = 1.07 + Math.sin(this.time * 12) * .015), this.hover && !this.grabbed && (y -= .025), this.squashV += ((y - this.squash) * 230 - this.squashV * 12) * t, this.squash = d(this.squash + this.squashV * t, .62, 1.32), this.dentV += (-this.dent * 320 - this.dentV * 15) * t, this.dent = d(this.dent + this.dentV * t, -.04, .17);
	}
	updateSurface(t, n) {
		n.snowing > .05 ? this.accumulateSnow(n.snowing * .03 * t) : this.snow = Math.max(0, this.snow - t * .06), this.snow > .05 && this.capWorldDir()[1] < .5 && (this.emit({
			type: "shed",
			amount: this.snow * .85,
			dir: this.capWorldDir()
		}), this.snow *= .15);
		let r = n.raining * (n.umbrella > .5 ? .35 : 1);
		this.wet = e(this.wet, r, r > this.wet ? .6 : .07, t);
	}
	renderState() {
		let e = this.expr;
		return {
			position: this.renderPos(),
			quaternion: this.q,
			scale: this.scaleVec(),
			dent: {
				dir: this.dentDir,
				amount: Math.max(this.dent, 0)
			},
			gaze: this.gaze,
			expression: {
				...e,
				open: e.open * (1 - this.blink)
			},
			wet: this.wet,
			snow: {
				dir: this.headToBody(this.snowDir),
				amount: this.snow
			},
			time: this.time
		};
	}
	colliderSphere() {
		let e = this.renderPos(), t = this.scaleVec(), n = this.snow * .12;
		return [
			e[0],
			e[1] + n,
			e[2],
			(t[0] + t[1]) * .5 + n * .6
		];
	}
}, pt = class {
	open = 0;
	openV = 0;
	tilt = [-.1, -.16];
	tiltV = [0, 0];
	spin = 0;
	spinV = 0;
	pv = [
		0,
		0,
		0
	];
	away = null;
	pose = null;
	get isAway() {
		return !!this.away;
	}
	blowAway(e) {
		return this.open < .5 || this.away ? !1 : (this.away = {
			off: [
				0,
				0,
				0
			],
			vel: [
				e[0] * 7,
				5.5,
				e[1] * 7
			],
			t: 0
		}, !0);
	}
	update(e, t, n) {
		let r = +(n.raining > .3 && !this.away);
		if (this.away) {
			let t = this.away;
			t.t += e, t.vel[1] -= 2.5 * e;
			for (let n = 0; n < 3; n++) t.off[n] += t.vel[n] * e;
			this.tilt[0] += e * 2.2, this.tilt[1] += e * 1.3, this.spinV = 6, t.t > 3 && (this.away = null, this.open = 0, this.openV = 0, this.tilt = [-.1, -.16]);
		} else {
			this.openV += ((r - this.open) * 85 - this.openV * 9) * e, this.open = Math.max(0, this.open + this.openV * e), r === 0 && this.open < .02 && (this.open = 0, this.openV = 0);
			let i = d((t.vel[0] - this.pv[0]) / Math.max(e, 1e-4), -80, 80), a = d((t.vel[2] - this.pv[2]) / Math.max(e, 1e-4), -80, 80), o = n.windStrength, s = -.1 + n.wind[0] * o * .3, c = -.16 - n.wind[1] * o * .3;
			this.tiltV[0] += ((s - this.tilt[0]) * 55 - this.tiltV[0] * 6.5 - i * .03) * e, this.tiltV[1] += ((c - this.tilt[1]) * 55 - this.tiltV[1] * 6.5 + a * .03) * e, this.tilt[0] += this.tiltV[0] * e, this.tilt[1] += this.tiltV[1] * e;
		}
		this.pv = [...t.vel], this.spinV *= Math.exp(-e * 1.6), this.spin += this.spinV * e, this.pose = this.computePose(t);
	}
	computePose(e) {
		let t = this.open;
		if (t <= .001) return null;
		let n = e.renderPos(), i = f([
			Math.tan(this.tilt[0]),
			1,
			-Math.tan(this.tilt[1])
		]), a = r(n, [
			.55,
			0,
			.84
		]);
		a[1] = Math.max(a[1], i[1] * b.below * t), this.away && (a = r(a, this.away.off));
		let o = r(a, g(i, b.apex * t)), s = b.radius * t, c = Math.sin(b.theta) * s, l = (b.apex - b.radius) * t + Math.cos(b.theta) * s, u = [];
		for (let e = 0; e < b.ribs; e++) {
			let t = e / b.ribs * Math.PI * 2 - this.spin;
			u.push(r(a, mt(i, [
				Math.cos(t) * c,
				l,
				Math.sin(t) * c
			])));
		}
		return {
			visible: !0,
			anchor: a,
			axis: i,
			open: t,
			spin: this.spin,
			canopyCenter: v(o, g(i, s)),
			canopyRadius: s,
			canopyTheta: b.theta,
			ribTips: u
		};
	}
	hit(e, t) {
		let n = this.pose;
		if (!n) return null;
		let i = v(e, n.canopyCenter), a = D(i, t), o = a * a - (D(i, i) - n.canopyRadius * n.canopyRadius);
		if (o < 0) return null;
		let s = Math.sqrt(o);
		for (let i of [-a - s, -a + s]) {
			if (i <= 0) continue;
			let a = r(e, g(t, i)), o = f(v(a, n.canopyCenter));
			if (Math.acos(d(D(o, n.axis), -1, 1)) < n.canopyTheta) return {
				t: i,
				point: a
			};
		}
		return null;
	}
	shelter(e, t) {
		let n = this.pose;
		if (!n) return [
			0,
			0,
			1,
			0
		];
		let i = r(n.canopyCenter, g(n.axis, n.canopyRadius * Math.cos(n.canopyTheta))), a = n.canopyRadius * Math.sin(n.canopyTheta);
		return [
			i[0] - e[0] * t * i[1] * .25,
			i[2] - e[1] * t * i[1] * .25,
			a,
			Math.min(n.open, 1)
		];
	}
};
function mt(e, t) {
	let n = e[1], r = e[2], i = -e[0], a = Math.hypot(r, i);
	if (a < 1e-6) return n > 0 ? t : [
		t[0],
		-t[1],
		-t[2]
	];
	let o = r / a, s = i / a, c = o * t[0] + s * t[2], l = -s * t[1], u = s * t[0] - o * t[2], d = o * t[1];
	return [
		t[0] * n + l * a + o * c * (1 - n),
		t[1] * n + u * a,
		t[2] * n + d * a + s * c * (1 - n)
	];
}
//#endregion
//#region src/config/assets.ts
var q = {
	ball: { kind: "procedural" },
	umbrella: { kind: "procedural" },
	environment: {
		ground: {
			base: {
				diff: "textures/aerial_beach_01/diff.webp",
				nor: "textures/aerial_beach_01/nor.webp",
				tile: 18
			},
			micro: {
				diff: "textures/brown_mud_03/diff.webp",
				nor: "textures/brown_mud_03/nor.webp",
				rough: "textures/brown_mud_03/rough.webp",
				tile: 1.4
			},
			snow: {
				diff: "textures/snow_02/diff.webp",
				nor: "textures/snow_02/nor.webp",
				tile: 2.4
			}
		},
		rock: {
			diff: "textures/rock_face_03/diff.webp",
			nor: "textures/rock_face_03/nor.webp",
			tile: 250
		},
		hdri: {
			sunny: "hdri/kloofendal_48d_partly_cloudy_puresky.hdr",
			windy: "hdri/kloofendal_48d_partly_cloudy_puresky.hdr",
			cloudy: "hdri/kloofendal_overcast_puresky.hdr",
			rain: "hdri/kloofendal_overcast_puresky.hdr",
			snow: "hdri/snow_field.hdr",
			fog: "hdri/kloofendal_misty_morning_puresky.hdr"
		},
		terrain: {
			heights: "terrain/kawaguchi_polar.u16",
			az: 1100,
			rad: 320,
			r0: 650,
			r1: 25e3,
			detail: {
				url: "terrain/kawaguchi_detail.webp",
				x0: -9500,
				x1: 12500,
				z0: -15e3,
				z1: -1500
			},
			scale: .377076,
			vex: 1.1,
			base: 833,
			earthRadius: 7322989
		},
		moon: {
			albedo: "moon/albedo.webp",
			height: "moon/height.webp"
		}
	}
}, ht = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", gt = "\nuniform float uNear;\nuniform float uFar;\nuniform float uFocus;\nuniform float uAperture;\nuniform float uMaxCoc;\nfloat linZ(float d) {\n  float z = d * 2.0 - 1.0;\n  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));\n}\nfloat cocOf(float depth) { return clamp(uAperture * (1.0 - uFocus / linZ(depth)), -uMaxCoc, uMaxCoc); }\n", _t = `
${gt}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  float d = min(min(texture2D(tDepth, vUv + vec2(-o.x, -o.y)).r, texture2D(tDepth, vUv + vec2(o.x, -o.y)).r),
                min(texture2D(tDepth, vUv + vec2(-o.x, o.y)).r, texture2D(tDepth, vUv + vec2(o.x, o.y)).r));
  gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, cocOf(d));
}`, vt = "\nuniform sampler2D tHalf;\nuniform vec2 uHalfTexel;\nuniform float uMaxCoc;\nvarying vec2 vUv;\nvoid main() {\n  vec4 c = texture2D(tHalf, vUv);\n  float cc = c.a * 0.5;\n  float rmax = uMaxCoc * 0.5;\n  vec3 sum = c.rgb;\n  float wsum = 1.0;\n  const int N = 40;\n  for (int i = 0; i < N; i++) {\n    float fi = float(i) + 0.5;\n    float d = sqrt(fi / float(N)) * rmax;\n    float a = fi * 2.39996323;\n    vec4 s = texture2D(tHalf, vUv + vec2(cos(a), sin(a)) * d * uHalfTexel);\n    float cs = s.a * 0.5;\n    float reach = cs <= cc ? abs(cs) : min(abs(cs), abs(cc));\n    float w = clamp(reach - d + 1.0, 0.0, 1.0);\n    w *= 1.0 + 0.6 * smoothstep(1.5, 6.0, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)));\n    sum += s.rgb * w;\n    wsum += w;\n  }\n  gl_FragColor = vec4(sum / wsum, 1.0);\n}", yt = `
${gt}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
varying vec2 vUv;
void main() {
  vec4 sharp = texture2D(tDiffuse, vUv);
  float coc = abs(cocOf(texture2D(tDepth, vUv).r));
  vec3 blur = texture2D(tBlur, vUv).rgb;
  gl_FragColor = vec4(mix(sharp.rgb, blur, smoothstep(0.45, 1.6, coc)), sharp.a);
}`;
function bt() {
	return new W(4, 4, {
		type: F,
		format: z,
		depthBuffer: !1,
		minFilter: I,
		magFilter: I,
		generateMipmaps: !1
	});
}
var xt = class extends Ve {
	focus = 10;
	aperture = 0;
	near = .1;
	far = 12e3;
	half = bt();
	blur = bt();
	prefilter;
	bokeh;
	composite;
	quad = new Be();
	lens = {
		uNear: { value: .1 },
		uFar: { value: 12e3 },
		uFocus: { value: 10 },
		uAperture: { value: 0 },
		uMaxCoc: { value: 1 }
	};
	constructor() {
		super();
		let e = {
			vertexShader: ht,
			depthTest: !1,
			depthWrite: !1
		};
		this.prefilter = new B({
			...e,
			fragmentShader: _t,
			uniforms: {
				...this.lens,
				tDiffuse: { value: null },
				tDepth: { value: null },
				uTexel: { value: new V() }
			}
		}), this.bokeh = new B({
			...e,
			fragmentShader: vt,
			uniforms: {
				uMaxCoc: this.lens.uMaxCoc,
				tHalf: { value: this.half.texture },
				uHalfTexel: { value: new V() }
			}
		}), this.composite = new B({
			...e,
			fragmentShader: yt,
			uniforms: {
				...this.lens,
				tDiffuse: { value: null },
				tDepth: { value: null },
				tBlur: { value: this.blur.texture }
			}
		});
	}
	setSize(e, t) {
		let n = Math.max(1, Math.ceil(e / 2)), r = Math.max(1, Math.ceil(t / 2));
		this.half.setSize(n, r), this.blur.setSize(n, r), this.prefilter.uniforms.uTexel.value.set(1 / e, 1 / t), this.bokeh.uniforms.uHalfTexel.value.set(1 / n, 1 / r);
	}
	render(e, t, n) {
		let r = this.lens;
		r.uNear.value = this.near, r.uFar.value = this.far, r.uFocus.value = this.focus, r.uAperture.value = this.aperture, r.uMaxCoc.value = Math.max(1, this.aperture * 1.6), this.prefilter.uniforms.tDiffuse.value = n.texture, this.prefilter.uniforms.tDepth.value = n.depthTexture, this.quad.material = this.prefilter, e.setRenderTarget(this.half), this.quad.render(e), this.quad.material = this.bokeh, e.setRenderTarget(this.blur), this.quad.render(e), this.composite.uniforms.tDiffuse.value = n.texture, this.composite.uniforms.tDepth.value = n.depthTexture, this.quad.material = this.composite, e.setRenderTarget(this.renderToScreen ? null : t), this.quad.render(e);
	}
	dispose() {
		this.half.dispose(), this.blur.dispose(), this.prefilter.dispose(), this.bokeh.dispose(), this.composite.dispose(), this.quad.dispose();
	}
}, St = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", Ct = class extends Ve {
	rays = 0;
	streak = 0;
	sunUv = new V(.8, .8);
	aspect = 1.6;
	rt = new W(4, 4, {
		type: F,
		depthBuffer: !1
	});
	raysQuad;
	addQuad;
	raysMat;
	constructor() {
		super(), this.raysMat = new B({
			vertexShader: St,
			fragmentShader: "\n        uniform sampler2D tDiffuse;\n        uniform vec2 uSunUv;\n        uniform float uAspect;\n        uniform float uRays;\n        uniform float uStreak;\n        varying vec2 vUv;\n        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n        vec3 bright(vec2 uv, float thr) { return min(max(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb - thr, 0.0), vec3(12.0)); }\n        void main() {\n          vec3 col = vec3(0.0);\n          vec2 dv = uSunUv - vUv;\n          vec2 dd = dv * vec2(uAspect, 1.0);\n          if (uRays > 0.001) {\n            const int N = 40;\n            vec2 st = dv / float(N) * 0.94;\n            vec2 uv = vUv + st * hash12(gl_FragCoord.xy);\n            float decay = 1.0;\n            vec3 acc = vec3(0.0);\n            for (int i = 0; i < N; i++) { acc += bright(uv, 2.4) * decay; decay *= 0.955; uv += st; }\n            col += acc / float(N) * uRays * exp(-dot(dd, dd) * 1.6);\n          }\n          if (uStreak > 0.001) {\n            // visibility of the disc itself (clouds / the ball / the umbrella can hide it)\n            vec3 v = vec3(0.0);\n            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) v += bright(uSunUv + vec2(float(i), float(j)) * 0.0025, 6.0);\n            float vis = clamp(dot(v, vec3(0.2126, 0.7152, 0.0722)) / 9.0 / 12.0, 0.0, 1.0);\n            float sx = abs(dd.x), sy = abs(dd.y);\n            float line = exp(-sy * sy * 9000.0) * (exp(-sx * 2.2) * 0.8 + exp(-sx * 9.0) * 0.6);\n            float glow = exp(-sy * sy * 900.0) * exp(-sx * 4.0) * 0.18;\n            col += vec3(0.62, 0.76, 1.0) * (line + glow) * vis * uStreak * 3.0;\n          }\n          gl_FragColor = vec4(col, 1.0);\n        }",
			uniforms: {
				tDiffuse: { value: null },
				uSunUv: { value: this.sunUv },
				uAspect: { value: 1.6 },
				uRays: { value: 0 },
				uStreak: { value: 0 }
			},
			depthTest: !1,
			depthWrite: !1
		});
		let e = new B({
			vertexShader: St,
			fragmentShader: "uniform sampler2D tLens; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tLens, vUv); }",
			uniforms: { tLens: { value: this.rt.texture } },
			blending: se,
			transparent: !0,
			depthTest: !1,
			depthWrite: !1
		});
		this.raysQuad = new Be(this.raysMat), this.addQuad = new Be(e), this.needsSwap = !1;
	}
	setSize(e, t) {
		this.rt.setSize(Math.max(2, e >> 1), Math.max(2, t >> 1));
	}
	render(e, t, n) {
		if (this.rays <= .001 && this.streak <= .001) return;
		let r = this.raysMat.uniforms;
		r.tDiffuse.value = n.texture, r.uAspect.value = this.aspect, r.uRays.value = this.rays, r.uStreak.value = this.streak, e.setRenderTarget(this.rt), this.raysQuad.render(e);
		let i = e.autoClear;
		e.autoClear = !1, e.setRenderTarget(n), this.addQuad.render(e), e.autoClear = i;
	}
	dispose() {
		this.rt.dispose(), this.raysQuad.dispose(), this.addQuad.dispose();
	}
}, wt = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", Tt = {
	uniforms: {
		tDiffuse: { value: null },
		uClipToDir: { value: new Ee() },
		uRain: { value: 0 },
		uSnow: { value: 0 },
		uWind: { value: 0 },
		uTime: { value: 0 },
		uSkyCol: { value: new de(.7, .72, .78) }
	},
	vertexShader: wt,
	fragmentShader: "\n    uniform sampler2D tDiffuse;\n    uniform mat4 uClipToDir;\n    uniform float uRain;\n    uniform float uSnow;\n    uniform float uWind;\n    uniform float uTime;\n    uniform vec3 uSkyCol;\n    varying vec2 vUv;\n    float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\n    vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }\n    void main() {\n      vec3 col = texture2D(tDiffuse, vUv).rgb;\n      vec4 c = uClipToDir * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);\n      vec3 rd = normalize(c.xyz / c.w);\n      float az = atan(rd.x, -rd.z);\n      float el = rd.y;\n      if (uRain > 0.01) {\n        float acc = 0.0;\n        for (int i = 0; i < 3; i++) {\n          float fi = float(i);\n          float sc = 1.0 + fi * 0.7;\n          vec2 uv = vec2(az * 90.0 * sc, el * 7.0 * sc);\n          uv.x += uv.y * uWind * 0.9 * 13.0 / sc;\n          uv.y += uTime * (8.0 + fi * 2.0);\n          float cx = floor(uv.x);\n          float h = hash11(cx + fi * 71.0);\n          float y = fract(uv.y * 0.18 + h * 7.0);\n          float seg = smoothstep(0.0, 0.05, y) * smoothstep(0.4, 0.06, y);\n          float xw = smoothstep(0.5, 0.05, abs(fract(uv.x) - 0.5));\n          acc += seg * xw * step(0.55, h) * (0.55 - fi * 0.12);\n        }\n        col += uSkyCol * acc * uRain * 0.16;\n      }\n      if (uSnow > 0.01) {\n        float acc = 0.0;\n        for (int i = 0; i < 3; i++) {\n          float fi = float(i);\n          float sc = 22.0 + fi * 14.0;\n          vec2 uv = vec2(az, el) * sc;\n          uv.y += uTime * (0.28 + fi * 0.08) * sc * 0.06;\n          uv.x += sin(uv.y * 0.7 + fi) * 0.3 + uTime * uWind * 0.4;\n          vec2 id = floor(uv);\n          vec2 o = hash22(id + fi * 13.0);\n          float d = length(fract(uv) - o);\n          acc += smoothstep(0.09, 0.0, d) * step(0.6, o.x) * (0.9 - fi * 0.2);\n        }\n        float l = dot(uSkyCol, vec3(0.2126, 0.7152, 0.0722));\n        col = mix(col, vec3(0.97, 0.98, 1.0) * l * 1.2, clamp(acc * uSnow * 0.7, 0.0, 1.0));\n      }\n      gl_FragColor = vec4(col, 1.0);\n    }"
}, Et = "\n  uniform sampler2D tDiffuse;\n  uniform float luminosityThreshold;\n  uniform float smoothWidth;\n  varying vec2 vUv;\n  void main() {\n    vec3 c = texture2D(tDiffuse, vUv).rgb;\n    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\n    float x = max(l - luminosityThreshold, 0.0);\n    float k = x * x / (x + smoothWidth);\n    gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0);\n  }", Dt = {
	uniforms: {
		tDiffuse: { value: null },
		uAspect: { value: 1 },
		uVignette: { value: .3 }
	},
	vertexShader: wt,
	fragmentShader: "\n    uniform sampler2D tDiffuse;\n    uniform float uAspect;\n    uniform float uVignette;\n    varying vec2 vUv;\n    void main() {\n      vec3 col = texture2D(tDiffuse, vUv).rgb;\n      vec2 vc = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0);\n      float v = 1.0 / pow(1.0 + dot(vc, vc) * 0.16, 2.0);\n      gl_FragColor = vec4(col * mix(1.0, v, min(uVignette * 1.4, 1.0)), 1.0);\n    }"
}, Ot = {
	uniforms: {
		tDiffuse: { value: null },
		uRes: { value: new V(1, 1) },
		uLift: { value: new de(0, 0, 0) },
		uGain: { value: new de(1, 1, 1) },
		uSat: { value: 1 },
		uContrast: { value: 1 },
		uCurve: { value: .15 },
		uWhite: { value: 1 },
		uHalation: { value: .3 },
		uGrain: { value: .012 },
		uFlash: { value: 0 },
		uTime: { value: 0 }
	},
	vertexShader: wt,
	fragmentShader: "\n    uniform sampler2D tDiffuse;\n    uniform vec2 uRes;\n    uniform vec3 uLift;\n    uniform vec3 uGain;\n    uniform float uSat;\n    uniform float uContrast;\n    uniform float uCurve;\n    uniform float uWhite;\n    uniform float uHalation;\n    uniform float uGrain;\n    uniform float uFlash;\n    uniform float uTime;\n    varying vec2 vUv;\n    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }\n    void main() {\n      vec3 col = texture2D(tDiffuse, vUv).rgb;\n\n      // halation: light from brighter neighbours spills a warm fringe onto darker edges only,\n      // so flat bright sky is left alone (two rings of taps)\n      if (uHalation > 0.001) {\n        float h = 0.0;\n        vec2 px = 1.0 / uRes;\n        for (int i = 0; i < 12; i++) {\n          float a = float(i) * 0.5235988;\n          vec2 dir = vec2(cos(a), sin(a));\n          float s1 = luma(texture2D(tDiffuse, vUv + dir * px * 3.0).rgb);\n          float s2 = luma(texture2D(tDiffuse, vUv + dir * px * 8.0).rgb);\n          h += max(s1 - 0.78, 0.0) * 0.6 + max(s2 - 0.78, 0.0) * 0.4;\n        }\n        float spill = max(h / 12.0 - max(luma(col) - 0.78, 0.0), 0.0);\n        col += spill * uHalation * vec3(1.0, 0.42, 0.18) * 1.6;\n      }\n\n      col += uFlash * (1.0 - col) * 0.6;\n      float l = luma(col);\n      col = mix(vec3(l), col, uSat);\n      col = (col - 0.5) * uContrast + 0.5;\n      col = mix(col, col * col * (3.0 - 2.0 * col), uCurve);\n      col = col * uGain + uLift * (1.0 - col);\n\n      // print-stock shoulder: highlights roll off toward uWhite instead of clipping to pure white\n      // (narrow knee so only the top of the range is touched; a wide one flattens the whole sky)\n      vec3 hk = vec3(uWhite - 0.08);\n      vec3 over = max(col - hk, 0.0);\n      col = min(col, hk) + 0.08 * (1.0 - exp(-over / 0.08));\n\n      // clumped grain, strongest in the mid-tones\n      vec2 gp = floor(gl_FragCoord.xy / 1.6) + fract(uTime * 7.31) * 513.0;\n      float g = (hash12(gp) + hash12(gp + 17.3) - 1.0);\n      float lw = 4.0 * l * (1.0 - l);\n      col += g * (uGrain * (0.35 + lw)) + (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;\n      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);\n    }"
}, kt = class {
	composer;
	dof;
	precip;
	lens;
	bloom;
	optics;
	grade;
	rot = new Ee();
	constructor(e, t, n) {
		let r = new W(4, 4, {
			type: F,
			samples: 4,
			depthTexture: new ge(4, 4)
		});
		this.composer = new Ue(e, r), this.dof = new xt(), this.precip = new qe(Tt), this.lens = new Ct(), this.bloom = new Ge(new V(256, 256), .3, .4, 2.2), this.bloom.materialHighPassFilter.uniforms.smoothWidth.value = .6, this.bloom.materialHighPassFilter.fragmentShader = Et, this.bloom.materialHighPassFilter.needsUpdate = !0, this.optics = new qe(Dt), this.grade = new qe(Ot), this.composer.addPass(new We(t, n)), this.composer.addPass(this.dof), this.composer.addPass(this.precip), this.composer.addPass(this.lens), this.composer.addPass(this.bloom), this.composer.addPass(this.optics), this.composer.addPass(new Ke()), this.composer.addPass(this.grade);
	}
	setSize(e, t, n) {
		this.composer.setPixelRatio(n), this.composer.setSize(e, t), this.lens.aspect = e / t, this.optics.uniforms.uAspect.value = e / t, this.grade.uniforms.uRes.value.set(e * n, t * n);
	}
	setPrecip(e, t, n, r, i, a) {
		let o = this.precip.uniforms;
		this.precip.enabled = t > .01 || n > .01, this.rot.extractRotation(e.matrixWorldInverse), o.uClipToDir.value.multiplyMatrices(e.projectionMatrix, this.rot).invert(), o.uRain.value = t, o.uSnow.value = n, o.uWind.value = r, o.uTime.value = i, o.uSkyCol.value.copy(a);
	}
	setFocus(e, t, n) {
		this.dof.enabled = n > .05, this.dof.focus = t, this.dof.aperture = n, this.dof.near = e.near, this.dof.far = e.far;
	}
	render(e) {
		this.composer.render(e);
	}
}, At = {
	sunny: {
		air: .1,
		wind: .04,
		rain: 0
	},
	cloudy: {
		air: .14,
		wind: .1,
		rain: 0
	},
	windy: {
		air: .06,
		wind: .5,
		rain: 0
	},
	rain: {
		air: .05,
		wind: .08,
		rain: .42
	},
	snow: {
		air: .08,
		wind: .12,
		rain: 0
	},
	fog: {
		air: .18,
		wind: .03,
		rain: 0
	}
}, jt = class {
	enabled = !1;
	ctx = null;
	weather = "sunny";
	master;
	noise;
	air;
	wind;
	rain;
	enable(e) {
		this.enabled = e, e && !this.ctx && this.init(), this.ctx && (e && this.ctx.resume(), this.master.gain.setTargetAtTime(e ? .9 : 0, this.ctx.currentTime, .4));
	}
	init() {
		let e = window.AudioContext ?? window.webkitAudioContext;
		if (!e) return;
		let t = this.ctx = new e();
		this.master = t.createGain(), this.master.gain.value = 0, this.master.connect(t.destination);
		let n = t.sampleRate * 3, r = t.createBuffer(1, n, t.sampleRate), i = r.getChannelData(0), a = 0, o = 0, s = 0;
		for (let e = 0; e < n; e++) {
			let t = Math.random() * 2 - 1;
			a = .99765 * a + t * .099, o = .963 * o + t * .2965, s = .57 * s + t * 1.0526, i[e] = (a + o + s + t * .1848) * .18;
		}
		this.noise = r;
		let c = (e, n, i) => {
			let a = t.createBufferSource();
			a.buffer = r, a.loop = !0, a.playbackRate.value = .7 + Math.random() * .6;
			let o = t.createBiquadFilter();
			o.type = e, o.frequency.value = n, o.Q.value = i;
			let s = t.createGain();
			return s.gain.value = 0, a.connect(o).connect(s).connect(this.master), a.start(), {
				f: o,
				g: s
			};
		};
		this.air = c("lowpass", 420, .5), this.wind = c("bandpass", 380, 1.4), this.rain = c("highpass", 900, .4), this.setWeather(this.weather);
	}
	dispose() {
		this.enabled = !1, this.ctx?.close(), this.ctx = null;
	}
	setWeather(e) {
		if (this.weather = e, !this.ctx) return;
		let t = At[e] || At.sunny, n = this.ctx.currentTime;
		this.air.g.gain.setTargetAtTime(t.air, n, 1.2), this.wind.g.gain.setTargetAtTime(t.wind, n, 1.2), this.rain.g.gain.setTargetAtTime(t.rain, n, 1.2);
	}
	update(e) {
		if (!this.ctx || !this.enabled) return;
		let t = this.ctx.currentTime;
		this.wind.f.frequency.setTargetAtTime(260 + e * 520, t, .3);
	}
	blip(e, t, n, r, i = "sine") {
		if (!this.ctx || !this.enabled) return;
		let a = this.ctx, o = a.currentTime, s = a.createOscillator(), c = a.createGain();
		s.type = i, s.frequency.setValueAtTime(e, o), s.frequency.exponentialRampToValueAtTime(t, o + n), c.gain.setValueAtTime(1e-4, o), c.gain.exponentialRampToValueAtTime(r, o + .012), c.gain.exponentialRampToValueAtTime(1e-4, o + n), s.connect(c).connect(this.master), s.start(o), s.stop(o + n + .05);
	}
	boop(e = 1) {
		this.blip(520 * e, 820 * e, .16, .18);
	}
	hop() {
		this.blip(300, 420, .1, .05);
	}
	thud(e) {
		this.blip(140, 55, .25, Math.min(.08 + e * .02, .4));
	}
	thunder() {
		if (!this.ctx || !this.enabled) return;
		let e = this.ctx, t = e.currentTime + .4 + Math.random() * .8, n = e.createBufferSource();
		n.buffer = this.noise;
		let r = e.createBiquadFilter();
		r.type = "lowpass", r.frequency.setValueAtTime(900, t), r.frequency.exponentialRampToValueAtTime(80, t + 2.6);
		let i = e.createGain();
		i.gain.setValueAtTime(1e-4, t), i.gain.exponentialRampToValueAtTime(.9, t + .08), i.gain.exponentialRampToValueAtTime(1e-4, t + 3), n.connect(r).connect(i).connect(this.master), n.start(t), n.stop(t + 3.1);
	}
}, Mt = class {
	camera = new je(38, 1, .1, 4e4);
	cssW = 1;
	cssH = 1;
	aspect = 1;
	fov = 38;
	pitch = -1;
	camH = 2.2;
	dist = 9.6;
	tanH = Math.tan(Te.degToRad(19));
	homeX = 3;
	shake = 0;
	ballX = null;
	portraitBallX = null;
	parallax = [0, 0];
	tmp = new H();
	layout(e, t) {
		this.cssW = Math.max(1, e), this.cssH = Math.max(1, t), this.aspect = this.cssW / this.cssH;
		let n = this.aspect < .95;
		this.fov = n ? 46 : 38, this.pitch = n ? -2.5 : -1, this.camH = n ? 2.4 : 2.2, this.dist = n ? 9.4 : 9.6, this.tanH = Math.tan(Te.degToRad(this.fov / 2));
		let r = n ? this.portraitBallX ?? 0 : this.ballX ?? d(.58 - (1.75 - this.aspect) * .12, .38, .62);
		this.homeX = r * this.tanH * this.aspect * this.dist, this.camera.fov = this.fov, this.camera.aspect = this.aspect, this.camera.updateProjectionMatrix();
	}
	get halfWidth() {
		return this.dist * this.tanH * this.aspect;
	}
	update(t, n) {
		let r = n ? n[0] : 0, i = n ? n[1] : 0;
		this.parallax[0] = e(this.parallax[0], r, 2.2, t), this.parallax[1] = e(this.parallax[1], i, 2.2, t);
		let a = -this.parallax[0] * .012, o = Te.degToRad(this.pitch) + this.parallax[1] * .006, s = this.camera;
		s.position.set(this.parallax[0] * .22, this.camH + this.parallax[1] * .08, this.dist), this.shake > 0 && (s.position.x += (Math.random() - .5) * this.shake * .05, s.position.y += (Math.random() - .5) * this.shake * .05, this.shake = Math.max(0, this.shake - t * 4)), s.rotation.set(o, -a, 0, "YXZ"), s.updateMatrixWorld();
	}
	get position() {
		let e = this.camera.position;
		return [
			e.x,
			e.y,
			e.z
		];
	}
	ray(e, t) {
		let n = this.tmp.set(e, t, .5).unproject(this.camera).sub(this.camera.position).normalize();
		return [
			n.x,
			n.y,
			n.z
		];
	}
	project(e) {
		let t = this.tmp.set(e[0], e[1], e[2]), n = t.clone().applyMatrix4(this.camera.matrixWorldInverse).z * -1;
		return t.project(this.camera), [
			(t.x * .5 + .5) * this.cssW,
			(.5 - t.y * .5) * this.cssH,
			n
		];
	}
	basis() {
		let e = this.camera.matrixWorld.elements;
		return {
			right: [
				e[0],
				e[1],
				e[2]
			],
			up: [
				e[4],
				e[5],
				e[6]
			]
		};
	}
}, Nt = class {
	canvas;
	rig;
	h;
	now;
	ndc = [0, 0];
	prevNdc = [0, 0];
	inside = !1;
	down = !1;
	lastMove = -10;
	moved = 0;
	worldVel = [
		0,
		0,
		0
	];
	press = null;
	downX = 0;
	downY = 0;
	lastClick = -1;
	dragging = !1;
	pointer = !0;
	keyboard = !1;
	abort = new AbortController();
	constructor(e, t, n, r) {
		this.canvas = e, this.rig = t, this.h = n, this.now = r;
		let i = { signal: this.abort.signal };
		e.addEventListener("pointerdown", (e) => {
			this.pointer && this.onDown(e);
		}, i), window.addEventListener("pointermove", (e) => {
			this.pointer && this.onMove(e);
		}, {
			passive: !0,
			signal: this.abort.signal
		}), window.addEventListener("pointerup", () => this.onUp(), i), window.addEventListener("pointercancel", () => this.onUp(), i), window.addEventListener("mouseout", (e) => {
			e.relatedTarget || (this.inside = !1);
		}, i), window.addEventListener("blur", () => {
			this.inside = !1, this.onUp();
		}, i), window.addEventListener("keydown", (e) => {
			!this.keyboard || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.target?.closest?.("input, textarea, select, [contenteditable=\"\"], [contenteditable=\"true\"]") || this.h.onKey(e.key) && e.preventDefault();
		}, i);
	}
	setPointer(e) {
		this.pointer = e, e || (this.inside = !1, this.onUp());
	}
	dispose() {
		this.abort.abort();
	}
	get active() {
		return this.inside && this.now() - this.lastMove < 3;
	}
	ray() {
		return this.rig.ray(this.ndc[0], this.ndc[1]);
	}
	setNdc(e) {
		let t = this.canvas.getBoundingClientRect(), n = e.clientX - t.left, r = e.clientY - t.top;
		return this.ndc = [n / Math.max(t.width, 1) * 2 - 1, 1 - r / Math.max(t.height, 1) * 2], n >= 0 && r >= 0 && n <= t.width && r <= t.height;
	}
	onDown(e) {
		this.setNdc(e), this.down = !0, this.inside = !0, this.downX = e.clientX, this.downY = e.clientY, this.moved = 0, this.dragging = !1;
		try {
			this.canvas.setPointerCapture(e.pointerId);
		} catch {}
		this.press = this.h.classify(this.rig.position, this.ray()), this.h.onActivity(), this.press.mode === "sky" && (this.dragging = !0, this.h.onDragStart(this.press));
	}
	onMove(e) {
		let t = this.ndc;
		if (!this.setNdc(e) && !this.down) {
			this.inside = !1;
			return;
		}
		this.inside = !0, this.lastMove = this.now(), this.h.onActivity();
		let n = Math.hypot((this.ndc[0] - t[0]) * this.rig.cssW * .5, (this.ndc[1] - t[1]) * this.rig.cssH * .5);
		this.down ? this.press && (this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.downX, e.clientY - this.downY)), !this.dragging && this.moved > 6 && this.press.mode === "ball" && (this.dragging = !0, this.h.onDragStart(this.press)), this.dragging && this.h.onDrag(this.press)) : this.h.onHoverMove(n);
	}
	onUp() {
		if (!this.down) return;
		this.down = !1;
		let e = this.press;
		if (this.press = null, !e) return;
		let t = this.moved < 6, n = this.now(), r = t && e.mode === "ball" && n - this.lastClick < .33;
		this.lastClick = t && e.mode === "ball" && !r ? n : -1, this.h.onRelease(e, t, r);
	}
	updateVelocity(e) {
		let t = [this.ndc[0] - this.prevNdc[0], this.ndc[1] - this.prevNdc[1]];
		this.prevNdc = [...this.ndc];
		let { right: n, up: i } = this.rig.basis(), a = r(g(n, t[0] * this.rig.tanH * this.rig.aspect / e), g(i, t[1] * this.rig.tanH / e));
		for (let e = 0; e < 3; e++) this.worldVel[e] += (a[e] - this.worldVel[e]) * .5;
	}
}, Pt = {
	sunny: ["晒太阳~", "好暖和"],
	cloudy: ["云来了", "阴天也不错"],
	windy: ["风好大！", "站稳站稳…"],
	rain: ["下雨啦，撑伞！", "滴答滴答"],
	snow: ["下雪了！", "好冷…"],
	fog: ["雾里看花", "看不清路…"]
}, Ft = (e) => e[Math.random() * e.length | 0], J = new de(), Y = (e, t) => e.setRGB(t[0], t[1], t[2]), It = class {
	hooks;
	renderer;
	scene = new Fe();
	rig = new Mt();
	weather = new rt("sunny");
	clock = new S();
	ball = new ft();
	umbrella = new pt();
	particles = new it(14e3);
	interact = new $e(512);
	reflection = new Ze();
	audio = new jt();
	input;
	lines = { ...Pt };
	pixelBudget = 36e5;
	maxPixelRatio = 2;
	autoCycleInterval = 14;
	anchors = {
		ball: {
			x: 0,
			y: 0,
			radius: 0
		},
		bubble: {
			x: 0,
			y: 0
		},
		ground: {
			x: 0,
			y: 0
		}
	};
	cursorKind = "default";
	lastNight = null;
	disposed = !1;
	sky;
	terrain;
	envTerrain;
	lighting;
	envAssets;
	post;
	ground;
	snowMound;
	moundAmt = 0;
	ballVisual;
	umbrellaVisual;
	particleRenderer;
	extraImpulses = [];
	time = 0;
	renderScale = 1;
	autoOn = !1;
	autoTimer = 0;
	reduceMotion;
	lastFrame = performance.now();
	perf = {
		acc: 0,
		frames: 0,
		good: 0,
		locked: !1
	};
	running = !1;
	looping = !1;
	constructor(e, t, n = {}) {
		this.hooks = t, this.reduceMotion = n.reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches, Lt(), this.renderer = new ze({
			canvas: e,
			antialias: !1,
			powerPreference: "high-performance",
			alpha: !1
		});
		let r = this.renderer;
		r.toneMapping = ce, r.shadowMap.enabled = !0, r.shadowMap.type = Le, r.transmissionResolutionScale = .5, m.uNoise2D.value = i(), this.sky = new y(r), this.terrain = new w(), this.ground = ee(), this.snowMound = E(this.ground), this.envTerrain = new L(this.terrain.mesh.geometry, this.terrain.mesh.material), this.lighting = new Je(r, this.sky.envDome, this.envTerrain), this.envAssets = new Ye(r, q.environment), this.particleRenderer = new lt(this.particles), this.reduceMotion && (this.particles.quality = .5);
		let a = this.scene;
		a.add(this.sky.dome, this.terrain.group, this.ground, this.snowMound, this.lighting.sun, this.lighting.sun.target, this.particleRenderer.mesh), this.rig.camera.layers.enable(1), this.lighting.sun.layers.enable(1), this.sky.dome.layers.enable(1), this.terrain.setLayers((e) => e.layers.enable(1)), this.post = new kt(r, a, this.rig.camera), this.weather.onLightning = () => {
			this.ball.startle(), this.ball.say("！", .7), this.audio.thunder();
		}, this.input = new Nt(e, this.rig, {
			classify: (e, t) => this.classify(e, t),
			onActivity: () => this.ball.pointerActivity(),
			onHoverMove: (e) => {
				this.ball.hover && this.ball.addPet(e);
			},
			onDragStart: (e) => this.onDragStart(e),
			onDrag: (e) => this.onDrag(e),
			onRelease: (e, t, n) => this.onRelease(e, t, n),
			onKey: (e) => this.onKey(e)
		}, () => this.time);
	}
	async start(e = "嗨～") {
		this.envAssets.start(this.weather.name);
		let t = q.environment.terrain;
		if (t && this.envAssets.enabled) {
			let e = new Ie().loadAsync(t.detail.url).then((e) => (e.colorSpace = Oe, e.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy()), e)), n = fetch(t.heights).then((e) => {
				if (!e.ok) throw Error(`HTTP ${e.status}`);
				return e.arrayBuffer();
			});
			Promise.all([n, e]).then(([e, n]) => {
				this.disposed ? n.dispose() : (this.terrain.applyDem(new Uint16Array(e), t, n), this.envTerrain.geometry = this.terrain.mesh.geometry, this.layout(), this.lighting.updateEnvironment(this.renderer, this.scene, this.lighting.sun.target.position, !0));
			}).catch((e) => console.warn(`[assets] terrain "${t.heights}" failed to load, keeping the procedural ranges`, e));
		}
		let [n, r] = await Promise.all([ne(q.ball), te(q.umbrella)]);
		if (this.disposed) {
			n.dispose(), r.dispose();
			return;
		}
		this.ballVisual = n, this.umbrellaVisual = r, this.ball.R = n.radius;
		let i = (e) => e.layers.enable(1);
		n.forEachMesh(i), r.forEachMesh(i), this.scene.add(n.root, r.root), this.layout(), this.interact.clear(this.renderer), this.lighting.updateEnvironment(this.renderer, this.scene, new H(...this.ball.pos), !0), e && this.hooks.say(e, 1.6), this.running = !0, this.resume();
	}
	pause() {
		this.looping = !1, this.renderer.setAnimationLoop(null);
	}
	resume() {
		!this.running || this.disposed || this.looping || (this.looping = !0, this.lastFrame = performance.now(), this.renderer.setAnimationLoop((e) => this.frame(e)));
	}
	get isRunning() {
		return this.looping;
	}
	cssW = 1;
	cssH = 1;
	layout(e = this.cssW, t = this.cssH) {
		e = Math.max(1, Math.round(e)), t = Math.max(1, Math.round(t)), this.cssW = e, this.cssH = t, this.rig.layout(e, t), this.ball.setHome(this.rig.homeX, 0);
		let n = this.rig.aspect < .95 ? j.uDem.value > .5 ? .17 : .3 : 0;
		this.terrain.group.rotation.y = n, this.envTerrain.rotation.y = n, j.uTerrainSwing.value = n;
		let r = this.pixelRatio();
		this.renderer.setPixelRatio(r), this.renderer.setSize(e, t, !1), this.post.setSize(e, t, r);
		let i = e * r, a = t * r, o = Math.min(r, 1.25 * this.renderScale);
		this.sky.setSize(e * o, t * o), this.reflection.setSize(e * o, t * o), this.particleRenderer.setResolution(i, a);
	}
	pixelRatio() {
		let e = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio), t = this.pixelBudget, n = this.rig.cssW * this.rig.cssH * e * e, r = n > t ? e * Math.sqrt(t / n) : e;
		return Math.max(.5, r * this.renderScale);
	}
	setWeather(e, t = !1) {
		let n = this.weather.name;
		this.weather.set(e) && (t && this.weather.snap(), this.envAssets.setWeather(e), this.hooks.weather(e, n), n === "rain" && e === "windy" && this.umbrella.blowAway(this.weather.windDir()) ? this.ball.say("我的伞！", 1.6) : this.lines[e]?.length && this.ball.say(Ft(this.lines[e]), 1.8), this.ball.wake(), this.ball.timers.surprise = .35, this.ball.wanderTarget = null, this.ball.saccadeT = .6, this.audio.setWeather(e), this.autoTimer = 0);
	}
	nextWeather() {
		this.setWeather(C[(C.indexOf(this.weather.name) + 1) % C.length]);
	}
	setAutoCycle(e, t = this.autoCycleInterval) {
		this.autoOn = e, this.autoCycleInterval = t, this.autoTimer = 0;
	}
	get autoCycle() {
		return this.autoOn;
	}
	classify(e, t) {
		let n = this.ball.hit(e, t), i = this.umbrella.hit(e, t);
		if (i && (!n || i.t < n.t)) return {
			mode: "umbrella",
			hit: i
		};
		if (n) return {
			mode: "ball",
			hit: n
		};
		if (t[1] < -.003) {
			let n = -e[1] / t[1];
			if (n < 70) return {
				mode: "ground",
				point: r(e, g(t, n))
			};
		}
		return { mode: "sky" };
	}
	dragSun() {
		let e = this.input.ray(), t = {
			az: Math.atan2(e[0], -e[2]),
			el: d(Math.asin(e[1]), .02, 1.2)
		};
		this.clock.isNight ? this.clock.moonOverride = t : this.weather.sunOverride = t;
	}
	setTimeMode(e, t = {}) {
		if (this.clock.setMode(e), t.instant && this.clock.snap(), this.hooks.time(e), t.quiet) return;
		let n = e === "night" || e === "auto" && this.clock.night > .5;
		this.ball.say(e === "auto" ? "跟着时间走" : n ? "晚安～" : "早上好！", 1.4), this.ball.wake();
	}
	dragging = !1;
	onDragStart(e) {
		this.dragging = !0, this.hooks.interact(e.mode, "drag"), e.mode === "sky" && this.dragSun(), e.mode === "ball" && this.ball.startGrab();
	}
	onDrag(e) {
		e.mode === "sky" && this.dragSun();
	}
	onRelease(e, t, n) {
		this.dragging = !1, t && this.hooks.interact(e.mode, n ? "doubleclick" : "click", e.mode === "ground" ? { point: e.point } : void 0), e.mode === "ball" ? this.ball.grabbed ? this.ball.endGrab() : t && (n ? this.ball.flip() : this.ball.boop(e.hit.local, e.hit.point)) : e.mode === "umbrella" && t ? (this.umbrella.spinV += 9, this.ball.timers.happy = .8, this.ball.say("转~", .9), this.umbrella.pose && this.particles.rimDrops(this.umbrella.pose, 40)) : e.mode === "ground" && t && (this.ball.sendTo(e.point), this.groundPoke(e.point));
	}
	groundPoke(e) {
		let t = this.weather.p;
		t.snowCover > .4 ? this.particles.snowPuff(e[0], .05, e[2], 10, .6) : Math.max(t.groundWet, t.puddle) > .5 ? this.particles.splashRing(e[0], e[2], 12, .6) : this.particles.dustPuff(e[0], e[2], 8, .6), this.extraImpulses.push([
			e[0],
			e[2],
			.35,
			-.9
		]);
	}
	onKey(e) {
		let t = parseInt(e, 10);
		if (t >= 1 && t <= 6) return this.setWeather(C[t - 1]), !1;
		let n = {
			ArrowLeft: [-4.5, 0],
			ArrowRight: [4.5, 0],
			ArrowUp: [0, -4.5],
			ArrowDown: [0, 4.5]
		};
		if (e === "n" || e === "N") return this.setTimeMode(this.clock.isNight ? "day" : "night"), !0;
		if (e === " ") this.ball.jump();
		else if (n[e]) this.ball.push(...n[e]);
		else return !1;
		return this.hooks.interact("key", "key", { key: e }), !0;
	}
	frame(e) {
		let t = Math.max(0, (e - this.lastFrame) / 1e3);
		this.lastFrame = e;
		let n = Math.min(t, 1 / 30) || 1 / 60;
		this.adapt(Math.min(t, .1)), this.step(n);
	}
	step(e) {
		this.running && !this.disposed && (this.time += e, this.update(e), this.render(e), this.onFrame?.(e));
	}
	onFrame = null;
	update(e) {
		this.weather.update(e), this.clock.update(e), this.clock.night > .01 && this.envAssets.requestMoon();
		let t = this.clock.apply(this.weather.p), n = this.clock.isNight;
		n !== this.lastNight && (this.lastNight = n, this.hooks.daynight(n)), this.applyWeather(t), this.envAssets.update(e, m.uSunDir.value), this.rig.update(e, this.input.inside ? this.input.ndc : null), this.input.updateVelocity(e);
		let i = this.rig.position, a = this.input.ray(), o = this.input.active, s = this.input.inside && !this.input.down ? this.ball.hit(i, a) : null;
		this.ball.setHover(!!s || this.ball.grabbed);
		let c = this.input.inside && !this.input.down && !s && this.umbrella.hit(i, a), l = this.ball.grabbed || this.dragging ? "grabbing" : s || c ? "grab" : "default";
		l !== this.cursorKind && (this.cursorKind = l, this.hooks.cursor(l));
		let f = this.rig.halfWidth, p = {
			x0: Math.max(this.ball.home[0] - 8, -f + 1.2),
			x1: Math.min(this.ball.home[0] + 3.2, f - 1),
			z0: -9,
			z1: 3.2,
			y1: 8
		};
		if (this.ball.grabbed) {
			let e = (this.ball.pos[2] - i[2]) / a[2], t = e > 0 ? r(i, g(a, e)) : this.ball.pos;
			this.ball.grabTarget = [
				d(t[0], p.x0, p.x1),
				d(t[1], this.ball.R, 7.5),
				this.ball.pos[2]
			];
		}
		let h = null;
		if (o) {
			if (s) h = i;
			else {
				let e = (this.ball.pos[2] + 2.5 - i[2]) / a[2];
				h = e > 0 ? r(i, g(a, e)) : i;
			}
		}
		let _ = this.weather.windDir(), v = this.weather.windStrength(), y = {
			weather: this.weather.name,
			wind: _,
			windStrength: v,
			gust: this.weather.gust,
			snowing: t.snowRate,
			raining: t.rainRate,
			sunDir: this.weather.sunDir(t),
			sunBright: d(t.sunI / 3, 0, 1),
			camPos: i,
			cursorTarget: h,
			cursorActive: o,
			umbrella: this.umbrella.open,
			friction: u(u(2.6, 1.5, t.groundWet), 4.5, t.snowCover),
			bounds: p
		}, b = Math.min(this.ball.baseHome[0], -this.rig.halfWidth + 1.5);
		this.ball.home[0] = Math.max(this.ball.baseHome[0] - 1.2 * Math.min(this.umbrella.open, 1), b), this.ball.update(e, y), this.umbrella.update(e, this.ball, {
			raining: t.rainRate,
			wind: _,
			windStrength: v
		}), this.handleBallEvents(), this.updateSnowMound(e);
		let x = this.mapCenter(), S = this.interact.worldSize / 2;
		this.particles.update(e, {
			weather: t,
			ball: this.ball,
			ballCenter: this.ball.renderPos(),
			ballScale: this.ball.scaleVec(),
			umbPose: this.umbrella.pose,
			cam: i,
			cursor: {
				active: o && !this.ball.grabbed,
				dir: a,
				vel: this.input.worldVel
			},
			region: {
				x0: -15,
				x1: this.ball.home[0] + 13,
				z0: i[2] - 30,
				z1: i[2] - 1,
				top: t.snowRate > t.rainRate ? 9 : 12
			},
			mapRect: [
				x[0] - S,
				x[0] + S,
				x[1] - S,
				x[1] + S
			],
			wind: _,
			windStrength: v,
			gust: this.weather.gust
		}), this.audio.update(this.weather.gust * t.wind), this.autoOn && (this.autoTimer += e) > this.autoCycleInterval && this.nextWeather();
		let C = this.ball.renderPos(), w = this.rig.project(r(C, [
			0,
			this.ball.R * this.ball.squash + .5 + this.ball.snow * .2,
			0
		])), T = this.rig.project([
			C[0],
			0,
			C[2] + .2
		]), E = this.rig.project(C), D = this.rig.project([
			C[0],
			C[1] + this.ball.R,
			C[2]
		]), O = this.anchors;
		O.ball.x = E[0], O.ball.y = E[1], O.ball.radius = Math.abs(E[1] - D[1]), O.bubble.x = w[0], O.bubble.y = w[1], O.ground.x = T[0], O.ground.y = T[1] + 12;
	}
	updateSnowMound(t) {
		let n = this.weather.p, r = this.ball, i = r.pos[1] - r.R < .06, a = Math.hypot(r.vel[0], r.vel[2]), o = n.snowCover * +!!i * (1 - .7 * d((a - .3) / 1.2, 0, 1));
		this.moundAmt = e(this.moundAmt, o, o > this.moundAmt ? .8 : 3, t);
		let s = r.renderPos();
		this.snowMound.visible = this.moundAmt > .01, this.snowMound.position.set(s[0], -.002, s[2]), this.snowMound.scale.set(r.R, 1, r.R), T.uSnowMound.value.set(s[0], s[2], r.R, this.moundAmt);
	}
	mapCenter() {
		return [this.ball.baseHome[0] - 1.5, -1];
	}
	handleBallEvents() {
		let e = this.weather.p;
		for (let t of this.ball.events) {
			switch (t.type) {
				case "land": {
					let n = t.impact, r = Math.max(e.groundWet, e.puddle) * (1 - e.snowCover);
					e.snowCover > .4 ? this.particles.snowPuff(t.pos[0], .1, t.pos[2], Math.round(6 + n * 1.6), .4 + n * .08) : r > .55 ? this.particles.splashRing(t.pos[0], t.pos[2], Math.round(8 + n * 2.2), .55 + n * .06) : n > 4 && this.particles.dustPuff(t.pos[0], t.pos[2], Math.round(4 + n), .5 + n * .05), this.extraImpulses.push([
						t.pos[0],
						t.pos[2],
						.75,
						-Math.min(n * .12, 1.6)
					]), n > 13 && !this.reduceMotion && (this.rig.shake = Math.min(1, n / 20)), this.audio.thud(n);
					break;
				}
				case "hop":
					this.extraImpulses.push([
						t.pos?.[0] ?? this.ball.pos[0],
						t.pos?.[2] ?? this.ball.pos[2],
						.5,
						-.3
					]), this.audio.hop();
					break;
				case "shed": {
					let e = this.ball.renderPos(), n = t.dir;
					this.particles.snowPuff(e[0] + n[0] * .9, e[1] + n[1] * .9, e[2] + n[2] * .9, Math.round(18 + t.amount * 60), 1.5, n);
					break;
				}
				case "boop":
					this.audio.boop();
					break;
				case "flip":
					this.audio.boop(1.5);
					break;
				case "say": this.hooks.say(t.text, t.dur);
			}
			this.hooks.ball(t);
		}
		this.ball.events.length = 0;
	}
	applyWeather(e) {
		let t = this.weather.windDir(), n = this.weather.windStrength(), i = this.weather.sunDir(e), a = this.weather.sunColor(e, !this.clock.isNight), o = this.weather.lightning;
		m.uSunDir.value.set(i[0], i[1], i[2]), m.uSunCol.value.setRGB(a[0], a[1], a[2]), m.uSunGlow.value = e.sunGlow, m.uSunSpec.value = d(1 - e.cloudCover * 1.05, 0, 1) ** 1.5, Y(m.uZenith.value, e.zenith), Y(m.uHorizon.value, e.horizon), Y(m.uFogCol.value, e.fogCol), m.uFogDens.value = e.fogDens, m.uFogFall.value = e.fogFall, m.uHaze.value = e.haze, m.uMist.value = e.mist, m.uLightning.value = o, m.uNight.value = this.clock.night, m.uStars.value = this.clock.stars(e), m.uMoonDisc.value = this.clock.moonDisc(), m.uMoonPhase.value = this.clock.phase * Math.PI * 2, m.uTime.value = this.time;
		let s = re;
		s.uCloudBase.value = e.cloudBase, s.uCloudTop.value = e.cloudTop, s.uCloudCover.value = e.cloudCover, s.uCloudDensity.value = e.cloudDens, s.uCloudType.value = e.cloudType, s.uCloudStretch.value = e.cloudStretch, s.uCloudWindDir.value.set(t[0], t[1]), s.uCloudOffset.value.set(this.weather.cloudOffset[0], this.weather.cloudOffset[1]), s.uTowers.value = e.towers, s.uSunAz.value = e.sunAz, s.uCloudAmbTop.value.setRGB(e.zenith[0] * 1.2 + o, e.zenith[1] * 1.2 + o, e.zenith[2] * 1.22 + o);
		let c = (e.sunI > .001 ? 3.2 / e.sunI : 0) * this.clock.cloudLight();
		s.uCloudSun.value.setRGB(a[0] * c, a[1] * c, a[2] * c);
		let l = e.sunI * Math.max(e.sunEl, 0) * .25;
		s.uCloudAmbBottom.value.setRGB(e.sandCol[0] * l + e.horizon[0] * .6, e.sandCol[1] * l + e.horizon[1] * .6, e.sandCol[2] * l + e.horizon[2] * .6), Y(s.uCloudTint.value, e.cloudTint), s.uCloudAmbScale.value = e.cloudAmb;
		let f = this.weather.bolt;
		s.uBolt.value.set(f[0], 636e4 + f[1], f[2], o), j.uMtnSnow.value = e.mtnSnow, Y(j.uMtnTint.value, e.mtnTint), j.uMistSheets.value = e.mistSheets, j.uMtnHaze.value = e.mtnHaze;
		let p = T;
		p.uGroundWet.value = e.groundWet, p.uPuddle.value = e.puddle, p.uSnowCover.value = e.snowCover, p.uDust.value = e.dust, p.uRain.value = e.rainRate, Y(p.uSandCol.value, e.sandCol), p.uGroundWind.value.set(t[0], t[1]), p.uBallSphere.value.fromArray(this.ball.colliderSphere()), p.uShelter.value.fromArray(this.umbrella.shelter(t, n));
		let h = Math.max(a[0], a[1], a[2], 1e-4);
		J.setRGB(a[0] / h, a[1] / h, a[2] / h);
		let _ = new H(this.ball.baseHome[0] - 1, 0, 0);
		this.lighting.setSun(m.uSunDir.value, J, h * Math.PI, _), this.lighting.sun.shadow.radius = e.shadowRadius, this.scene.environmentIntensity = e.envI;
		let v = e.snowCover;
		if (this.lighting.setGroundAlbedo(J.setRGB(u(e.sandCol[0], .93, v), u(e.sandCol[1], .95, v), u(e.sandCol[2], .98, v))), this.ballVisual) {
			let t = this.ballVisual.uniforms;
			Y(t.uFillCol.value, e.fill), Y(t.uKeyCol.value, e.key);
			let n = this.ball.renderPos(), r = this.rig.position;
			t.uFillDir.value.set(r[0] - n[0] - 3, r[1] - n[1] + 4, r[2] - n[2]).normalize();
			let a = r[0] - n[0], o = r[2] - n[2], s = Math.hypot(a, o) || 1, c = [
				a / s,
				0,
				o / s
			], l = [
				c[2],
				0,
				-c[0]
			], u = d((i[0] * l[0] + i[2] * l[2]) * 6, -1, 1), f = Math.cos(1.48), p = Math.sin(1.48), m = Math.cos(.61), h = Math.sin(.61);
			t.uKeyDir.value.set((c[0] * f + l[0] * u * p) * m, h, (c[2] * f + l[2] * u * p) * m).normalize();
		}
		this.umbrellaVisual && "wet" in this.umbrellaVisual && (this.umbrellaVisual.wet.value = e.rainRate), this.particleRenderer.material.uniforms.uAmbCol.value.setRGB((e.zenith[0] + e.horizon[0]) * .5 * (1 + o * .8), (e.zenith[1] + e.horizon[1]) * .5 * (1 + o * .8), (e.zenith[2] + e.horizon[2]) * .5 * (1 + o * .8));
		let y = this.post, b = this.rig.project(r(this.rig.position, g(i, 400))), x = b[0] / this.rig.cssW, S = 1 - b[1] / this.rig.cssH, C = b[2] > 0 ? d(1.6 - Math.max(Math.abs(x - .5), Math.abs(S - .5)) * 2, 0, 1) : 0, w = C * d(e.sunI / 3.4, 0, 1) * d(e.sunEl * 4, 0, 1);
		this.renderer.toneMappingExposure = e.exposure * (1 - .12 * w), y.bloom.strength = e.bloom, y.bloom.radius = e.bloomRadius, y.bloom.threshold = e.threshold, y.lens.sunUv.set(x, S), y.lens.rays = e.rays * C * 1.4, y.lens.streak = e.streak * w;
		let E = y.grade.uniforms;
		Y(E.uLift.value, e.lift), Y(E.uGain.value, e.gain), E.uSat.value = e.sat, E.uContrast.value = e.contrast, E.uCurve.value = e.curve, E.uWhite.value = e.white, E.uHalation.value = e.halation, E.uGrain.value = e.grain, y.optics.uniforms.uVignette.value = e.vignette, E.uFlash.value = o * .12, E.uTime.value = this.time;
		let D = this.ball.renderPos(), O = this.rig.position, k = Math.hypot(D[0] - O[0], D[1] - O[1], D[2] - O[2]) - this.ball.R * .6;
		this.particleRenderer.setFocus(k), y.setFocus(this.rig.camera, k, e.dof * .001 * this.renderer.domElement.height * (this.reduceMotion ? .5 : 1)), this.ballVisual?.setEnvIntensity(e.ballEnv), J.setRGB((e.zenith[0] + e.horizon[0]) * .5, (e.zenith[1] + e.horizon[1]) * .5, (e.zenith[2] + e.horizon[2]) * .5), y.setPrecip(this.rig.camera, e.rainRate, e.snowRate, n, this.time, J);
	}
	render(e) {
		let t = this.renderer, n = this.weather.p;
		this.ballVisual.update(this.ball.renderState());
		let i = this.umbrella.pose;
		i ? this.umbrellaVisual.update(i, e) : this.umbrellaVisual.root.visible = !1;
		let a = [...this.extraImpulses, ...this.particles.impulses];
		this.extraImpulses.length = 0;
		let o = this.ball.renderPos(), s = Math.hypot(this.ball.vel[0], this.ball.vel[2]), c = this.ball.pos[1] - this.ball.R < .06, l = Math.max(n.groundWet, n.puddle) * (1 - n.snowCover);
		c && s > .4 && l > .35 && a.unshift([
			o[0],
			o[2],
			.7,
			-.05 * Math.min(s, 6)
		]);
		let u = null, f = this.input.ray();
		if (n.mist > .05 && this.input.active && f[1] < -.01) {
			let e = this.rig.position, t = -e[1] / f[1];
			t < 40 && (u = r(e, g(f, t)));
		}
		let p = this.mapCenter();
		this.interact.setCenter(p[0], p[1]), this.interact.step(t, {
			impulses: a,
			ballContact: [
				o[0],
				o[2],
				.5 + (1 - this.ball.squash) * 1.6,
				+!!c
			],
			fogBrush: u ? [
				u[0],
				u[2],
				1.5,
				1
			] : [
				0,
				0,
				1,
				0
			],
			fogBrush2: [
				o[0],
				o[2],
				1.8,
				n.mist > .05 ? d(.35 + s * .25, 0, 1) : 0
			],
			dt: e,
			snowing: n.snowRate,
			snowCover: n.snowCover
		}), this.lighting.updateEnvironment(t, this.scene, new H(o[0], 0, o[2])), this.sky.update(t, this.rig.camera), this.sky.setSunDisc(0), this.reflection.render(t, this.scene, this.rig.camera), this.sky.setSunDisc(1), T.uMirror.value = this.reflection.texture, T.uMirrorMatrix.value.copy(this.reflection.textureMatrix), this.particleRenderer.upload(), this.post.render(e);
	}
	lockScale(e) {
		this.renderScale = e, this.perf.locked = !0, this.layout();
	}
	unlockScale() {
		this.perf.locked = !1, this.perf.good = 0;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = !0, this.pause(), this.input.dispose(), this.audio.dispose(), this.envAssets.enabled = !1;
		let e = /* @__PURE__ */ new Set(), t = (t) => t.traverse((t) => {
			let n = t;
			n.geometry && !e.has(n.geometry) && (e.add(n.geometry), n.geometry.dispose());
			let r = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
			for (let t of r) e.has(t) || (e.add(t), t.dispose());
		});
		t(this.scene), t(this.lighting.envScene), this.sky.dispose(), this.reflection.dispose(), this.post.composer.dispose(), this.renderer.renderLists.dispose(), this.renderer.dispose(), this.renderer.forceContextLoss();
	}
	adapt(e) {
		let t = this.perf;
		if (t.locked || this.time < 2.5 || document.hidden) {
			t.acc = 0, t.frames = 0;
			return;
		}
		if (t.acc += e, t.frames++, t.acc < 1) return;
		let n = t.acc / t.frames;
		t.acc = 0, t.frames = 0, n > .0205 ? (t.good = 0, this.sky.steps > 28 ? this.sky.steps -= 10 : this.renderScale > .6 && (this.renderScale = Math.max(.6, this.renderScale - .08), this.layout())) : n < .0175 && ++t.good >= 3 && (t.good = 0, this.renderScale < 1 ? (this.renderScale = Math.min(1, this.renderScale + .05), this.layout()) : this.sky.steps < 64 && (this.sky.steps = Math.min(64, this.sky.steps + 10)));
	}
};
function Lt() {
	T.uGTex.value = 0, T.uSnowTex.value = 0, T.uSnowMound.value.set(0, 0, 1, 0), j.uRockTex.value = 0, j.uDem.value = 0, j.uTerrainSwing.value = 0, P.uHdrOn.value = 0, P.uHdrMix.value = 0, x.uMoonTexOn.value = 0;
}
//#endregion
//#region src/lib/config.ts
var Rt = (e) => !!e && typeof e == "object" && !Array.isArray(e), X = (e) => structuredClone(e), Z = {
	assets: X(q),
	presets: X(N),
	night: X(M),
	daylight: X(A)
};
function zt(e, t) {
	for (let n of Object.keys(e)) n in t || delete e[n];
	for (let n of Object.keys(t)) e[n] = X(t[n]);
}
function Q(e, t) {
	if (!t) return e;
	for (let [n, r] of Object.entries(t)) r !== void 0 && (r === null ? delete e[n] : Rt(r) && Rt(e[n]) ? Q(e[n], r) : e[n] = X(r));
	return e;
}
function Bt(e) {
	zt(q, Z.assets), zt(N, Z.presets), zt(M, Z.night), zt(A, Z.daylight), Q(q, e.assets);
	for (let [t, n] of Object.entries(e.presets ?? {})) {
		let e = N[t];
		e && Q(e, n);
	}
	Q(M, e.night), Q(A, e.daylight), Wt(q, e.assetBase ?? "");
}
function Vt() {
	return X(Z);
}
var Ht = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;
function Ut(e, t) {
	return !t || Ht.test(e) ? e : (t.endsWith("/") ? t : `${t}/`) + e;
}
function Wt(e, t) {
	if (!t) return;
	let n = (e) => Ut(e, t);
	e.ball.kind === "gltf" && (e.ball.url = n(e.ball.url)), e.umbrella.kind === "gltf" && (e.umbrella.url = n(e.umbrella.url));
	let r = e.environment, i = (e) => {
		e && (e.diff &&= n(e.diff), e.nor &&= n(e.nor), e.rough &&= n(e.rough));
	};
	i(r.ground.base), i(r.ground.micro), i(r.ground.snow), i(r.rock);
	for (let e of Object.keys(r.hdri)) {
		let t = r.hdri[e];
		t && (r.hdri[e] = n(t));
	}
	r.terrain && (r.terrain.heights = n(r.terrain.heights), r.terrain.detail.url = n(r.terrain.detail.url)), r.moon && (r.moon.albedo = n(r.moon.albedo), r.moon.height && (r.moon.height = n(r.moon.height)));
}
//#endregion
//#region src/lib/emitter.ts
var Gt = class {
	map = /* @__PURE__ */ new Map();
	on(e, t) {
		let n = this.map.get(e);
		return n || this.map.set(e, n = /* @__PURE__ */ new Set()), n.add(t), () => this.off(e, t);
	}
	once(e, t) {
		let n = this.on(e, (e) => {
			n(), t(e);
		});
		return n;
	}
	off(e, t) {
		this.map.get(e)?.delete(t);
	}
	has(e) {
		return (this.map.get(e)?.size ?? 0) > 0;
	}
	emit(e, t) {
		let n = this.map.get(e);
		if (n) for (let r of [...n]) try {
			r(t);
		} catch (t) {
			console.error(`[weather-scene] "${String(e)}" listener failed`, t);
		}
	}
	clear() {
		this.map.clear();
	}
}, Kt = class extends Error {
	code;
	constructor(e, t) {
		super(t), this.code = e, this.name = "WeatherSceneError";
	}
}, $ = null;
function qt() {
	try {
		return !!document.createElement("canvas").getContext("webgl2");
	} catch {
		return !1;
	}
}
async function Jt(e, t = {}) {
	let n = new Yt(e, t);
	return await n.ready, n;
}
var Yt = class {
	container;
	canvas;
	ready;
	ball;
	emitter = new Gt();
	app;
	ro;
	io = null;
	userPaused = !1;
	hiddenPaused = !1;
	offscreen = !1;
	disposed = !1;
	quality = "auto";
	speech;
	fps = {
		t: 0,
		n: 0,
		value: 0,
		ms: 0
	};
	onVisibility = () => {
		this.hiddenPaused = this.autoPause && (document.hidden || this.offscreen), this.syncPause();
	};
	autoPause;
	onWindowResize = () => this.resize();
	baseParticles = 1;
	constructor(e, t = {}) {
		if (this.container = e, !qt()) throw new Kt("webgl2-unavailable", "WebGL2 is not available in this browser");
		if ($ && !$.disposed) throw new Kt("already-active", "Only one WeatherScene can run per page: dispose() the previous one first");
		$ = this, Bt({
			assets: t.assets,
			presets: t.presets,
			night: t.night,
			daylight: t.daylight,
			assetBase: t.assetBase
		}), t.moonPhase !== void 0 && (M.moonPhase = t.moonPhase);
		let n = this.canvas = document.createElement("canvas");
		n.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none", n.setAttribute("aria-hidden", "true"), e.appendChild(n);
		let r = this.emitter, i = t.cursor ?? !0, a = t.speech ?? !0;
		this.speech = a !== !1, this.autoPause = t.autoPause ?? !0;
		try {
			this.app = new It(n, {
				say: (e, t) => {
					this.speech && r.emit("say", {
						text: e,
						duration: t
					});
				},
				weather: (e, t) => r.emit("weatherchange", {
					weather: e,
					previous: t
				}),
				time: (e) => r.emit("timechange", { mode: e }),
				daynight: (e) => r.emit("daynight", { night: e }),
				cursor: (e) => {
					i && (n.style.cursor = e === "default" ? "" : e), r.emit("cursor", { cursor: e });
				},
				ball: (e) => r.emit("ball", e),
				interact: (e, t, n) => r.emit("interact", {
					target: e,
					action: t,
					key: n?.key,
					point: n?.point
				})
			}, { reducedMotion: t.reducedMotion });
		} catch (e) {
			throw n.remove(), $ = null, new Kt("init-failed", `WeatherScene failed to start: ${e.message}`);
		}
		let o = this.app;
		this.baseParticles = o.particles.quality, typeof a == "object" && a.lines && Object.assign(o.lines, a.lines), t.maxPixelRatio && (o.maxPixelRatio = t.maxPixelRatio), t.pixelBudget && (o.pixelBudget = t.pixelBudget), t.layout && (o.rig.ballX = t.layout.ballX ?? null, o.rig.portraitBallX = t.layout.portraitBallX ?? null), o.input.pointer = t.input?.pointer ?? !0, o.input.keyboard = t.input?.keyboard ?? !1, t.environmentAssets === !1 && (o.envAssets.enabled = !1), t.audio && o.audio.enable(!0), t.autoCycle && o.setAutoCycle(!0, typeof t.autoCycle == "number" ? t.autoCycle : 14);
		let s = t.weather ?? "sunny";
		s !== o.weather.name && (o.weather.set(s), o.weather.snap()), o.clock.setMode(t.time ?? "auto"), o.clock.snap(), o.onFrame = (e) => this.frame(e), this.ball = this.makeBall(), this.ro = new ResizeObserver(() => this.resize()), this.ro.observe(e), addEventListener("resize", this.onWindowResize), this.autoPause && (document.addEventListener("visibilitychange", this.onVisibility), this.io = new IntersectionObserver((e) => {
			this.offscreen = !e[e.length - 1].isIntersecting, this.onVisibility();
		}), this.io.observe(e)), this.resize(), this.setQuality(t.quality ?? "auto");
		let c = typeof a == "object" && a.greeting !== void 0 ? a.greeting : "嗨～";
		this.ready = (async () => {
			if (t.debug) {
				let { installDebug: e } = await import("./debug-pqTzl7QU.js");
				e(o);
			}
			await o.start(c), !this.disposed && (this.resize(), r.emit("weatherchange", {
				weather: o.weather.name,
				previous: o.weather.name
			}), r.emit("timechange", { mode: o.clock.mode }), this.syncPause(), r.emit("ready", { scene: this }));
		})();
	}
	on(e, t) {
		return this.emitter.on(e, t);
	}
	once(e, t) {
		return this.emitter.once(e, t);
	}
	off(e, t) {
		this.emitter.off(e, t);
	}
	static weathers = C;
	get weather() {
		return this.app.weather.name;
	}
	setWeather(e, t = {}) {
		if (!C.includes(e)) throw Error(`unknown weather "${e}" (expected ${C.join(", ")})`);
		this.app.setWeather(e, t.instant);
	}
	nextWeather() {
		this.app.nextWeather();
	}
	setAutoCycle(e, t) {
		this.app.setAutoCycle(e, t);
	}
	get autoCycle() {
		return this.app.autoCycle;
	}
	updatePreset(e, t) {
		Q(N[e], t);
	}
	getPreset(e) {
		return structuredClone(N[e]);
	}
	setSun(e) {
		this.app.weather.sunOverride = e ? {
			az: e.azimuth,
			el: e.elevation
		} : null;
	}
	get timeMode() {
		return this.app.clock.mode;
	}
	get isNight() {
		return this.app.clock.isNight;
	}
	get nightAmount() {
		return this.app.clock.night;
	}
	setTime(e, t = {}) {
		this.app.setTimeMode(e, t);
	}
	setMoonPhase(e) {
		M.moonPhase = e;
	}
	setMoon(e) {
		this.app.clock.moonOverride = e ? {
			az: e.azimuth,
			el: e.elevation
		} : null;
	}
	updateNight(e) {
		Q(M, e);
	}
	updateDaylight(e) {
		Q(A, e);
	}
	setInput(e) {
		e.pointer !== void 0 && this.app.input.setPointer(e.pointer), e.keyboard !== void 0 && (this.app.input.keyboard = e.keyboard);
	}
	setSound(e) {
		this.app.audio.enable(e);
	}
	get sound() {
		return this.app.audio.enabled;
	}
	setSpeech(e) {
		this.speech = e;
	}
	setLines(e) {
		Object.assign(this.app.lines, e);
	}
	static defaultLines = Pt;
	setLayout(e) {
		e.ballX !== void 0 && (this.app.rig.ballX = e.ballX), e.portraitBallX !== void 0 && (this.app.rig.portraitBallX = e.portraitBallX), this.resize();
	}
	resize() {
		if (this.disposed) return;
		let e = this.container.getBoundingClientRect();
		this.app.layout(e.width || 1, e.height || 1);
	}
	setQuality(e) {
		let t = this.app;
		if (this.quality = e, e === "auto") {
			t.unlockScale(), t.sky.steps = 64, t.particles.quality = this.baseParticles;
			return;
		}
		let n = {
			low: [
				.6,
				28,
				.5
			],
			medium: [
				.8,
				44,
				.75
			],
			high: [
				1,
				64,
				1
			]
		}[e];
		t.sky.steps = n[1], t.particles.quality = Math.min(n[2], this.baseParticles), t.lockScale(n[0]);
	}
	getStats() {
		let e = this.app;
		return {
			fps: this.fps.value,
			frameMs: this.fps.ms,
			renderScale: e.renderScale,
			cloudSteps: e.sky.steps,
			quality: this.quality,
			width: e.renderer.domElement.width,
			height: e.renderer.domElement.height
		};
	}
	capture(e = "image/png", t) {
		return this.app.step(.001), new Promise((n, r) => this.canvas.toBlob((e) => e ? n(e) : r(/* @__PURE__ */ Error("capture failed")), e, t));
	}
	get paused() {
		return this.userPaused || this.hiddenPaused;
	}
	pause() {
		this.userPaused = !0, this.syncPause();
	}
	resume() {
		this.userPaused = !1, this.syncPause();
	}
	syncPause() {
		if (this.disposed) return;
		let e = this.paused;
		e !== !this.app.isRunning && (e ? this.app.pause() : this.app.resume(), this.app.isRunning === !e && this.emitter.emit("pause", { paused: e }));
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.ro.disconnect(), this.io?.disconnect(), removeEventListener("resize", this.onWindowResize), document.removeEventListener("visibilitychange", this.onVisibility), this.app.dispose(), this.canvas.remove(), $ === this && ($ = null), this.emitter.emit("dispose", {}), this.emitter.clear());
	}
	get isDisposed() {
		return this.disposed;
	}
	get internals() {
		return { app: this.app };
	}
	frame(e) {
		let t = this.fps;
		t.t += e, t.n++, t.t >= .5 && (t.value = Math.round(t.n / t.t), t.ms = +(1e3 * t.t / t.n).toFixed(1), t.t = 0, t.n = 0), this.emitter.has("frame") && this.emitter.emit("frame", {
			dt: e,
			anchors: this.app.anchors
		});
	}
	makeBall() {
		let e = this.app, t = e.ball;
		return {
			jump: () => {
				t.wake(), t.jump();
			},
			flip: () => {
				t.wake(), t.flip();
			},
			say: (e, n = 1.8) => t.say(e, n),
			cheer: (e, n = 2) => {
				t.wake(), t.timers.happy = 1.2, t.jump(), e && t.say(e, n);
			},
			push: (e, n) => {
				t.wake(), t.push(e, n);
			},
			wake: () => t.wake(),
			get anchors() {
				return e.anchors;
			}
		};
	}
};
//#endregion
export { k as LABELS, C as WEATHERS, Yt as WeatherScene, Kt as WeatherSceneError, Jt as createWeatherScene, Vt as getDefaults, qt as isWebGL2Available, Ut as resolveAsset };
