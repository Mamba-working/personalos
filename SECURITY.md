# Security

This repository includes the unchanged alpha native UI plus an independent local content-service demo. The NestJS/Fastify API has PostgreSQL persistence, bounded/token-gated local admin routes and a public-only-published projection, but it is not a production identity/privacy system and is not prepared for real private personal content.

Do not commit credentials, raw user messages, private QA screenshots, environment metadata or private recovery artifacts. The public-pattern check is a basic guard and cannot certify that a file is safe.

Report a suspected credential exposure or security issue privately to a verified repository maintainer. Do not publish secret values in a public issue. GitHub private vulnerability reporting can be used if the maintainer has enabled it; no reporting address or availability is assumed here.

Provider credentials must stay on an approved server. Implement auth/authorization, request limits, retention/deletion and deployment security before adding private data or a real AI provider. Review third-party licenses before any commercial deployment.

Local-demo admin/review constants are public development guards. Bind them only to loopback; do not expose through tunnels or public deployments. Keep real admin/review secrets server-side and out of MCP/worker environments. Capture only explicitly authorized snippets; publishing source-derived prose requires reviewing the complete exact immutable revision. Raw envelopes and private provenance are excluded from public DTOs, but the draft is not automatically anonymized. See [content API boundaries](docs/CONTENT_API.md).

The current CopilotKit/OpenIntelligentUI candidate format carries native HTML, CSS and JavaScript. Server validation bounds structure and bytes only; it cannot prove arbitrary code safe. Execute artifacts only in the pinned opaque-origin, no-host-access sandbox with denied network and validated/confirmed bridge. Native code is part of the exact reviewed revision hash; executor or bridge/CSP changes need version/policy updates. Sandboxing does not guarantee protection against resource exhaustion.
