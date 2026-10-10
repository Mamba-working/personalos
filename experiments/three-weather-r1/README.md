# Three weather r1: frozen public-source sync

This isolated experiment preserves the exact 26-file Three weather r1 runtime. It is a source/validation sync, not a new rendering revision or a replacement for the main PersonalOS application. Runtime bytes, original Ball geometry and eyes, screen-right umbrella and straight shaft, camera, licenses and attribution are unchanged.

## Run

Requirements: Node 24 and Python 3 standard library. The experiment already contains its approved Three r180/BVH files; it needs no package installation or dependency download.

From this directory:

    sh qa/run-all.sh

From the repository root:

    sh experiments/three-weather-r1/qa/run-all.sh

For a local viewer:

    python3 -m http.server 8765 --directory public

Open http://localhost:8765 in a browser with normal WebGL access. CPU tests do not require a browser. Do not bypass disabled WebGL or other browser security restrictions.

## Exact identity

- Runtime archive SHA-256: `4c5d9a6be87aa9433b11e00c08e79a27f3d38e7d05b627d007e025a1b6fb2734`
- Original candidate source-and-validation archive SHA-256: `ba2eff7c28a9befe400cdf76e0941dfe8cfcb3391a2bd2400a0bd6e8f2b99b19`
- Unchanged 2,221,336-byte GLB: `11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89`
- Sole included 227,080-byte PNG: `0a24cc230df5a22bfd5cf0ff36c4c0ff39eadf688539dee8f384ca2760f5e5fa`

`RUNTIME-ALLOWLIST.json` is unchanged from the frozen candidate. `PUBLIC-SOURCE-ALLOWLIST.json` lists each sanitized public source file, byte length and SHA-256, excluding only itself and ignored generated test results. It is a reviewable inventory, not a digital signature. The verifier independently pins the runtime manifest, portable baseline manifest, original 22-record identity projection and exact reproduced runtime ZIP hash.

## Verification and boundaries

The self-contained CPU suite verifies:

- All 26 runtime paths, lengths and hashes; the exact runtime ZIP is reproduced into ignored `qa/results`
- All 22 original source identity anchors, including their unchanged relative names, byte lengths and SHA-256 values; 17 anchors refer to included unchanged runtime files and five use exact original-source fixtures
- Original GLB geometry, camera, two eyes, shaft, screen-right umbrella and native projection anchors
- Real BVH triangle hits and rain → runoff → rim release → ground impact → wave ancestry
- Deterministic state/event and ground-normal bytes across 15/30/60/120 Hz input cadence, reset/pause behavior, bounded pools and 60-second stress
- Nine lifecycle scenarios with DOM/RAF mocks; application light/sky/shadow/PMREM control flow with explicit capture mocks
- The exact non-color PNG format, provenance hash links, public source inventory and heuristic credential/private-path/conversation scans

Public CI verifies included snapshots. It cannot recheck inaccessible original private filesystem locations or rerun the original Blender packed-map extraction, source-mesh/UV correspondence, raw float precision or half-float loader validation. Those historical extraction observations are identified separately in `source/wet-map-provenance`. The raw Blender source, photographs, raw float/half-float fields and QA images are not included. No baseline identity assertion is skipped because a private path is unavailable.

CPU success does not establish WebGL shader compilation, GPU images, optical/refraction quality, device frame rate, mobile performance or AAA visual quality. DOM/RAF/PMREM tests are mocks. The 120 Hz simulation tick is not measured rendering FPS. PMREM can lag the moving sun by almost 0.5 seconds, and stock transmission, transparent ordering, droplet optical thickness and a single bump-map approximation retain the limitations documented in the original candidate report.

Generated timings, logs and test receipts belong in ignored `qa/results` or CI output, not the committed source inventory. The historical documents under `docs/original-candidate` describe the original freeze and should not be mistaken for current publication status or a claim that omitted private extraction tools are available here.

## Public image guard

The proposed repository guard admits exactly `experiments/three-weather-r1/public/assets/canopy-wet-stock-rgba8.png` only when both its byte length and SHA-256 match. Other images, alternate paths, altered bytes and a second PNG remain blocked; all existing content and symlink checks still apply. This is self-authored non-color material data, not a photograph or rendered image. Run `node --test scripts/check-public-export.test.mjs` from the repository root for positive/negative controls.

## Licenses and reuse

All notices under `public/licenses` and `public/vendor/three` are retained byte-for-byte. There is no blanket MIT license for this experiment. In particular, the aora/Emotion Ball visual designs remain restricted to non-commercial personal technical study and research; the engine/data have distinct licensing terms. Public source availability does not remove those restrictions or grant commercial rights. Read the retained LICENSE, NOTICE.md and attribution before reuse.

See `docs/PORTABILITY.md` for the exact sanitization and private-source verification boundary.
