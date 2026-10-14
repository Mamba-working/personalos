# PersonalOS · Agent entry

Current web candidate: v0.1.0-alpha.8. Canonical native UI uses the original motion-ball module through its public API. The old 3D renderer is removed from current source and serving output. Actual GPU/mobile acceptance is incomplete; this candidate does not promote GitHub main or the default deployment.

## Main structure

- integrations/native-shell/: native page, feed, menu and local demonstration chat
- integrations/native-card/: card/reader controller, measured layout and CSS; [layout notes](docs/NATIVE_CARD_LAYOUT.md)
- integrations/motion-ball/: scene host, asset base, headless weather provider, input and lifecycle; [integration notes](docs/MOTION_BALL_INTEGRATION.md)
- modules/motion-ball/: the original 84-file 3D source, assets and documentation
- apps/web/runtime/: generated 87-file runtime; edit canonical sources instead
- apps/api/ and packages/contracts/: unchanged health/status scaffold and schemas; [backend scope](docs/BACKEND_SCOPE.md)
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
