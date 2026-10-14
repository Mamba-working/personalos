/**
 * Which visuals the characters use. Swap the procedural defaults for real models here —
 * nothing else in the code needs to change. Put .glb/.gltf files in `public/models/`.
 * Ground / rock textures and the environment skies are listed in `environment` at the bottom.
 *
 * Ball model checklist
 *   - roughly spherical, centred, any size: `fit: 'auto'` rescales its bounding sphere to `radius`
 *   - face pointing +Z (or set `forward`)
 *   - expressions, pick one:
 *       face.mode 'procedural' → our SDF eyes are painted on the model's materials (default)
 *       face.mode 'morph'      → drive the model's own morph targets; map our expression
 *                                channels to its target names in `face.morphs`
 *       face.mode 'none'       → static face
 *   - wetness, snow-cap rim shadow, atmosphere and shadows are added to its materials automatically
 *
 * Umbrella model checklist
 *   - +Y along the shaft, origin at the hand grip, canopy apex at y ≈ 2.05 (or set `scale`)
 *   - a node named `spinNode` (default "canopy") spins when clicked
 *   - the rain collider uses `collider` (sphere cap) — keep it roughly matching the canopy
 */

import type { WeatherName } from '../weather/presets';

export type ExpressionChannel = 'blink' | 'happy' | 'surprise' | 'squint' | 'sleepy' | 'dizzy' | 'squeeze' | 'blush';

export type BallAsset =
  | { kind: 'procedural' }
  | {
      kind: 'gltf';
      url: string;
      fit?: 'auto' | number;
      radius?: number;
      forward?: [number, number, number];
      face?: { mode: 'procedural' | 'morph' | 'none'; morphs?: Partial<Record<ExpressionChannel, string>> };
      /** Add the procedural snow-cap shell around the model's bounding sphere. */
      snowShell?: boolean;
    };

export type UmbrellaAsset =
  | { kind: 'procedural' }
  | { kind: 'gltf'; url: string; scale?: number; spinNode?: string; transmissive?: string[] };

/**
 * A tileable PBR texture set (files in `public/textures/`). Normal maps use the OpenGL
 * convention (green up, Poly Haven `nor_gl`). Colour is normalised by the map's own average
 * in the shader, so the weather presets keep control of hue and brightness and the photo only
 * adds structure; a tilt baked into a scan's normal map is removed the same way.
 */
export interface TextureSet {
  diff?: string;
  nor?: string;
  rough?: string;
  /** World size of one tile in metres. */
  tile: number;
}

/**
 * Photo-scanned surfaces and environment light. Every entry is optional: anything missing or
 * failing to load keeps the procedural look, so the page never breaks.
 */
export interface EnvironmentAssets {
  ground: {
    /** Ripples and tone variation across the whole flat. */
    base?: TextureSet;
    /** Grain at the ball's feet, faded out with distance. */
    micro?: TextureSet;
    /** Replaces the procedural snow surface (loaded the first time it snows). */
    snow?: TextureSet;
  };
  /** Rock detail on the distant ranges, triplanar at `tile` and 4× `tile`. */
  rock?: TextureSet;
  /**
   * Equirectangular .hdr skies (files in `public/hdri/`) per weather. Only the structure of the
   * photographed sky is used (clouds, the bright side around the sun) — its colour and level
   * follow the weather preset — and only for ambient light and reflections. Loaded on demand.
   */
  hdri: Partial<Record<WeatherName, string>>;
  /** The distant landscape from real elevation data (replaces the procedural ranges, see TerrainDem). */
  terrain?: TerrainDem;
  /**
   * The moon's near side for the night sky: orthographic-ready maps covering longitude −90…90°
   * and latitude −90…90° (square, north up). `albedo` is colour (sRGB), `height` relief (0…1, only
   * relative heights matter: it lights the craters along the terminator). Loaded the first night.
   */
  moon?: { albedo: string; height?: string };
}

