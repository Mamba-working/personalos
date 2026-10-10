# Historical extraction notes: public-source boundary

The notes below describe the original private extraction, not files available in this public experiment. Raw .blend/.f32/.bin inputs, extraction/conversion scripts and process logs named below are intentionally omitted. The optional half-float loader is retained as source provenance only; its half-float data is absent and this runtime uses the pinned RGBA8 PNG. Historical numeric/loader reports are not rerun by public CI. file-hashes.json records original extraction artifacts, including omitted ones, and does not inventory the current sanitized directory. The sanitized extraction manifest links its original hash; PUBLIC-SOURCE-ALLOWLIST.json covers all current public bytes.

---

# Calibrated canopy wetness maps

Private research conversion of the four explicitly selected self-authored packed images in the a440 source copy. No rendering, downloads, external ground texture extraction, `.blend` save, geometry export, or original-file edits were performed.

## Runtime files

- `canopy-wet-stock-rgba16f.bin`: preferred 1024 × 512 RGBA half-float data, 4 MiB
- `stock-material-manifest.json`: channel semantics, scales, hashes and limitations
- `load-canopy-wet-stock.js`: optional loader for the existing locally vendored Three r180
- `canopy-wet-stock-rgba8.png`: 222 KiB portable fallback with identical channel semantics; lower precision

The same texture supplies stock `MeshPhysicalMaterial.bumpMap` from R and `roughnessMap` from G. There is no shader patch. The helper leaves all other physical-material settings to the caller. Do not combine this bump with a non-null `normalMap`, because the stock Three shader prioritizes the normal map.

Use the exact manifest values for `bumpScale` (0.0006577785534318537 metres) and `roughness` (0.06). The texture already matches glTF's UV orientation: set `flipY=false`, `NoColorSpace`, `channel=0`, repeat wrapping, linear magnification and linear mipmaps. Use a `Uint16Array` of the `.bin` data with `RGBAFormat` and `HalfFloatType`. For the PNG fallback, also set `flipY=false` and `NoColorSpace`; never decode it as sRGB.

Channels:

- R = signed effective physical height normalized by `(heightMetres - heightOffsetMetres) / bumpScaleMetres`
- G = absolute source roughness / 0.06
- B = smootherstep-remapped localized water support; this is not opacity
- A = 1

Effective combined height spans −0.195 to +0.463 mm. Source roughness spans 0.009 to 0.04738. Half-float encoding error is under 0.161 micrometres of height; the original calibrated metre values are retained in `canopy-combined-height-metres-gltf.f32`. The raw four source fields are also retained as unnormalized linear float32 at 1024 × 512.

## UV and source verification

All four selected image nodes use `ConnectedWetField_SurfaceMetric_v1`. Every exported canopy vertex position matches its sampled source position exactly after the original metre/axis conversion, and the existing GLB UVs match the source chart exactly after glTF's V inversion. There are 25,024 exported vertices and 48,768 triangles. No alternate UV sidecar is required. The source's `CanopyWetness_ProjectedXY_v1` chart feeds an older disconnected procedural wrinkle branch, not these four maps.

The source `.blend` SHA256 is `a440dc770b88e8f692efb328856856498af8ace84d5457672f635b30c0a16cb2`. Its hash and the input GLB's hash were verified before and after extraction and conversion. Exact packed-image hashes, extracted scalar-field hashes, full material node/link semantics and every output hash are in the manifests.

## Faithfulness and limitations

The source's metre height scale, signed folds, calibrated bead mapping and linear roughness are retained. The stock single bump approximates two chained Blender bump operations. It includes the original 0.95 water strength and 0.65 × (1 − `ActualCurvatureSupport`) fold attenuation, using that attribute sampled from the source geometry. Multiplying fold height by the attenuation field adds an attenuation-gradient contribution absent from Blender's normal-strength blend. Reducing each source field by an explicit 2 × 2 area mean before nonlinear remapping also filters subpixel beads. These are documented approximations, not an exact Cycles/Three optical match.

No geometry or silhouette is displaced. The layered inner PVC shell, original Blender glass shader and color-management appearance are outside this extraction. Use the source-derived maps with the candidate's existing coherent environment lighting, and verify the visible result in that candidate.

## Reproducibility and checks

The extraction ran once in installed Blender 4.3.2 with scripts disabled. Its process-group guard capped RSS at 4 GiB, required at least 2 GiB host headroom and imposed a 120-second timeout. It finished in 9.95 seconds at about 1.45 GiB peak RSS. Conversion ran in 1.21 seconds at about 294 MiB RSS. Both remained above the memory headroom floor.

`extract_wet_maps_once.py` and `prepare_stock_material_maps.py` refuse to overwrite their principal asset outputs. All output is isolated to this directory. `validate_stock_assets.py` checks hashes, size, finiteness, exact UV compatibility, orientation and numeric encoding error. `test-loader.mjs` checks stock Three r180 texture/material binding and disposal without a browser or rendering. `numeric-validation.json` and `loader-validation.json` record the results. Visual/GPU validation is intentionally left to the sibling integration candidate.
