# Backend scope

The initial API scaffold is new code in this public import. It is not a recovered earlier PersonalOS backend.

Implemented:

- GET /healthz: bounded JSON liveness response
- GET /api/v1/status: product/scaffold versions and explicit capability booleans
- Unknown route 404; mutation methods on implemented routes 405
- No payload logging or database writes; no cross-origin allowance
- Localhost binding by default; request/header timeouts and header-count bound

Not implemented:

- Auth/session/authorization
- Content management or persistent storage
- Real AI/provider requests, streaming or conversation persistence
- User-specific retrieval, uploads or real weather
- Web-to-API integration
- Production reverse proxy/TLS, deployment, monitoring, abuse controls or migrations

Changing API_HOST or WEB_HOST can expose local development servers to a network. They are intended for local development. Production service setup and data-sharing approvals belong to a separate, explicit deployment task.

The scaffold needs no secret and no .env file. Do not place API keys in apps/web/runtime, committed files or browser responses. Authentication/provider/hosting choices remain product decisions.
