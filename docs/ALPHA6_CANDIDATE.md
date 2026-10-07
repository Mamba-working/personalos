# Alpha.6 static-shadow-cache candidate

Status: local, unpublished, acceptance pending. Base: published alpha.5 commit 652d79050449e907380d21ae940dadaf7bbad9f7. No cinematic rain-v6 or Next.js sources are included.

## Runtime scope

The exact runtime allowlist is release-meta.json, world/scene.js and new world/shadow-cache.js. Only the latter two contain graphics implementation changes. The renderer, actor, camera, scene, geometry, materials, DPR, 2048-square VSM map, radius and blur sample settings are retained. Product package/contract/version metadata moves to 0.1.0-alpha.6; API and contracts scaffold packages remain 0.0.1.

The native owner checks shadow inputs after actor/story/weather updates and before its existing main render. It requests Three's normal shadow pass for changed inputs and reuses the same map otherwise. Visible VSM receivers are included alongside casters. GPU buffer versions and matrices are compared without scanning vertices. Custom/animated depth paths conservatively refresh. Resize, visible resume and context restoration invalidate; disposal restores the original renderer policy. No shadow clock or weather-side shadow policy writer is added.

## Historical and candidate proof

The previous alpha.5 active manifest is preserved verbatim as provenance/candidates/alpha5-world-layers-652d790.json. Its historical scene and release metadata are pinned snapshots. The old CSS-only world-layer assertion still validates the same hashes. Alpha.6 separately enforces six exact service-hook transformations and the unchanged reviewed cache-service hash. Mutating runtime files, the hook description, a historical snapshot, or the allowlist cannot be excused by re-signing active-candidate metadata.

The payload commit is recorded separately before its mapping commit to avoid self-reference. Run node scripts/check-provenance.mjs --verify-source-commit to verify its Git blobs match all final runtime/version files. Immutable historical provenance records are not rewritten.

## Existing observations and remaining checks

provenance/observations/shadow-cache-source-observation.json records the actual earlier graphics-source identity and hashes of original private evidence. All six baseline/cache native-canvas pairs were pixel-identical at matching camera, actor, shadow participant, time and phase state. The two implementation files in this alpha.6 source are byte-identical to that observed candidate; release metadata is newly versioned. This relationship is source equality, not a newly dated alpha.6 browser result.

A single ordered Chromium 141 / SwiftShader sample showed fewer settled shadow draws and a large cloud frame-cadence change. It is not physical-device FPS, a validated general speedup, or per-pass GPU timing. Prior evidence remains bounded to its original source and environment.

Before publication, a small exact-final-commit browser smoke is recommended: boot/read the alpha.6 release metadata; confirm one actor/camera/canvas; exercise book intro, Skip/replay, reader open/close and rain toggle; check hidden/resume and resize for stale shadows; check context restoration when supported. No new optimization matrix is needed merely for version/provenance changes. Physical-device acceptance and final user signoff remain separate.

## Future ownership boundary

The native renderer alone owns shadow update flags and auxiliary render ordering. Future custom depth shaders need complete depth-input revisions before caching can replace the conservative fallback. Reflection autoUpdate=false does not suppress an existing needsUpdate=true; auxiliary passes must preserve pending main-frame invalidations. The current candidate does not implement a module revision API or merge the unaccepted cinematic weather experiment.
