# Release policy

## Version identifiers

- Product version: vX.Y.Z, with alpha/beta/rc suffixes for prereleases
- API scaffold/package version: independently truthful; initially 0.0.1
- A hosting snapshot ID is deployment provenance, not a semantic product version or acceptance grade
- Historical imported web: v0.1.0-alpha.4
- Active implementation: local v0.1.0-alpha.6 static-shadow-cache candidate; unpublished, full unified acceptance pending

## Clean public import

The original development history contained private QA captures and operational details. The public repository begins with a fresh sanitized import commit. Original branches/tags and their exact objects remain in private local recovery, while provenance/releases.json records historical source/runtime pointers.

Never create an old release tag on an unrelated clean import commit and describe it as the old SHA. Original source hashes in provenance are references only. Any future sanitized historical reimport needs a new commit and an explicit import label/mapping.

## Candidate identity and verification

1. Install locked dependencies and reconstruct verified vendor artifacts; freeze source and record the real PUBLIC candidate commit plus current file inventory
2. Run public-file review and automated source/contracts/HTTP checks on that exact commit
3. Collect sanitized current-candidate browser/device/performance observations appropriate to the claim
4. Label deferred gates explicitly in release notes and UI
5. Require final user/product acceptance before a stable v0.1.0 claim
6. Record deployed route, exact commit, source digests and observed environment without private paths/account metadata
7. Never reuse historical browser success as fresh current-candidate observation

The historical provenance guard preserves the frozen alpha.4 records. The active alpha.5 composite has a separate provenance/active-candidate.json; the guard verifies its complete inventory, product-version agreement, deferred gates and the exact unchanged historical record hashes. The alpha.3 inventory and source mapping remain available at its exact public commit, recorded as previousCandidate in the current provenance files. The alpha.4 delta changes only weather.js and release-meta.json in the 69-file runtime; it also imports the portable solar consumer tests and the byte-pinned alpha.3 negative control. Before intentional later web changes, introduce a new explicit candidate inventory/commit mapping in a reviewable change. Do not silently update an old import's recorded source hashes.

## CI and publication

CI checks source/import safety and backend smoke. It neither deploys nor publishes releases. Build/deploy/merge/tag publishing must be separately authorized. Use least-privilege CI and approved hosting/provider credentials stored in platform secrets, never committed.

The initial workflow pins official actions to verified source commits. Reference: [actions/checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1), [actions/setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020)

## Local alpha.5 source mapping

The source payload is committed before its active-candidate mapping to avoid a self-referential commit hash. sourcePayloadCommit identifies the implementation/version bytes; the following provenance-only commit records that mapping. Run node scripts/check-provenance.mjs --verify-source-commit locally to verify mapped Git blobs equal the current runtime/version payload. Normal CI remains portable to shallow clones and enforces the full SHA-256 inventory and historical-record pins. The public alpha.4 commit is a source reference; this local snapshot history is not represented as its ancestry. publicGitCommit/publicGitTag remain null and deployed remains false until separately authorized publication. No historical result grants assembled alpha.5 acceptance.

## Local alpha.6 source mapping

The alpha.6 payload adds only the exact reviewed cache service, six native renderer lifecycle hooks and release metadata to published 652d790. Its source-payload commit precedes the active mapping commit. The previous active alpha.5 manifest and historical scene/metadata bytes are copied without modification into pinned snapshots. The historical CSS-only oracle still checks those old bytes; a separate alpha.6 oracle enforces the exact allowed transformations and rejects unrelated runtime changes even when the active inventory is re-signed. Current candidate results cannot rewrite old observation times or source hashes. Public commit/tag remain null and deployed remains false in candidate metadata.
