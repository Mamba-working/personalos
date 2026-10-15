# PersonalOS · Agent entry

Current web candidate: v0.1.0-alpha.8. Canonical native UI uses the original motion-ball module through its public API. The old 3D renderer is removed from current source and serving output. Actual GPU/mobile acceptance is incomplete; this candidate does not promote GitHub main or the default deployment.

## Main structure

- integrations/native-shell/: native page, feed, menu and local demonstration chat
- integrations/native-card/: card/reader controller, measured layout and CSS; [layout notes](docs/NATIVE_CARD_LAYOUT.md)
- integrations/motion-ball/: scene host, asset base, headless weather provider, input and lifecycle; [integration notes](docs/MOTION_BALL_INTEGRATION.md)
- modules/motion-ball/: the original 84-file 3D source, assets and documentation
- apps/web/runtime/: generated 87-file runtime; edit canonical sources instead
- apps/api/ and packages/contracts/: TypeScript NestJS/Fastify content demo, PostgreSQL adapter, separate durable worker, restricted MCP/Skill and article contracts; [backend scope](docs/BACKEND_SCOPE.md), [API](docs/CONTENT_API.md), [demo checkpoint](docs/CONTENT_DEMOS.md)
- scripts/, docs/ and provenance/: reproducible build, checks, public guidance and source/runtime mapping

Run cloud setup/build with npm run setup && npm run build:web, then npm run check and npm test. The current web command npm run test:web covers 72 source/state/layout-model tests. [Test boundaries](docs/TESTING.md) and [release policy](docs/RELEASE_POLICY.md) define what remains unverified.

## 3D responsibility and original docs

motion-ball owns rendering, weather, character behavior, its engine clock and GPU resources. Native controllers own content, article identity, feed/reader scrolling, navigation/history/focus, menu and chat. Keep one scene and use only the original documented public API; do not patch module internals or substitute the standalone landing-page UI.

Read the original [module agent.md](modules/motion-ball/agent.md), then its relevant unchanged child document:

- [Architecture and render pipeline](modules/motion-ball/docs/architecture.md)
- [Weather, time and composition configuration](modules/motion-ball/docs/configuration.md)
- [Models, assets and source attribution](modules/motion-ball/docs/models.md)
- [Input and character interaction](modules/motion-ball/docs/interaction.md)
- [Development, debugging and validation](modules/motion-ball/docs/development.md)
- [Public module API and component integration](modules/motion-ball/docs/library.md)

The original docs remain exact upstream text. Main-project cloud setup, host policy and known limitations are documented in [motion-ball integration](docs/MOTION_BALL_INTEGRATION.md). See [architecture](docs/ARCHITECTURE.md), [ownership](docs/OWNERSHIP.md), [security](SECURITY.md) and [third-party notices](THIRD_PARTY_NOTICES.md) before related changes.

## Content demo checkpoint

The independent content-service/studio demo does not modify the accepted native UI, generated runtime or 84-file motion-ball source. Build backend with `npm run build --workspace apps/api`; run real PostgreSQL integration by supplying DATABASE_URL to `node --test apps/api/test/*.test.mjs packages/contracts/test/*.test.mjs`. Generation/extraction are explicitly controlled mock/heuristic; there are zero external model calls. Never expose local-demo admin constants publicly or let MCP/generation grant human approval. See [three journeys and remaining work](docs/CONTENT_DEMOS.md).

CopilotKit/OpenIntelligentUI is the current tested candidate checkpoint; product framework selection remains under verification. New revisions persist one renderer-neutral `presentation` envelope with untouched native activity payload, upstream/runtime/policy pins and hash-bound protocol metadata. Arbitrary HTML/JS is untrusted: shape validation is not a safety proof, and only the isolated sandbox may execute it. The prior json-render experiment is historical; approvals never transfer automatically. Minimal conversation/artifact APIs reuse the same durable worker and cannot approve/publish.

Validated checkpoint: root checks and 138 tests pass with real PostgreSQL 17.11 and zero skips; studio type-check/production build, 10 native workflow browser checks and 8 independently repeated sandbox checks pass. Generation remains controlled mock with zero provider calls. Real human sessions, tenancy, provider budgets, production operations and arbitrary-code CPU/memory containment remain open; see the demo and studio checkpoint documents before extending or deploying.
