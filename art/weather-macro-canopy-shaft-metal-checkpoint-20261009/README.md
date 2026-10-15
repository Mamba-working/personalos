# Macro canopy, shaft and metal source checkpoint

This additive checkpoint retains the selected static partial art correction and its exact historical construction sources. The retained image is still unaccepted for whole-artwork/reference parity. The wet roof remains pebbly instead of the reference's connected film contours; the lit-side metal rolloff remains brighter/sharper. This is not runtime integration, browser/device validation, Web performance work, or a physically complete lighting solution.

## Selected source and intentional approximation

The latest selected owner-held packed master is PersonalOS-soft-reflection-scrim-candidate.blend, 210,031,083 bytes, SHA-256 92916e52cb240c30a239327462b067053cce1d6bc2a3c43b9ad5a151fbbb67ab. It is omitted from Git, with no public download URL. Earlier selected or rejected masters are different inputs.

Retained authorship includes one continuous membrane-relief field, a single half-scale spatial/displacement refinement with retained normalization, a 0.20 mm paired PVC wall, water seating, visible straight shaft, coaxial satin sleeves and matte ferrule. Relief is authored membrane/wet-film-like geometry, not fluid or membrane-stress simulation. The selected World and finite positive lower bounce card remain unchanged at the last metal correction.

One world-fixed curved 80% negative-fill scrim supplies the final reflected-metal visibility correction. It is explicitly nonphysical: glossy-visible, invisible to camera, transmission, diffuse, shadow and volume rays. Its uniform peak density and feathered arc are an intentional visibility approximation. It is not a shaft texture, target-image projection, emissive outline or per-object gain. This disclosure is retained in the exact builder source. The positive lower bounce card is also intentionally camera-invisible while its other ray types are shared. These choices do not establish physically complete scene lighting.

## Bounded exact-master crop replay

Supply the exact master as assets/master.blend or WEATHER_MASTER, and the exact already-resampled linear crop plate as assets/plate-crop.npy or WEATHER_PLATE. The latter is 1,278,128 bytes, float32 [300,355,3], SHA-256 06658ced2144d6afb80f7a05cbb6c8cbb24196dbf0e6968577aae3d6709d4899. It is the bottom-up [195:495,470:825] slice of the retained 900x600 scene-linear plate resample, corresponding to top-left full-frame bounds [470,105,825,405]. The external crop is byte-checked; no approximate replacement or silent resample is accepted. The original 1536x1024 signed linear plate and its processing lineage are separately identified in DEPENDENCIES.json. Do not clamp finite signed plate samples.

Use existing official Blender 4.3.2 with its matching OCIO/LUT assets, host NumPy 2.3.5 and OIDN 2.5.1. Set BLENDER_BIN and WEATHER_OIDN to the exact recorded existing executables if needed. Executable hash gates do not validate the full OCIO/LUT inventory or dynamically loaded OIDN libraries; matching original distributions remain owner-supplied requirements. Nothing is installed or downloaded by these scripts.

From this checkpoint directory:

    python tools/check_sources.py
    python tools/reproduce.py

The first command performs source/hash/helper/synthetic PFM-composite/input-output safety checks. The second prints a plan without running Blender/OIDN. Intentional replay with all exact external inputs available uses:

    python tools/reproduce.py --execute

The replay produces only one 355x300 crop at frame49 and native 900x600 coordinates, 512 samples, seed0, no DOF/adaptive sampling/in-render denoise. Raw, color-only OIDN and same-buffer albedo/normal-guided variants preserve the original hero alpha. Compositing remains scene-linear premultiplied hero + (1-alpha)*plate*catcher, then one AgX Medium High Contrast display transform. No full-frame replay entrypoint is supplied.

Outputs default to ignored output/ or an explicit WEATHER_WORK_DIR outside this checkpoint. A fresh directory is required. The Linux flock/process-group guard permits two CPU workers, 4 GiB RSS, at least 2 GiB host headroom, 900 seconds for this crop and 180 seconds per processing stage. No OS/security settings change. These offline limits are not product/browser/mobile performance budgets. Input hashes are rechecked after execution.

## Historical source lineage

src/recipes/weather-macro-art-correction-20261009-0448 contains 18 byte-identical retained sources. The macro geometry/light foundation is followed by structured-cloud authoring, continuous relief/contact correction, straight-shaft/positive-card selection, half-scale roof/contact audit and mesh-only merge, satin sleeves/ferrule, analytical wide-flag placement and the selected soft reflection scrim. Historical placement analysis uses owner-held cached ray/geometry reports. The selected scrim starts from the satin-shaft stage, before the rejected opaque rectangular flag; that rejected flag is not the selected result.

Historical recipes require the owner-held masters, arrays and generated reports identified in DEPENDENCIES.json. Copy them to a separate owner-managed recipe tree with the original relative layout if intentionally rebuilding. No private QA contents are distributed, and no clean single-command/from-scratch historical reconstruction is claimed. Exact hashing of an old saved master is not a guarantee that another machine will save identical Blender bytes.

SOURCE-COPY-MAPPING.json identifies original/public hashes and every limited replay adaptation. Geometry, material, scrim, guard and OIDN source are unchanged. The portable renderer pins the selected master identity; the portable postprocessor only selects isolated output and the exact external crop plate. Math and crop choices are retained. Inherited notices and all earlier repository blobs are preserved.

## Verification and rights

The selected native crop was rendered and reviewed in the owner-held art work; raw/color/guided views agree on the remaining visual issues. This source sync runs no Blender, OIDN or new render. The new public adapters receive source/hash/synthetic-helper/planning/privacy checks only and have not been executed on real scene inputs. Repository CI is tracked separately for the exact commit; it does not execute Blender/OIDN or establish art/runtime/visual acceptance. Cross-machine bit-identical rendering is not promised.

No packed masters, donor textures, images, video, arrays, raw passes, proof packages, restricted reference, private QA contents, private identifiers or signed URLs are published. Existing frontend/backend, product versions, notices, CI and earlier checkpoints remain unchanged. No merge or deployment is performed.

Emotion Ball/aora visuals remain non-commercial personal technical study/research. CC0 applies only to identified TextureCan/Poly Haven assets; existing licenses do not license the whole scene or grant commercial character clearance. Read LICENSE, THIRD_PARTY_NOTICES.md and ../weather-hybrid-v7/notices/ before reuse.
