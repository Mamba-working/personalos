# Test boundaries

## Reproducible setup and checks

Use Node 24.19.0 from .nvmrc in a cloud environment:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run setup
    npm run build:web
    npm run check
    npm test

npm run setup copies the original motion-ball tree into an ignored build directory and installs the exact locked dependencies from official npm. Only registry URLs in the copied lockfile change; original source, lockfile, versions and integrity values remain unchanged.

npm run build:web type-checks/builds the original library and assembles apps/web/runtime from canonical integrations. Current runtime: 87 alpha.8 files, with original assets, Three.js 0.186.1 and its license. The old Three.js 0.180.0 runtime/fixture reconstruction is historical and is not a current prerequisite.

npm run check covers recorded source/runtime hashes, original module integrity, effective unpatched source, import closure, obsolete-renderer absence, JavaScript syntax and public-export heuristics. The pattern scan is not a complete secret/security audit.

## Automated test layers

npm test runs:

- Shared health/demo-content contracts
- Real local HTTP health/status API, missing capabilities/routes, rejected methods and headers
- Real local HTTP static serving, current assets/MIME types and repo-file/traversal/method boundaries
- npm run test:web: 59 current host, weather-bridge and native-card tests

The API and contracts use Node built-ins and add no server framework dependency. Their source/tests are unchanged, including status metadata productVersion 0.1.0-alpha.4 and apiScaffoldVersion 0.0.1; the current web is alpha.8.

The 59 web tests replace WeatherScene at its documented public-API boundary and use bounded host/DOM/layout models. They exercise input ownership, pause/resume/lifecycle, weather/time control and card layout/projection continuity. They do not run a real WebGL renderer or prove real CSS pixels and physical-device behavior.

Generated local evidence stays ignored. Do not upload screenshots/logs containing personal UI, raw messages or absolute environment paths to public Actions artifacts or releases by default.

## Separate current-candidate acceptance

Still required:

- Actual scene loading, shader/WebGL errors, six weather modes and day/night behavior
- Native touch scrolling, interrupted gestures and overlay/canvas input arbitration
- Actual native feed density, long Chinese rendering, reader/history/focus and same-node identity
- Source-to-lifted and airborne-to-reparented card continuity, scrolled close, reopen and resize during return
- Menu reversal/intermediate frames; chat/Send retention, native keyboard and IME
- Reduced motion, hidden/background/BFCache restoration, repeated and interrupted flows, loading/context failures
- Desktop, mobile, short viewport and landscape observations
- Measured frame timing/GPU performance and final visual/user signoff

Actual GPU/mobile acceptance remains incomplete. Synthetic frame.dt and module diagnostics are not measured display FPS. Upstream asynchronous asset/disposal/remount limitations remain documented in [motion-ball integration](MOTION_BALL_INTEGRATION.md); passing host mocks does not resolve them.

## Historical evidence

Earlier public alpha.3/alpha.4 imports retained portable integration/menu/weather suites, byte-pinned negative controls and documented popstate/concurrency harness repairs. Their inventories, tests and vendor reconstruction remain scoped to those historical commits.

The current source retires the old renderer. Historical mixed full-page and old-renderer suites are not part of the 59 current web tests and are not represented as current-page passes. Preserve historical provenance and relevant negative controls when deliberately adapting a future suite; do not remove controls to obtain a pass.

The original private release validator/evidence registry is not included. Public acceptance requires newly collected sanitized evidence for the exact current candidate; excluded private records cannot serve as public proof.

## Tool version basis

.nvmrc retains Node 24.19.0. It identifies the pinned test environment, not a claim that it is the latest available Node release. CI retains official actions pinned to verified source commits and has no browser-install or deployment step.
