# 架构

返回入口：[agent.md](../agent.md)

## 目录与职责

```
index.html, src/styles.css     页面 UI（标题、卡片、天气/菜单弹层），与 3D 场景独立
src/lib/                       对外的独立模块：createWeatherScene / WeatherScene（参数、方法、事件、生命周期）、配置合并与 assetBase
src/main.ts                    落地页：解析 URL 参数，通过公开 API 创建场景，把事件接到页面 UI（UI.ts）
src/app/
  App.ts                       引擎：创建场景、每帧 update/render、applyWeather 下发参数；通过 AppHooks 向外报告，不碰页面 DOM
  CameraRig.ts                 镜头：构图（随宽高比）、鼠标视差、投影/射线工具
  Input.ts                     指针与键盘手势识别（点击、双击、拖拽、悬停）
  debug.ts                     window.__mb 调试工具（仅 dev 或 ?debug=1 时加载）
src/config/assets.ts           模型配置（程序化 / GLTF）和环境素材（地面、远山贴图、HDR 天空），换素材的唯一入口
src/characters/
  types.ts                     模拟层与渲染层之间的契约接口
  factory.ts                   按配置创建 Visual，加载失败回退到程序化模型
  ball/BallBrain.ts            小球的行为与物理（跳、滚、抓、表情、湿度、积雪）
  ball/ProceduralBall.ts       默认程序化小球
  ball/GltfBall.ts             GLTF 小球适配
  ball/surfacePatch.ts         小球表面补丁：脸、凹痕、湿润水珠、积雪、背光边缘光
  ball/faceGlsl.ts             程序化 SDF 眼睛
  umbrella/UmbrellaRig.ts      雨伞的姿态与弹开动画、伞面碰撞体
  umbrella/Procedural|GltfUmbrella.ts  雨伞渲染（程序化版：八骨透明圆顶伞，伞面是薄膜反射层而非 transmission）
src/weather/
  presets.ts                   六种天气的全部参数（见 configuration.md）
  Weather.ts                   参数插值、阵风、闪电、太阳方向/颜色
  TimeOfDay.ts                 白天/夜晚（本机时间或手动）：把天气参数变成夜空、月亮、星星、月光和夜间调色
  ParticleSystem.ts            CPU 粒子：雨、雪、沙、光尘、溅射、雪块，含与球/伞的碰撞
  ParticleRenderer.ts          粒子的实例化绘制
src/world/
  atmosphere.ts                全局大气 uniform：天空渐变、日晕、高度雾、薄雾；替换 three 的 fog
  Sky.ts + clouds/             体积云（半分辨率 + 时域累积）与天空穹顶
  Terrain.ts                   远景：真实地形（河口湖看富士山，按海拔分层的森林/岩石/雪），未加载时用三层程序地形；山间雾带、远山专用空气透视
  Ground.ts                    盐滩地面：湿润水膜、积水、雨点涟漪、积雪（雪块、冰晶、球周围的雪堆）、接触阴影
  PlanarReflection.ts          地面平面镜面反射
  InteractionMap.ts            地面交互贴图（涟漪、雪坑、拨开薄雾）
  Lighting.ts                  太阳光 + VSM 软阴影 + 环境探针（cube → PMREM）
  EnvAssets.ts                 异步加载地面 / 远山照片贴图和 HDR 天空，写进各 uniform；天气切换时淡入淡出天空
src/fx/
  PostFX.ts                    后期链组装
  DepthOfFieldPass.ts          景深：半分辨率散景采样 + 全分辨率合成，对焦在小球脸部
  LensPass.ts                  太阳光束 + 变形镜头横纹
  shaders.ts                   远景降水、bloom 高通、暗角、胶片调色
src/core/                      patch（材质补丁）、noise（GPU/CPU 噪声）、math（元组向量）
src/ui/UI.ts                   DOM UI 控制（弹层、气泡、提示）
src/audio/Ambience.ts          环境音与音效
public/models/                 放 GLTF 模型
public/textures/, public/hdri/ 地面、远山贴图（WebP）和 HDR 天空（Poly Haven，CC0）
public/terrain/, public/moon/ 真实地形（AWS Terrain Tiles）和月面（NASA SVS）
tools/terrain/                 下载高程瓦片、生成远景地形文件的脚本
```

## 一帧的流程（App.step）

1. `update(dt)`
   - `Weather.update`：所有参数向目标天气平滑插值，计算阵风、闪电
   - `applyWeather()`：把天气参数写进各处 uniform、灯光、后期参数
   - 镜头更新 → 悬停 / 抓取 / 光标目标 → `BallBrain.update` → `UmbrellaRig.update`
   - 处理小球事件（落地溅水、抖雪、音效、气泡文字）→ 粒子模拟 → UI
2. `render(dt)`
   - Visual 同步模拟状态 → 交互贴图步进 → 环境探针（每 6 帧）→ 体积云 pass
   - 平面反射（反射里关掉太阳圆盘）→ 上传粒子 → 后期链

## 渲染管线

```
场景（MSAA×4，HalfFloat，带深度）
 → 景深 → 远景雨雪 → 光束/横纹 → bloom（只送超阈值能量）
 → 镜头暗角（线性空间）→ AgX 色调映射（OutputPass）
 → 胶片调色（halation、饱和度、对比、S 曲线、lift/gain、高光肩部、颗粒）
```

所有 MeshStandard / MeshPhysical 材质通过 `atmospherePatch` 接入统一大气，远山额外用 `applyRangeAtmosphere` 做分层空气透视。

粒子写深度（只有不透明的核心写），所以景深按每颗雨滴、水滴自己的距离去虚化；透明伞面不写深度，跟着它背后的远景一起虚化，而伞骨是不透明物体，始终清晰。

## 关键设计

- **补丁式材质**：`applyPatches(material, [patchA, patchB])` 组合多个 `onBeforeCompile`，并按补丁 key 生成 program 缓存键。GLTF 模型加载后自动套用同样的补丁，所以新模型也会有湿润、积雪、大气效果。
- **共享 uniform**：`atmos`、`cloudUniforms`、`terrainUniforms`、`groundUniforms`、`envSkyUniforms` 是全局对象，所有材质按引用共享，改 `.value` 即全局生效。
- **素材渐进加载**：`EnvAssets` 在后台加载贴图，加载完成前 `uGTex` / `uRockTex` / `uSnowTex` / `uHdrOn` 为 0，shader 走程序化细节；加载完成后置 1。所以首帧不用等素材，素材缺失也不影响运行。
- **模拟与渲染分离**：`BallBrain` 输出 `BallRenderState`，`UmbrellaRig` 输出 `UmbrellaPose`，渲染层只消费这些结构（见 [models.md](models.md)）。
- **自适应分辨率**：像素预算约 360 万，帧时间超标时先减云层步进、再降低 `renderScale`；`?scale=` 可锁定。
