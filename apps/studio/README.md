# PersonalOS Content Studio: OpenIntelligentUI candidate checkpoint

This is a verified-workflow candidate, not a production maturity certification or a deployed service. The exact upstream project is [CopilotKit/OpenIntelligentUI](https://github.com/CopilotKit/OpenIntelligentUI), pinned to commit `8391a94c1c3939c679e40ddd7bfc08a9ef690e70` under MIT. The prior experimental catalog renderer remains only in git history at checkpoint `c9a85185611fe7dcd7b4175138d93303734c4a7d`.

**Mock AI生成，真实 OpenIntelligentUI 渲染，真实 API / PostgreSQL / 修订 / 审批流程。** There is no model request, provider credential, Jev request, or AI cost. The current controlled generator clearly labels its generic interactive experiment; it does not claim to reason about any arbitrary topic.

## What runs

- `/`: private collection → topic grouping → asynchronous generation → exact-revision review and publication
- `/chat`: private mock conversation → the same native artifact → save exact artifact as review draft → follow-up creates a new immutable revision
- `/library` and `/read/:slug`: public-only approved content DTO, with the native interaction rendered inside its sandbox
- `/api/demo/*`: allowlisted server proxy; admin/reviewer tokens remain server-side

The existing PersonalOS web runtime, accepted motion-ball module, and native page are unchanged. The separate Studio uses Next.js / TypeScript. Its content service remains NestJS / Fastify / PostgreSQL, with the real API/worker described in the repository's content documentation.

## Actual upstream reuse

The adapter reuses the pinned upstream native activity schema, Websandbox loader, design-system source, iframe lifecycle, ordered function/expression execution, source-checked sizing, and 50..4000 height bounds. The actual executor dependency is `@jetbrains/websandbox@1.2.1` (Apache-2.0).

`src/vendor/openintelligentui/UPSTREAM.json` records file SHA-256 values and original paths; the full MIT license and upstream reference source are retained beside it. The active adapter is `src/components/openintelligentui/`. This is an adapted persisted-artifact rendering rail, not the entire stock CopilotKit/Python/AG-UI application.

The native payload is the upstream activity content: `initialHeight`, `generating`, `css`, `cssComplete`, `html: string[]`, `htmlComplete`, `jsFunctions`, `jsFunctionsComplete`, `jsExpressions: string[]`, `jsExpressionsComplete`. Saved artifacts must be complete. Backend envelope metadata separately binds renderer/protocol, upstream commit, executor version, and sandbox-policy version. The payload is not a new component-catalog language.

## Review and sandbox boundaries

- Public release covers the complete artifact content and native HTML/CSS/JavaScript code; approval binds the exact revision and content hash
- Full raw source records, private provenance, conversation records and reviewer identity are excluded from the public DTO; text derived into the artifact will be public
- Native code runs only in an opaque-origin `sandbox="allow-scripts"` iframe, with no same-origin, top-navigation, popup or form permission
- Frame CSP denies network, child frames, forms, remote scripts/media and eval; the host's frame policy restricts navigation, and a subsequent load tears the frame down
- The actual Websandbox host dispatcher is additionally narrowed to known handshake/response messages and a strict text-only follow-up proposal; incoming interface mutation, prototype paths and unknown methods are rejected
- The sole named `sendPrompt` method rejects when no current chat callback is enabled, including every public reader. An enabled follow-up proposal still requires an explicit host-side confirmation click before it can submit a new local mock-chat turn; no bridge method can approve, publish, fetch admin data, read storage or open links
- Host stop/reload controls reset the local reader state; arbitrary iframe state is not automatically synchronized back to the conversation

Structural validation does not prove code safety. Arbitrary JavaScript may falsify displayed outputs even when a known calculator function is injected. The bounded mock uses a versioned named calculator; this is not tamper-proof verification of arbitrary generated code.

There is no CPU/memory budget. A hostile infinite loop may hang the shared browser event loop before host controls respond. Stop/reload cannot guarantee preemption. This checkpoint does not certify arbitrary-JavaScript production execution, real reviewer identity, real-device/GPU behavior, or a complete accessibility audit.

## Local cloud demo

```sh
npm ci --prefix apps/studio --workspaces=false --ignore-scripts --no-audit --no-fund
# Start the PostgreSQL content API and its worker first.
CONTENT_STUDIO_ADMIN_ENABLED=true npm run dev --prefix apps/studio --workspaces=false
```

Studio binds `127.0.0.1:3002`; API defaults to `127.0.0.1:3001`. See `.env.example` for server-only configuration. Without explicit admin opt-in, `/` serves the public library and the private proxy refuses requests. Both `dev` and `start` bind loopback. Host/Origin checks are defense in depth, not production authentication. Do not expose an enabled local studio publicly. `Local reviewer` is a demo attribution, not an authenticated person.

## Verification

```sh
npm test --prefix apps/studio --workspaces=false
npm run typecheck --prefix apps/studio --workspaces=false
npm run build --prefix apps/studio --workspaces=false
npm run test:sandbox --prefix apps/studio --workspaces=false
# Real API + worker + enabled Studio must share a network namespace:
npm run test:browser --prefix apps/studio --workspaces=false
```

The standalone sandbox test requires no API, PostgreSQL, model or user data. It bundles the actual adapter/runtime and probes real loopback network hits, opaque DOM/storage boundaries, hostile RPC, document replacement, navigation, follow-up confirmation, stop/reload and failure teardown. A marker from the rewritten document proves its script executed; zero network hits are not inferred from a script that never ran.

The browser default is `/usr/bin/chromium` (override `CHROMIUM_PATH`). This cloud sandbox's full-Chrome binary could not create its singleton Unix socket, and the Playwright CDN returned truncated archives. Actual verification uses `@sparticuz/chromium@153.0.0` from npm in ignored `.build/browser-tools`, with unnecessary insecure flags removed. `CHROMIUM_RUNTIME_MODULE` can point to its module, and `FONTCONFIG_PATH=/etc/fonts` enables system CJK fonts. This test-only tooling is separate from runtime dependencies.

Source checks, production build and actual-browser reports have different scopes. Screenshots/reports are ignored under `test-results/`; the parent delivery identifies which checkpoint and workflows were actually tested. No push, deployment, external model test or production promotion is implied.

### Verified candidate checkpoint (2026-10-15)

- Production build and strict TypeScript passed; 11 unit/policy/provenance tests passed
- Eight actual-browser sandbox checks passed with zero probe-network hits and zero uncaught host errors, including late-enabled/disabled follow-up capability; an independent reviewer reproduced the bounded sandbox checkpoint
- Ten full browser journeys passed using real PostgreSQL, Nest/Fastify and production Next: capture/group, durable generation, linked local calculation, exact approval/publish, approved public/mobile reader, approval invalidation, chat draft/follow-up/reload, MCP review deep link, default-disabled admin and proxy guards
- Production dependency audit reported zero findings

Fresh native evidence is under `test-results/native/`; `test-results/sandbox/` holds the standalone security harness. Older top-level screenshots belong to the earlier catalog-renderer checkpoint and are not evidence for this native candidate. Chat follow-up captures use visible viewports because headless full-page compositing can omit an offscreen iframe even when its DOM and calculations are present.
