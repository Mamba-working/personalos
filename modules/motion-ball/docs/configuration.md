# 可配置参数

返回入口：[agent.md](../agent.md)

## 1. 天气参数 `src/weather/presets.ts`

`SUNNY` 是基准，其他五种天气用 `{ ...SUNNY, 覆盖项 }` 写法，只列出不同的字段。切换天气时每个字段都会平滑插值（`groundWet`、`puddle`、`snowCover` 有各自更慢的涨落速度，见 `Weather.ts` 的 `SLOW`）。颜色均为线性 RGB。

新增天气：在 `WEATHERS`、`LABELS`、`PRESETS` 里各加一项，并在 `index.html` 的天气弹层加按钮。

### 太阳与天空
| 字段 | 含义 |
|---|---|
| `sunEl` / `sunAz` | 太阳高度角 / 方位角（弧度）。方位 0 = 正前方远处，正值偏右；镜头看向 -Z |
| `sunI` | 地面接收到的太阳强度 |
| `sunColor` | 太阳色调（低太阳角会额外变暖） |
| `sunGlow` | 太阳周围日晕强度 |
| `zenith` / `horizon` | 天顶色 / 地平线色 |

### 大气
| 字段 | 含义 |
|---|---|
| `fogCol` | 雾的颜色 |
| `fogDens` / `fogFall` | 贴地高度雾的密度 / 随高度衰减速度 |
| `haze` | 随距离线性增长的薄霾 |
| `mist` | 近处流动低雾（光标和小球能拨开） |

### 体积云
| 字段 | 含义 |
|---|---|
| `cloudCover` / `cloudDens` | 覆盖率 / 密度 |
| `cloudBase` / `cloudTop` | 云底 / 云顶高度（米） |
| `cloudType` | 0 层云 → 1 积云 |
| `cloudStretch` | 沿风向拉伸（大风） |
| `cloudSpeed` | 漂移速度 |
| `towers` | 太阳附近的积云塔 |
| `cloudTint` / `cloudAmb` | 云色调 / 环境光强度 |

`cloudCover` 同时决定太阳硬高光的强弱：`(1 − 1.05·cloudCover)^1.5`，雨天为 0。

### 远山
| 字段 | 含义 |
|---|---|
| `mtnSnow` | 雪线：0 无雪，1 雪到山脚 |
| `mtnTint` | 岩石颜色（乘在各层底色上） |
| `mtnHaze` | 远山空气透视，1 km 处的光学厚度；越大远山越淡，层次越柔 |
| `mistSheets` | 山间雾带浓度 |

远景用的是真实地形（河口湖看富士山，见 [models.md](models.md) 的 `terrain`），山的形状来自高程数据，不是参数。材质分层的海拔（林线约 2350 m、火山渣 1800–2600 m、雪线 `mix(3650, 1250, mtnSnow)` 并沿沟谷下降 520 m）在 `Terrain.ts` 的 DEM 分支。程序化的 `terrainHeight`（`foot` / `mid` / `chain` / `hero`）只在真实地形没加载时使用。晴天的太阳放在正左侧偏低（`sunAz -1.55`、`sunEl 0.42`），这样光从侧面掠过富士山，沟谷和雪的形状才看得出来；`mtnHaze` 降到 0.014，空气更通透。

### 地面
| 字段 | 含义 |
|---|---|
| `sandCol` | 盐滩底色 |
| `groundWet` / `puddle` | 湿润水膜 / 积水比例（影响镜面反射） |
| `snowCover` | 地面积雪 |
| `dust` | 地面流沙纹理（大风） |

### 光照
| 字段 | 含义 |
|---|---|
| `envI` | 场景环境光整体强度 |
| `key` | 小球的人像主光（线性 RGB 照度）：从视线侧方约 85°、仰角约 35° 打来，自动放在太阳/月亮所在的一侧（`App.applyWeather`），给出亮面、明暗交界线和缎面高光。球的立体感主要靠它 |
| `fill` | 小球的机位侧补光（类似反光板），现在基本为 0，开大了球会变平 |
| `ballEnv` | 小球接收的天空环境光比例（漫反射；釉面反射按 `(ballEnv + 1) / 2` 保留）。0.2–0.35 时暗面才压得下去，接近参考图的明暗 |
| `shadowRadius` | 阴影柔和度 |

