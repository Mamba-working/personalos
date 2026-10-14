import { ASSETS, type AssetConfig } from '../config/assets';
import { PRESETS, type WeatherName, type WeatherParams } from '../weather/presets';
import { DAYLIGHT, NIGHT } from '../weather/TimeOfDay';

/**
 * Runtime configuration of the shared modules (ASSETS, PRESETS, NIGHT, DAYLIGHT). They are plain
 * objects other modules read every frame, so a scene configures them in place: restore the
 * defaults captured at load time, then deep-merge the host's overrides on top.
 */

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T,>(v: T): T => structuredClone(v);

/** Deep partial: nested objects may be partial; `null` removes an optional entry (e.g. an asset). */
export type DeepPartial<T> = T extends readonly unknown[] ? T
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> | null } : T;

export type NightConfig = typeof NIGHT;
export type DaylightConfig = typeof DAYLIGHT;

const DEFAULTS = {
  assets: clone(ASSETS),
  presets: clone(PRESETS),
  night: clone(NIGHT),
  daylight: clone(DAYLIGHT),
};

/** Replace `target`'s contents with a copy of `src`, keeping the object identity. */
function resetInto(target: Plain, src: Plain) {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  for (const k of Object.keys(src)) target[k] = clone(src[k]);
}

/** Merge `patch` into `target` in place. Arrays and primitives replace; `null` deletes; `undefined` is skipped. */
export function deepMerge(target: Plain, patch: Plain | undefined | null) {
  if (!patch) return target;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) { delete target[k]; continue; }
    if (isPlain(v) && isPlain(target[k])) deepMerge(target[k] as Plain, v);
    else target[k] = clone(v);
  }
  return target;
}

export interface SceneConfig {
  assets?: DeepPartial<AssetConfig>;
  presets?: Partial<Record<WeatherName, Partial<WeatherParams>>>;
  night?: Partial<NightConfig>;
  daylight?: Partial<DaylightConfig>;
  assetBase?: string;
}

/** Defaults + overrides into the live shared objects. */
export function configure(cfg: SceneConfig) {
  resetInto(ASSETS as unknown as Plain, DEFAULTS.assets as unknown as Plain);
  resetInto(PRESETS as unknown as Plain, DEFAULTS.presets as unknown as Plain);
  resetInto(NIGHT as unknown as Plain, DEFAULTS.night as unknown as Plain);
  resetInto(DAYLIGHT as unknown as Plain, DEFAULTS.daylight as unknown as Plain);
  deepMerge(ASSETS as unknown as Plain, cfg.assets as Plain);
  for (const [name, patch] of Object.entries(cfg.presets ?? {})) {
    const p = PRESETS[name as WeatherName];
    if (p) deepMerge(p as unknown as Plain, patch as Plain);
  }
  deepMerge(NIGHT as unknown as Plain, cfg.night as Plain);
  deepMerge(DAYLIGHT as unknown as Plain, cfg.daylight as Plain);
  applyAssetBase(ASSETS, cfg.assetBase ?? '');
}

/** The built-in defaults (copies), for hosts that want to build on them. */
export function getDefaults() { return clone(DEFAULTS); }

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;

/** Prefix every relative asset URL with `base` (a folder URL; a trailing slash is added). */
export function resolveAsset(url: string, base: string) {
  if (!base || ABSOLUTE.test(url)) return url;
  return (base.endsWith('/') ? base : `${base}/`) + url;
}

function applyAssetBase(a: AssetConfig, base: string) {
  if (!base) return;
  const r = (u: string) => resolveAsset(u, base);
  if (a.ball.kind === 'gltf') a.ball.url = r(a.ball.url);
  if (a.umbrella.kind === 'gltf') a.umbrella.url = r(a.umbrella.url);
  const env = a.environment;
  const set = (t?: { diff?: string; nor?: string; rough?: string }) => {
    if (!t) return;
    if (t.diff) t.diff = r(t.diff);
    if (t.nor) t.nor = r(t.nor);
    if (t.rough) t.rough = r(t.rough);
  };
  set(env.ground.base); set(env.ground.micro); set(env.ground.snow); set(env.rock);
  for (const k of Object.keys(env.hdri) as WeatherName[]) { const u = env.hdri[k]; if (u) env.hdri[k] = r(u); }
  if (env.terrain) { env.terrain.heights = r(env.terrain.heights); env.terrain.detail.url = r(env.terrain.detail.url); }
  if (env.moon) { env.moon.albedo = r(env.moon.albedo); if (env.moon.height) env.moon.height = r(env.moon.height); }
}
