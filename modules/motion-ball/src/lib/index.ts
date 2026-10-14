/**
 * weather-scene — a self-contained three.js weather backdrop with an interactive ball.
 *
 *   const scene = await createWeatherScene(el, { weather: 'rain', time: 'auto' });
 *   scene.on('say', ({ text }) => …);
 *   scene.setWeather('snow');
 *   scene.dispose();
 *
 * Framework-agnostic: wrap it in a React / Vue / Svelte component by creating it on mount and
 * disposing it on unmount. See docs/library.md.
 */
export { createWeatherScene, isWebGL2Available, WeatherScene, WeatherSceneError } from './WeatherScene';
export type { BallControls, Quality, SceneStats, WeatherSceneEvents, WeatherSceneOptions } from './WeatherScene';
export { getDefaults, resolveAsset } from './config';
export type { DaylightConfig, DeepPartial, NightConfig } from './config';
export type { CursorKind, InteractTarget, SceneAnchors } from '../app/App';
export type { BallEvent } from '../characters/ball/BallBrain';
export type { AssetConfig, BallAsset, UmbrellaAsset, EnvironmentAssets, TextureSet, TerrainDem, ExpressionChannel } from '../config/assets';
export { WEATHERS, LABELS } from '../weather/presets';
export type { WeatherName, WeatherParams, RGB } from '../weather/presets';
export type { TimeMode } from '../weather/TimeOfDay';
