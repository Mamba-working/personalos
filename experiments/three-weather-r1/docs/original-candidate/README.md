# Three weather candidate · 2026-10-10

An isolated, unpublished Three r180 water-and-light candidate. The original Ball, its existing eyes, screen-right umbrella, straight shaft, camera, and 2,221,336-byte approved GLB are preserved. Nothing in the prior stable preview, Site10, Motionr5, Unreal, or the user's computer is changed.

## What is actually implemented

- Beauty view starts with visible rain and diagnostics off. Near rain, contact micro-splash, moving canopy beads, accumulating hanging drops, and released rim drops use curved 3D geometry and stock MeshPhysicalMaterial. A subtle short exposure trace supplements rain; it is not the only water representation.
- Three-mesh-bvh finds real first hits against the actual Ball, canopy, and ground triangles. A rain hit can generate a surface-following runoff event, actual-rim accumulation, release, ballistic first hit, and a ground wave. Nothing emits ground splashes or rim drops on an independent timer.
- Canopy paths use a gravity-biased mesh-graph shortest path. The routing graph welds duplicated glTF UV seams without editing render geometry: 24,577 unique points and 384 real outer-boundary edges. Rim sampling varies continuously along genuine boundary segments.
- This runoff/coalescence rule is an artistic event-driven approximation, not a fluid/film/surface-tension solver. Point CCD does not account for finite drop radius. Micro-splash lifetimes and capacities are deliberately bounded.
- Existing self-authored canopy crease/wet-height/roughness fields were read from the unchanged source, reduced and calibrated, and mapped with the verified original UVs. A local 227,080-byte non-color PNG drives stock bump and roughness. No photograph, generated replacement art, external ground texture, or source render is used as relit foreground.
- Ground impact events drive a bounded analytic damped-wave normal field on the wet PBR ground. There are no luminous ring meshes in beauty mode. The ground has sky/environment specular response; it does **not** have a mirror image of the Ball or umbrella.
- A deterministic 120 Hz fixed-step clock drives weather. The 12-second accelerated sun updates the directional light and visible Sky together on every rendered frame. PMREM samples that same solar trajectory at a conservative maximum 2 Hz, with exact pause/end refresh. Its temporal/angular lag is explicitly reported rather than claiming continuous exact alignment. Shadows fit the actual caster bounds and their projected ground footprint, rather than an 8 × 8 m blanket frustum.
- Pause/resume, static sun A/B, sun replay, rain off/on, uint32 seed/reset, JSON/PNG snapshot buttons, responsive canvas, diagnostic IDs, pools and real browser frame/CPU instrumentation are wired. No fabricated FPS or GPU measurements appear.

## Run privately

From this directory:

    python3 -m http.server 8765 --directory public

Open http://localhost:8765 in a browser with normal WebGL access. No installation or network package fetch is needed. Do not use software GPU flags or bypass a disabled/denied WebGL environment.

CPU/data validation:

    node --experimental-loader ./qa/three-resolver.mjs ./qa/validate-candidate.mjs
    node --experimental-loader ./qa/three-resolver.mjs ./qa/geometry-static.mjs
    python3 ./qa/package-and-verify.py

`window.sliceDebug` exposes snapshot, pause, play, playSun, setState, setRain, reset, resizeForTest, captureSnapshot, capturePNG, dispose, and bounded deterministic stepping while paused. Snapshot/export buttons are local user-triggered downloads only.

## Verified, not verified

`qa/candidate-validation.json` records actual GLB hits, source hash, complete rim-to-ground-to-ripple ancestry, deterministic reset and 15/30/60/120-Hz input cadence, fixed-step pause and stalled-frame bounds, stock material contracts, normal-map updates/reset, pools/disposal, shadow coverage, native camera projection, and projected drop widths. CPU durations in that report are Node timings, not browser/GPU timings or FPS.

The original 900 × 600 Ball center remains approximately (609.99997, 322.10353); the canopy center remains to its screen right. Projected rain width p90 is approximately 2.28 px; sampled rim drops are approximately 2.12–4.22 px wide. These are geometry projections, **not** evidence that highlights, antialiasing, optical depth, or the water art read well in a rendered image.

**Not verified:** WebGL shader compilation, actual GPU images, shadows/transmission artifacts, browser interaction by rendered pixels, device frame rate, mobile performance, or AAA-game visual quality. The available cloud browser has disabled WebGL. This boundary was respected; no launch flags, GPU fallback, or bypass were attempted.

## Known visual and budget limitations

- Three's stock screen-space transmission does not guarantee nested water/PVC refraction or transparent-to-transparent reflections. Sorting cannot repair that. Material opacity stays 1 when transmission is active.
- r180 optical thickness does not incorporate per-instance scale. Droplet size classes therefore use conservative shared world thicknesses, not physically correct per-instance optical path lengths.
- The canopy is a thin, single-sheet stock transmission approximation. It does not cast an opaque black shadow. Ball and the opaque frame cast the dominant directional shadow. No caustics, transparent shadow transport, multilayer shell optics, SSR, or local-scene planar reflections are implemented.
- The authored wet field is a calibrated single-bump approximation of Blender's chained normal operations. It is not silhouette displacement. The chosen 8-bit pack has a height quantization step around 2.58 µm (maximum quantization error under 1.29 µm); extraction provenance and higher-precision references remain outside the runtime.
- Clearcoat is restrained on the canopy because the source bump perturbs the base normal; no claim is made that it also reproduces a separate wet clearcoat normal field.
- The default lighting policy permits up to 23 intermediate 64px PMREM captures per 12-second uninterrupted replay, plus two cached endpoints and explicit paused-state refreshes. Only one temporary capture stays live. Direct sun and visible sky are current; IBL can lag by almost 0.5 seconds while playing. Exact lag and capture counts are in snapshots. Its **GPU cost is unmeasured**; no performance improvement is claimed. Captures stop at the endpoint. Rain-off plus a static/finished sun stops RAF scheduling.
- Heavy direct rain can saturate the 112-wave field and 96 diagnostic contacts. Dropped/evicted effects are counted; rim-drop waves preferentially retain space. This avoids unbounded allocations. It is not volumetric water conservation.
- Very small rain/micro-drops remain subpixel or roughly one pixel in the original wide camera; a bounded hero fraction provides larger curved drop shapes. No visual quality equivalence is asserted.

## Provenance and packaging

- `SOURCE-FROZEN-SHA256.json` was written before copying or modifying the candidate. It lists the untouched source public tree and collision-adapter source.
- `RUNTIME-ALLOWLIST.json` is an explicit file allowlist with final byte counts and SHA-256. The runtime ZIP contains exactly those paths; it excludes QA, raw floats, source `.blend`, old unused implementations, and reports.
- `SOURCE-REPORT.md` maps the candidate modules and verification to the requirements.
- All original aora research restrictions and Three/three-mesh-bvh license notices are retained. This remains private, noncommercial research.
