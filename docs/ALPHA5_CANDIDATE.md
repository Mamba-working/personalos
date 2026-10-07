# Local alpha.5 integration candidate

This candidate combines reviewed clock source fef46540fc31fb8bb85b8f987b28348fc6604f11 with the verified four-file V5 weather patch a713d0fc83b01c8fe2353bfed22dc70adda00694fe511a765778f8be48d1e3fb. It is not pushed, tagged, deployed or visually accepted.

The public alpha.4 source reference is 64c36696dcc54ba2fa108437a3be49ac830100ef. Actual local ancestry begins at the explicit clean snapshot 5772029008e613d737ab40fad1667e1dafdb59d0; these are not claimed to be the same Git object or ancestry.

## Reviewed integration

| Before | After | Why |
| --- | --- | --- |
| Clock and V5 had separate changes to world/scene.js | A three-way merge uses the exact alpha.4 base, reviewed clock source and weather payload | Retains RAF timestamps and intent epochs while applying native weather response before the existing render |
| Presentation receives elapsed-visible time | Procedural weather still receives at most 50 ms per delivered update | Stable bounded simulation; no hidden time or catch-up burst is introduced |
| Native face reset precedes effect updates | Same native reset, then optional same-frame weather response | No cumulative weather rotation, replacement face, actor, camera or renderer |
| V5 preview included QA conveniences | Only weather.js, weather.css, the native world hook and note ink are integrated | No preview index, badge, query preset handler or module-mount overwrite |
| Different candidate bytes retained old alpha.4 labels | Product surfaces consistently say alpha.5; original provenance JSON remains untouched | Prevents relabeling historical alpha.4 evidence as acceptance of new bytes |

Three weather files exactly match their payload hashes. The fourth, scene.js, is deliberately a semantic merge. The initial 0fc929f assembly preserved 64 other reviewed-clock files. The reading-assistant revision changes only app.js, host.js and an appended host.css section; 62 other reviewed-clock runtime files remain exact. Relative to alpha.4, the revised composite changes 12 runtime files and retains 57 unchanged files. The inventory remains 69 files.

The original native feed/reader/menu/keyboard/Send and inner chat layout are preserved. Weather retains exactly the alpha.4 model, solar projection and activity policies while changing its visible consumers. The production model default remains cloudy; preview query helpers are absent. API/contracts scaffold package versions remain 0.0.1 and capabilities remain demonstration-only.

## Provenance and evidence

provenance/active-candidate.json records the implementation payload commit, complete current runtime inventory, input identities, explicit semantic integration, and unchanged historical-record hashes. All seven previous provenance JSON files remain exact historical records. A later provenance-only commit records the source payload without a self-reference. Ordinary checks work in shallow CI; a strict local Git mapping check verifies the source payload separately.

Run npm run check, npm test and node scripts/check-provenance.mjs --verify-source-commit against the final frozen candidate. Test outputs belong to that exact candidate. Source/model/CPU/DOM tests cannot establish dynamic GPU appearance, rendered integration continuity, device keyboard/IME, natural performance or final product signoff. All remain deferred; earlier component-only browser successes are context only.

The initial alpha.5 inventory is retained as provenance/candidates/alpha5-0fc929f.json. Its successful behavioral flow did not establish unobstructed mobile reading: the reader overlapped the persistent actor. See READING_ASSISTANT_REVISION.md for the bounded layout correction and its independent evidence requirements.
