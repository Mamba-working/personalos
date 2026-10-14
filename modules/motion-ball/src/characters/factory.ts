import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { AssetConfig } from '../config/assets';
import { GltfBall } from './ball/GltfBall';
import { ProceduralBall } from './ball/ProceduralBall';
import { GltfUmbrella } from './umbrella/GltfUmbrella';
import { ProceduralUmbrella } from './umbrella/ProceduralUmbrella';

export type AnyBallVisual = ProceduralBall | GltfBall;
export type AnyUmbrellaVisual = ProceduralUmbrella | GltfUmbrella;

let loader: GLTFLoader | null = null;
function gltfLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    // DRACO / KTX2: add loader.setDRACOLoader(...) / setKTX2Loader(...) here if models need them.
  }
  return loader;
}

/** Build the ball visual from config; any load error falls back to the procedural ball. */
export async function createBallVisual(cfg: AssetConfig['ball']): Promise<AnyBallVisual> {
  if (cfg.kind === 'gltf') {
    try {
      const gltf = await gltfLoader().loadAsync(cfg.url);
      return new GltfBall(gltf, cfg);
    } catch (err) {
      console.warn(`[assets] ball model "${cfg.url}" failed to load, using the procedural ball`, err);
    }
  }
  return new ProceduralBall();
}

export async function createUmbrellaVisual(cfg: AssetConfig['umbrella']): Promise<AnyUmbrellaVisual> {
  if (cfg.kind === 'gltf') {
    try {
      const gltf = await gltfLoader().loadAsync(cfg.url);
      return new GltfUmbrella(gltf, cfg);
    } catch (err) {
      console.warn(`[assets] umbrella model "${cfg.url}" failed to load, using the procedural umbrella`, err);
    }
  }
  return new ProceduralUmbrella();
}

/** Parse an in-memory GLB (used by the debug tools to exercise the GLTF path). */
export function parseGltf(data: ArrayBuffer) {
  return gltfLoader().parseAsync(data, '');
}
