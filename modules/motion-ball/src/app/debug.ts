import { Color, Mesh, MeshBasicMaterial, SphereGeometry, type Material, type Object3D } from 'three';
import type { App } from './App';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshStandardMaterial } from 'three';
import { parseGltf } from '../characters/factory';
import { GltfBall } from '../characters/ball/GltfBall';
import { add, clamp, scale, type Vec3 } from '../core/math';
import { PRESETS } from '../weather/presets';
import { NIGHT, DAYLIGHT } from '../weather/TimeOfDay';
import { atmos } from '../world/atmosphere';
import { groundUniforms } from '../world/Ground';
import { terrainUniforms } from '../world/Terrain';
import { cloudUniforms, envSkyUniforms, moonUniforms } from '../world/Sky';

type Cell = [number, number, number];

/**
 * Console tooling (window.__mb) for tuning without screenshots: synchronous frame
 * stepping, pixel probes, contrast-stretched luminance maps and an object-id view.
 */
export function installDebug(app: App) {
  const gl = app.renderer.getContext();
  const canvas = app.renderer.domElement;

  function stepFrames(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) app.step(dt); }

  function grab(): { px: Uint8Array; w: number; h: number } {
    const w = canvas.width, h = canvas.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { px, w, h };
  }

  function snapshot(cols = 100, rows = 44, x0 = 0, y0 = 0, x1 = 1, y1 = 1, step = true) {
    if (step) stepFrames(1);
    const { px, w, h } = grab();
    const cells: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        let R = 0, G = 0, B = 0, n = 0;
        const sx0 = Math.floor((x0 + ((x1 - x0) * c) / cols) * w), sx1 = Math.max(sx0 + 1, Math.floor((x0 + ((x1 - x0) * (c + 1)) / cols) * w));
        const sy0 = Math.floor((y0 + ((y1 - y0) * r) / rows) * h), sy1 = Math.max(sy0 + 1, Math.floor((y0 + ((y1 - y0) * (r + 1)) / rows) * h));
        for (let y = sy0; y < sy1; y += 2) for (let x = sx0; x < sx1; x += 2) {
          const i = ((h - 1 - y) * w + x) * 4;
          R += px[i]; G += px[i + 1]; B += px[i + 2]; n++;
        }
        row.push([(R / n) | 0, (G / n) | 0, (B / n) | 0]);
      }
      cells.push(row);
    }
    return cells;
  }

  function lumaMap(cols: number, rows: number, x0 = 0, y0 = 0, x1 = 1, y1 = 1, warm = false) {
    const cells = snapshot(cols, rows, x0, y0, x1, y1);
    const L = cells.map((r) => r.map(([R, G, B]) => 0.2126 * R + 0.7152 * G + 0.0722 * B));
    let lo = 1e9, hi = -1e9;
    L.forEach((r) => r.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    const ramp = ' .:-=+*#%@';
    let out = `lo ${lo | 0} hi ${hi | 0}\n` + L.map((r) => r.map((v) => ramp[Math.min(9, Math.floor(((hi - v) / (hi - lo + 1e-6)) * 10))]).join('')).join('\n');
    if (warm) out += '\n\n' + cells.map((r) => r.map(([R, , B]) => { const d = R - B; return d > 30 ? 'W' : d > 18 ? 'w' : d > 8 ? 'n' : d > -4 ? 'c' : 'B'; }).join('')).join('\n');
    return out;
  }

  function sample(points: Record<string, [number, number]>, step = true) {
    if (step) stepFrames(1);
    const { px, w, h } = grab();
    const out: Record<string, Cell> = {};
    for (const k in points) {
      const [x, y] = points[k];
      let R = 0, G = 0, B = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const sx = clamp(Math.floor(x * w) + dx, 0, w - 1), sy = clamp(Math.floor((1 - y) * h) + dy, 0, h - 1);
        const i = (sy * w + sx) * 4;
        R += px[i]; G += px[i + 1]; B += px[i + 2]; n++;
      }
      out[k] = [(R / n) | 0, (G / n) | 0, (B / n) | 0];
    }
    return out;
  }

  function probe() {
    const rig = app.rig, ball = app.ball;
    const W = rig.cssW, H = rig.cssH;
    const rp = ball.renderPos();
    const c = rig.project(rp);
    const r = c[1] - rig.project([rp[0], rp[1] + ball.R, rp[2]])[1];
    const sd = app.weather.sunDir();
    const sun = rig.project(add(rig.position, scale(sd, 400)));
    const hz = rig.project([0, rig.position[1], -10000])[1];
    const P = (x: number, y: number): [number, number] => [clamp(x / W, 0.002, 0.998), clamp(y / H, 0.002, 0.998)];
    const pts = {
      skyTL: P(W * 0.08, H * 0.06), skyL: P(W * 0.25, H * 0.3), skyTopMid: P(W * 0.5, H * 0.08), skyR: P(W * 0.95, H * 0.3),
      nearSun: P(sun[0] - 70, sun[1] + 50), sun: P(sun[0], sun[1]),
      mtnL: P(W * 0.2, hz - 8), mtnR: P(W * 0.55, hz - 8), horizonGround: P(W * 0.3, hz + 6),
      groundBL: P(W * 0.12, H * 0.94), groundMid: P(W * 0.45, H * 0.8), groundR: P(c[0] + r * 1.7, c[1] + r * 0.9),
      contact: P(c[0], c[1] + r * 1.05), shadow: P(c[0] - r * 0.5, c[1] + r * 1.5),
      ballC: P(c[0], c[1]), ballL: P(c[0] - r * 0.85, c[1]), ballR: P(c[0] + r * 0.85, c[1]),
      ballTop: P(c[0], c[1] - r * 0.85), ballBot: P(c[0], c[1] + r * 0.8), ballUR: P(c[0] + r * 0.6, c[1] - r * 0.6),
      ballRim: P(c[0] + r * 0.7, c[1] - r * 0.66), skyBehindBall: P(c[0] + r * 0.3, c[1] - r * 1.35),
    };
    return { screen: [W, H], ball: [c[0] | 0, c[1] | 0, r | 0], sunPx: [sun[0] | 0, sun[1] | 0], horizon: hz | 0, ...sample(pts) };
  }

  /** Luma just inside (0.92 r), on the rim (0.985 r) and just outside (1.07 r) the ball every 30°. */
  function silhouette() {
    const p = probe();
    const [cx, cy, r] = p.ball;
    const [W, H] = p.screen;
    const pts: Record<string, [number, number]> = { c: [cx / W, cy / H], face: [(cx - r * 0.35) / W, (cy - r * 0.2) / H] };
    for (let a = 0; a < 360; a += 30) {
      const t = (a * Math.PI) / 180, dx = Math.cos(t), dy = -Math.sin(t);
      for (const [k, f] of [['i', 0.92], ['e', 0.985], ['o', 1.07]] as const) pts[k + a] = [(cx + dx * r * f) / W, (cy + dy * r * f) / H];
    }
    const s = sample(pts, false);
    const L = (v: Cell) => Math.round(0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]);
    let sum = 0, min = 999;
    const ring: string[] = [];
    for (let a = 0; a < 360; a += 30) {
      const i = L(s['i' + a]), e = L(s['e' + a]), o = L(s['o' + a]);
      const d = Math.max(Math.abs(i - o), Math.abs(e - o));
      sum += d; min = Math.min(min, d);
      ring.push(`${a}:${i}/${e}|${o}`);
    }
    return `exp ${app.renderer.toneMappingExposure.toFixed(2)} sun ${p.sunPx} | centre ${L(s.c)} face ${L(s.face)} | separation mean ${(sum / 12).toFixed(1)} min ${min}\n  ${ring.join(' ')}`;
  }

  /** Grid of display luma values (no contrast stretch). */
  function lumaGrid(cols: number, rows: number, x0 = 0, y0 = 0, x1 = 1, y1 = 1) {
    return snapshot(cols, rows, x0, y0, x1, y1, false)
      .map((r) => r.map(([R, G, B]) => String(Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B)).padStart(4)).join('')).join('\n');
  }

  /** Temporarily patch a preset, render, run `fn`, then restore. */
  function withPreset<T>(name: keyof typeof PRESETS, patch: Record<string, unknown>, fn: () => T, frames = 30): T {
    const P = PRESETS[name] as unknown as Record<string, unknown>;
    const keep: Record<string, unknown> = {};
    for (const k in patch) { keep[k] = P[k]; P[k] = patch[k]; }
    app.weather.snap();
    stepFrames(frames);
    try { return fn(); } finally {
      for (const k in keep) P[k] = keep[k];
      app.weather.snap();
    }
  }

  /** Flat-colour object ids: O ball, S snow cap, U umbrella, . ground, ^ terrain, ~ mist, blank sky. */
  function idMap(cols: number, rows: number, x0 = 0, y0 = 0, x1 = 1, y1 = 1) {
    const ids: Record<string, Color> = {
      ball: new Color(1, 0, 0), 'ball-snowcap': new Color(1, 0, 1), 'umbrella-canopy': new Color(0, 0, 1),
      ground: new Color(0, 1, 0), terrain: new Color(1, 1, 0), 'mist-sheet': new Color(0, 1, 1),
    };
    const saved = new Map<Mesh, Material | Material[]>();
    const hidden: Object3D[] = [];
    app.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      let id = ids[m.name];
      if (!id && m.parent && (m.parent.name === 'umbrella' || m.parent.parent?.name === 'umbrella')) id = new Color(0.3, 0.3, 1);
      if (m.name === 'particles' || (!id && m !== app.sky.dome)) { if (m.visible) { hidden.push(m); m.visible = false; } return; }
      saved.set(m, m.material);
      // toneMapped off: AgX would desaturate the id colours past the classification thresholds
      m.material = new MeshBasicMaterial({ color: m === app.sky.dome ? 0x000000 : id, side: 2, depthWrite: m !== app.sky.dome, toneMapped: false });
    });
    app.renderer.setRenderTarget(null);
    app.renderer.render(app.scene, app.rig.camera);
    const cells = snapshot(cols, rows, x0, y0, x1, y1, false);
    saved.forEach((mat, m) => { (m.material as Material).dispose(); m.material = mat; });
    hidden.forEach((o) => { o.visible = true; });
    return cells.map((r) => r.map(([R, G, B]) => {
      const r1 = R > 120, g1 = G > 120, b1 = B > 120;
      if (r1 && b1 && !g1) return 'S';
      if (b1 && !r1 && !g1) return 'U';
      if (r1 && g1 && !b1) return '^';
      if (g1 && b1) return '~';
      if (r1) return 'O';
      if (g1) return '.';
      if (B > 60) return 'u';
      return ' ';
    }).join('')).join('\n');
  }

  /** Exercise the GLTF swap path: export the procedural ball as GLB and load it back as a model. */
  async function gltfRoundTrip() {
    const src = new Mesh(new SphereGeometry(0.5, 64, 48), new MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }));
    src.name = 'TestBall';
    const glb = (await new GLTFExporter().parseAsync(src, { binary: true })) as ArrayBuffer;
    const gltf = await parseGltf(glb);
    const vis = new GltfBall(gltf, { kind: 'gltf', url: 'memory', fit: 'auto', radius: 1 });
    return { meshes: (() => { let n = 0; vis.root.traverse((o) => { if ((o as Mesh).isMesh) n++; }); return n; })(), radius: vis.radius, bytes: glb.byteLength, visual: vis };
  }

  /** Cloud layer transmittance as digits (9 = clear sky, 0 = opaque) from the half-res cloud target. */
  function cloudMap(cols = 80, rows = 24) {
    stepFrames(1);
    const sky = app.sky as unknown as { rts: import('three').WebGLRenderTarget[]; cur: number };
    const rt = sky.rts[sky.cur];
    const buf = new Uint16Array(rt.width * rt.height * 4);
    app.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
    const h2f = (h: number) => { const e = (h & 0x7c00) >> 10, f = h & 0x03ff; return e === 0 ? (f / 1024) * 2 ** -14 : 2 ** (e - 15) * (1 + f / 1024); };
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const x = Math.floor(((c + 0.5) / cols) * rt.width), y = Math.floor((1 - (r + 0.5) / rows) * rt.height);
        const T = h2f(buf[(y * rt.width + x) * 4 + 3]);
        line += String(Math.min(9, Math.floor(T * 10)));
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  // presets are live: edit a field, then app.weather.snap() to apply it instantly
  /** Photo textures / HDR skies on (true) or procedural (false); re-renders the env probe. */
  function assets(on: boolean) {
    app.envAssets.setActive(on);
    app.lighting.updateEnvironment(app.renderer, app.scene, app.lighting.sun.target.position, true);
    stepFrames(12);
    return app.envAssets.describe();
  }

  /** Save the current frame (JPEG) through the preview server's /__shot endpoint, if it has one. */
  async function shot(name: string, quality = 0.95) {
    stepFrames(1);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return 'no blob';
    const r = await fetch(`/__shot/${name}.jpg`, { method: 'POST', body: blob });
    return `${r.status} ${(blob.size / 1024) | 0} KB`;
  }

  // shared uniform objects, for poking single features on and off
  const u = { atmos, ground: groundUniforms, terrain: terrainUniforms, sky: envSkyUniforms, clouds: cloudUniforms, moon: moonUniforms };

  const tools = { app, presets: PRESETS, night: NIGHT, daylight: DAYLIGHT, u, withPreset, stepFrames, cloudMap, snapshot, lumaMap, lumaGrid, sample, probe, silhouette, idMap, gltfRoundTrip, assets, shot, readMap: (x: number, z: number) => app.interact.read(app.renderer, x, z) };
  (window as unknown as { __mb: typeof tools }).__mb = tools;
  return tools;
}

export type DebugTools = ReturnType<typeof installDebug>;
export type { Vec3 };
