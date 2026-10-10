# Public-source portability and test boundary

## Preserved exactly

All runtime files are copied byte-for-byte from the approved 26-file freeze. Its manifest is unchanged. Existing runtime code, vendor files, source GLB, calibrated non-color PNG, export manifest and license notices are not edited.

All 22 records in the original frozen source inventory retain their original `relative`, `bytes` and `sha256` fields. The old location field is remapped to an included immutable file:

- 17 original records map to byte-identical runtime assets, vendor files, notices or collision adapter (including the separate adapter-source record)
- Five changed older files are copied as exact bytes under `qa/fixtures/original-public`: app.js, foreground-rain.js, index.html, style.css and sun-playback.js

Those fixtures exist only for original byte-identity protection. They are not a second runnable application. Their old relative imports need not resolve because the tests hash them instead of executing them.

The canonical JSON projection of all 22 original relative names, byte lengths and SHA-256 values is independently pinned in both the public-source verifier and identity suite. Its digest is `8f464693b2621726f7cd7fce59fe869367ccd1e7e428d5e0ae7e572dd0833ad9`. Missing, substituted or changed anchors fail. The portable manifest also records the original unsanitized manifest's SHA-256 as provenance, without including its private locations.

## Changed only for portability

The behavior assertions in validate-candidate, geometry-static, independent-contracts, lifecycle-contracts, lighting-wiring-contracts and pool-stress are unchanged. Their report destinations now point to ignored qa/results. The identity test additionally resolves each baseline path against this experiment, verifies the same 22 source hashes, adds byte-length and identity-projection assertions, and explicitly reports that private original locations were not rechecked. qa/run-all.sh adds the public inventory/privacy gate and runtime ZIP reproduction. A new package.json makes module mode and Node 24 explicit.

The old packaging script required private absolute inputs and regenerated the freeze. It is deliberately replaced with qa/verify-public-source.py: verification is read-only by default and never rewrites either frozen manifest. The optional reproduction step only writes the original 26 approved runtime entries to ignored qa/results, verifies every ZIP entry, and requires the original archive SHA-256. The historical source ZIP is not claimed to be reproducible from a sanitized subset because excluded private metadata and reports differ by design.

The original candidate README/report are retained under docs/original-candidate as historical records, not updated claims. Historical extraction notes and numeric/loader reports are retained under source/wet-map-provenance and labeled as such. The extraction manifest replaces only the private source and GLB location values with an opaque source identifier and a portable relative path, adding explicit sanitization metadata. Its material constants, source hashes, node/link semantics and prior observations are unchanged.

The stock material manifest's extractionManifestSHA256 and historical file-hashes.json refer to the original pre-sanitization extraction artifacts. They must not be silently rewritten to pretend that sanitization is the original extraction. The sanitized extraction manifest records that original hash, and the public verifier checks this link. Its current public bytes are independently covered by PUBLIC-SOURCE-ALLOWLIST.json.

## Public CPU checks versus private-source checks

Public CI can hash every included runtime and original-baseline snapshot, instantiate the real frozen GLB with vendored Three/BVH, run simulation and geometry contracts, test the application's control flow with stated CPU mocks, verify PNG structure, and reconstruct the exact runtime archive.

Public CI cannot re-open or hash an external original file at its former private location, re-extract packed maps from the omitted Blender source, recompute source-mesh-to-export UV equality, or rerun float/half-float conversion error analysis without those omitted source inputs. Historical successful extraction/numeric reports remain evidence from the original task, not fresh checks. No private-source-only assertion is silently replaced with an always-pass result.

The unchanged GLB byte hash protects the approved geometry/camera/identity against public-source drift; CPU projection assertions provide an additional concrete check. Neither is a rendered pixel or optical acceptance test. A normal authorized WebGL browser remains necessary for visual acceptance.

## Repository integration

Only a new experiment directory, a new candidate-specific CPU workflow, a minimal reviewed root public-export guard change and its negative tests are proposed. The existing CI workflow, main application, vendor reconstruction workflow and original root provenance inventory remain unchanged. Existing checkout/setup-node action commit pins are reused from the verified repository main. No deploy, merge, replacement runtime, new dependency or package install is part of this overlay.

## Archive serializer/compressor boundary

The exact archive was reproduced locally with Python 3.12.14 and zlib build/runtime 1.3.2. Reproduction uses Python zipfile, the frozen ordered entry names, DOS timestamp 2026-10-10 00:00:00, deflate, and regular-file mode 0644, matching the original packaging script. ZIP serialization and deflate output may vary with Python/zlib versions even when every runtime entry is identical. The gate verifies all 26 entry contents before checking the whole-archive digest, reports the Python/zlib versions, and labels an archive-only mismatch explicitly. CI retains this strict archive assertion; an Ubuntu runner mismatch needs investigation and must not be mislabeled as runtime drift or silently accepted. No GPU or private-source verification is inferred from archive reproduction.
