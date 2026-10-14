# motion-ball · Agent 入口

PersonalOS 落地页的 3D 天气小球：浏览器端 three.js 场景，一个会互动的白色小球站在湿盐滩上，六种天气（晴、多云、大风、雨、雪、雾）。技术栈 three.js 0.186 + Vite 8 + TypeScript 5.8，无后端。

本文件只做索引：先看这里判断要找什么，再进对应文档。改代码前先读相关文档，改完后同步更新文档。

## 文档地图

| 想了解 / 想做 | 去看 |
|---|---|
| 目录结构、模块职责、一帧里发生了什么、渲染管线 | [docs/architecture.md](docs/architecture.md) |
| 调天气效果、白天/夜晚与月亮、镜头构图、远山、后期调色（所有可配置参数） | [docs/configuration.md](docs/configuration.md) |
| 换小球 / 雨伞的 3D 模型（GLTF）、表情映射、模型规范；换地面 / 远山照片贴图和 HDR 天空 | [docs/models.md](docs/models.md) |
| 鼠标、键盘交互，小球行为与事件，天气和小球的物理互动 | [docs/interaction.md](docs/interaction.md) |
| 安装、构建、预览、`?debug=1` 调试工具、验证方法和已知坑 | [docs/development.md](docs/development.md) |
| 在其他项目里复用：独立模块的 API、配置项、事件、组件封装 | [docs/library.md](docs/library.md) |

## 最常见的改动入口

- 换模型、换地面 / 远山贴图或天空：只改 `src/config/assets.ts`（素材放 `public/`），详见 [docs/models.md](docs/models.md)
- 调某种天气的观感：只改 `src/weather/presets.ts`，详见 [docs/configuration.md](docs/configuration.md)
- 改页面文案 / 布局：`index.html` + `src/styles.css` + `src/main.ts`（落地页只通过公开 API 使用场景）
- 给其他项目用：`npm run build:lib`，接口见 [docs/library.md](docs/library.md)

## 必须遵守的约定

- 材质扩展一律走 `src/core/patch.ts` 的 `applyPatches` + `inject`，不要手写整套 shader，也不要直接改 three 的内置 chunk。
- 模拟（Brain / Rig）和渲染（Visual）分离，渲染层只实现 `src/characters/types.ts` 里的接口。
- 3D 代码（`src/app`、`src/world`、`src/weather`、`src/characters`、`src/fx`）不能访问页面 DOM（`document.body`、按 id 查元素、`window` 尺寸）；需要告诉页面的事走 `AppHooks` → `WeatherScene` 事件，页面的 UI 只放在 `src/main.ts` / `src/ui/`
- 天气参数只在 `presets.ts` 定义，运行时由 `Weather` 插值，`App.applyWeather()` 统一下发；不要在别处硬编码天气数值。
- 这是一个常驻背景页面：避免强眩光、闪烁和大面积纯白，改动光照后要按 [docs/development.md](docs/development.md) 的方法验证。
