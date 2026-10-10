# Alpha.10 reader r5 candidate

This unpublished candidate binds the reviewed surface-continuity delta 0acb3673c33c9b19f4292fbbcb89e2b1501ee67a onto the exact alpha.9/r4 candidate a6f7af9ea8bf8ec52e71e424c2d503ee2d8affbd. These are local review/source identities, not public Git ancestry. The tree-equivalent public alpha.9 source is df50a8cfd450d96bb9850c9f775647ec07230304. An authorized r5 source publication must create an ordinary child of that public commit, rather than publishing the local review ancestry.

## Exact scope

The frozen implementation changes app.js and material.css and adds reader-surface-continuity.test.mjs. The release envelope changes only product-version metadata and the document revision title. The r4 projection JavaScript/CSS, reader body/text, other runtime files and license notices remain unchanged. The alpha.9 source is independently authenticated by a complete 375-path inventory and exact changed-file snapshots; all earlier historical inventories remain intact.

Current checks independently assert alpha.10, split-card-reader-r5 and the r5 HTML title. Runtime path sets, exact allowed changes, all source blobs and frozen input hashes are bound. Compact negative checks reject modified/extra runtime paths even after inventory re-signing, stale identities, changed predecessor bytes, and unauthorized source files. The original historical aggregate executes its unchanged assertions; the current full web aggregate includes all six new surface regressions. No test filter or workflow bypass is used.

Run npm ci, npm run setup, commit the reviewed candidate, npm run check, and npm test. Passing these checks does not establish rendered browser continuity, physical-device behavior, performance or final user acceptance. Browser acceptance and deployed byte parity remain unverified in the frozen release metadata. Previous preview routes are independent and unchanged.
