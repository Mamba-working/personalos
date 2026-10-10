# Alpha.8 candidate release envelope

This is a new, unpublished source candidate, not a stable release or product promotion. The Motion-inspired reader r3 implementation comes from public source commit 649023a02beefc1d94ca43e191602da64a75abd4. Only release metadata differs within the runtime. Every JavaScript, CSS, HTML, license and asset byte remains identical to that source. Weather, renderer/shadow and chat ownership remain frozen, including the exact previously reviewed chat-history handoff hook.

## Independent gates

- The full 310-path alpha.7 source inventory is SHA-256 pinned independently. Original changed files are stored in an explicit historical snapshot; unchanged files are checked against their original hashes. The historical root contains precisely those 310 paths plus the four verified generated Three.js files. Original alpha.6/alpha.7 provenance, contract and static HTTP assertion files execute unchanged against this real reconstructed baseline. Active contract and static HTTP tests compare the served identity with the independently pinned alpha.8 release constant, not another reading of their own mutable output; a cross-endpoint regression verifies both real HTTP responses and unchanged backend capability disclosures.
- The active alpha.8 envelope is separately hash-pinned, including all 73 runtime files, every product-version surface, input lineage and deferred acceptance gates. Its seven-path delta from alpha.7 must exactly match the original reader r3 overlay. Its metadata-only delta from reader r3 is explicit.
- The alpha.8 public-source path list is independent and exact. Unknown, missing or symlinked source is rejected. Source bytes needed by historical guards cannot drift. Reader r3 regression files and license notices retain their original hashes.
- The regular web aggregate executes every test without a skip pattern. The two older direct byte assertions read explicit alpha.7 inputs; all behavioral tests still import active runtime. Existing alpha.6/world-layer resolvers follow the explicit alpha.8-to-alpha.7 lineage. The new independent runtime gate covers every current byte, so archival assertions do not substitute for successor coverage.
- Negative tests change/remove/add runtime, alter version metadata and claims, broaden or re-sign manifests, corrupt baseline snapshots, change source paths and tamper with the chat hook. Each must fail. The Git payload check compares the active runtime and product-version files against the current checked-out commit; the input-source commit is never mislabeled as this new payload.

## Normal verification

Run npm ci, npm run setup, npm run check and npm test with Node 24.19.0. Commit the reviewed source before running check, since the payload gate checks current HEAD. The old test-card-reader-candidate entry point now delegates to npm test with no exclusions. CI uses the same commands; no continue-on-error or workflow bypass is added.

The immutable card-reader-candidate.json remains the r3 input record. It is not rewritten to pretend the new metadata had already shipped. Future candidates must add explicit versioned inputs and independent pins rather than regenerating old manifests.

## Acceptance boundary

Source/DOM tests do not establish rendered motion, physical iPhone/Safari behavior, native keyboard/IME, performance or user signoff. Those acceptance gates stay deferred. This change does not deploy, tag, merge or promote the candidate.
