# PersonalOS

PersonalOS is managed as one product repository: web UI, a backend service boundary, shared contracts, regression tests and release provenance.

## Current implementation

- Web: the frozen v0.1.0-alpha.4 interface, 18 authored demonstration records, native feed/reader/navigation, Ball scene, menu, simulated weather and local demonstration chat
- API: a new runnable Node service with GET /healthz and GET /api/v1/status
- Contracts: health payload and authored-demo-content shape
- Product backend features: content storage/API, real AI, authentication and persistence are not implemented; the unchanged web demo does not call the new API

This is an alpha source import and backend scaffold. Test success does not establish browser/GPU/device/performance or final visual acceptance.

## Quick start

Use Node 24.19.0, as recorded in .nvmrc. From the repository root:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run setup
    npm run check
    npm test
    npm run dev

Web: http://127.0.0.1:4173

API health: http://127.0.0.1:3001/healthz

API status: http://127.0.0.1:3001/api/v1/status

The web and API can also run independently with npm run dev:web and npm run dev:api. These local development servers are not a production deployment configuration.

## Repository

    apps/web/runtime/           frozen browser sources and vendor notices
    apps/web/tests/             portable source/DOM regression suites
    apps/web/dev-server.mjs     runtime-only local static server
    apps/api/src/               real health/status HTTP service
    apps/api/test/              API HTTP regressions
    packages/contracts/        payload builders and content schema
    scripts/                   development and import checks
    docs/                      architecture, ownership, testing and release policy
    provenance/                exact source-file hashes and clean-import mapping
    .github/workflows/ci.yml    source/contracts/HTTP checks

## Public history and licenses

This public repository begins with a clean import. Original private QA captures, raw conversation feedback and operational environment details were excluded. The public import therefore has a new Git commit; historical source commits are recorded only as provenance in provenance/releases.json. They are not public ancestry or recreated original release tags.

Two runtime Three.js build files and their two accepted-baseline fixture copies are deliberately absent from Git. Root npm ci installs exact three@0.180.0; npm run setup restores all four files from the official package after SHA-256 verification. Run this before opening, serving or testing the web app. Three.js licenses remain tracked.

After setup, all 69 imported runtime files retain their exact source bytes. Their current canonical runtime digest is 7dc1d4eb903df03745d36b8424041978f6871b414a7b970d5caffed48fa8f41e despite the outer directory relocation.

Read LICENSE and THIRD_PARTY_NOTICES.md before reuse. This repository has no blanket MIT license. The retained Emotion Ball character visuals are restricted to non-commercial personal technical study/research; its engine/data have separate commercial licensing terms. A product commercialization plan must address those restrictions first.

More: [architecture](docs/ARCHITECTURE.md), [backend scope](docs/BACKEND_SCOPE.md), [testing](docs/TESTING.md), [release policy](docs/RELEASE_POLICY.md), [ownership](docs/OWNERSHIP.md)