/**
 * A real landscape from elevation data, seen from a real viewpoint. `heights` samples the scene's
 * polar terrain grid (azimuth −1.5…1.5 rad × radius log-spaced r0…r1, rows = radius): uint16 LE,
 * (scene height + 50) × 20. `detail` is the shading map over a terrain-local rect: RG = normal x/z,
 * B = concavity (128 = flat, brighter = gully). The build script lives with the docs (models.md).
 */
export interface TerrainDem {
  heights: string;
  az: number; rad: number; r0: number; r1: number;
  detail: { url: string; x0: number; x1: number; z0: number; z1: number };
  /** Scene metres per real metre, vertical exaggeration, the viewpoint's level (m), earth radius with refraction (m). */
  scale: number; vex: number; base: number; earthRadius: number;
}

export interface AssetConfig {
  ball: BallAsset;
  umbrella: UmbrellaAsset;
  environment: EnvironmentAssets;
}

export const ASSETS: AssetConfig = {
  ball: { kind: 'procedural' },
  // ball: {
  //   kind: 'gltf', url: 'models/ball.glb', fit: 'auto', radius: 1,
  //   face: { mode: 'morph', morphs: { blink: 'Blink', happy: 'Smile', surprise: 'Wow' } },
  // },
  umbrella: { kind: 'procedural' },
  // umbrella: { kind: 'gltf', url: 'models/umbrella.glb', spinNode: 'canopy' },

  // Poly Haven, CC0 (https://polyhaven.com/license): aerial_beach_01, brown_mud_03, snow_02,
  // rock_face_03; skies kloofendal_48d_partly_cloudy_puresky, kloofendal_overcast_puresky,
  // snow_field, kloofendal_misty_morning_puresky.
  environment: {
    ground: {
      base: { diff: 'textures/aerial_beach_01/diff.webp', nor: 'textures/aerial_beach_01/nor.webp', tile: 18 },
      micro: { diff: 'textures/brown_mud_03/diff.webp', nor: 'textures/brown_mud_03/nor.webp', rough: 'textures/brown_mud_03/rough.webp', tile: 1.4 },
      snow: { diff: 'textures/snow_02/diff.webp', nor: 'textures/snow_02/nor.webp', tile: 2.4 },
    },
    rock: { diff: 'textures/rock_face_03/diff.webp', nor: 'textures/rock_face_03/nor.webp', tile: 250 },
    hdri: {
      sunny: 'hdri/kloofendal_48d_partly_cloudy_puresky.hdr',
      windy: 'hdri/kloofendal_48d_partly_cloudy_puresky.hdr',
      cloudy: 'hdri/kloofendal_overcast_puresky.hdr',
      rain: 'hdri/kloofendal_overcast_puresky.hdr',
      snow: 'hdri/snow_field.hdr',
      fog: 'hdri/kloofendal_misty_morning_puresky.hdr',
    },
    // The view south from the north shore of Lake Kawaguchi to Mt Fuji, true to scale (×0.377, Fuji
    // 18 km away → 6.8 km) with 1.1× relief: AWS Open Data Terrain Tiles (terrarium z12, ~31 m;
    // Mapzen, from SRTM and others), out to 66 km so the far ranges layer into the haze. The shading
    // detail around Fuji comes from z13 (~15.6 m) at 4096 px (5.4 m per texel in the scene).
    terrain: {
      heights: 'terrain/kawaguchi_polar.u16', az: 1100, rad: 320, r0: 650, r1: 25000,
      detail: { url: 'terrain/kawaguchi_detail.webp', x0: -9500, x1: 12500, z0: -15000, z1: -1500 },
      scale: 0.377076, vex: 1.1, base: 833, earthRadius: 7322989,
    },
    // NASA's Scientific Visualization Studio, CGI Moon Kit (LRO LROC colour + LOLA elevation),
    // https://svs.gsfc.nasa.gov/4720 — public domain, credit NASA SVS. Cropped to the near side.
    moon: { albedo: 'moon/albedo.webp', height: 'moon/height.webp' },
  },
};
