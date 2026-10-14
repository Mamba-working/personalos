# Ownership and contribution

The repository maintainer is accountable for the complete product and release truth. Add specific verified GitHub handles to CODEOWNERS when maintainers are assigned; no invented account is installed as an owner.

Responsibilities:

- Web owner: native layout/motion/accessibility, feed/reader/article identity, navigation/history/focus, menu/chat and browser regression
- 3D integration owner: one scene/container, bounded public-API usage, asset routing, input arbitration and lifecycle; no changes to upstream engine logic
- Native-card owner: stable CSS layout, measured projection, reading scroll and opening/closing/resize continuity
- API owner: HTTP behavior, credentials, authorization, data retention and operational limits
- Contracts owner: versioned payload/schema compatibility and frontend/backend boundary tests
- Release owner: exact source/runtime/deployment mapping, evidence limits, licenses and acceptance status

Read [agent.md](../agent.md) and the original [motion-ball entry](../modules/motion-ball/agent.md) before relevant work. Preserve all 84 upstream files and six child documents. Main-project changes belong in canonical integrations or build scripts; do not edit generated apps/web/runtime or use engine overrides.

Before a change:

1. Keep scope and implementation status explicit, including web/API version differences
2. Preserve fixture licenses and byte references; do not delete negative controls to make tests pass
3. Run npm run setup, npm run build:web, npm run check and npm test in the cloud; report failed, blocked or never-run checks honestly
4. Update applicable contracts/docs/provenance when behavior or ownership changes
5. Use a draft pull request for review; source publication does not authorize merging, tagging, deployment or default-route promotion
6. Collect fresh current-candidate browser/GPU/device observations before claiming those gates passed

The old renderer is retired from the current source and serving tree. Historical or retired tests retain historical meaning; their absence from the current web command is not a pass.

Backend-related open decisions:

- Which content is demo-only and which content should become user-owned?
- Does the real product need authentication, and what data should persist?
- Which provider/hosting/storage choices and retention rules are authorized?
- What first-party and third-party permissions are required before commercial reuse or release?

The root LICENSE remains unchanged, including historical Emotion Ball restrictions. See [third-party notices](../THIRD_PARTY_NOTICES.md) for current motion-ball assets and retained dependency notices.
