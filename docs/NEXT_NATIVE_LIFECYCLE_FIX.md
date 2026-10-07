# Next native lifecycle correction

This is a bounded correction to the alpha.4-based Next SSR candidate. It is not a full alpha.5 integration, release, deployment, GPU result or visual acceptance.

## Browser failures addressed

The production-browser review found that initial child controller mount replaced the framework's history state before Next 16.4 installed its native-history wrappers. Returning to that initial entry caused Next to reload the document. Original article references and reader offsets were lost. The installed framework documents native `pushState`/`replaceState` integration and reloads popstate entries missing its App Router marker.

The content controller also retained alpha.4's 32 ms elapsed-time cap. At sparse RAF delivery it discarded visible time, stretching the unchanged critically damped spring over many seconds.

## Ownership changes

- Navigation mount and disposal never write history. Initial/deep-link entries keep their opaque framework state and depth; Strict Mode cleanup cannot overwrite it
- Explicit user intent resolves the current native history method, so Next's installed wrapper performs framework integration. The application neither fabricates nor copies framework markers and does not poll for them
- Application-written entries have stable IDs. The same NavigationAuthority remembers the departing entry's position before publishing native Back/Forward changes, without modifying the incoming entry. Close preserves its earlier checkpoint when its optimistic teardown precedes popstate
- The content clock consumes full nonnegative finite visible elapsed time. Visibility suspension cancels pending RAF and excludes the hidden gap. Retargeting starts a new monotonic intent epoch; older callback timestamps and obsolete synchronous completion cannot advance the new intent
- Spring omega remains 17 for progress and 19 for geometry. Settlement cancels RAF and zeros velocity; repeated Close does not restart the return. No world/physics clock, weather, menu or chat module is changed

## Verification boundary

The new deterministic suite preserves the original ten negative regression assertions and adds checks for a framework wrapper installed after mount, independent scroll positions for distinct entries with the same URL, queued interrupted Close and synchronous progress-listener reversal. These are source/controller/JSDOM checks using synthetic geometry and frame timestamps, not actual browser timing or GPU acceptance.

The pre-fix negative run is retained with its original source hashes. A first combined check invoked from the repository root passed the ten new cases but could not execute the existing JSX hydration test because that invocation did not load the web workspace's JSX configuration. Its raw failure is retained; subsequent checks use the documented workspace command.

The corrected-workspace intermediate run passed 23 of 24 cases and reproduced the added interrupted-intent race as two Back calls instead of one. The final queued-intent correction passes that assertion without weakening it.

The completed source aggregate passes on Node 24.19.0 / Next 16.4.0:

- `npm run check`: vendor reconstruction, exact 69-file runtime provenance, syntax and public-export checks
- `npm test`: vendor 5/5, contracts 3/3, API 4/4, static HTTP 3/3 and original web 227/227
- `npm run build:next`: production build, with `/` still dynamic server-rendered on demand
- `npm run typecheck:next`: strict TypeScript check
- `npm run test:next`: 26/26, including the original twelve cases and fourteen native-lifecycle regressions

Heavy validation was serialized. The frozen runtime digest remains `7dc1d4eb903df03745d36b8424041978f6871b414a7b970d5caffed48fa8f41e`. Raw negative, intermediate and final check logs remain local evidence; no browser failure is reclassified as passed by these results.

Production browser revalidation must establish that the same SSR nodes and window survive actual Close/Back/Forward at desktop and mobile widths, reader offsets survive both Close and direct Back, and the existing no-JavaScript, hydration, native scroll, refresh, route, reload and direct-detail checks still hold. Ordinary-motion timing and real GPU/choreography remain separately scoped.

The known mobile corner Ball overlap is not fixed here. The alpha.5 reading-assistant layout, full world-layer integration, book/menu/weather/chat parity and final visual/device acceptance remain follow-up work.
