# Test boundaries

## Automated import checks

npm run check verifies all imported runtime paths and SHA-256 digests, JavaScript syntax and public-file credential/private-path/conversation-reference heuristics. The pattern scan is not a complete secret/security audit.

npm test runs:

- Shared health/demo-content contracts
- Real local HTTP health/status API, missing capabilities/routes, rejected methods and headers
- Real local HTTP static-source serving and repo-file/traversal/method boundaries
- Original web integration plus menu/weather source/DOM regressions through their bounded runner

Run root npm ci followed by npm run setup before checks/tests. The pinned official three@0.180.0 package reconstructs two omitted runtime builds and their two fixture copies with exact SHA-256 checks; npm run setup:tests installs the web test dependency. Its original lockfile pins jsdom 27.0.1. The API and contracts use Node built-ins and add no server framework dependency. Three.js is the pinned browser-build reconstruction dependency.

## Web source verification

The imported runner executes candidate browser modules and preserves accepted-byte references and negative controls. Geometry, observers, frame timing and parts of DOM/GSAP/WAAPI are synthetic. These are source/state/controller checks, not proof of real browser rendering or native device behavior.

Generated local evidence stays ignored. Do not upload screenshots/logs containing personal UI or absolute environment paths to a public Actions artifact or release by default.

## Separate acceptance

Required future observations include actual mixed feed density, long Chinese rendering, menu intermediate frames/reversal, native reader/history/focus, chat/Send retention, weather hit-testing and scrolling, reduced motion and interrupted/repeated flows. Test relevant desktop/mobile/short/landscape states.

GPU/world rendering, physical-device keyboard/IME, measured performance and final visual/user signoff stay separate. No new cloud browser, GPU, iOS/Safari or device pass is established by this repository import.

The original private release validator/evidence registry is not copied. A public release process must use newly collected sanitized current-candidate evidence; it cannot treat excluded private records as public proof.

## Import harness adjustment

The public-copy-only compact-feed history test replaces a fixed 35 ms delay with the actual popstate event and a 2,000 ms timeout. All original state/node/focus/history assertions remain. The original and public test digests and exact transformation are recorded in provenance/source-allowlist.json. No imported runtime file was changed by that initial harness adjustment. The initial load-sensitive failure is not counted as a pass; full verification is rerun after the synchronization repair.

## Tool version basis

Node v24.19.0 and npm 11.9.0 were observed from actual shell version output. Node is pinned to that tested environment version, not asserted to be the latest version. See provenance/tooling-verification.json for official action commit sources.

The public runner also bounds simultaneous test files to four. Every original suite remains, as does the 60-second run ceiling. This avoids resource kills from automatic file fan-out; it is a test-runner scheduling change, not a runtime or acceptance-criteria change.

## Exact generated dependency builds

provenance/vendor-dependencies.json records the four generated destinations, exact npm version/integrity and per-file SHA-256. npm run setup:vendor checks package version and all source bytes before writing, refuses approximate files and changed existing output, and is idempotent. npm run check:vendor verifies the reconstructed outputs. Five installer tests cover exact/idempotent reconstruction, missing package, wrong version, wrong bytes and missing/changed outputs.

## Alpha.4 incremental source gates

The alpha.4 candidate imports the exact frozen weather projection and release metadata, the new solar consumer/transition/policy tests, and a byte-pinned alpha.3 negative control. The source content-history test now also waits for actual popstate; the existing public compact-feed popstate repair and concurrency-four runner are preserved. The public provenance guard and source/HTTP aggregates verify this portable snapshot without copying the private release validator, private evidence registry or operational source-checkpoint verifier. These gates remain source/model/DOM checks and do not establish new browser, GPU, device, performance or user acceptance.
