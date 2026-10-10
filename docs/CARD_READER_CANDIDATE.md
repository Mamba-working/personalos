# Split card reader candidate

Status: isolated r3 alpha mechanism candidate; r1 has bounded live-browser evidence and two observed defects, while r3 browser acceptance remains pending. No production deployment.

## Baseline

- Repository: Mamba-working/personalos
- Source branch: feat/alpha5-weather-clock-reader
- Fixed GitHub commit: 15a5967b775dec5e1224c224a5e36f07ddbbb76b
- 310 tracked blobs were reconstructed and verified against the GitHub tree before edits
- Published alpha.7 DOM/version was observed, but exact byte parity with Site117 commit 995f664cec19a6214aec3a069b90ef3032535788 is unverified

## Scope

The existing content/history host, native masonry, 18 demo records, original article/body/control nodes, chat, menu, assistant shelf, and world/weather sources remain. No engine upgrade or Motion dependency is introduced. The new reader uses a bounded single reading column and a projected hero cover. Shell, preserve-aspect cover and position-only text have separate responsibilities. An inert, ID-free, permanently hidden preview geometry probe measures responsive return positions. Only the original semantic text paints, at final reading width with translation-only motion; there is exactly one visible text identity and one semantic title.

The existing elapsed-time spring is the only clock. Keyboard and reduced-motion intents commit at the next frame without a geometric flight. Live reading text is laid out at final width before the first frame and never scales. Original interactive labs and late-image elements are not cloned. Native reading scroll and fixed controls retain their original regions. One optional chat-open gate prevents a chat history push from canceling an outstanding content Back; all other chat-host bytes remain exact baseline. A size observer updates absolute content height after actual typography/media size changes.

## Route corrections

- Normalize initial and historical categories; a valid item wins a conflicting category
- Restore saved feed offsets when returning from a reader
- Invalidate superseded replacement/filter requests on same-card reversal or explicit cancel
- Identify a requested Back by its parent entry and defer subsequent pushes until traversal completes
- Let chat keep its capture-phase and mobile-page ownership while handing the content route back to the existing owner
- Keep focus within available reader controls, including forms, and restore source/category focus on return

## Design review

| Before | After | Why |
| --- | --- | --- |
| Whole preview identity moves/scales as one rail | Independent shell, cover crop and translation-only semantic text | Reading glyphs do not inherit the shell aspect change |
| Compact preview width determines reader identity | Final reader column committed before animation | Native title and long-body line layout is stable during motion |
| Fixed global historyClose flag | Parent-entry-scoped traversal with deferred route writes | A stale traversal cannot silently strand the next URL |
| Canceled filter/replacement remains queued | New user intent clears older work | Escape and reselect own the final state |
| Chat capture hides content route traversal | Deferred reconciliation through the same content owner | Back/Forward across chat and detail retain route meaning |

## Verification boundaries

Tests in card-projection.test.mjs execute the candidate modules in JSDOM. Layout boxes, rAF and media-query geometry are doubles, so they establish state/ownership/identity invariants rather than real layout, frame rate, CJK rasterization, native touch, iOS/Safari or physical-keyboard behavior. A cloud browser cannot reach this executor's loopback server. Real browser QA therefore remains required on a separate preview before any promotion.

The immutable alpha.7 provenance envelope deliberately does not describe this new overlay. The original root check:provenance and provenance tests consequently reject the changed source. Do not relabel that rejection as a pass or update historical hashes to suppress it. Use the separate candidate manifest/checker for this isolated overlay. A release owner must mint a new candidate/version envelope before any mainline release.

Required browser checks: 360/390 px and desktop, at least 3,000 CJK characters, 200% text size, late fonts/images, native wheel/touch reading, keyboard focus, same-card reversal and rapid A→B→Escape, Back/Forward/deep links including chat, resize, and reduced motion. Observe intermediate frames and the final return, not screenshots of endpoints alone.

For this overlay, run node scripts/test-card-reader-candidate.mjs. It checks the exact candidate inventory before and after the full source/DOM runner, while explicitly excluding four unchanged old release-envelope byte checks. The old npm test/test:web commands still reject these altered runtime bytes; their failures are not relabeled as passes. The overlay checker additionally strips only the exact chat history hook and demands the original chat-host SHA-256.

## r2/r3 fixes after published r1 QA

The exact public r1 at `/experiments/motion-reader-alpha/` exposed a reused-reader offset bug after native scrolling and viewport changes: the next card could settle at303 or474px despite no wheel during that opening. The native scrolling box exists only while `.reading` enables `overflow:auto`; writing scrollTop after removing that class can be ignored under [CSSOM View scrollTop rules](https://drafts.csswg.org/cssom-view/#dom-element-scrolltop). r2 resets before releasing that box, and once after a fresh session acquires it. Resize and same-card retargets retain user scroll. No per-frame resets, wheel handlers, or blanket anchoring disable were added. A no-scrolling-box test double captured three failures against r1 before the fix. This controller model does not replace browser confirmation.

r1 early-frame screenshots also showed different preview/final glyph layouts simultaneously. r3 removes that visual crossfade: the cloned geometry probe stays hidden for its entire lifetime, and only original real text translates. The exact original article/body/control subtree remains unchanged. Four before-fix tests failed on visible preview text; after-fix tests cover forward and reverse progress for Work, Thoughts, long CJK and Labs. Typography changes from preview to reading at selection, and returns to preview style after landing; no glyph scale is interpolated. Live middle-frame judgment remains required.

The immutable r1 package remains separate. r2 scroll ownership is committed independently from the r3 visible-text correction. The r3 manifest records new runtime bytes rather than claiming the old alpha7 provenance envelope passed.
