# 作为独立模块使用（weather-scene）

返回入口：[agent.md](../agent.md)

3D 天气背景已经封装成一个与框架无关的模块，入口是 `src/lib/index.ts`。它只需要一个容器元素，不依赖页面上的任何 DOM、样式或全局状态，也不会改动 `document.body`。本仓库的落地页（`src/main.ts` + `src/ui/UI.ts`）就是它的一个使用方。

## 构建与引入

```bash
npm run build:lib
```

产物在 `dist-lib/`：
- `weather-scene.js`：ESM 包（three.js 是 peer dependency，不打进包里；`debug` 是按需加载的分块）
- `types/`：类型声明
- `assets/`：运行时素材（贴图、HDR 天空、真实地形、月面、模型），约 6.4 MB。部署到任意静态目录或 CDN，再把这个目录的 URL 传给 `assetBase`

其他项目引用：本地可以用 `npm i ../motion-ball`（`package.json` 已配好 `exports`），或者发布到私有 npm 源。宿主项目需要自己安装 `three@0.186`。

## 最小用法

```ts
import { createWeatherScene } from 'motion-ball';

const scene = await createWeatherScene(document.getElementById('bg')!, {
  assetBase: '/weather-scene/',   // dist-lib/assets 部署的位置
  weather: 'sunny',
  time: 'auto',
});

scene.on('say', ({ text }) => showBubble(text));
scene.setWeather('rain');
// 卸载时
scene.dispose();
```

容器必须有尺寸。画布会填满容器，并通过 `ResizeObserver` 自动跟随尺寸变化。

## 配置项 `WeatherSceneOptions`

| 选项 | 默认 | 说明 |
|---|---|---|
| `weather` | `'sunny'` | 初始天气：`sunny` `cloudy` `windy` `rain` `snow` `fog` |
| `time` | `'auto'` | `auto` 跟随本机时间，或固定 `day` / `night` |
| `moonPhase` | `'real'` | 月相：`'real'` 按当天，或 0–1（0.5 满月） |
| `assetBase` | 页面地址 | 相对素材路径的根目录（可以是 CDN）。绝对地址（`https:`、`/`、`data:`）不受影响 |
| `assets` | 内置 | 覆盖模型和素材（深合并）。可选项设为 `null` 表示不用，例如 `{ environment: { terrain: null } }` 用回程序化远山 |
| `environmentAssets` | `true` | `false` 时不加载任何照片贴图、HDR、真实地形和月面，只用程序化效果（最轻） |
| `presets` | 内置 | 按天气覆盖观感参数，例如 `{ rain: { exposure: 1.4 } }`，字段见 [configuration.md](configuration.md) |
| `night` / `daylight` | 内置 | 夜景参数、自动模式下的黄昏 / 黎明时间 |
| `quality` | `'auto'` | `auto` 按帧时间自适应，或固定 `low` / `medium` / `high` |
| `maxPixelRatio` / `pixelBudget` | `2` / `3.6e6` | 像素比上限、主画面像素预算 |
| `layout` | — | `{ ballX, portraitBallX }`：球在横屏 / 竖屏下的水平位置（NDC，−1 左 … 1 右） |
| `input` | `{ pointer: true, keyboard: false }` | 画布上的鼠标交互；键盘快捷键（数字 1–6、N、空格、方向键）默认关闭，避免和宿主冲突 |
| `cursor` | `true` | 悬停/抓取时自动设置画布的鼠标样式 |
| `audio` | `false` | 环境声（浏览器需要用户手势后才能出声） |
| `speech` | `true` | `false` 不发出 `say` 事件；或 `{ lines, greeting }` 替换各天气的台词和开场问候（`greeting: null` 不问候） |
| `autoCycle` | `false` | 自动轮播天气：`true`（14 秒）或秒数 |
| `autoPause` | `true` | 容器移出视口或页面切到后台时暂停渲染 |
| `reducedMotion` | 系统设置 | 更平缓的动作、减半粒子 |
| `debug` | `false` | 安装 `window.__mb` 调参工具（见 [development.md](development.md)） |

## 方法

