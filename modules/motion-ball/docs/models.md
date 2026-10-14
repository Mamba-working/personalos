# 可替换的模型

返回入口：[agent.md](../agent.md)

小球和雨伞默认是程序化生成的。替换成美术模型时只需要两步：把文件放进 `public/models/`，再改 `src/config/assets.ts`。其他代码不用动。模型加载失败会在控制台警告并自动回退到程序化版本，页面不会坏。地面、远山的照片贴图和环境天空也在同一个文件里配置，见下文[地面、远山贴图和环境天空](#地面远山贴图和环境天空assetsenvironment)。

## 小球

```ts
ball: {
  kind: 'gltf',
  url: 'models/ball.glb',
  fit: 'auto',          // 'auto' 按最远顶点缩放到 radius；也可以给固定缩放数值
  radius: 1,            // 物理半径（米），碰撞、粒子、阴影都用它
  forward: [0, 0, 1],   // 模型的“脸”朝向，默认 +Z
  face: { mode: 'morph', morphs: { blink: 'Blink', happy: 'Smile', surprise: 'Wow' } },
  snowShell: true,      // 是否加程序化积雪壳
},
```

模型规范：
- 大致球形、几何中心在原点，尺寸不限（`fit: 'auto'` 会处理）
- 脸朝 +Z，或用 `forward` 指定
- 材质用 MeshStandard / MeshPhysical（GLTF 的 PBR 材质默认就是）。大气、湿润水珠、积雪边缘阴影、接触阴影会自动加到这些材质上
- 支持 Meshopt 压缩；需要 DRACO / KTX2 时在 `factory.ts` 的 `gltfLoader()` 里加对应 loader
- 带骨骼的模型会保留层级；不带骨骼的网格会把节点变换烘焙进几何体

### 表情 `face.mode`
| 模式 | 说明 |
|---|---|
| `procedural`（默认） | 把程序化 SDF 眼睛画在模型材质上 |
| `morph` | 驱动模型自带的 morph target，在 `morphs` 里把表情通道映射到 target 名称 |
| `none` | 静态脸 |

表情通道（`ExpressionChannel`）：`blink`、`happy`、`surprise`、`squint`、`sleepy`、`dizzy`、`squeeze`、`blush`。没映射的通道会被忽略。

## 雨伞

```ts
umbrella: { kind: 'gltf', url: 'models/umbrella.glb', scale: 1, spinNode: 'canopy', transmissive: ['canopy'] },
```

模型规范：
- +Y 沿伞柄，原点在手握处（小球侧面中部），伞顶约在 y = 2.45，伞柄末端约在 y = −1.05（落在地上），伞面直径约 3.7（不符合就用 `scale`）
- 名为 `spinNode`（默认 `canopy`）的节点会在点击时旋转
- `transmissive` 列出的网格不投射阴影（透明伞面）
- 雨滴碰撞用的是 `UMBRELLA_GEOMETRY` 的球冠（`src/characters/types.ts`），换模型后让它大致贴合伞面；伞骨尖滴水的位置也按这里的 `ribs`、`theta` 计算（`UmbrellaPose.ribTips`）
- 透明伞面尽量不要用 `transmission`：three 会把伞后面的场景以半分辨率重渲一遍，伞骨和背景都会糊掉，帧时间也多约 1.5 ms。程序化伞的做法是用预乘 alpha 的薄膜反射层（见 `ProceduralUmbrella.ts`）
- 自定义几何体时，三角形绕序必须和法线一致（从外侧看是逆时针），否则光照会反，透明材质会整片发白

## 地面、远山贴图和环境天空（`ASSETS.environment`）

同样在 `src/config/assets.ts` 里配置，文件放在 `public/textures/<名字>/`（`diff.webp` 颜色、`nor.webp` 法线、`rough.webp` 粗糙度）和 `public/hdri/`。全部异步加载，没配、没加载完或加载失败时自动用程序化效果，页面不会坏。加 `?tex=0` 可以只看程序化版本做对比。

| 配置项 | 用在哪 | 当前素材（Poly Haven，CC0） |
|---|---|---|
| `ground.base` | 整片地面的波纹和明暗变化，两种尺度混合避免重复 | `aerial_beach_01`，2K，`tile: 18` |
| `ground.micro` | 球脚边的细颗粒和湿润斑驳，约 40 m 外淡出 | `brown_mud_03`，1K，`tile: 1.4` |
| `ground.snow` | 雪地表面，第一次下雪时才加载 | `snow_02`，1K，`tile: 2.4` |
| `rock` | 远山三平面投影岩石，近山用 `tile`，远山用 4 倍 | `rock_face_03`，1K，`tile: 250` |
| `hdri.<天气>` | 环境光探针里的天空结构（只影响环境光和反射） | 4 张 puresky / 雪原 HDR，512×256 |
| `terrain` | 整片远景：从河口湖北岸向南看富士山的真实地形，延伸到 66 km 外（按 0.377 缩放，起伏放大 1.1 倍） | AWS Open Data Terrain Tiles（terrarium z12，约 31 m；Mapzen，底层含 SRTM 等），`public/terrain/kawaguchi_polar.u16`（网格高度，690 KB）和 `kawaguchi_detail.webp`（法线 + 沟谷，z13 数据、4096 px，2.2 MB） |
| `moon` | 夜空里的月亮：正面（经度 −90°…90°）的颜色图和高程图，正交投影成球，按月相受光，高程只用来在明暗交界线照出环形山 | NASA SVS CGI Moon Kit（LRO 的 LROC 彩色 + LOLA 高程），公有领域，注明 NASA's Scientific Visualization Studio；`public/moon/albedo.webp`（512²，65 KB）、`height.webp`（138 KB），第一次进入夜晚时才加载 |

远景（`terrain`）：`heights` 直接是场景极坐标网格（方位 −1.5…1.5 弧度 × 半径 r0…r1 对数分布）上的高度，`detail` 是富士山一带的细节贴图（RG = 法线 x/z，B = 凹凸度，沟谷亮）。材质在 `Terrain.ts` 的 DEM 分支里按真实海拔（由 `scale`、`vex`、`base`、地球曲率换算）分层：林线以下是深色森林，平地是田野，往上是灰色裸岩和富士山上部的红褐色火山渣，雪线以上是雪（随天气的 `mtnSnow` 变化，顺着沟谷向下延伸成雪舌；下雪天会一直白到湖边）。换地点或视角：改 `tools/terrain/get_tiles.sh` 的瓦片范围和 `tools/terrain/build_dem.py` 顶部的视点、目标山峰、缩放，重新生成两个文件，再改 `src/config/assets.ts` 里的参数。数据需注明来源。没加载成功时会回退到程序化的山。

换素材时要知道的：
- 颜色只取"结构"：shader 用贴图除以它自己的平均色（最后一级 mip），天气预设仍然决定地面的颜色和亮度。所以换一张偏黄或偏暗的照片不会把场景染色，对比度由 `Ground.ts` 里的系数控制
- 法线用 OpenGL 约定（绿色朝上，Poly Haven 的 `nor_gl`）。扫描时整体倾斜的法线贴图（比如 `snow_02`）会被自动减去平均倾斜
- `tile` 是一张贴图对应的世界尺寸（米）。小尺寸的近景层用了随机偏移加旋转的变体混合（`tileVariants`），不会出现规律重复
- HDR 天空只取它相对自身模糊版本的明暗起伏，乘在探针自己的云上，太阳被裁掉（方向光已经负责太阳）。它会自动转到让照片里的太阳对准场景太阳
- 体积：地面首屏约 2.2 MB，远山 0.8 MB，每张天空 0.1–0.4 MB。颜色 WebP q86，法线 q90（`-sharp_yuv`）。原始素材在 polyhaven.com 按名字下载，转换方法是 `cwebp`（1K 用 `ffmpeg -vf scale=1024:1024:flags=area` 先缩），HDR 用 `ffmpeg -vf scale=512:256:flags=area -c:v hdr`
- 性能：各向异性过滤是这些贴图的主要开销（16× 时每帧多约 5 ms），所以地面用 4×、远山不用

## 契约接口（想写全新渲染方式时看这里）

`src/characters/types.ts`：
- `BallVisual`：`root`、`radius`、`update(state: BallRenderState, dt)`、`dispose()`
- `UmbrellaVisual`：`root`、`update(pose: UmbrellaPose, dt)`、`dispose()`

`BallRenderState` 提供位置、朝向、挤压缩放、戳出的凹痕、视线偏移、表情、湿度、积雪方向和厚度。`UmbrellaPose` 提供可见性、握点、伞轴、弹开程度、旋转、伞面碰撞体，以及各伞骨尖的世界坐标（`ribTips`，雨水从这里滴落）。

此外 App 还会调用 Visual 的这几个方法，新实现也要提供（参考 `ProceduralBall` / `GltfBall`）：
- `forEachMesh(fn)`：让网格进入反射图层
- `uniforms`：表面补丁 uniform，由 `createSurfaceUniforms()` 创建
- `setEnvIntensity(v)`：写入 `uniforms.uEnvGain`。注意：使用 `scene.environment` 时 three 会忽略材质的 `envMapIntensity`，所以必须走 uniform

## 验证新模型

在 `?debug=1` 下运行 `await __mb.gltfRoundTrip()`。它会把程序化小球导出成 GLB 再走 GLTF 加载路径，用来确认这条链路正常。换上真实模型后，用 `__mb.silhouette()` 检查各天气下的轮廓分离度（见 [development.md](development.md)）。
