# Right-side umbrella and wet-surface source checkpoint

This additive source checkpoint retains the partial right-side umbrella/water correction and the exact-source lineage behind it. The final original 900 x 600 / 512-sample still was actually rendered and reviewed. Whole artwork and reference parity remain unaccepted. The reference is still brighter, wetter and more interconnected; the diagonal envelope, Ball position, shaft-foot impression and separated dark ground reflection/contact remain open visual issues.

The retained look has clustered fine water, localized wet-normal relief, restrained resolved crest/rim accents, short connected forms and six unequal pendant accumulation states with one sparse low-point successor. A shared lateral warm core/halo redistribution preserves integrated warm energy. The final stage changes pendant/successor geometry only. These are authored instantaneous water states, not a completed fluid or continuous-dripping simulation. Original authored airborne density and 1/320-second exposure remain, with fresh radius-aware checks and the inherited bounded pre-contact radius-collapse approximation disclosed.

## Supported final-master replay

The packed final master is 153,559,476 bytes, SHA-256 4a4b2c998e7334b053fedd39a964cc9c629e6467060a56e7241952a13e4911e8. It is owner-held, excluded from Git and has no public download URL. Supply the exact file as assets/master.blend or set WEATHER_MASTER. Older checkpoint masters are different inputs and are not substitutes.

The exact separate scene-linear plate is also external: assets/plate-scene-linear.npy or WEATHER_PLATE, SHA-256 1039d1f48c5ac373e1da1c4ba199ddeb333c83afba64f4aecce3c59a7f1aa1c7. Do not clamp its finite signed samples. The master packs scene resources, but the standalone postprocessor still needs the separate plate. Official existing Blender 4.3.2, matching OCIO/LUT assets and OIDN 2.5.1 are required. Set WEATHER_OIDN to the exact existing OIDN executable; BLENDER_BIN can select the exact existing Blender executable. No software is installed or downloaded.

From this checkpoint directory:

    python tools/check_sources.py
    python tools/reproduce.py

The first command runs AST/hash/helper/PFM/composite/contract checks. The second prints four bounded stages and does not run Blender/OIDN. For an intentional replay with all exact inputs already available:

    python tools/reproduce.py --execute

WEATHER_WORK_DIR defaults to the ignored output/ directory. Other output directories must be outside this checkpoint. Use a fresh output with no render or processing artifacts. The Linux flock/process-group guard allows two CPU workers, a 4 GiB RSS ceiling, 2 GiB available-memory floor and a 2400-second render deadline; no OS/security settings change. The source master and plate hashes are rechecked afterward. These offline guard timings are not runtime/mobile/browser budgets.

Render is frame 49, native 900 x 600, 512 samples, seed 0, no DOF/adaptive sampling/in-render denoise. Actual same-buffer denoising albedo/normal guides are exported. OIDN produces color-only and guided hero variants plus color-only catcher; original hero alpha and plate are retained. Compositing is scene-linear premultiplied hero plus (1-alpha) * plate * catcher, followed by one AgX Medium High Contrast display transform.

## Exact historical construction source

src/recipes/ preserves byte-identical canonical-rain, right-pose, fine-water, shared-opening, wet-readability and final pendant recipes in their original relative layout. SELECTED-POSE.json is an authored numeric control file. The read-only snapshot helper closure is extracted verbatim from its ancestor; material-patch/main code is omitted. No private QA JSON is distributed.

These construction recipes require owner-held precursor masters, donor scene/snapshot, original authored 900 rain records and plate/World/report inputs listed with identities in DEPENDENCIES.json. They document the historical construction and are not a clean single-command or from-scratch reconstruction. If intentionally used, copy source to a separate owner-managed recipe tree and provide those exact inputs there. Do not put binary/private inputs in the tracked source tree. No automated construction entrypoint is offered.

The protected snapshot compares its serialized representation, not exhaustive Blender datablock equality: its mesh hash covers vertex positions and loop indices, not all UVs/custom normals/attributes. Microrelief remains bounded bump; clear UV texel fraction is not area-weighted surface coverage. Tiny water bodies are not boolean-unioned, dimensions are art-direction hypotheses, seating uses a 10-micrometre offset and hem visibility is a lookdev proxy.

The original right-pose builder saved a scene before reopen verification exposed hidden retired-water cache differences. finalize_saved_candidate.py then verified that saved candidate with the corrected local invariant_tools that excludes only hidden evaluated matrix/dimension cache fields; serialized basis/parent/visibility remain guarded. This history is retained honestly rather than advertised as a pristine one-shot build. The supported final replay does not run historical builders.

SOURCE-COPY-MAPPING.json records every original/public hash, exact extraction and adaptation. Render, OIDN orchestration and resource guard are byte-identical originals. The postprocessor only adapts the external plate selector; its export/resampling/decoding/composite/display math is unchanged. New contract/command/check wrappers are separately labeled.

## Verification boundaries and rights

The original final master reopened with protected state intact. The original portable postprocess reused its raw passes and matched raw/color/guided display pixels exactly, without a second full render. Public copies receive source/hash/helper/planning/privacy checks only; the new public wrapper/plate adapter and historical public recipe copies have not been executed. No new heavy render or local full-product test was performed by this source sync. Existing exact-commit repository CI is checked separately and does not execute Blender/OIDN or establish visual/runtime acceptance. Cross-machine bit-identical rendering is not promised.

No packed scene/donor, images/video/arrays/raw passes, proof package, restricted reference, private QA, identifiers or signed URLs are published. Earlier checkpoint blobs, product frontend/backend, versions and CI remain unchanged. No merge or Site/deployment occurs.

Emotion Ball visuals remain non-commercial personal technical study/research. CC0 applies only to identified TextureCan/Poly Haven inputs. Read LICENSE, THIRD_PARTY_NOTICES.md and retained original component notices. Public source publication grants no blanket MIT/CC0 or commercial-character clearance.
