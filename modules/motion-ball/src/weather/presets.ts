// Weather presets. Every field is interpolated when the weather changes, so a new look is
// mostly a matter of editing numbers here. Colors are linear RGB.

export type RGB = [number, number, number];

export interface WeatherParams {
  // sun & sky
  sunEl: number; sunAz: number; sunI: number; sunColor: RGB; sunGlow: number;
  zenith: RGB; horizon: RGB;
  // atmosphere
  fogCol: RGB; fogDens: number; fogFall: number; haze: number; mist: number;
  // volumetric clouds
  cloudCover: number; cloudDens: number; cloudBase: number; cloudTop: number; cloudType: number;
  cloudStretch: number; cloudSpeed: number; towers: number; cloudTint: RGB; cloudAmb: number;
  // distant terrain (mtnHaze: aerial perspective of the ranges, optical depth at 1 km)
  mtnSnow: number; mtnTint: RGB; mtnHaze: number; mistSheets: number;
  // ground
  sandCol: RGB; groundWet: number; puddle: number; snowCover: number; dust: number;
  // lighting (fill = soft camera-side bounce on the ball; ballEnv < 1 flags down its sky
  // ambient + reflections so the silhouette separates from a sky of similar brightness)
  // key = portrait key light on the ball (irradiance, linear RGB): from ~70° to the side of the view,
  // on the sun's side, so the ball shows a lit shoulder, a core shadow and a satin highlight
  envI: number; fill: RGB; key: RGB; shadowRadius: number; ballEnv: number;
  // particles & wind
  rainRate: number; snowRate: number; sandRate: number; motes: number;
  wind: number; windAngle: number;
  // camera & film (AgX tone mapping; threshold in scene-linear units; dof = blur px at infinity per 1000 px:
  // above ~0.45 the whole backdrop is composited from the half-resolution bokeh, so keep clear
  // weathers low — the near foreground still softens)
  exposure: number; bloom: number; bloomRadius: number; threshold: number; rays: number; streak: number; dof: number;
  // white = display level highlights roll off toward (print-stock shoulder, 1 = no limit)
  lift: RGB; gain: RGB; sat: number; contrast: number; curve: number; white: number; halation: number; vignette: number; grain: number;
}

export const WEATHERS = ['sunny', 'cloudy', 'windy', 'rain', 'snow', 'fog'] as const;
export type WeatherName = (typeof WEATHERS)[number];

export const LABELS: Record<WeatherName, string> = {
  sunny: 'SUNNY · 晴', cloudy: 'CLOUDY · 多云', windy: 'WINDY · 大风',
  rain: 'RAIN · 雨', snow: 'SNOW · 雪', fog: 'FOG · 雾',
};

// Sunny is a page people leave open, so the sun never enters the frame: a morning sun from the
// left (east of Fuji), ~90° off the view, rakes across the cone so its ravines and snow read. The ranges get lit flanks and shaded
// faces so the haze stacks them into receding planes, the ball is half lit with a soft shadow
// side, its shadow falls toward the viewer on the right, and highlights roll off below white (white).
const SUNNY: WeatherParams = {
  sunEl: 0.42, sunAz: -1.55, sunI: 2.6, sunColor: [1.0, 0.95, 0.86], sunGlow: 0.45,
  zenith: [0.16, 0.34, 0.78], horizon: [0.62, 0.72, 0.86],
  fogCol: [0.68, 0.76, 0.86], fogDens: 0.003, fogFall: 0.25, haze: 0.00008, mist: 0,
  cloudCover: 0.24, cloudDens: 1.1, cloudBase: 1300, cloudTop: 3400, cloudType: 1,
  cloudStretch: 0, cloudSpeed: 6, towers: 0, cloudTint: [1, 1, 1], cloudAmb: 0.8,
  mtnSnow: 0.25, mtnTint: [0.36, 0.35, 0.35], mtnHaze: 0.014, mistSheets: 0.12,
  sandCol: [0.5, 0.47, 0.43], groundWet: 0.65, puddle: 0.18, snowCover: 0, dust: 0,
  envI: 1.0, fill: [0, 0, 0], key: [4.0, 3.8, 3.55], shadowRadius: 7, ballEnv: 0.25,
  rainRate: 0, snowRate: 0, sandRate: 0, motes: 0.4,
  wind: 0.15, windAngle: 2.8,
  exposure: 1.05, bloom: 0.12, bloomRadius: 0.15, threshold: 4, rays: 0, streak: 0, dof: 0.35,
  lift: [0.0, 0.006, 0.014], gain: [1.0, 0.99, 0.975], sat: 1.06, contrast: 1.04, curve: 0.12, white: 0.96, halation: 0.08, vignette: 0.25, grain: 0.005,
};

