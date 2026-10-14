import type { IUniform, Material, WebGLProgramParametersWithUniforms } from 'three';

/**
 * A composable shader patch for three.js built-in materials.
 *
 * We extend MeshStandard/MeshPhysical materials instead of writing raw shaders so that
 * any material — including the ones that come with a future GLTF model — keeps PBR
 * lighting, shadows and environment reflections and just gains our extra behaviour
 * (atmosphere, wetness, snow, face decals...).
 */
export interface ShaderPatch {
  /** Unique, stable id; becomes part of the program cache key. */
  key: string;
  /** Uniform objects are shared by reference, so updating `.value` updates every material. */
  uniforms?: Record<string, IUniform>;
  vertex?: (src: string) => string;
  fragment?: (src: string) => string;
}

type PatchedMaterial = Material & { userData: { __patches?: ShaderPatch[] } };

export function applyPatches<M extends Material>(material: M, patches: ShaderPatch[]): M {
  const m = material as unknown as PatchedMaterial;
  const all = [...(m.userData.__patches ?? []), ...patches.filter((p) => !(m.userData.__patches ?? []).some((q) => q.key === p.key))];
  m.userData.__patches = all;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    for (const p of all) {
      if (p.uniforms) Object.assign(shader.uniforms, p.uniforms);
      if (p.vertex) shader.vertexShader = p.vertex(shader.vertexShader);
      if (p.fragment) shader.fragmentShader = p.fragment(shader.fragmentShader);
    }
  };
  const key = all.map((p) => p.key).join('|');
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}

/** Insert `code` relative to an `#include <chunk>` (or any anchor). Warns loudly if the anchor moved. */
export function inject(src: string, anchor: string, code: string, where: 'before' | 'after' | 'replace' = 'after'): string {
  if (!src.includes(anchor)) {
    console.warn(`[shader patch] anchor not found: ${anchor}`);
    return src;
  }
  if (where === 'replace') return src.replace(anchor, code);
  return src.replace(anchor, where === 'before' ? `${code}\n${anchor}` : `${anchor}\n${code}`);
}
