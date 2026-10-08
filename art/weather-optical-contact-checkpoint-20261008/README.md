# Weather optical/contact checkpoint, 2026-10-08

This source-only checkpoint follows the historical `../weather-hybrid-v7/`
handoff without replacing it. It changes no frontend, backend, product version,
CI configuration or Site deployment. It is an offline art pipeline, not a
runtime implementation.

## Selection and revision status

The retained master is a **pre-revision controlled checkpoint**, not final
user-approved artwork. The user rejected its too-round canopy and bent lower
shaft on 2026-10-08, and requested clearer accumulated/coalesced/dripping water.
New eight-gore tensioned/scalloped canopy and straight coaxial shaft work remains
separate and requires a new clay review. No pending geometry or wetness revision
is included or promoted here.

The original Ball identity/body, navy eye finish, closed 0.20 mm PVC optical
model, and corrected calibrated contact/receiver remain the controlled baseline.
The navy eye delta uses linear RGB (0.026, 0.038, 0.058), roughness 0.38 and
Specular IOR Level 0.50; IOR stays 1.5. This master received a native padded
Ball/eye crop only. Its full camera frame has **not** been rendered. The v21
predecessor was the last full-frame-rendered source. See CHECKPOINT-MANIFEST.json.

## Required external inputs

Supply these exact owner-held files; neither is included or publicly downloadable
through this repository:

- Packed master: `assets/master.blend`, 112,486,837 bytes, SHA-256
  `f887b703ac88d7b6728ac36b3a5f4e4f81a75c2e5d7604ef147260e62521287b`
- Top-down float32 linear RGB plate: `assets/plate-scene-linear.npy`,
  18,874,496 bytes, SHA-256
  `1039d1f48c5ac373e1da1c4ba199ddeb333c83afba64f4aecce3c59a7f1aa1c7`

The master supplies scene geometry, materials, camera, shared lighting field,
packed textures and compositor. These scripts do not rebuild that scene from
scratch. A public reader can inspect/validate the source, but cannot reproduce
the artwork without the externally supplied master and calibrated plate.

Use Blender 4.3.2 and the official OIDN 2.5.1 Linux x86-64 package. The OIDN
executable identity is pinned in the manifest; its dependent libraries and
vendor notices must accompany the separately installed package.

## Source checks and execution boundary

From this directory:

    python3 tools/reproduce.py verify
    python3 tools/reproduce.py pipeline --master assets/master.blend --plate assets/plate-scene-linear.npy --oidn .dependencies/oidnDenoise

The second command only prints a four-stage plan. No tool is installed or
executed unless `--execute` is appended. `--blender`, `--work-dir` and
`--lock-file` select explicit tool/output/shared-lock paths. Output must be a
child of this kit's ignored `output/` directory; render requires a fresh empty
directory. No stage overwrites its prior results. Use the established shared
render lock when sharing a machine with other work; the default coordinates
this kit only.

1. `src/render_full.py`: externally supplied master; Cycles CPU, frame 49,
   1536×1024, 128 fixed samples, seed 0, no adaptive sampling, render denoise,
   border or DOF. Export hero/catcher and genuine albedo/normal guides. Source
   changes remain in memory and are not saved back to the master
2. `src/process_hybrid.py export`: linear float32 PFM/NumPy pass export;
   actual hero guides are mandatory
3. `src/denoise_hybrid.py`: OIDN HDR/high on the CG hero with actual albedo and
   normal guides, color-only catcher; preserve original hero coverage alpha
4. `src/process_hybrid.py display`: scene-linear premultiplied composite,
   `hero_rgb + (1 - hero_alpha) * plate_rgb * catcher_rgb`, then AgX / Medium
   High Contrast / exposure 0 / gamma 1 once. The static plate is never denoised

The adapted modules remove historical label allowlists and workspace-relative
inputs. Their original/adapted SHA-256 mapping is recorded. The retained Linux
process-group guard limits each stage to 4,096 MiB RSS, 2,048 MiB host memory
headroom, two worker threads, and a bounded deadline of at most 600 seconds.
No system security/resource setting is changed. The guard can stop a slow
render; completion is not guaranteed within that resource envelope.

## Visual and validation limits

The environment and near-ground appearance are a fixed AI-generated SDR plate.
The hero, umbrella, attached water and receiver interaction are CG. The packed
shared field is authored SDR-derived lighting, not recovered/measured HDR.
The clean checkpoint omits airborne rain and UI. Arbitrary-camera parallax,
fully reactive visible terrain, real-time performance and complete art approval
are unestablished.

Canonical authored scale is 1 AU = 15/88 m. Saved Blender unit scale remains 1.0;
do not treat that UI value as a physical conversion or rescale this checkpoint.
The plate is inverse-display calibrated, not a lossless inverse or recovered
HDR; recorded mean/max RGB round-trip errors are about 0.000956 / 0.086993.

This sync performed source AST, hash, inventory, privacy and command-planning
checks only. The adapted pipeline was **not executed**, and no new Blender
launch, full-frame render or product test is claimed. Input hashes do not prove
an output or cross-machine bit-identical rendering.

## Rights and exclusions

The existing source-only LICENSE and component notices in
`../weather-hybrid-v7/` remain applicable. Emotion Ball/aora-bot visuals permit
only non-commercial personal technical study/research; publishing source does
not expand those rights. TextureCan Ground0020/Others0004 maps are separately
CC0; that grant does not cover the assembled scene or generated plate.
OIDN is an external Apache-2.0 tool and Blender has its own GPL terms.
No blanket license is granted to first-party code/art by this checkpoint.

No master, plate, texture, render, private QA/report, upload metadata, artifact
identifier, restricted reference media, binary, cache or ancestor scene builder
is included. No merge or deployment occurred.
