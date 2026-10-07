# Alpha.7 visible-weather time candidate

Status: local, unpublished, final acceptance pending. Base: exact accepted alpha.6 source b4fe3cc3b1e663bec4930a20bf7b7cdb5bc59326. This is a temporal-correctness-only successor. Existing alpha.6 weather art and renderer-owned shadow-cache service are unchanged. Cinematic rain-v6 and Next.js are not included.

## Runtime scope

Exactly three runtime files change: modules/weather.js, world/scene.js and release-meta.json. The implementation files match the separately observed elapsed-time candidate byte-for-byte. Product version surfaces move to 0.1.0-alpha.7; backend scaffold package versions remain 0.0.1.

The world retains its bounded first effect argument for legacy consumers and adds explicit active-visible elapsed metadata. Weather's new opt-in consumer evaluates climate response and rain/wind phase integrals analytically, including the bounded auto-sun ramp. It does not push large Euler steps through a spring, replay missed frames or create another clock. Native setting/resume epochs clip the first interval to actual input time; phases are not reset or rescaled. Legacy consumers without metadata retain their exact capped behavior.

Hidden/idle time is excluded by the existing world clock. Quiet, disabled, paused and reduced policies remain; pause/reduced retains the existing static-target policy. The same actor, canvas, face, material endpoint recipes, rain geometry, shaders and resource budget remain.

## Historical and successor proof

The alpha.6 active inventory and required runtime/version preimages are preserved verbatim and independently hash-pinned. Historical alpha.6 provenance tests execute their unchanged assertions and negative controls against a fully reconstructed pinned alpha.6 input tree. Earlier CSS-only and weather byte-equality checks use explicit historical source reads. Current alpha.7 elapsed behavior, same-actor scene integration, call ordering and legacy compatibility remain tested against actual active runtime.

A separate alpha.7 boundary checks eight exact weather hunks, one exact scene hunk, the reviewed metadata hash and the union-of-paths runtime delta. The shadow-cache service retains its exact approved hash. Independent negative tests reject modified, missing, added and symlinked files; altered historical inputs/hunks; broadened allowlists; version drift; and unearned release claims, including after the mutable candidate inventory is re-signed.

The normal web runner includes all 19 elapsed tests alongside every historical suite. A separate exact public-source path allowlist rejects unexpected source additions; the existing credential/private-path scan remains a heuristic, not a complete security audit.

As before, the local payload commit precedes the mapping commit to avoid self-reference. Run node scripts/check-provenance.mjs --verify-source-commit to compare every tracked runtime/version file to the actual local Git object. A local payload commit is not a public commit or a deployment. Source-only or shallow public checkouts explicitly skip unavailable Git-object assertions, while exact portable inventory/hunk/source-scope gates remain mandatory. Local pre-publication verification requires both actual payload objects.

## Bounded browser evidence and limits

The source-identical implementation passed an independent native cloud-browser observation: original alpha.6 versus elapsed candidate, matched nominal clear/rain transition windows, native retarget/pause/quiet controls, one actor/canvas/scene and unchanged settled-shadow ownership. Captured climate and phase followed independent analytic equations. Representative actual frames were inspected; rain stayed visible and returned to the same clear endpoint.

This prior observation used sandboxed Chromium 141, installed Playwright 1.56.1 default headless shell and SwiftShader. It is not physical-device FPS, general performance or final visual-motion acceptance. Hidden resume used a diagnostic visibility override, not actual OS backgrounding. Raw evidence remains private; the public observation record contains only source relationships, environment limits and evidence hashes. It does not relabel the earlier run as fresh final-alpha.7 browser evidence.

Before publication, run a small exact-final-runtime metadata/boot/native interaction smoke. No new optimization matrix or rain redesign is implied. Final user signoff, physical-device keyboard/IME and complete motion acceptance remain separate. Correct elapsed semantics cannot manufacture missing rendered frames; sparse rendering can still strobe.
