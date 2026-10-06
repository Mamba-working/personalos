# Next.js SSR first-slice candidate

## Status and provenance

This is an isolated, incomplete migration proof synchronized by a real Git rebase onto public main `64c36696dcc54ba2fa108437a3be49ac830100ef` (alpha.4). It is not a deployment, replacement release, visual acceptance, or permission to merge. The original alpha.3 proof `befed444b44d3c02c2d60affcc1740fa77468254` is preserved as local checkpoint `checkpoint/next-ssr-alpha3-befed444`. Alpha.4 solar weather, release metadata, contracts and provenance are preserved exactly from main.

The original 69 runtime files, their accepted-baseline fixtures, all existing 227 web tests, API, contracts, and alpha.4 provenance remain unchanged. The existing runtime digest is still `7dc1d4eb903df03745d36b8424041978f6871b414a7b970d5caffed48fa8f41e`. The original app is still available with the root `npm run dev` command on port 4173. The Next candidate uses port 4183.

## Run

Node 24.19.0 is the repository toolchain.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run setup
npm run check
npm test
npm run build:next
npm run typecheck:next
npm run test:next
npm run start:next
```

For development use `npm run dev:next`. The synchronized alpha.4 candidate passed all 227 legacy web cases plus vendor, API, contracts and static HTTP checks, the 12-case Next suite (the original 10 plus two completion regressions), production build and strict typecheck. The separate source-review report records the executed results, original failure evidence and remaining browser/GPU gates.

The separate API remains `npm run dev:api` on port 3001. Next has no `/api/v1/status` replacement and calls no content, AI, authentication, or persistence backend.

`npm run test:next` requires a production build and starts its own short-lived Node HTTP server. It does not require browser automation or a GPU. Its synthetic geometry is explicitly not a layout/performance/device acceptance result.

## Dependency decision

Pinned from the official npm registry on 2026-10-06: Next **16.4.0**, React/React DOM **19.3.0**, TypeScript **7.0.2**. Next's official [16.4.0 release](https://github.com/vercel/next.js/releases/tag/v16.4.0) was verified, and registry peer requirements accept React 19 and Node >=20.9.0. The root lockfile pins resolved dependencies and integrity hashes. Three remains **0.180.0**. React type packages are 19.3.0; Node types are 24.19.1. TypeScript 7 support is documented in the [Next 16.3 release](https://nextjs.org/blog/next-16-3). Version-matched Next documentation is bundled in the installed package.

## Ownership implemented

- `app/page.tsx` is request-time dynamic SSR. It parses `searchParams`, generates title/description/canonical metadata and emits all 18 real authored demo articles, including full Chinese bodies. The no-JavaScript selected article is a readable region before the feed. No content is initially inert.
- `NativeContentIsland` freezes its initial HTML in component state. React owns the stable outer div and has no child fibers for any feed/article/reader/story-layer descendants. The native controller adopts the existing nodes. It does not write `innerHTML`, clone an article, or generate a replacement article.
- The native reader retains the original identity/slot/title/body and uses the original critically damped spring calculation and width-locking geometry. One native document scroller and one reader scroller own their offsets. Filter re-layout preserves focused elements after reparenting.
- One `NavigationAuthority` owns `space`, `item` and reserved `chat` state through Next's documented native-history integration. It deliberately does not copy Next's internal `__NA` marker into writes, does not intercept popstate in capture, and never imports the old application/chat history writers. Initial deep links do not invent a preview history entry. Interrupted close/reopen is queued across asynchronous Back.
- `PersistentMotionShell` lives in the unkeyed root layout. It browser-loads a lifecycle adaptation of the original Ball scene and original licensed ring data. The same actual Three renderer, geometry, Ball actor and original frame clock are used. Listeners, click handlers, frame subscribers, scene resources, canvas and globals have explicit cleanup. React does not create an additional frame loop.
- The reserved story presentation destination is inside the opaque island. The animated content-lease/book story is deliberately **not enabled in this proof**, because its full ownership/lifecycle migration has not been verified. The original renderer's non-book intro remains available. The first slice uses a bounded corner Ball placement rather than claiming original host/choreography visual parity.
- GET/HEAD-only candidate routes retain the legacy read-only HTTP boundary through a Next `proxy.ts`. Server Actions are not used.

## What the automated evidence proves

The candidate suite checks:

1. Actual production HTTP responses contain all 18 articles, unique IDs, Chinese deep-link text, per-article title, canonical URL excluding chat state, and no initially inert content root. The production CSS is fetched and evaluated with scripts disabled: each body must be block/static, each article auto-height/unclipped, and no ancestor may be hidden, inert, zero-opacity or fully clipped. Native anchor URLs must open and close the Chinese article through real HTTP responses. This is computed-style/source evidence, not browser paint or geometry acceptance
2. Source/private paths and the unimplemented API return 404; GET/HEAD work and PUT returns 405
3. React hydration under Strict Mode captures and retains all 18 original SSR article references, with zero hydration recovery or console errors in the component-level JSDOM harness
4. Long-Chinese open, reader scroll, close, Forward, interrupted close/reopen, same component rerender, changed server-payload prop, component departure/return, and repeated mount/dispose preserve the tested identities/offsets/focus and do not leak controller listeners/RAF
5. The real Three constructor fails honestly when WebGL is absent; readable article DOM remains. A separate GPU gate rejects zero canvases, missing draw calls, changed actor UUID or duplicate actors/canvases. Synthetic positive inputs validate the gate logic only
6. Every legacy web test remains in place and runs separately, rather than treating new slice tests as full feature parity

The changed-payload React test models the island's refresh contract; it is **not proof of actual `router.refresh()` in a real Next browser**. A production-script JSDOM probe was attempted and failed in Next/Turbopack bootstrap with `Expected document.currentScript to be a <script> element. Received null`. The retained exploratory probe is outside the acceptance test glob. No bootstrap shim was used to convert this into a pass.

## Measured size baseline

A production Node HTTP run returned the home response at **178,905 bytes raw / 16,408 bytes gzip**, with all 18 article elements already in the HTML. Initial external scripts totalled **592,502 bytes raw / 184,356 bytes gzip**. The deferred Ball/Three chunk was **739,113 bytes raw / 191,910 bytes gzip**; two other deferred chunks totalled 55,215 raw bytes. All emitted JavaScript chunks totalled **1,386,830 raw / 395,466 gzip bytes**. Compression values are independent gzip estimates, not a browser waterfall or transferred-byte measurement. The client scene and legacy story helpers resolve the same reconstructed Three module; an accidental second Three module graph was removed before the final build.

For context only, a static traversal of the legacy entry scripts and eager imports found 37 JavaScript files totalling 2,437,057 raw / 550,557 independent gzip bytes. That graph excludes dynamic imports, while the candidate does not mount every legacy feature. These figures are **not comparable feature-complete performance claims**. Warm local HTTP response samples were roughly 24–75 ms; no browser latency, LCP, CLS or frame-rate improvement is claimed.

## Remaining blocking acceptance gates

- Real browser production hydration, actual `router.refresh()`, App Router route departure/return and back/forward integration
- Real-GPU one-canvas/one-actor UUID retention, rendering calls, clock/listener/resource accumulation and context loss/recovery
- Visual/layout continuity, initial progressive-enhancement layout shift, low/mid/mobile widths, real native scrolling, selection, reduced motion and pointer/touch behavior
- Actual keyboard/IME and accepted chat flows; no chat module is mounted in this candidate, so none of its retained primitives is rewritten or represented as migrated
- Menu, simulated weather, book-story leases, full host intro choreography, delayed-image behavior and animated filter reflow parity

The cloud browser's localhost route is unavailable for this task. HTTP and DOM results above are reported at their actual scope. Real-GPU and browser gates remain blocked/not run, **not passed**. Do not expand or promote the candidate before those ownership gates are reviewed.

## Runtime/deployment boundary

`next build` reports `/` as **dynamic server-rendered on demand**. The candidate uses `next start`, not `output: 'export'`. A persistent supported Node runtime or a verified Next adapter is required to deploy it. Static hosting/Sites compatibility is not established; copying the HTML or `.next/static` files would not deploy SSR. No Site, public repository branch, or deployment was changed by this implementation or synchronization task. See [source review](NEXT_SOURCE_REVIEW.md) for the alpha.4 synchronization and no-JavaScript review.

## Rollback

Keep the legacy root `npm run dev` workflow as the alpha.4 oracle. Reverting the migration commit removes the additive Next surface; it does not require rolling back API/contracts, vendor fixtures or the preserved runtime. Original Ball character restrictions in `LICENSE` and `THIRD_PARTY_NOTICES.md` still apply.
