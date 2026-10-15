# OpenIntelligentUI source pin

Repository: https://github.com/CopilotKit/OpenIntelligentUI
Commit: 8391a94c1c3939c679e40ddd7bfc08a9ef690e70
License: MIT, Copyright (c) Atai Barkai; full license retained in this directory

The schema, Websandbox loader, and shared design-system source are copied from this exact commit. Reference copies of the upstream renderer, frame builder and partial preview processor are retained as .txt files for source comparison. The active PersonalOS completed-artifact adapter uses the upstream Websandbox creation/lifecycle, ordered JavaScript channel execution, source-checked resize and 50..4000 height clamp. It uses the actual @jetbrains/websandbox runtime pinned to 1.2.1 (Apache-2.0).

Adaptations are explicit: persisted complete activities rather than CopilotKit streaming hooks; Next/Nest/PG persistence rather than Python/AG-UI; no partial HTML preview/export overlay/trip helpers/CDN importmap; default-deny frame networking; protocol-level host bridge allowlist and host-confirmed follow-up proposals. No Jev, provider credential or model request is included. This is an adapted upstream sandbox rendering rail, not the entire stock OpenIntelligentUI application.
