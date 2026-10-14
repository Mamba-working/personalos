# PersonalOS

PersonalOS is managed as one product repository: web UI, a backend service boundary, shared contracts, regression tests and release provenance.

## Current implementation

- Web: v0.1.0-alpha.8 candidate, 18 authored demonstration records, native feed/reader/navigation, menu and local demonstration chat
- 3D: the original motion-ball WeatherScene, a white ball on wet terrain with six simulated weather modes; all 84 upstream source, asset and documentation files are preserved
- API: the unchanged Node scaffold with GET /healthz and GET /api/v1/status
- Contracts: the unchanged health payload and authored-demo-content shape
- Product backend features: content storage/API, real AI, authentication and persistence are not implemented; the web demo does not call the API

The old 3D renderer, character and weather/story orchestration are removed from the current source and serving tree. Native UI ownership remains separate from motion-ball. The module's internal model, materials, shaders, weather, behavior, input and engine clock are unchanged.

This is an alpha source candidate and backend scaffold. Current web checks cover 59 host/weather/native-card tests; they do not establish actual GPU, mobile-device, performance or final visual acceptance. Those gates remain incomplete. A candidate branch does not change GitHub main or the default deployment.

## Quick start

Use Node 24.19.0, as recorded in .nvmrc. Run the reproducible setup and build in a cloud development environment, from the repository root:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run setup
    npm run build:web
    npm run check
    npm test
    npm run dev

Web: http://127.0.0.1:4173

API health: http://127.0.0.1:3001/healthz

API status: http://127.0.0.1:3001/api/v1/status

The web and API can also run independently with npm run dev:web and npm run dev:api. Build the web runtime before serving it. These development servers are not a production deployment configuration.

The API status response intentionally retains productVersion 0.1.0-alpha.4 and apiScaffoldVersion 0.0.1 because API/contracts were preserved byte-for-byte. This metadata describes that existing scaffold; it is not the current web candidate's release identifier. Backend integration capabilities remain false.

## Repository

    integrations/native-shell/  canonical native page, feed, menu and demo chat
    integrations/native-card/   canonical reader/card layout and projection
    integrations/motion-ball/   bounded public-API host adapter
    modules/motion-ball/        original 84-file upstream module and docs
    apps/web/runtime/           generated alpha.8 serving output, 87 files
    apps/web/dev-server.mjs     runtime-only static development server
    apps/api/                  unchanged health/status HTTP scaffold and tests
    packages/contracts/        unchanged payload builders and content schema
    scripts/                   reproducible build, checks and 59 web tests
    docs/                      architecture, integration and release guidance
    provenance/                public source/runtime mapping and export policy
    .github/workflows/ci.yml    build/source/contracts/HTTP checks, no deployment

Edit canonical sources rather than generated runtime files. No legacy dist tree is exported.

## Public history and licenses

This public repository began with a clean import. Private QA captures, raw conversation feedback and operational environment details were excluded. Historical source pointers are provenance references, not recreated original ancestry or old release tags. Earlier public candidates remain available in Git history; their checks and visual observations do not establish current-candidate acceptance.

The alpha.8 build compiles the original motion-ball library and copies its original assets. npm run setup prepares an ignored build copy and installs pinned dependencies from official npm. Only registry URLs in that copy's lockfile are adapted; the upstream lockfile, versions and integrity values remain unchanged. Three.js 0.186.1 and its license are included in the generated runtime. The old Three.js 0.180.0 reconstruction and old renderer fixtures are historical, not current setup steps.

Read [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before reuse. There is no blanket MIT license. The retained root licensing notice includes restrictions on historical Emotion Ball materials; their removal from the current runtime does not relicense historical copies or grant commercial rights to motion-ball or other first-party material.

Start at [agent.md](agent.md), then [architecture](docs/ARCHITECTURE.md), [motion-ball integration](docs/MOTION_BALL_INTEGRATION.md), [native-card layout](docs/NATIVE_CARD_LAYOUT.md), [backend scope](docs/BACKEND_SCOPE.md), [testing](docs/TESTING.md), [release policy](docs/RELEASE_POLICY.md) or [ownership](docs/OWNERSHIP.md).
