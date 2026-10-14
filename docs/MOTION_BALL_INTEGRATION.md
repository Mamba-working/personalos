# motion-ball integration

Start with the unchanged [module agent.md](../modules/motion-ball/agent.md) and [public API guide](../modules/motion-ball/docs/library.md). Its original six child documents and all 84 original files are preserved at commit `957cec0acf327ef5a79f754c94b70142792b0133` of `Mamba-working/motion-ball`.

`integrations/motion-ball/` mounts one client-only WeatherScene in a background container. It supplies assetBase, observes container resize, calls public weather/time/input/pause/resume/dispose methods and consumes public events/anchors, including isNight/daynight for host navigation tone. It owns no Three meshes, materials, shaders, brain or clock. The effective module build receives no internal patch. Native content, menus, reader and local demonstration chat retain their own DOM and history. A stable native chat button activates chat; canvas gesture cancellation cannot accidentally open it.

The previous renderer, actor handoff, story entry, exclusive assets and Three r180 dependency have been removed. The page has one module renderer and no legacy actor fallback. `integrations/native-shell/` is the independent native page source. [Native-card layout](NATIVE_CARD_LAYOUT.md) owns reader controls, measurements and projections separately from 3D styles.

Cloud build:

```sh
npm ci --ignore-scripts
npm run setup
npm run build:web
npm run check
npm test
```

Setup copies exact upstream source to ignored `.build/motion-ball/`. Only dependency registry URLs in that temporary lockfile are changed to official npm; versions and integrity stay pinned. The original lockfile remains byte-identical. Three 0.186.1 and its addon import closure/license are local to the compiled runtime. The standalone upstream page UI is not used as the homepage.

Limitations of the unchanged module: reducedMotion is initialization-only; the host responds to realtime preferences by pausing the same instance. Paused weather/time application uses existing instant changes and public capture for repaint. ready does not guarantee every asynchronous asset is complete; original asynchronous texture/HDR/moon loading has no complete dispose-generation isolation. The host does not remount a disposed scene in the page. frame.dt is clamped simulation time, not real display FPS. WebGL2/startup/context-loss failures leave the native product UI usable with a status message.

The 72 deterministic checks cover host ownership, weather DOM/state and native-card geometry. They do not certify real GPU art, six-weather transitions, physical resize, mobile gestures or browser performance. Those gates remain incomplete; this branch does not promote the live default.

Visible credits preserve Poly Haven (CC0), AWS Open Data Terrain Tiles / Mapzen and NASA SVS/LRO. See unchanged [models.md](../modules/motion-ball/docs/models.md) for the source material terms. GSAP's existing native UI notice remains in the runtime and canonical native source.

## Current host presentation and weather data

Display-only hero heading/eyebrow cannot select or intercept input; hit testing passes through to the original scene canvas without synthetic click forwarding. Native navigation, filters, reader text and chat stay interactive/selectable. The redundant hero information/weather-control card is removed; the footer labels the public demonstration content and simulated weather.

WeatherProvider is a headless host-data interface. Its default mock resolves asynchronously with sunny/auto and explicit source:mock/simulated:true state. It makes no network or geolocation request, never blocks native UI or scene initialization, and applies validated complete weather/time choices through the existing host API. Abort, stale completion and provider failure keep safe fallback state. No real weather/backend integration is claimed.

Navigation A is a transparent, flat editorial masthead with an inset hairline and text actions. Existing logo/motion/chat/menu actions retain their native semantics and at least44CSSpx targets; compact labels keep accessible names. Foreground follows only public scene night/ready state; content overlap adds a small, unblurred contrast edge and a two-color focus outline. DOM/style/color-pair tests do not certify actual scene pixels, mobile touch or Safari.
