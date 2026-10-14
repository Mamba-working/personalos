import { DataTexture, LinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';

/**
 * Tileable 256² random texture for fast value noise in shaders. G/A hold R/B shifted by
 * (37,17) so a single fetch returns two z-slices for 3D noise (the classic iq trick).
 */
export function createNoiseTexture(size = 256): DataTexture {
  const a = new Uint8Array(size * size);
  const b = new Uint8Array(size * size);
  let s = 1337;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 24);
  for (let i = 0; i < a.length; i++) { a[i] = rnd(); b[i] = rnd(); }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const j = ((y + 17) % size) * size + ((x + 37) % size);
      data[i * 4] = a[i]; data[i * 4 + 1] = a[j];
      data[i * 4 + 2] = b[i]; data[i * 4 + 3] = b[j];
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Shared GLSL: hashes and texture-based value noise (needs `uNoise2D`). */
export const NOISE_GLSL = /* glsl */ `
#ifndef MB_NOISE
#define MB_NOISE
uniform sampler2D uNoise2D;
float mbSat(float x) { return clamp(x, 0.0, 1.0); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float noise2(vec2 x) {
  vec2 p = floor(x); vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise2D, (p + f + 0.5) / 256.0, 0.0).x;
}
float noise3(vec3 x) {
  vec3 p = floor(x); vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = (p.xy + vec2(37.0, 17.0) * p.z) + f.xy;
  vec2 rg = textureLod(uNoise2D, (uv + 0.5) / 256.0, 0.0).xy;
  return mix(rg.x, rg.y, f.z);
}
float fbm2(vec2 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * noise2(p); n += a;
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s / n;
}
#endif
`;

// ---------------------------------------------------------------- CPU noise (terrain)

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Smooth 2D value noise in [0,1]. */
export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ridged multifractal: sharp crests with eroded-looking valleys. */
export function ridged(x: number, y: number, octaves: number, seed = 0): number {
  let sum = 0, amp = 0.5, freq = 1, weight = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise(x * freq + i * 17.3, y * freq - i * 9.1, seed + i);
    n = 1 - Math.abs(n * 2 - 1);
    n *= n;
    n *= weight;
    weight = Math.min(1, n * 1.8);
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function fbm(x: number, y: number, octaves: number, seed = 0): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return sum / norm;
}
