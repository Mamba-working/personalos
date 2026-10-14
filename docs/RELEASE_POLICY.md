# Release policy

## Version identifiers

- Product/web version: vX.Y.Z, with alpha/beta/rc suffixes for prereleases
- Current web candidate: v0.1.0-alpha.8; actual GPU/mobile/performance and final unified acceptance are incomplete
- API scaffold/package version is independently truthful: the unchanged scaffold is 0.0.1
- The unchanged API/contracts status metadata retains productVersion 0.1.0-alpha.4; this is not the alpha.8 web identifier
- A hosting snapshot or source digest is deployment provenance, not a semantic product version or acceptance grade

A candidate source branch does not change GitHub main or the default deployment. No merge, release tag, publication of a stable release or deployment follows automatically from passing build/tests.

## Clean public import and history

The public repository began with a sanitized import. Private QA captures, raw conversation feedback and operational details were excluded. Historical source hashes in provenance are references only, not recreated original public ancestry.

Never create an old release tag on an unrelated clean import commit and describe it as the old SHA. A sanitized historical reimport needs a new commit and an explicit import label/mapping.

The earlier alpha.3/alpha.4 inventories, vendor reconstruction and portable source-test adjustments belong to their exact public commits. Alpha.8 intentionally replaces the old renderer and its current runtime inventory; do not silently rewrite an earlier candidate's recorded hashes or call its browser observations fresh alpha.8 evidence. Recovery uses existing Git history rather than served duplicate legacy source.

## Candidate identity and verification

1. Install locked workspace dependencies, run npm run setup and npm run build:web; freeze canonical sources and record the real PUBLIC candidate commit plus current source/runtime inventory
2. Verify the original 84-file motion-ball tree, effective build source and generated 87-file runtime; record registry-only lock adaptation separately
3. Run public-file review and automated source/contracts/HTTP/current-web checks on that exact candidate
4. Collect sanitized current-candidate browser/device/performance observations appropriate to the claim
5. Label failed, blocked, unrun and deferred gates explicitly in release notes and UI
6. Require final user/product acceptance before a stable v0.1.0 claim
7. For an authorized deployment, record route, exact commit, source/runtime digests and observed environment without private paths or account metadata
8. Never reuse historical browser success as current-candidate observation

The 72 current web tests are host/weather/native-card source/state/layout-model checks. They are not real WebGL pixels, native browser layout, physical-device behavior or GPU performance. No old-renderer fallback is included in the current candidate.

## CI and publication

CI uses Node 24 from .nvmrc, installs workspace links with npm ci --ignore-scripts, prepares pinned official motion-ball dependencies, builds the web runtime, checks provenance/syntax/public patterns and runs contracts, API/static HTTP and current web tests. It does not install a browser, deploy or publish releases.

Build/deploy/merge/tag publication must be separately authorized. Use least-privilege CI and approved platform secrets; never commit credentials or private captures. The export-pattern guard is a heuristic, not a complete security audit.

The workflow retains official actions pinned to verified source commits: [actions/checkout](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1), [actions/setup-node](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020).
