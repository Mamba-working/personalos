# Architecture

## Product boundary

One monorepo coordinates web, API, data contracts, tests and release evidence. It does not imply all product capabilities already exist.

The alpha.8 web is a native static browser application with authored demo content, simulated weather and canned local chat answers. Local scene assets are loaded by motion-ball. Its native runtime still has no provider integration, server session, real authentication or web-to-API connection. The independent content studio is a separate application; its API does not change the accepted native page.

The TypeScript content backend now uses NestJS/Fastify, PostgreSQL and a separate durable worker. Its status retains historical productVersion 0.1.0-alpha.4 and apiScaffoldVersion 0.0.1, adds backendDemoVersion 0.1.0-demo.1, and reports real capability limits. Article generation is an explicitly labeled controlled mock with zero external model calls. See [content API](CONTENT_API.md) and [demo journeys](CONTENT_DEMOS.md).

## Minimal layout

- integrations/native-shell owns the canonical native page, feed, menu, chat and their retained static dependencies
- integrations/native-card owns the card/reader controller, measured layout and reader CSS
- integrations/motion-ball owns only the public-API bridge: scene container, asset base, weather/time UI, input ownership and pause/resume/disposal
- modules/motion-ball preserves the 84-file original source/assets/docs. It owns its renderer, character behavior, weather, scene clock and GPU resources
- apps/web/runtime is generated serving output. The 87-file alpha.8 inventory contains the native shell, host adapters, compiled motion-ball library, original assets and required Three.js 0.186.1 dependency files
- apps/web/dev-server.mjs serves only that runtime, including its image/WebGL asset MIME types; it does not expose repository source
- apps/api owns the NestJS/Fastify HTTP adapter, framework-independent content use cases, PostgreSQL/SQLite adapters, separate durable generation worker, stdio MCP adapter and workflow Skill
- packages/contracts owns shared content types, strict article-spec runtime validation, the trusted concurrency calculator, health builders and original native demo-record schemas
- scripts owns reproducible setup/build, source/syntax/export checks and current host/weather/card tests
- docs and provenance own public implementation truth, responsibilities and source/runtime mapping

Do not add packages/config, packages/database, a queue, generated clients or a content SDK until a real shared need exists. A fake auth/database adapter would obscure current scope.

## UI and 3D ownership

Keep one WeatherScene instance and canvas. The module owns its internal render/simulation clock; the host uses only its documented public API and events. Do not patch its model, lights, materials, shaders, presets, brain, input or clock. The standalone upstream landing page is not the native shell.

Native controllers retain article/node identity, feed scrolling, reader history/focus, menu and local chat state. The reader's stable CSS layout and scroll viewport are independent of 3D geometry. Its outer spring owns position/size/opacity; measured projection bridges opening and closing endpoints. See [native-card layout](NATIVE_CARD_LAYOUT.md).

The host arbitrates canvas input and pauses for overlays, reduced motion, hidden/background state and leaving the first-screen area. Ball interaction remains the original interaction; chat opens through a stable native control. Resize, restoration and disposal use the existing public lifecycle API. Known upstream asynchronous-loading and remount limits remain explicit in [motion-ball integration](MOTION_BALL_INTEGRATION.md).

The old world renderer, character, weather layer and story orchestration are absent from current canonical and generated runtime sources. There is no old-renderer fallback. Historical native or old-renderer tests cannot be treated as current-page acceptance.

## Build boundary

From a cloud environment, run npm ci, then npm run setup and npm run build:web. Setup copies the exact module into ignored .build/motion-ball and changes registry URLs only in that copy's lockfile, preserving pinned versions/integrity. Build compiles the original library and assembles apps/web/runtime from the canonical integrations. Generated output is not an editing surface.

No legacy dist tree is exported. A source/build check is not a deployment or a default-route promotion.

## Backend integration sequence

1. Decide actual content ownership and auth model; keep authored fixtures separate from user-owned content
2. Implement versioned read-only content endpoints against an approved store; test contracts and failure cases
3. Add a web data adapter without changing native identity/motion ownership; keep demo fallback explicit
4. Design real provider streaming, cancellation, errors and retention; keys stay server-side
5. Add authentication/authorization, CSRF/CORS, rate limits, retention/deletion and redacted observability before handling private user data

The status API reports content/persistence as implemented by this demo; real chat and production authentication remain false. Other capabilities must stay false until implementation and applicable integration tests exist. Health-check success does not establish an AI/backend product.
