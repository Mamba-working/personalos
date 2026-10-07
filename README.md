# PersonalOS

PersonalOS is managed as one product repository: web UI, a backend service boundary, shared contracts, regression tests and release provenance.

## Current implementation

- Web: the local v0.1.0-alpha.6 static-shadow-cache candidate, 18 authored demonstration records, native feed/reader/navigation, Ball scene, menu, simulated weather and local demonstration chat
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

    apps/web/runtime/           candidate browser sources and vendor notices
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

The historical alpha.4 import remains recorded without modification. The active alpha.6 candidate adds only the reviewed renderer-owned static-shadow cache and version metadata to published alpha.5 source 652d790. The exact alpha.5 manifest and historical source assertions remain pinned. A new runtime inventory, exact hook allowlist and source-payload mapping are recorded in provenance/active-candidate.json. Cinematic rain-v6 and Next.js are not included. It is local and unpublished; fresh assembled alpha.6 browser/device and final acceptance remain pending. Prior matched-pixel observations are referenced by their actual graphics-source SHA, not relabeled as a new run. See docs/ALPHA6_CANDIDATE.md.

Read LICENSE and THIRD_PARTY_NOTICES.md before reuse. This repository has no blanket MIT license. The retained Emotion Ball character visuals are restricted to non-commercial personal technical study/research; its engine/data have separate commercial licensing terms. A product commercialization plan must address those restrictions first.

More: [architecture](docs/ARCHITECTURE.md), [backend scope](docs/BACKEND_SCOPE.md), [testing](docs/TESTING.md), [release policy](docs/RELEASE_POLICY.md), [ownership](docs/OWNERSHIP.md)
