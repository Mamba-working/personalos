# Backend scope

The API is the existing public health/status scaffold, not a recovered earlier PersonalOS backend. Its source, contracts and tests are preserved byte-for-byte in the alpha.8 web integration.

Implemented:

- GET /healthz: bounded JSON liveness response
- GET /api/v1/status: existing product/scaffold versions and explicit capability booleans
- Unknown route 404; mutation methods on implemented routes 405
- No payload logging or database writes; no cross-origin allowance
- Localhost binding by default; request/header timeouts and header-count bound

The existing status metadata remains productVersion 0.1.0-alpha.4 and apiScaffoldVersion 0.0.1. The web candidate is v0.1.0-alpha.8. Keeping this difference visible avoids implying an API/contracts change or a new backend release.

Not implemented:

- Auth/session/authorization
- Content management or persistent storage
- Real AI/provider requests, streaming or conversation persistence
- User-specific retrieval, uploads or real weather
- Web-to-API integration
- Production reverse proxy/TLS, deployment, monitoring, abuse controls or migrations

Changing API_HOST or WEB_HOST can expose development servers to a network. They are intended for local development. Production service setup and data-sharing approvals belong to a separate explicit deployment task.

The scaffold needs no secret and no .env file. Do not place API keys in browser sources, generated runtime, committed files or browser responses. Authentication/provider/hosting choices remain product decisions.
