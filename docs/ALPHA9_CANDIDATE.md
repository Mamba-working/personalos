# Alpha.9 reader r4 candidate

This explicit unpublished, acceptance-pending successor binds the frozen r4 endpoint correction. It is not a stable release, deployment, or browser/device approval.

## Reviewed implementation boundary

Public alpha.8 source ba67a75a2d7bc8b29041bec06ce38cef41a25939 (tree cdfa952c2283b22028e85142cbe169d28bf5ee7b) is the predecessor. The reviewed local r4 delta fc1e7d9b00540fcd8a77fed66b645578a580c767 changes exactly app.js, card-projection.js and card-projection.css, plus two regression files. Its local history is not represented as public Git ancestry. A separately pinned input-delta manifest authenticates those five files before the current candidate metadata is bound.

Runtime adds only those three implementation changes, release-meta.json, and the index.html title label changed from r3 to r4. The title-only delta is checked against authenticated alpha.8 HTML; document title, metadata revision and product version must match independent exact pins. Every other runtime byte remains equal to alpha.8, including weather, renderer/shadow ownership, chat/history, all other HTML bytes, assets and licenses. Product-version surfaces consistently declare alpha.9. Runtime behavior and final typography decisions belong to the reviewed r4 implementation; the release tooling does not change them.

## Historical and active checks

The complete original 348-path alpha.8 source is independently authenticated with exact changed-file snapshots. Original alpha.8 manifests, validator, negative tests, contract/static identities and its entire original npm test aggregate execute unchanged from that reconstructed source. That aggregate continues to execute the original alpha.7/alpha.6 checks and all original r3 behavioral suites. Historical test dependencies use the same unchanged lockfile and are mounted only into a disposable test copy, not the cached source oracle.

Current historical-only helpers explicitly follow alpha.9 → alpha.8 → alpha.7. Active behavioral suites still consume active r4 sources. No broad version fallback, test skip pattern or workflow bypass is used. Current contract/static HTTP assertions use the independent alpha.9 pin, and real HTTP responses must retain exact backend capability limitations.

The independently pinned alpha.9 manifest binds all current runtime, product-version and supporting-source bytes. Separate exact source-path and Git-blob gates reject extras, omissions, non-regular files, unrelated changes, and committed/worktree drift. Negative tests reject re-signed inventories, broadened delta scope, older-source corruption, false acceptance/deployment claims and malformed payloads. Original frozen histories cannot be regenerated to accept the current runtime.

## Normal verification and limits

Use Node 24.19.0; run npm ci, npm run setup, commit the reviewed source, then npm run check and npm test. The normal payload gate requires the checked-out commit to match the candidate files. The normal web aggregate runs every test without exclusions.

Source/JSDOM endpoint comparisons and mutation tests do not establish rendered visual continuity, physical iPhone/Safari, native touch/keyboard/IME, measured performance or final user signoff. Browser acceptance and deployed parity remain unverified. No publishing, merge, tag or deployment is implied by this candidate envelope.