export const PRESETS: Record<WeatherName, WeatherParams> = {
  sunny: SUNNY,
  cloudy: {
    ...SUNNY,
    sunEl: 0.5, sunAz: 0.5, sunI: 1.25, sunColor: [1, 0.96, 0.92], sunGlow: 0.35,
    zenith: [0.55, 0.62, 0.74], horizon: [0.82, 0.84, 0.88],
    fogCol: [0.8, 0.83, 0.88], fogDens: 0.004, haze: 0.0001,
    cloudCover: 0.42, cloudDens: 1.0, cloudBase: 1100, cloudTop: 2700, cloudType: 0.75, cloudSpeed: 10, towers: 0.6,
    cloudTint: [0.97, 0.98, 1.0], cloudAmb: 0.95,
    mtnSnow: 0.6, mtnTint: [0.32, 0.33, 0.36], mtnHaze: 0.042, mistSheets: 0.3,
    sandCol: [0.44, 0.44, 0.45], groundWet: 0.72, puddle: 0.28,
    envI: 1.0, fill: [0.03, 0.03, 0.035], key: [3.4, 3.25, 3.05], shadowRadius: 14, ballEnv: 0.2, motes: 0, wind: 0.3,
    exposure: 1.5, bloom: 0.25, threshold: 2.0, rays: 0.06, streak: 0, dof: 0.5, halation: 0.15,
    lift: [0, 0.006, 0.016], gain: [0.97, 0.99, 1.03], sat: 0.92,
  },
  windy: {
    ...SUNNY,
    sunEl: 0.42, sunAz: 0.6, sunI: 1.9, sunColor: [1, 0.95, 0.88], sunGlow: 0.6,
    zenith: [0.55, 0.62, 0.74], horizon: [0.88, 0.88, 0.88],
    fogCol: [0.86, 0.83, 0.79], fogDens: 0.006, haze: 0.00014,
    cloudCover: 0.34, cloudDens: 0.7, cloudBase: 1600, cloudTop: 2700, cloudType: 0.35,
    cloudStretch: 1, cloudSpeed: 45, towers: 0.2, cloudTint: [1, 0.99, 0.98], cloudAmb: 0.85,
    mtnSnow: 0.2, mtnTint: [0.42, 0.37, 0.32], mtnHaze: 0.052, mistSheets: 0,
    sandCol: [0.5, 0.47, 0.42], groundWet: 0.15, puddle: 0, dust: 1,
    envI: 1.0, fill: [0.03, 0.03, 0.035], key: [3.2, 3.0, 2.75], shadowRadius: 9, ballEnv: 0.22, sandRate: 1, motes: 0, wind: 1,
    exposure: 1.42, bloom: 0.25, threshold: 2.2, rays: 0.1, streak: 0.08, dof: 0.5, halation: 0.2,
    gain: [0.99, 0.98, 0.97], sat: 0.92,
  },
  // Rain: a slate storm sky, darker than the subjects under it. A soft key from the front-left
  // (behind the camera, glints suppressed under the full deck by uSunSpec) models the ball and lights
  // the wet canopy, which then reads as a bright, beaded film against the sky.
  rain: {
    ...SUNNY,
    sunEl: 0.5, sunAz: -1.75, sunI: 1.5, sunColor: [1.0, 0.96, 0.9], sunGlow: 0.1,
    zenith: [0.24, 0.27, 0.35], horizon: [0.22, 0.25, 0.32],
    fogCol: [0.19, 0.22, 0.29], fogDens: 0.009, haze: 0.00016, mist: 0.2,
    cloudCover: 1, cloudDens: 1.4, cloudBase: 700, cloudTop: 3800, cloudType: 0.2, cloudSpeed: 12, towers: 0,
    cloudTint: [0.4, 0.43, 0.5], cloudAmb: 0.85,
    mtnSnow: 0.35, mtnTint: [0.26, 0.27, 0.3], mtnHaze: 0.05, mistSheets: 0.5,
    sandCol: [0.36, 0.37, 0.39], groundWet: 1, puddle: 0.9,
    envI: 1.0, fill: [0.03, 0.03, 0.035], key: [2.0, 1.78, 1.5], shadowRadius: 18, ballEnv: 0.25, rainRate: 1, motes: 0, wind: 0.3,
    exposure: 1.6, bloom: 0.25, threshold: 1.8, rays: 0, streak: 0, dof: 0.8, halation: 0.1,
    lift: [0, 0.008, 0.02], gain: [0.98, 0.99, 1.01], sat: 0.8,
  },
  // Snow: a soft, warm key from the front-left (behind the camera) over cool skylight, so the
  // crust's lumps and the ball's cap get lit tops and blue hollows, and the cream ball stands off
  // the white. Exposure sits below the shoulder so the whites keep their texture.
  snow: {
    ...SUNNY,
    sunEl: 0.6, sunAz: -1.75, sunI: 2.8, sunColor: [1, 0.9, 0.78], sunGlow: 0.3,
    zenith: [0.36, 0.46, 0.66], horizon: [0.8, 0.84, 0.9],
    fogCol: [0.82, 0.85, 0.91], fogDens: 0.005, haze: 0.0001, mist: 0.15,
    cloudCover: 0.7, cloudDens: 0.8, cloudBase: 900, cloudTop: 2600, cloudType: 0.15, cloudSpeed: 6, towers: 0.15,
    cloudTint: [1, 1, 1], cloudAmb: 0.9,
    mtnSnow: 0.45, mtnTint: [0.24, 0.25, 0.29], mtnHaze: 0.035, mistSheets: 0.35,
    sandCol: [0.46, 0.46, 0.48], groundWet: 0.2, puddle: 0, snowCover: 1,
    envI: 0.7, fill: [0, 0, 0], key: [2.6, 2.4, 2.1], shadowRadius: 16, ballEnv: 0.35, snowRate: 1, motes: 0, wind: 0.2,
    exposure: 0.92, bloom: 0.3, threshold: 2.0, rays: 0.04, streak: 0, dof: 0.6, halation: 0.15,
    lift: [0, 0.006, 0.016], gain: [0.98, 0.99, 1.02], sat: 0.95,
  },
  fog: {
    ...SUNNY,
    sunEl: 0.55, sunAz: 0.25, sunI: 0.6, sunColor: [1, 0.97, 0.93], sunGlow: 0.3,
    zenith: [0.7, 0.74, 0.8], horizon: [0.84, 0.86, 0.89],
    fogCol: [0.8, 0.82, 0.86], fogDens: 0.008, fogFall: 0.2, haze: 0.0002, mist: 0.85,
    cloudCover: 0.55, cloudDens: 0.4, cloudBase: 2500, cloudTop: 4000, cloudType: 0, towers: 0, cloudAmb: 1,
    mtnSnow: 0.35, mtnTint: [0.26, 0.27, 0.3], mtnHaze: 0.065, mistSheets: 0.95,
    sandCol: [0.6, 0.61, 0.63], groundWet: 0.72, puddle: 0.45,
    envI: 1.0, fill: [0.03, 0.03, 0.035], key: [2.8, 2.75, 2.7], shadowRadius: 16, ballEnv: 0.22, motes: 0, wind: 0.08,
    exposure: 1.38, bloom: 0.35, threshold: 1.2, rays: 0.04, streak: 0, dof: 0.7, halation: 0.1,
    gain: [0.98, 0.99, 1.02], sat: 0.75,
  },
};
