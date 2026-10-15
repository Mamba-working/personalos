# Content demo API v1

Types are in `packages/contracts/content.ts`; runtime request schemas are in `apps/api/src/content/inputs.ts`. The modular TypeScript service uses NestJS 11.2.7/Fastify, PostgreSQL and a separate durable worker. SQLite is an explicit offline/test adapter. All AI generation is a clearly labeled deterministic mock, with zero OpenAI/Jev/provider calls.

## Local authorization boundary

The API defaults to 127.0.0.1:3001. Local-demo mode refuses a non-loopback bind and requires `Authorization: Bearer personalos-local-demo` on admin routes. Approval, publication and rollback additionally require `X-PersonalOS-Review-Token: personalos-local-review`. These public constants are development guards, not production authentication. Do not expose them through a public tunnel or deploy them with private data.

Token mode requires distinct `PERSONALOS_ADMIN_TOKEN` and `PERSONALOS_REVIEW_TOKEN` of at least 32 characters. Keep them server-side, exclude both from worker/MCP environments, and integrate real authenticated reviewer identity/session authorization before production. Reviewer display text is attribution only. Browser-origin token-mode admin requests must go through the server-side studio BFF. Cross-site local admin origins are rejected; no CORS allowance is enabled.

Requests are JSON, at most 128 KiB. Selected capture text is at most 32,000 characters and retained as the exact submitted string, including spacing/line endings, with a UTF-8 content hash. Unknown fields are rejected. Header/request timeouts and header count are bounded. Errors are `{error:{code,message,details?}}`; unknown routes retain `{error:"not_found"}`. Responses are no-store/nosniff; no raw payload logs, paths, provider keys or database connection details are returned.

## Capture, generation and review routes

Every POST body includes an `idempotencyKey`. Same operation/key/input returns its original result; different input is 409. Operation namespaces are separate, and replay records commit with the operation.

- GET `/api/v1/admin/snapshot` → sources, grouped topics, articles with latest revision/approval/publication, jobs, publication history and conversation summaries
- POST `/api/v1/admin/fixtures` `{idempotencyKey}` → three synthetic sources only; no approval/publication
- POST `/api/v1/admin/captures` `{idempotencyKey,externalId,title,content,origin,permission:{confirmed:true,scope:"selected-snippet"},provenance:{label,url?},publicCitation?:{label,url?}}` → `{source,duplicate}`
- POST `/api/v1/admin/group` `{idempotencyKey,sourceIds?}` → `{topics}` with immutable source-version references and explicitly marked facts/decisions/uncertainties
- POST `/api/v1/admin/jobs` `{idempotencyKey,topicId,simulateFailureOnce?}` → 202 `{job,incrementalReuse}`; synthetic failure mode is local-demo only
- GET `/api/v1/admin/jobs/:id` → `{job,revision?}`
- POST `/api/v1/admin/jobs/:id/retry` `{idempotencyKey}` → 202 `{job}`; bounded failed-job retries with backoff
- GET `/api/v1/admin/articles/:id` → `{article,revisions,latestRevision,approval,publication}`
- POST `/api/v1/admin/articles/:id/revisions` `{idempotencyKey,baseRevisionId,title?,summary?,spec?}` → `{revision,validation}`; `spec`, when supplied, is the current protocol-native completed activity, not a new UI DSL
- POST `/api/v1/admin/articles/:id/approve` `{idempotencyKey,revisionId,contentHash,reviewer,reviewIntent:"human-reviewed-exact-revision"}` → `{approval}`
- POST `/api/v1/admin/articles/:id/publish` `{idempotencyKey,revisionId,contentHash}` → `{publication}`
- POST `/api/v1/admin/articles/:id/rollback` `{idempotencyKey,publicationId}` → `{publication}`; target must be a historical publication of the same article

Approve/publish/rollback require the separate human-review capability. Capture, generation, chat, MCP and saving drafts cannot set approval. Any edit/regeneration creates an immutable revision and invalidates current draft approval. An existing public pointer remains stable until a deliberate approved publish or historical rollback. Rollback creates a new audit event using the historical exact-revision approval; it cannot approve a new draft.

## Minimal conversation/artifact routes

These are intentionally small local demo APIs, not recovered ChatGPT/Codex history or a full chat product:

- POST `/api/v1/admin/conversations` `{idempotencyKey,title?}` → `{conversation,messages:[],jobs:[],artifacts:[]}`
- GET `/api/v1/admin/conversations/:id` → `{conversation,messages,jobs,artifacts}`; messages are append-only and reference exact immutable article artifacts
- POST `/api/v1/admin/conversations/:id/messages` `{idempotencyKey,content,baseRevisionId?}` → 202 `{conversation,userMessage,job}`. A follow-up requires the current exact base revision; an active generation job blocks concurrent turns
- POST `/api/v1/admin/conversations/:id/artifacts/:revisionId/save` `{idempotencyKey}` → `{articleId,revisionId,contentHash,reviewUrl}`. This adds an explicit review-draft binding to an already private generated artifact; it does not approve or publish

The same domain generator/worker/native artifact contract serves selected-source jobs and the platform demo chat. A successful job atomically writes a new revision, invalidates draft approval and appends an assistant message with its artifact reference. Follow-ups create separate immutable snapshots, preserving earlier messages/artifacts and any existing published pointer. Host/frame follow-up proposals must be explicitly confirmed in the host UI before a new turn. No automatic background prompt or admin action is authorized by rendering an artifact.

