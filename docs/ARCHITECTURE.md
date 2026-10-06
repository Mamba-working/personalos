# Architecture

## Product boundary

One monorepo coordinates web, API, data contracts, tests and release evidence. It does not imply all product capabilities already exist.

The web source was a static browser application. Its only application-owned fetch loads local release-meta.json. Its chat selects canned local answers; weather is simulated. It has no provider integration, server session, database or real authentication. The public import keeps that runtime unchanged.

## Minimal layout

- apps/web/runtime owns browser UI, scene, motion, feed/reader/menu/chat layout and demonstration rendering
- apps/web/tests retains the integration/menu/weather suites and frozen byte/negative-control fixtures. Keeping tests next to runtime preserves their original relative imports
- apps/api owns HTTP service behavior. The initial implementation exposes health and capability status only
- packages/contracts owns the current health response builder and demo-record validation/schema. Add API contract versions here as real endpoints are implemented
- scripts owns local orchestration, syntax/privacy-pattern checks and exact imported runtime provenance
- docs/provenance own public implementation truth, roles and clean-import mapping

Do not add packages/config, packages/database, a queue, generated clients or a content SDK until an actual shared need exists. A schema package is justified by the current demo records and real service payload. A fake auth/database adapter would obscure current scope.

## Existing UI ownership

Keep one host owner for navigation/history/feed/reader/chat/world state. Menu and weather remain bounded modules. Keep one Ball/canvas and shared scene clock. Backend adapters must not create extra animation loops or replace retained input/article identities.

## Backend integration sequence

1. Decide actual content ownership and auth model; keep authored fixtures explicitly separate from user-owned content
2. Implement versioned read-only content endpoints against a real approved store; test contract and failure cases
3. Add a web data adapter without changing motion/identity ownership; keep demo fallback explicit
4. Design real chat/provider streaming, cancellation, errors and retention; keys stay server-side
5. Add appropriate authentication/authorization, CSRF/CORS, rate limits, retention/deletion and redacted observability before handling private user data

The status API must continue to report false for capabilities until both implementation and applicable integration tests exist. Do not promote health-check success into an AI/backend-product acceptance claim.

The large Three.js core/module builds are generated dependency artifacts. Root three@0.180.0 is exact-pinned; npm run setup:vendor restores the two runtime files plus two identical frozen-fixture files. Every other imported runtime file remains tracked and unchanged, and the complete reconstructed 69-file inventory is verified against the original frozen digest.
