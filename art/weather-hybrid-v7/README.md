# Weather hybrid v7: source-only art handoff

This directory preserves the offline, fixed-view v7 art pipeline and material
recipes. It does not change the web runtime, API, product version, deployment,
or acceptance status. The art name `v7` is independent of web alpha versions.

## Required input and reproducibility boundary

The render entrypoint requires the exact **owner-provided packed master scene**:

- Suggested local path: `assets/scene/master.blend`
- Original filename: `hybrid-hero-structured-v7.blend`
- Size: **89,486,282 bytes (85.34 MiB)**
- SHA-256: `3f585ba68ed972b3013eb23fcec7da99ab26671fa68502c10c0ac702432b2555`
- Blender version: **4.3.2**

The master is intentionally not included in Git. There is currently no public
download URL for it. A reader without this scene can inspect and validate the
code but cannot reproduce the render. This is code synchronization, not a
complete public asset release or a from-scratch scene generator.

The saved master contains its active images, geometry, camera, materials, 3D
rain, catchers and compositing setup. The portable extraction stage reads the
packed `plate-scene-linear-verified.exr` pixels and writes the top-down NumPy
array expected by the original display helper. No previous working-directory
tree or earlier `.blend` is needed for this master-based render route.

The optional original environment PNG is also omitted from Git. Its source
identity, dimensions and generation provenance are recorded in
`assets/environment/PROVENANCE.json`. It is needed only for the earlier
inverse-display/source recipes, not for rendering from the packed v7 master.
It is a generated project resource, with no new CC0/MIT grant asserted.

## Validation and entrypoints

From this directory, run a source-only check:

    python3 tools/reproduce.py verify

This parses Python syntax and checks the public allowlist and hashes. It reports
missing external inputs separately and does not render or download anything.

After supplying the exact master and the official OIDN 2.5.1 Linux x86-64
package, the pipeline can be planned without executing it:

    python3 tools/reproduce.py pipeline --master assets/scene/master.blend --oidn .dependencies/oidn-2.5.1.x86_64.linux/bin/oidnDenoise

Append `--execute` to explicitly run that plan. The stages can also be run
individually: `extract`, `render`, `export`, `denoise`, `display`. Supply the same
master, OIDN and work-directory options for each stage. `--blender` chooses the
Blender executable. Output must remain under this kit's ignored `output/` tree;
use a fresh `--work-dir output/<run-name>` for a new render.

The source pipeline is:

1. `tools/run_frozen.py extract`: unpack the existing linear plate, without
   recomputing the inverse display transform
2. `src/render_full_v7.py`: render 900×600, 128 fixed samples, seed 0, no DOF;
   preserve raw hero, catcher, albedo and normal passes
3. `src/process_hybrid.py export full-v7`: export linear float32 PFM/NumPy data
4. `src/denoise_hybrid.py full-v7`: OIDN on the CG hero with albedo/normal guides;
   color-only denoising on the catcher; preserve original hero coverage alpha
5. `src/process_hybrid.py display full-v7`: composite over the untouched plate
   and apply AgX / Medium High Contrast / exposure 0 / gamma 1 once

The four files under `src/` retain their exact original bytes. The wrapper only
redirects the master and OIDN path expressions in memory and supplies an
output-local `__file__`. It does not change samples, materials, lighting,
geometry, camera or compositing calculations. The retained process-group guard
limits each stage to 4,096 MiB, with a bounded deadline and 2,048 MiB host memory
headroom. Stages use two worker threads and a serial lock. If other rendering
work shares the machine, use `--lock-file` to select its established shared
lock; the default lock coordinates this kit only. No system limits are changed.

## Material/source recipes

`recipes/materials/` retains the original clear-wet canopy, thin-sheet and
ceramic patch modules. The remaining `recipes/` files document plate conversion,
v4 hybrid preparation, canopy refinement, structured radiance and saved-source
verification. Their old sibling-directory references were relocated and private
asset identifiers removed; `provenance/SOURCE-COPY-MAPPING.json` records both
original and public hashes.

These are historical recipes, not a supported from-scratch command. They need
the exact earlier packed seed and intermediate scene inputs; several assert
original saved-scene byte hashes. Those binaries are not included, and a fresh
Blender save is not promised to reproduce the old file bytes. Public texture
downloads alone cannot reconstruct the original modeled scene.

## Honest visual boundary

- The visible environment and ground appearance are an AI-generated fixed-view
  plate. Existing distant scenery, ground glints and depth blur remain static
- Ball, umbrella and near rain are genuine 3D; catcher surfaces add current CG
  shadows/reflections. Rain is a static shutter-integrated capsule representation
- The membrane is an effective non-absorbing thin dielectric sheet at IOR 1.38;
  its Solidify modifier is disabled to avoid counting a local interface pair
  twice. The original curved mesh and spatial wall crossings remain
- Shared structured lighting is SDR-derived, art-directed calibration, with
  constructed off-camera sky. It is not recovered or measured HDR
- Arbitrary free-camera movement, fully reactive visible terrain, a multi-shot
  intro, real-time performance and final visual acceptance are not established
- This handoff ran only syntax/hash/path/privacy checks. It did not rerender,
  rebuild the scene, run the full product checks, or establish new art acceptance

See `provenance/DEPENDENCIES.json` for pins, hashes, official origins and limits;
see `THIRD_PARTY_NOTICES.md` and retained component licenses before reuse.
