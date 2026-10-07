# Next candidate source review after alpha.4 synchronization

## Scope

Source synchronization and review only. No deployment, visual promotion, remote branch update, or product working-tree change is included.

The original proof remains at `befed444b44d3c02c2d60affcc1740fa77468254`, retained by local branch `checkpoint/next-ssr-alpha3-befed444`. The candidate was rebased using the real fetched public main `64c36696dcc54ba2fa108437a3be49ac830100ef`. The only rebase conflicts were `apps/web/package.json` and `package-lock.json`: alpha.4 product versions were retained alongside the exact existing Next/React/TypeScript pins. No dependency was upgraded during synchronization.

The complete runtime, solar weather, release metadata, provenance, API, contracts, legacy test files, static-server tests, release policy and testing policy have zero diff from that alpha.4 main.

## Review findings

| Before | After | Why |
| --- | --- | --- |
| Candidate was based on alpha.3 while public main had advanced | Actual rebase onto alpha.4; old proof checkpoint retained | Preserves the public solar/release/provenance changes without presenting them as new Next work |
| HTTP test established article text in HTML, but did not load the production stylesheet | Production CSS is fetched and evaluated with scripts disabled; all 18 bodies are block/static, cards auto-height/overflow-visible, and ancestors are checked for hidden/inert/opacity/clipping | Text inside `display:none` markup would no longer pass this check |
| Article href presence alone | Real HTTP navigation follows the long-Chinese article link and its Close href; target responses contain the selected original article or returned 18-article feed | Exercises the no-JavaScript navigation contract without claiming browser click/paint coverage |
| Reader completion could leave a previously queued animation frame alive | Terminal advance is now idempotent and completion cancels the residual RAF; two negative regressions failed before the patch, retaining the original scroll/focus assertions | The original failure occurred with the test-only manual advance driver. The second negative test toggles the actual bound reduced-motion handler using synthetic JSDOM events; neither is evidence of an observed OS/browser/user failure |
| A changed payload in a React component test could be mistaken for full App Router refresh acceptance | Component-level refresh simulation and actual Next/browser refresh are explicitly separate gates | The latter is still blocked and must not inherit the JSDOM result |
| No-GPU fallback might be confused with a retained world | Zero canvas is only fallback evidence; the GPU gate requires exactly one rendering canvas, one actor and an unchanged UUID | No real-GPU result is available in this environment |

## No-JavaScript evidence and its limits

The production HTTP test loads the exact emitted CSS and does not execute any page script. For each article it checks its full authored body text, computed display/position, article height/overflow, all ancestor visibility/display/opacity/hidden/inert/clip-path states, and the total of 18 distinct article nodes. The selected deep-link article has region semantics before enhancement and is ordered before the feed. The native anchor chain opens and closes it with HTTP GET.

This establishes the intended CSS/source behavior more strongly than HTML string inclusion. It does **not** establish physical text bounds, absence of occlusion, line wrapping, scroll geometry, browser accessibility behavior, LCP/CLS, screenshots or actual painted visibility. JSDOM has no real layout/paint engine. Real-browser inspection remains blocked/not run and must be completed before promotion.

The no-JavaScript category links carry valid server route state and selected labels, but the SSR fallback intentionally keeps all 18 full articles readable rather than performing the enhanced client filter. Full no-JavaScript filtering parity is not claimed. Menu, weather, chat and book-story leases remain outside the migrated slice.

## Validation status

Final synchronized candidate checks passed: production build, strict TypeScript, vendor/provenance/syntax/public-source checks, all 227 legacy web regressions, 4 API HTTP tests, 3 contract tests, 3 static HTTP tests, 5 vendor tests, and all 12 Next cases (the original 10 plus two completion regressions). The root aggregate and Next checks were serialized with the shared heavy-check lock. The first alpha.4 run’s 9/10 result and both explicit pre-fix negative failures are preserved as historical failure evidence; they were not removed or reclassified as passes. The original scroll, focus and node-identity assertions remain intact.

The production-script JSDOM bootstrap probe remains a recorded harness limitation (`document.currentScript` is unavailable when Next/Turbopack expects a script element), not a hydration or browser pass. It is retained separately from the acceptance test glob.

## Promotion boundary

Before expanding or promoting this architecture, use a supported SSR runtime and browser route to verify production hydration, actual `router.refresh()`, departure/return, repeated/reversed native interactions, physical layout/scroll/focus, reduced motion and real-GPU identity/resource stability. Only the independent Next controller’s completion guard and pending-frame cleanup were patched. No legacy runtime source, motion parameter, timing, broad layout or redesign was changed during this review.
