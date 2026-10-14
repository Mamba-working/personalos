import { D as e, O as t, S as n, U as r, b as i, g as a, i as o, o as s, p as c, r as l, s as u, u as d, v as f, y as p } from "./factory-fttR10Kb.js";
import { Color as m, Mesh as h, MeshBasicMaterial as g, MeshStandardMaterial as _, SphereGeometry as v } from "three";
import { GLTFExporter as y } from "three/addons/exporters/GLTFExporter.js";
//#region src/app/debug.ts
function b(b) {
	let x = b.renderer.getContext(), S = b.renderer.domElement;
	function C(e = 1, t = 1 / 60) {
		for (let n = 0; n < e; n++) b.step(t);
	}
	function w() {
		let e = S.width, t = S.height, n = new Uint8Array(e * t * 4);
		return x.readPixels(0, 0, e, t, x.RGBA, x.UNSIGNED_BYTE, n), {
			px: n,
			w: e,
			h: t
		};
	}
	function T(e = 100, t = 44, n = 0, r = 0, i = 1, a = 1, o = !0) {
		o && C(1);
		let { px: s, w: c, h: l } = w(), u = [];
		for (let o = 0; o < t; o++) {
			let d = [];
			for (let u = 0; u < e; u++) {
				let f = 0, p = 0, m = 0, h = 0, g = Math.floor((n + (i - n) * u / e) * c), _ = Math.max(g + 1, Math.floor((n + (i - n) * (u + 1) / e) * c)), v = Math.floor((r + (a - r) * o / t) * l), y = Math.max(v + 1, Math.floor((r + (a - r) * (o + 1) / t) * l));
				for (let e = v; e < y; e += 2) for (let t = g; t < _; t += 2) {
					let n = ((l - 1 - e) * c + t) * 4;
					f += s[n], p += s[n + 1], m += s[n + 2], h++;
				}
				d.push([
					f / h | 0,
					p / h | 0,
					m / h | 0
				]);
			}
			u.push(d);
		}
		return u;
	}
	function E(e, t, n = 0, r = 0, i = 1, a = 1, o = !1) {
		let s = T(e, t, n, r, i, a), c = s.map((e) => e.map(([e, t, n]) => .2126 * e + .7152 * t + .0722 * n)), l = 1e9, u = -1e9;
		c.forEach((e) => e.forEach((e) => {
			l = Math.min(l, e), u = Math.max(u, e);
		}));
		let d = `lo ${l | 0} hi ${u | 0}\n` + c.map((e) => e.map((e) => " .:-=+*#%@"[Math.min(9, Math.floor((u - e) / (u - l + 1e-6) * 10))]).join("")).join("\n");
		return o && (d += "\n\n" + s.map((e) => e.map(([e, , t]) => {
			let n = e - t;
			return n > 30 ? "W" : n > 18 ? "w" : n > 8 ? "n" : n > -4 ? "c" : "B";
		}).join("")).join("\n")), d;
	}
	function D(e, n = !0) {
		n && C(1);
		let { px: r, w: i, h: a } = w(), o = {};
		for (let n in e) {
			let [s, c] = e[n], l = 0, u = 0, d = 0, f = 0;
			for (let e = -1; e <= 1; e++) for (let n = -1; n <= 1; n++) {
				let o = t(Math.floor(s * i) + n, 0, i - 1), p = (t(Math.floor((1 - c) * a) + e, 0, a - 1) * i + o) * 4;
				l += r[p], u += r[p + 1], d += r[p + 2], f++;
			}
			o[n] = [
				l / f | 0,
				u / f | 0,
				d / f | 0
			];
		}
		return o;
	}
	function O() {
		let n = b.rig, i = b.ball, a = n.cssW, o = n.cssH, s = i.renderPos(), c = n.project(s), l = c[1] - n.project([
			s[0],
			s[1] + i.R,
			s[2]
		])[1], u = b.weather.sunDir(), d = n.project(e(n.position, r(u, 400))), f = n.project([
			0,
			n.position[1],
			-1e4
		])[1], p = (e, n) => [t(e / a, .002, .998), t(n / o, .002, .998)], m = {
			skyTL: p(a * .08, o * .06),
			skyL: p(a * .25, o * .3),
			skyTopMid: p(a * .5, o * .08),
			skyR: p(a * .95, o * .3),
			nearSun: p(d[0] - 70, d[1] + 50),
			sun: p(d[0], d[1]),
			mtnL: p(a * .2, f - 8),
			mtnR: p(a * .55, f - 8),
			horizonGround: p(a * .3, f + 6),
			groundBL: p(a * .12, o * .94),
			groundMid: p(a * .45, o * .8),
			groundR: p(c[0] + l * 1.7, c[1] + l * .9),
			contact: p(c[0], c[1] + l * 1.05),
			shadow: p(c[0] - l * .5, c[1] + l * 1.5),
			ballC: p(c[0], c[1]),
			ballL: p(c[0] - l * .85, c[1]),
			ballR: p(c[0] + l * .85, c[1]),
			ballTop: p(c[0], c[1] - l * .85),
			ballBot: p(c[0], c[1] + l * .8),
			ballUR: p(c[0] + l * .6, c[1] - l * .6),
			ballRim: p(c[0] + l * .7, c[1] - l * .66),
			skyBehindBall: p(c[0] + l * .3, c[1] - l * 1.35)
		};
		return {
			screen: [a, o],
			ball: [
				c[0] | 0,
				c[1] | 0,
				l | 0
			],
			sunPx: [d[0] | 0, d[1] | 0],
			horizon: f | 0,
			...D(m)
		};
	}
	function k() {
		let e = O(), [t, n, r] = e.ball, [i, a] = e.screen, o = {
			c: [t / i, n / a],
			face: [(t - r * .35) / i, (n - r * .2) / a]
		};
		for (let e = 0; e < 360; e += 30) {
			let s = e * Math.PI / 180, c = Math.cos(s), l = -Math.sin(s);
			for (let [s, u] of [
				["i", .92],
				["e", .985],
				["o", 1.07]
			]) o[s + e] = [(t + c * r * u) / i, (n + l * r * u) / a];
		}
		let s = D(o, !1), c = (e) => Math.round(.2126 * e[0] + .7152 * e[1] + .0722 * e[2]), l = 0, u = 999, d = [];
		for (let e = 0; e < 360; e += 30) {
			let t = c(s["i" + e]), n = c(s["e" + e]), r = c(s["o" + e]), i = Math.max(Math.abs(t - r), Math.abs(n - r));
			l += i, u = Math.min(u, i), d.push(`${e}:${t}/${n}|${r}`);
		}
		return `exp ${b.renderer.toneMappingExposure.toFixed(2)} sun ${e.sunPx} | centre ${c(s.c)} face ${c(s.face)} | separation mean ${(l / 12).toFixed(1)} min ${u}\n  ${d.join(" ")}`;
	}
	function A(e, t, n = 0, r = 0, i = 1, a = 1) {
		return T(e, t, n, r, i, a, !1).map((e) => e.map(([e, t, n]) => String(Math.round(.2126 * e + .7152 * t + .0722 * n)).padStart(4)).join("")).join("\n");
	}
	function j(e, t, n, r = 30) {
		let i = d[e], a = {};
		for (let e in t) a[e] = i[e], i[e] = t[e];
		b.weather.snap(), C(r);
		try {
			return n();
		} finally {
			for (let e in a) i[e] = a[e];
			b.weather.snap();
		}
	}
	function M(e, t, n = 0, r = 0, i = 1, a = 1) {
		let o = {
			ball: new m(1, 0, 0),
			"ball-snowcap": new m(1, 0, 1),
			"umbrella-canopy": new m(0, 0, 1),
			ground: new m(0, 1, 0),
			terrain: new m(1, 1, 0),
			"mist-sheet": new m(0, 1, 1)
		}, s = /* @__PURE__ */ new Map(), c = [];
		b.scene.traverse((e) => {
			let t = e;
			if (!t.isMesh) return;
			let n = o[t.name];
			!n && t.parent && (t.parent.name === "umbrella" || t.parent.parent?.name === "umbrella") && (n = new m(.3, .3, 1)), t.name === "particles" || !n && t !== b.sky.dome ? t.visible &&= (c.push(t), !1) : (s.set(t, t.material), t.material = new g({
				color: t === b.sky.dome ? 0 : n,
				side: 2,
				depthWrite: t !== b.sky.dome,
				toneMapped: !1
			}));
		}), b.renderer.setRenderTarget(null), b.renderer.render(b.scene, b.rig.camera);
		let l = T(e, t, n, r, i, a, !1);
		return s.forEach((e, t) => {
			t.material.dispose(), t.material = e;
		}), c.forEach((e) => {
			e.visible = !0;
		}), l.map((e) => e.map(([e, t, n]) => {
			let r = e > 120, i = t > 120, a = n > 120;
			return r && a && !i ? "S" : a && !r && !i ? "U" : r && i && !a ? "^" : i && a ? "~" : r ? "O" : i ? "." : n > 60 ? "u" : " ";
		}).join("")).join("\n");
	}
	async function N() {
		let e = new h(new v(.5, 64, 48), new _({
			color: 15658734,
			roughness: .5
		}));
		e.name = "TestBall";
		let t = await new y().parseAsync(e, { binary: !0 }), n = await l(t), r = new o(n, {
			kind: "gltf",
			url: "memory",
			fit: "auto",
			radius: 1
		});
		return {
			meshes: (() => {
				let e = 0;
				return r.root.traverse((t) => {
					t.isMesh && e++;
				}), e;
			})(),
			radius: r.radius,
			bytes: t.byteLength,
			visual: r
		};
	}
	function P(e = 80, t = 24) {
		C(1);
		let n = b.sky, r = n.rts[n.cur], i = new Uint16Array(r.width * r.height * 4);
		b.renderer.readRenderTargetPixels(r, 0, 0, r.width, r.height, i);
		let a = (e) => {
			let t = (e & 31744) >> 10, n = e & 1023;
			return t === 0 ? n / 1024 * 2 ** -14 : 2 ** (t - 15) * (1 + n / 1024);
		}, o = [];
		for (let n = 0; n < t; n++) {
			let s = "";
			for (let o = 0; o < e; o++) {
				let c = Math.floor((o + .5) / e * r.width), l = a(i[(Math.floor((1 - (n + .5) / t) * r.height) * r.width + c) * 4 + 3]);
				s += String(Math.min(9, Math.floor(l * 10)));
			}
			o.push(s);
		}
		return o.join("\n");
	}
	function F(e) {
		return b.envAssets.setActive(e), b.lighting.updateEnvironment(b.renderer, b.scene, b.lighting.sun.target.position, !0), C(12), b.envAssets.describe();
	}
	async function I(e, t = .95) {
		C(1);
		let n = await new Promise((e) => S.toBlob(e, "image/jpeg", t));
		return n ? `${(await fetch(`/__shot/${e}.jpg`, {
			method: "POST",
			body: n
		})).status} ${n.size / 1024 | 0} KB` : "no blob";
	}
	let L = {
		app: b,
		presets: d,
		night: u,
		daylight: s,
		u: {
			atmos: n,
			ground: a,
			terrain: c,
			sky: p,
			clouds: f,
			moon: i
		},
		withPreset: j,
		stepFrames: C,
		cloudMap: P,
		snapshot: T,
		lumaMap: E,
		lumaGrid: A,
		sample: D,
		probe: O,
		silhouette: k,
		idMap: M,
		gltfRoundTrip: N,
		assets: F,
		shot: I,
		readMap: (e, t) => b.interact.read(b.renderer, e, t)
	};
	return window.__mb = L, L;
}
//#endregion
export { b as installDebug };
