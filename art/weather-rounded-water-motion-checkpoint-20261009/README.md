# Rounded-water and continuous rim-drip source checkpoint

This additive checkpoint retains reusable source for the native 900 x 600, 512-sample still and a 75-frame / 2.5-second offline water-motion proof. Both original proofs were rendered and visually reviewed. Whole artwork remains unaccepted. This source sync does not merge, deploy or integrate the proof into frontend/backend code.

The motion is one authored, continuously deforming primary connected water form/feeder/pendant with a daughter drop at release. Closed shells split at unchanged boundary coordinates; rounding and gravity happen afterward. It is a tiny 100 x 72 native crop from a 900 x 600 render. The 30 fps number is playback cadence. No fluid simulation, runtime performance, full-scene animation, impact/splash, airborne rain or UI is claimed.

## Exact external inputs required

The packed retained master is 135,298,499 bytes, SHA-256 ea4f3c4833c7f9b1c4c18ac06a19721bf86e84bbc27f2426d64e31ed644c12e7. It is omitted from Git and has no public download URL. Use the exact owner-provided file as assets/master.blend or set WEATHER_MASTER. Older v7/optical-contact master files are not substitutes.

The original scene-linear plate is also external: assets/plate-scene-linear.npy or WEATHER_PLATE. Its hash and the exact native900 resample hash are in DEPENDENCIES.json. The master contains packed resources, but the standalone processing scripts require the separate calibrated plate. Official Blender 4.3.2 and OIDN 2.5.1, matching Blender color configuration/LUTs, host Python packages and external encoding tools are needed. Set WEATHER_OIDN to the exact OIDN executable. No credential, private storage identifier or asset download route is embedded here.

This is not a from-scratch reconstruction or complete public asset release. The original geometry NPZ, master, images/videos, references and private QA are excluded. Water(audit=True) regenerates water arrays from the exact master. Ancestor scene builders and the primary-outlet generator are not bundled. The local mesh helper extraction exposes only the four functions actually needed by continuous motion from the retained master.

## Original proof versus public path adaptation

SOURCE-COPY-MAPPING.json records the original file hashes, exact retained definitions and every adaptation. The Water class, deformation/volume/gravity math and four mesh helpers are unchanged. Render crop/sample/display/composite and encoding recipes are unchanged. Inputs/outputs and helper imports are adapted to explicit external contracts and an isolated output tree. Public adapted scripts were source-checked, but were not rerendered or re-encoded. Original successful proof is not a claim that these adapted paths were executed.

src/run_guarded.py and src/audit_animation.py are byte-identical original files. State audit functions are copied verbatim with locally extracted unchanged RNA serializers. New contract/command wrappers are separately identified. Direct scripts are implementation modules; tools/reproduce.py is the supported command entry point.

## Source checks and command planning

From this checkpoint directory:

    python tools/check_sources.py
    python tools/reproduce.py --pipeline full
    python tools/reproduce.py --pipeline motion

These commands only check/print plans. Host-side source tests need NumPy; the host package versions recorded in the original environment are pinned in requirements.txt. Blender modules are supplied by Blender itself. Planning does not install packages, start rendering or save the master.

For an intentional offline execution with the exact inputs and tools already installed:

    python tools/reproduce.py --pipeline full --execute
    python tools/reproduce.py --pipeline motion --execute

WEATHER_WORK_DIR defaults to this checkpoint's ignored output/ directory. Another output directory must be outside the source checkpoint. Every heavy stage uses the Linux process-group guard, 4 GiB RSS ceiling, 2 GiB available-memory headroom, two workers and bounded deadlines; no OS/security settings change. The motion plan prepares the exact native900 plate without rerendering the full frame, runs geometry/subframe audits, then a pilot, full cropped sequence and actual encoding/decoded-frame checks. Full reproduction requires external data and does not promise bit-identical output on another machine.

## History and rights

../weather-hybrid-v7/ and ../weather-optical-contact-checkpoint-20261008/ are preserved. Their manifests describe their historical stages; this newer checkpoint does not rewrite them.

Emotion Ball visuals remain non-commercial personal technical study/research. CC0 is scoped to identified TextureCan/Poly Haven inputs only. Read LICENSE, THIRD_PARTY_NOTICES.md, DEPENDENCIES.json and retained original component notices. Publishing source does not grant blanket MIT/CC0 or commercial character rights.