### 粒子与风
| 字段 | 含义 |
|---|---|
| `rainRate` / `snowRate` / `sandRate` | 雨 / 雪 / 飞沙量（0–1） |
| `motes` | 阳光中漂浮的光尘 |
| `wind` / `windAngle` | 风力 / 风向（弧度） |

### 镜头与胶片
| 字段 | 含义 |
|---|---|
| `exposure` | 曝光（AgX 色调映射前）；太阳入画时自动减 12% |
| `bloom` / `bloomRadius` / `threshold` | 辉光强度 / 半径 / 阈值（线性亮度单位） |
| `rays` / `streak` | 太阳光束 / 变形镜头横纹（仅太阳在画面内时生效） |
| `dof` | 景深：无穷远处的模糊半径（像素，按每 1000 px 画面高度计），对焦在小球脸部。当前各天气为 1（雾 0.7），只做轻微分层；超过 2 背景就会明显发糊 |
| `lift` / `gain` | 暗部 / 亮部色偏（分离色调） |
| `sat` / `contrast` / `curve` | 饱和度 / 对比度 / S 曲线强度 |
| `white` | 高光肩部上限（显示值），1 = 不限制 |
| `halation` | 亮边暖色溢光 |
| `vignette` / `grain` | 暗角 / 胶片颗粒 |

常驻背景的经验值：晴天让太阳不入画（目前在左前方高处），`streak` 为 0、`grain` ≤ 0.012，`white` 约 0.96；判断小球是否看得清用 `__mb.silhouette()`（见 [development.md](development.md)）。

## 2. 镜头构图 `src/app/CameraRig.ts`

`layout()` 按宽高比选择：横屏 `fov 38 / camH 2.2 / pitch -1°`，竖屏 `fov 46 / camH 2.4 / pitch -2.5°`，镜头距离 `dist 9.6`。小球的屏幕横向位置由 `ndcX` 决定（横屏偏右，竖屏居中）。`update()` 里的系数控制鼠标视差幅度。竖屏时 `App.layout()` 会把远山整体旋转 0.3 弧度，让主峰仍在球后方。

## 3. 运行时参数

这些是落地页（`src/main.ts`）的网址参数，最终都换算成模块的配置项；在其他项目里直接传配置项即可，见 [library.md](library.md)。

| 方式 | 作用 |
|---|---|
| `?w=sunny\|cloudy\|windy\|rain\|snow\|fog` | 直接进入某天气 |
| `?quality=low\|medium\|high` | 固定画质（分辨率倍率、云层步进、粒子量），关闭自适应 |
| `?debug=1` | 构建版也加载调试工具（dev 模式总是加载） |
| `?tex=0` | 不加载照片贴图和 HDR 天空，只看程序化版本（做前后对比用） |
| `?time=day\|night\|auto` | 固定白天 / 夜晚，或跟随本机时间（默认 auto） |

## 2.5 时间（白天 / 夜晚）`src/weather/TimeOfDay.ts`

夜晚不是单独的天气，而是叠加在任意天气上的一层：`TimeOfDay.apply()` 把当前天气参数变成实际渲染用的值，所以晴、多云、大风、雨、雪、雾都有对应的夜晚。

- `DAYLIGHT`：自动模式下的黄昏（17:30 → 19:15）和黎明（4:45 → 6:30），按本机时间计算。切换会平滑过渡几秒，中间有暖色的日落 / 日出天光
- `NIGHT`：夜晚的观感
  - `moonAz` / `moonEl`：月亮位置（弧度），默认在画面右上方的山脊上空
  - `moonPhase`：`'real'` 按当天的真实月相（太细时至少显示一道看得见的月牙），也可以填 0–1 固定（0.5 为满月）
  - `moonI` / `moonColor`：月光强度和颜色，云量越大越弱
  - `skyScale` / `skyTint` / `skyFloor`：夜空、雾色相对白天的缩放、偏蓝程度和最低亮度（阴雨夜不至于全黑）
  - `cloudLight`：云被月光照亮的比例；`exposure`：夜里曝光倍数；`key`：小球主光乘上的冷色系数；`stars`：星星强度（只在晴朗处可见）
