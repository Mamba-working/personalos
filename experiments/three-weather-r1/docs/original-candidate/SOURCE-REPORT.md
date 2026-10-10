# Source and validation report

## Changed only inside the new candidate

| File | Responsibility |
| --- | --- |
| `public/weather-clock.js` | Fixed 1/120-second timeline, explicit paused time, bounded 0.25-second catch-up, deterministic 12-second sun |
| `public/weather-model.js` | Fixed-capacity rain / micro-splash / runoff / rim / ripple pools, seeded random lifecycle, causal IDs, first-hit events, bounded journal |
| `public/canopy-drainage.js` | Non-mutating UV-seam weld for topology; 384 genuine boundary edges; gravity-biased graph routes and interpolated mesh surface normals |
| `public/water-renderer.js` | Stock curved physical water instances, restrained secondary trails, optional diagnostics, fixed-tick analytic ground normal map |
| `public/lighting.js` | Shared sun direction and caster/receiver-fitted directional shadow camera |
| `public/wet-material.js` | Local calibrated non-color authored canopy bump / roughness mapping |
| `public/app.js` | Scene lifecycle, direct light/sky and explicitly sampled IBL, UI controls, real browser instrumentation and exports |
| `public/index.html`, `style.css` | Beauty-first private viewer, clear scope and verification status |

The collision adapter is copied unchanged from the existing approved integration. All Three and BVH vendor modules are existing local versions; nothing is installed or downloaded. The GLB is unchanged, SHA-256 `11d01c348cae82681e11e63393e953e535ceaad52e14ab7fea435505e94a6c89`.

## Causal contract

A root rain particle receives a unique lifetime ID. A BVH impact records its actual world point, face index, normal and time. A selected canopy impact owns a runoff path and source-impact ID. Its actual boundary arrival feeds a short-lived geometric rim reservoir, whose release retains source IDs and runoff parents. The rim drop queries the same real colliders. A real ground hit creates a wave event linked to that hit. The renderer cannot independently invent a drip or wave.

The representative 12-second seed `20261010` CPU run has 6,012 rain hits (2,667 canopy, 136 Ball, 3,209 ground), 927 runoff starts, 811 rim releases and 664 complete rim-to-ground-to-wave chains. It uses 318 distinct actual rim vertices. These are deterministic simulation results, not a rendered-quality assessment. The final JSON test report is authoritative if a later bug fix changes counts.

Pool ceilings are 176 rain particles, 112 runoff paths, 192 airborne secondary droplets, 64 hanging rim reservoirs, 112 waves and 96 optional diagnostic contacts. The event journal retains at most 2,048 records. Source event IDs are preserved; the journal can age out older ancestors, so exported recent-event snippets are not an unlimited archive. Full causal ancestry is captured separately by the CPU validation callback.

## Corrected before freeze

Independent CPU review identified and confirmed fixes for:

1. UV seam boundaries being mistaken for physical edges; only the routing graph is now welded
2. A released rim-drop pool slot being reused by micro-splash before the ripple-kind check; immutable impact data now determines the wave
3. Reused micro-droplet provenance retaining an old rim vertex; lifetime-specific fields are cleared
4. Reset leaving stale ground normals; resets/backward ticks regenerate them
5. Display-rate-dependent wave normals; normal updates now subscribe to exact fixed simulation ticks
6. Modulo-only lighting capture missing cadence on low display rates; default now uses current direct sun/sky with at-most-2-Hz IBL, measured lag and exact pause/end refresh
7. Startup-hidden and persisted-page lifecycle gaps; scheduling and pre-ready pause are guarded
8. Static rain-off views needlessly rendering; RAF now rests and wakes explicitly

## Map provenance

`source/wet-map-provenance/` preserves the extraction manifest, calibrated material manifest and separate CPU/numeric validation. The extraction worker verified source SHA `a440dc770b88e8f692efb328856856498af8ace84d5457672f635b30c0a16cb2` and every exported canopy vertex/UV. Runtime texture SHA is `0a24cc230df5a22bfd5cf0ff36c4c0ff39eadf688539dee8f384ca2760f5e5fa`.

The extracted maps are existing self-authored non-color height/support/fold/roughness data. Source image art, external ground imagery, scene renders, and unlicensed replacement assets are absent.

## Acceptance boundary

This is a code/data/causality-tested, GPU-unverified candidate, not a production-ready or AAA-quality claim. No performance value is inferred from the 120-Hz simulation tick. Actual browser RAF intervals, CPU submission durations and resource counts are instrumented; GPU time is `null` unless a real measurement is later added. Default cloud WebGL restrictions were not bypassed.

Next visual acceptance requires an authorized WebGL-capable browser: check wet-glass shape, near-drop highlight readability, canopy bead adherence, variable rim origins, impact size, shadow clarity, transparent ordering, ground normal/reflection response, exposure, pause/reset/resize, and real frame timings. No publication or computer access was performed here.

## Independent final CPU gates

All independent gates pass: deterministic state/provenance and wave-normal bytes at 15/30/60/120-Hz input cadence; real-triangle first-hit ancestry; 384 actual rim edges; 60-second maximum-capacity pool stress; original source/identity hashes; 9/9 lifecycle callback scenarios; and actual application lighting-control execution with call-recording PMREM mocks. The 12-second lighting test records 22–23 intermediate captures, minimum 0.5-second spacing, maximum observed lag 0.492 seconds / approximately 6.29°, exact pause/end refresh, one steady temporary target and two only during replacement.

Run the complete self-contained suite with `sh qa/run-all.sh`. The copied independent assertions are unchanged; only relative paths were adapted to this bundle. Lifecycle DOM/RAF and lighting PMREM calls are explicit CPU mocks, not browser/GPU acceptance.