Only the explicitly submitted turns are stored; there is no implicit all-chat access. Conversation prompts, job prompt snapshots and private provenance are absent from public DTOs. Draft prose can reflect user-selected material or the requested topic and must be reviewed in full before publication; capture is not publication consent. The mock harness accepts arbitrary topic input but does not claim genuine domain reasoning or live data.

## Renderer-neutral immutable envelope

This checkpoint experiments with CopilotKit/OpenIntelligentUI; product framework selection remains under verification. The native activity schema/runtime is pinned to [CopilotKit/OpenIntelligentUI at 8391a94](https://github.com/CopilotKit/OpenIntelligentUI/tree/8391a94c1c3939c679e40ddd7bfc08a9ef690e70). New revisions persist one authoritative `presentation` envelope:

- `rendererId: "copilotkit-openintelligentui"`
- `protocolVersion: "open-generative-ui-activity-v1"`
- `catalogVersion: "none"` (freeform native artifacts, no fixed component catalog)
- `upstreamCommit: "8391a94c1c3939c679e40ddd7bfc08a9ef690e70"`
- `runtimeVersion: "@jetbrains/websandbox@1.2.1"`
- `sandboxPolicyVersion: "personalos-opaque-no-network-v1"`
- `spec`: original lowercase native completed activity fields: `initialHeight`, `generating:false`, `css`, `cssComplete:true`, `html:string[]`, `htmlComplete:true`, `jsFunctions:string`, `jsFunctionsComplete:true`, `jsExpressions:string[]`, `jsExpressionsComplete:true`

No protocol translation or homegrown UI DSL is introduced. The revision hash binds every byte of the native HTML/CSS/function/expression channels, all descriptor fields, source references, input hash, generator and named calculator version. Approval/publish/rollback/public serving compare the full descriptor with the supported runtime. Runtime/bridge/CSP changes must update their version/policy and require compatible versioned rendering or regeneration plus fresh review. Approval never silently transfers between executors or protocols.

`packages/contracts/openintelligentui.mjs` checks native shape/completion/size only. It deliberately does not certify arbitrary JavaScript or HTML safe. Native strings are never executed on the server. Rendering requires the pinned opaque-origin sandbox, no same-origin/storage/host access, network-denied policy, bounded/validated frame messages and an explicitly confirmed narrow follow-up bridge. No host eval or direct admin callback is part of the contract. Sandboxing is not a guarantee against CPU/memory abuse; production resource limits and further security review remain necessary.

The deterministic mock's numerical example calls the shared named `calculateConcurrency` from `packages/contracts/calculators.mjs`, injected as a frozen trusted sandbox function. Its simplified batch estimate is labeled synthetic and is not a benchmark or topic-specific business fact. The native payload format can carry open-ended artifacts; the zero-provider mock is only a pipeline harness.

## Public routes and privacy

- GET `/api/v1/public/articles` → `{articles}` with only current published projections
- GET `/api/v1/public/articles/:slug` → `{article}`; unpublished/missing is 404
- POST `/api/v1/public/readers` → `{readerId,capability}`; random capability is stored only as a hash
- GET/PUT `/api/v1/public/readers/:readerId/articles/:slug/state` require `X-Reader-Capability`; PUT `{revisionId,progress}` with progress in [0,1]

Public article fields are exactly `id,slug,revisionId,title,summary,contentHash,presentation,generator,publishedAt`. There is no duplicate top-level spec, raw-source, conversation, draft, review history, generic asset, private provenance or job endpoint. The explicit DTO never spreads a private record. Reviewed native code is public together with the article and executes only inside the required reader sandbox. Private source envelopes/reviewer names are omitted, but derived prose is not automatically anonymized.

Reader progress is isolated by capability+reader ID and never attached to shared article state. It is not real account identity, cross-device synchronization or production abuse/privacy infrastructure.

## Jobs, persistence and transition limits

Queued → running → validating → succeeded/failed is persisted. A separate worker claims PostgreSQL jobs with short `FOR UPDATE SKIP LOCKED` transactions, executes after commit, recovers expired leases and fences old workers. Exhausted recovered jobs fail without an extra attempt. Retries are explicit, bounded and backoff-controlled. Long real model calls will need periodic lease renewal, provider idempotency and cancellation; exactly-once external model effects are not claimed.

Changed grouped inputs or conversation bases reject stale queued results. Unchanged selected-source/capability inputs reuse existing work. PostgreSQL JSONB aggregate records and indexed jobs persist state; immutable source versions, revisions, assets, publication events and conversation messages have database triggers. Transactions bind revision+approval invalidation+job completion+artifact message, and publication pointer+audit event.

This single-tenant demo uses a cross-aggregate advisory lock. Production still needs tenant-scoped schemas/policies, proper migrations/roles, real reviewer sessions, quotas/rate limits, retention/deletion, object storage, backup/restore, observability and resource isolation. SQLite remains an explicitly selected offline/test adapter.

Earlier json-render/pre-envelope checkpoints remain historical experiments. Pre-envelope rows are privately displayed as `legacy-unbound-json-render`, never stamped with a new approved hash. They cannot be newly approved, published, rolled back or served under the current runtime. Use fresh synthetic test storage or regenerate and obtain fresh review; no production data migration is implied.
