# Backend scope

The former health-only scaffold now includes an actual TypeScript content-service demo using NestJS 11/Fastify and PostgreSQL, a separate durable generation worker, immutable versioned content, auth-gated local admin routes, exact-revision review/publication and a restricted public projection. See [API contract](CONTENT_API.md) and [three runnable journeys](CONTENT_DEMOS.md).

The existing health identifiers remain `productVersion: 0.1.0-alpha.4` and `apiScaffoldVersion: 0.0.1` for compatibility. Status additionally reports `backendDemoVersion: 0.1.0-demo.1`, actual storage adapter and `nestjs-fastify`. `contentApi` and `persistence` are true; real chat/provider and production authentication remain false. `frontendConnected:false` describes the unchanged native alpha.8 page; the independent review studio connects to the content API through its BFF.

Implemented:

- Authorized selected-snippet capture; provenance, deterministic dedup, immutable source versions
- Explicit facts/decisions/uncertainties extraction and keyword topic grouping, visibly heuristic
- Persisted jobs, idempotency, incremental input hashes, retries, leases/fencing and PostgreSQL SKIP LOCKED claims
- Controlled-mock native OpenIntelligentUI artifact generator, zero model calls, bounded structural validation (not arbitrary-code safety certification), trusted named calculator and sandbox-required envelope
- Immutable revision assets; independent human review capability; exact revision/hash/capability approval; publish pointer and audited rollback
- Public-only-published DTO, no raw/draft/review/provenance endpoint; per-reader capability-isolated progress
- Minimal persisted conversation/artifact references, explicit save-to-review draft and immutable follow-up revisions via the same worker
- Actual stdio MCP adapter plus a capture/generate/status/review Skill; no AI publish/approve tool
- Request bounds, no payload logging, no CORS allowance, loopback-only local-demo binding and explicit offline SQLite adapter

Not implemented:

- Real user accounts/session authentication, multi-tenant authorization or proof of human identity
- Real AI generation/provider streaming, automatic access to ChatGPT/Codex history or full natural-language extraction
- Native alpha.8 feed integration; original web content, UI and motion-ball runtime remain intact
- Production TLS/reverse proxy, migrations/roles at scale, retention/deletion, rate limits, object storage, backup/restore and monitoring

Local-demo constants are intentionally public test guards, not production credentials. Token mode separates admin and review secrets but is still not a production identity system. Do not publicly expose the development admin API or use private real data in these demos. Public reader output can contain source-derived prose only after deliberate exact-revision human review; raw envelopes are not public, but prose is not automatically redacted.

No secrets or paid APIs are needed. No source publication implies deployment approval.
