# Three runnable backend journeys

CopilotKit/OpenIntelligentUI is the current candidate checkpoint, with product framework selection still under verification. Its source is pinned at CopilotKit/OpenIntelligentUI@8391a94c1c3939c679e40ddd7bfc08a9ef690e70. The native HTML/CSS/JavaScript artifact runs only in the isolated opaque sandbox. Shape validation is not arbitrary-code safety certification. Earlier json-render work is a preserved historical experiment, not the current renderer.

## Truth table

Real: TypeScript + NestJS/Fastify HTTP, PostgreSQL persistence and migration, immutable revisions/assets, durable separate worker, idempotency, source provenance/versioning, deterministic structured extraction/grouping, validation, exact-revision approval, publication pointer/rollback, isolated reader state, stdio MCP and independent review studio.

Mock: only article generation/extraction heuristics and the deliberately synthetic workshop material. The generator identifies itself as `controlled-mock`, uses a deterministic freeform-native pipeline harness and makes zero model/provider calls. It accepts arbitrary topic input without a fixed component catalog, but does not claim genuine topic reasoning. Extraction recognizes explicit `[fact]`, `[decision]`, `[uncertainty]` markers, not general natural-language intelligence. Topic grouping is a deterministic keyword heuristic. No user chats, credentials or paid services are involved.

Unimplemented: automatic access to historical ChatGPT/Codex conversations, real account/session auth, real AI generation, uploads, multi-tenant authorization, public deployment, operational scaling and the original native feed's API integration. The accepted motion-ball/UI/runtime remain unchanged.

## Setup and commands

Node 24.19.0. From the repository root:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run build --workspace apps/api

Use a local PostgreSQL 17 instance. Optional Docker setup, if Docker is available:

    docker compose -f apps/api/compose.yaml up -d
    export DATABASE_URL=postgresql://personalos@127.0.0.1:55432/personalos_demo
    node apps/api/scripts/migrate.mjs

The compose file uses passwordless trust only on a loopback-published synthetic-demo database. It is not a production configuration. The cloud validation used actual official Debian PostgreSQL 17.11 binaries with an unprivileged loopback-only cluster, not Docker, SQLite disguised as PostgreSQL, or a PostgreSQL emulator. PostgreSQL version, restart survival and adapter tests were observed.

Run API and a genuinely separate generation worker, with review/admin credentials excluded from the worker environment:

    node apps/api/scripts/dev-demo.mjs

The API is on 127.0.0.1:3001. Start the independent studio using its own package scripts and `CONTENT_STUDIO_ADMIN_ENABLED=true`; the default review URL is 127.0.0.1:3002. Production-facing credentials and hosting are intentionally unnecessary for these demos.

For an explicit offline-only synthetic fallback:

    PERSONALOS_STORAGE=sqlite-demo node apps/api/scripts/dev-demo.mjs

SQLite persists to the ignored `.build/content-demo/content.sqlite`; never commit the database. PostgreSQL is the chosen primary service adapter.

## 1. Capture and group

    node apps/api/scripts/demo.mjs

The runner seeds three synthetic architecture notes, deduplicates them, extracts marked facts/decisions/uncertainties and groups topics. It then generates validated drafts, prints only article/revision/hash identities and stops before approval/publication. Run it again to observe idempotent capture and unchanged-input job reuse. It does not automatically read any conversation.

In the studio, inspect private source provenance and versions, then select a topic. The /chat page accepts an arbitrary topic, enqueues the same worker, receives an exact native artifact reference and offers explicit save-to-review draft. A follow-up targets the current revision and creates a new snapshot; it cannot approve or publish. For an MCP host, launch `.build/api/apps/api/src/mcp/stdio.js` with DATABASE_URL and without review/admin HTTP credentials. Add `apps/api/skills/content-workflow/SKILL.md` to the host's supported skill configuration. This repository provides the adapter and skill; it does not claim the user's ChatGPT/Codex host has been configured.

## 2. Generate and validate

Enqueue a topic in the studio. HTTP returns 202 promptly; the separate worker persists queued/running/validating/succeeded/failed transitions and the UI polls status. Inspect exact revision hash and validation report. Use the concurrency article's sliders and step controls to explore the shared trusted calculator. This is a simplified model, not a benchmark.

The optional local-demo `simulateFailureOnce:true` job fixture deliberately fails its first attempt; retry is explicit, bounded and backoff-controlled. Source changes use a new input hash and create a new immutable revision; unchanged input reuses the previous job.

## 3. Review and publish

Read the full draft, including every source-derived sentence and opt-in public citation. The separate human control approves only the exact current revision/hash, and publishing requires that approval plus the review capability. The public reader sees only that published projection. Make a new edit to invalidate draft approval; the old published revision remains stable until a new approved publish. Roll back to a historical published revision through the separate review route.

No demo script, MCP tool or generation worker grants human approval. Test fixtures exercise approval/publication only against isolated synthetic test databases.

## Verification and checkpoint

    npm run build --workspace apps/api
    node --test apps/api/test/*.test.mjs packages/contracts/test/*.test.mjs

With DATABASE_URL set, the suite additionally runs the same domain invariants against a disposable PostgreSQL schema and removes only that test schema. Without it, the PostgreSQL group is explicitly skipped. A PostgreSQL pass must not be inferred from a SQLite pass.

The automated checks cover duplicate/malformed captures, authorization, immutable versions, source-as-data injection controls, job transitions/retry/lease fencing, stale inputs, incremental reuse, exact/stale approvals, approval invalidation, unapproved publish rejection, rollback, capability-version compatibility, public DTO omissions, restart survival, reader isolation, actual HTTP limits/origin/auth checks, migration consistency and the stdio MCP boundary.

Current checkpoint: 50 backend/contract tests passed against real PostgreSQL 17.11 and the SQLite adapter, with zero skips. The final root `npm run check && npm test` also passed: 138 tests across contracts, API, static server, unchanged native host and studio, with zero failures/skips. Studio type-check and production build pass. Ten native studio workflow browser checks passed against real PostgreSQL, Nest/Fastify and production Next.js with zero runtime errors, including conversation generation/save, explicit bridge confirmation and follow-up revision. Eight actual-browser sandbox checks (independently repeated) passed with zero network-probe hits; they are bounded evidence, not a general arbitrary-code safety certification. Persisted revisions use a renderer-neutral presentation envelope binding renderer ID, protocol version, no-catalog marker, upstream/runtime/policy versions and native payload. No new UI DSL is introduced. Exact browser commands and evidence boundaries are documented by the studio's own checkpoint. Browser/GPU/mobile acceptance of the pre-existing native page is not implied.

Next: real authenticated human sessions and authorization, tenant isolation, source consent/retention controls, a real generator behind the same service contract with budgets/cancellation/lease heartbeats, versioned renderer upgrades, production migrations/backup/restore and deployment hardening. None is silently enabled by this demo.
