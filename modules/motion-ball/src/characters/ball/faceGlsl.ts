import { Vector2, Vector4, type IUniform } from 'three';

/** Per-ball uniforms for the procedural face decal and surface effects. */
export function createFaceUniforms() {
  return {
    uGaze: { value: new Vector2() },
    uEyeA: { value: new Vector4(1, 0, 0, 0) },   // open, happy, surprise, squint
    uEyeB: { value: new Vector4() },             // sleepy, dizzy, squeeze, blush
    uEyeTilt: { value: 0.1 },
  } satisfies Record<string, IUniform>;
}

/**
 * Eyes as 2D signed distance shapes in the tangent plane of a unit sphere around the
 * face direction (+Z). Expressions are blended SDFs, so any mix morphs smoothly.
 * `faceMask(dir)` → x = eye coverage, y = inset ring, z = blush.
 */
export const FACE_GLSL = /* glsl */ `
uniform vec2 uGaze;
uniform vec4 uEyeA;
uniform vec4 uEyeB;
uniform float uEyeTilt;

mat2 faceRot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdCapsuleV(vec2 p, float r, float h) { p.y -= clamp(p.y, -h, h); return length(p) - r; }
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdArc(vec2 p, float ap, float ra, float rb) {
  vec2 sc = vec2(sin(ap), cos(ap));
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

float eyeShape(vec2 p, float side) {
  p = faceRot2(uEyeTilt) * p;
  float open = uEyeA.x * (1.0 - 0.55 * uEyeA.w);
  float sy = max(open, 0.07);
  float r = mix(0.088, 0.112, uEyeA.z);
  float h = mix(0.108, 0.085, uEyeA.z);
  float d = sdCapsuleV(vec2(p.x, p.y / sy), r, h) * sy;
  float dHappy = sdArc(p + vec2(0.0, 0.06), 1.15, 0.11, 0.03);
  float dSleepy = sdArc(vec2(p.x, -p.y) + vec2(0.0, 0.07), 0.95, 0.1, 0.022);
  float dX = min(sdSeg(p, vec2(-0.085, -0.09), vec2(0.085, 0.09)), sdSeg(p, vec2(-0.085, 0.09), vec2(0.085, -0.09))) - 0.026;
  vec2 pc = vec2(-side * p.x, p.y);
  float dChev = min(sdSeg(pc, vec2(-0.075, 0.095), vec2(0.07, 0.0)), sdSeg(pc, vec2(-0.075, -0.095), vec2(0.07, 0.0))) - 0.028;
  d = mix(d, dHappy, uEyeA.y);
  d = mix(d, dSleepy, uEyeB.x);
  d = mix(d, dX, uEyeB.y);
  d = mix(d, dChev, uEyeB.z);
  return d;
}

vec3 faceMask(vec3 lp, float aa) {
  vec3 res = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    float yaw = uGaze.x + side * 0.26;
    float pitch = uGaze.y + 0.1;
    vec3 e = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));
    if (dot(lp, e) < 0.75) continue;
    vec3 tx = vec3(cos(yaw), 0.0, -sin(yaw));
    vec3 ty = cross(e, tx);
    vec2 p = vec2(dot(lp, tx), dot(lp, ty));
    float d = eyeShape(p, side);
    res.x = max(res.x, 1.0 - smoothstep(-aa, aa, d));
    res.y = max(res.y, smoothstep(0.05, 0.0, d) * smoothstep(-0.01, 0.008, d));
    vec2 bp = (p - vec2(side * 0.12, -0.25)) * vec2(1.0, 1.5);
    res.z = max(res.z, exp(-dot(bp, bp) / 0.006));
  }
  return res;
}
`;