- 月亮画在天空穹顶里（`Sky.ts` 的 `moonDisc`）：角半径 `r = 0.02`（约为真实的 2 倍），亮度系数 `2.6`，细月牙额外提亮最多 1.5 倍；用 Lommel–Seeliger 公式着色（月亮边缘不变暗），亮边朝已落下的太阳方向倾斜约 25°；环形山起伏夸张 4 倍（`moonUniforms.uMoonRelief`）。贴图没加载时回退到程序化的圆盘
- 夜里页面文字会切成浅色（`body[data-time="night"]`，见 `styles.css` 末尾）
- 调试：`__mb.night` / `__mb.daylight` 是上面两个对象，改完立即生效；`__mb.app.setTimeMode('night')`
| 天气弹层的“自动” | 每 14 秒切换下一种天气 |

## 4. 其他常量

- 像素预算 `3.6e6`：`App.pixelRatio()`（Retina 1440×900 约 1.67 倍）。云层和地面镜面反射按 CSS 像素 ≤1.25 倍单独计算分辨率
- 自适应画质（`App.adapt`）：帧时间超过 20.5 ms 时，先减少云层步进（48 → 28），再降分辨率（最低 0.6）；恢复时顺序相反
- 雨伞几何与碰撞：`src/characters/types.ts` 的 `UMBRELLA_GEOMETRY`（伞面球半径、半角、伞柄长度）。伞靠在球的右前方、伞柄落地，位置和倾角在 `UmbrellaRig.ts`（`anchor` 偏移、`tilt` 静止值）；下雨时球向左让出的距离在 `App.update`（`baseHome − 1.2`）。程序化伞的造型（裙边起伏 `SCALLOP`、卷边宽度 `HEM`、伞巢高度 `RUNNER_Y`、直柄长度 `HANDLE`、骨架粗细、材质颜色）在 `src/characters/umbrella/ProceduralUmbrella.ts`
- 伞上的雨：滴水速率在 `ParticleSystem.update`（每根伞骨尖每秒 7 滴 × 雨量）。伞面的水膜条纹、两层水珠（`beadLayer` 的尺度、密度、大小）、散射亮度（`1.4`）、水珠高光（`glint * 2.2`）在 `ProceduralUmbrella.ts` 的 `canopyWaterPatch`；伞骨尖悬挂的水滴在 `ProceduralUmbrella.update`
- 雪：球顶积雪速度在 `BallBrain`（每秒 `0.03 × 雪量`，约半分钟积满）；雪帽形状在 `surfacePatch.ts` 的 `SNOW_GLSL`（边缘 `snowEdge`、厚度 `snowThick`），雪粒、凹陷和冰晶闪光在 `snowCapPatch`。地面的雪块起伏和凹陷在 `Ground.ts` 的 `snowClump`（强度 `0.07`），冰晶闪光在 `sparkle`，球周围的雪堆在 `MOUND_GLSL`（高度 `0.16 R`）和 `App.updateSnowMound`。近处雪花的散景大小在 `ParticleRenderer.ts`（系数 `0.048`，上限为画面高度的 2.4%）
- 后期链结构与 bloom 高通：`src/fx/PostFX.ts`
- 地面材质（粗糙度、水膜光滑度）：`src/world/Ground.ts` 的 `groundSurface`。照片贴图的强度也在这里：基础层明暗 `1.8`、波纹法线 `0.5`，近景颗粒的颜色 `0.28`、法线 `0.45`、淡出距离 `42 m`，雪地法线 `0.8`
- 远山岩石贴图的强度：`src/world/Terrain.ts` 的 `rockTriplanar`（法线 `k = 0.85`，颜色混合 `0.85`，近 / 远两种尺度在 1.8–3.6 km 之间过渡）
- 用哪些贴图、每张对应多大（`tile`）、各天气用哪张 HDR：`src/config/assets.ts` 的 `environment`（见 [models.md](models.md)）