天气
- `scene.weather`、`setWeather(name, { instant })`、`nextWeather()`
- `setAutoCycle(on, seconds)`、`autoCycle`
- `updatePreset(name, patch)`：运行时修改某个天气的参数，当前天气会平滑过渡过去；`getPreset(name)`
- `setSun({ azimuth, elevation } | null)`：固定太阳方向（弧度，0 为正前方，正值偏右）

时间
- `timeMode`、`isNight`、`nightAmount`（0–1）
- `setTime('auto' | 'day' | 'night', { instant, quiet })`
- `setMoonPhase(p)`、`setMoon({ azimuth, elevation } | null)`、`updateNight(patch)`、`updateDaylight(patch)`

小球 `scene.ball`
- `jump()`、`flip()`、`push(x, z)`、`wake()`
- `say(text, duration)`、`cheer(text?)`（开心地跳一下，可附一句话）
- `anchors`：屏幕锚点（相对画布的 CSS 像素）`{ ball: {x, y, radius}, bubble: {x, y}, ground: {x, y} }`

其他
- `setInput({ pointer, keyboard })`、`setSound(on)`、`setSpeech(on)`、`setLines(lines)`、`setLayout({ ballX, portraitBallX })`
- `setQuality(q)`、`getStats()` → `{ fps, frameMs, renderScale, cloudSteps, quality, width, height }`
- `capture(type?, quality?)` → `Promise<Blob>`：渲染一帧并导出图片
- `pause()`、`resume()`、`paused`、`resize()`、`dispose()`、`isDisposed`
- `internals.app`：内部引擎，供调试工具使用，不保证兼容

## 事件 `scene.on(name, fn)`（返回取消订阅函数；也有 `once`、`off`）

| 事件 | 数据 | 时机 |
|---|---|---|
| `ready` | `{ scene }` | 第一帧准备好 |
| `weatherchange` | `{ weather, previous }` | 天气切换（启动时也触发一次） |
| `timechange` | `{ mode }` | 时间模式改变（启动时也触发一次） |
| `daynight` | `{ night }` | 白天 ↔ 夜晚切换（启动时也触发一次） |
| `say` | `{ text, duration }` | 小球说话：由宿主渲染气泡 |
| `ball` | 小球原始事件 | `land` `hop` `boop` `flip` `grab` `release` `shed` `say` |
| `interact` | `{ target, action, key?, point? }` | 用户点击 / 双击 / 拖拽了 `ball` `umbrella` `ground` `sky`，或按了快捷键 |
| `cursor` | `{ cursor }` | `default` / `grab` / `grabbing` |
| `frame` | `{ dt, anchors }` | 每帧：只用来更新 DOM 的 transform，不要在这里写框架的 state |
| `pause` | `{ paused }` | 暂停 / 恢复 |
| `dispose` | `{}` | 释放时 |

## 封装成框架组件（示例：React）

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { createWeatherScene, type WeatherScene, type WeatherName } from 'motion-ball';

export function WeatherBackground({ weather, onSay }: { weather: WeatherName; onSay?: (t: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const scene = useRef<WeatherScene | null>(null);
  useEffect(() => {
    let alive = true;
    createWeatherScene(el.current!, { assetBase: '/weather-scene/', weather }).then((s) => {
      if (!alive) { s.dispose(); return; }
      scene.current = s;
      s.on('say', ({ text }) => onSay?.(text));
    });
    return () => { alive = false; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setWeather(weather); }, [weather]);
  return <div ref={el} style={{ position: 'fixed', inset: 0 }} />;
}
```

在 Next.js 里用 `dynamic(() => import('./WeatherBackground'), { ssr: false })` 加载。React 开发模式下组件会挂载两次，上面的 `alive` 判断加上 `dispose()` 就能正确处理。

## 限制

- **每页同时只能有一个实例**：大气、地面等着色器参数是模块级共享的。创建第二个会抛出 `WeatherSceneError('already-active')`，先 `dispose()` 旧的即可（路由切换、热更新都没问题）
- 天气只有六种内置类型，可以改参数，但还不能新增天气名
- 需要 WebGL2，不支持时 `createWeatherScene` 会以 `WeatherSceneError('webgl2-unavailable')` 拒绝
- 素材的署名要求（Poly Haven CC0、NASA SVS、AWS Terrain Tiles）见 [models.md](models.md)，使用方展示时请保留
