# Browser process guards (stock Chrome candidate)

This additive, test-only candidate starts at public main commit
`64c36696dcc54ba2fa108437a3be49ac830100ef`. The existing CI workflow, original
source/DOM suites, HTTP API/static tests, contracts, runtime and provenance are
unchanged. The Next migration is outside this candidate.

## Current validation status: review-only draft\n\nThis is a separate branded-Chrome candidate. Historical Chromium 141 observations below remain historical and do not certify stock Chrome. Draft PR #2 preserves the pinned-Chromium/helper investigation: its hosted helper was actually root:root mode 0777, with no setuid bit. This branch changes the browser baseline explicitly to the runner's already-installed official Google Chrome through Playwright channel `chrome`, retains Playwright 1.56.1 and all original product/negative-control criteria, and does not modify OS security or permissions.\n\nThe exact branded Chrome version and installed-package consistency are recorded per run. A two-minute CI preflight requires sandboxed launch, blank-page renderer execution and a nonblank synthetic WebGL triangle using the unchanged render-pixel criterion before any browser product/negative-control test. Chrome/old-driver compatibility, default graphics availability and product behavior must be established by actual exact-head CI; none is assumed. This smoke is not the production Ball/book render gate, and has no hardware/FPS/device conclusion.\n\n[Playwright documents the branded Chrome channel](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge) and notes its headless behavior differs from the bundled Chromium headless shell. This candidate neither installs/upgrades Chrome nor substitutes a sandbox helper. Package metadata/checksum checks are consistency checks, not a full security audit. Hosted executable permissions are recorded, and the runner's trusted setup/isolation are part of this limited test threat model.

The default-instrumented browser/render gate has a recorded failure. Native Skip-to-home completion in the observed software-rendered environment took 34,183.9 ms and exceeded the unchanged 30-second state wait. The failed run remains a failed observation; later home settlement is not relabeled a pass.

A separate minimal-instrumentation run completed the bounded intro-to-home, real Ball pointer activation, chat open/Escape-close and native scroll-to-dock flow. It observed one nonblank actual WebGL canvas, stable actor identity and zero before/during/after source BCR change from paint-only isolation. This limited software-renderer observation does not certify the default gate, full browser aggregate, hardware GPU, physical iPhone/Safari/IME, FPS, performance thresholds or final visual acceptance.

The final six-case default-instrumented DOM aggregate has not been rerun/certified after the harness repairs. The original source/API aggregate was started locally, but its result became unavailable; it is not counted as a verified pass. GitHub CI must be read for the exact published candidate, independently of main's historical result. Criterion unit tests and explicit one-column/initialized-blank-render negative controls have passed their intended detection checks.

Keep this PR in draft. Product runtime, API/contracts, provenance and the original CI workflow are unchanged. No merge or deployment acceptance follows from this candidate, even if an individual CI job becomes green.

## Reproduce

Use the pinned Node version in `.nvmrc`, then:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run setup
    npm ci --prefix apps/web/tests/browser --ignore-scripts --no-audit --no-fund
    apps/web/tests/browser/node_modules/.bin/playwright install --with-deps chromium
    node apps/web/tests/browser/stock-chrome-preflight.mjs
    npm --prefix apps/web/tests/browser run test:unit
    npm --prefix apps/web/tests/browser run test:negative
    npm --prefix apps/web/tests/browser test -- --grep-invert '@negative|@render'
    npm --prefix apps/web/tests/browser run test:render-negative
    npm --prefix apps/web/tests/browser test -- --grep '@render'

Playwright Test remains exactly pinned to 1.56.1, with lockfile integrity. The
unchanged installer still downloads bundled Chromium 141 and FFmpeg, but this
candidate selects the already-installed branded Chrome via channel `chrome`.
Its actual version is not repository-pinned and must be recorded for each run.
The CI retains the official installer, sandbox enabled, zero custom launch flags,
one worker, a bounded 180-second per-flow / 30-second state budget (instrumented software rendering is not a performance gate), no retries, no secrets, and `contents: read`. It uses a new isolated
browser context and a repository-owned static server on port 4381, with no reuse
of an existing server. Test requests outside that demo origin are aborted.

This suite is reproducible project test code. It is not computer-use automation
against the user's browser or a workaround for denied browser access. Never add
unsafe WebGL/SwiftShader flags, disable the sandbox, bypass security warnings or
treat a browser-baseline change as proof that the earlier engine passed. This separately authorized branded-Chrome candidate records its own outcomes.

## Small first scope

Each guard runs at CSS viewports 390 x 844 and 1280 x 900 with real Chromium
pointer/keyboard actions. Mobile here is a viewport, not an iPhone simulation.

- Default All contains 18 authored records, six per category. Native geometric
  columns must be two at 390 and three at 1280; dataset labels alone do not pass
- Menu open/close and Escape during opening capture frame geometry, detect
  transient horizontal overflow, document/header jumps and focus loss. Real
  menu links exercise Work and All navigation
- Card pointer open, native wheel reading, Escape close, keyboard interrupted
  reopening and browser Back verify the same card node, focus and scroll return
- Local demo chat draft/Enter send, close during local answer production, retained
  transcript, Back and mobile closing underlay verify scroll/site restoration

The rAF collector is read-only: it does not call manual-step hooks, replace the
animation clock or force app state. It samples DOM/state at browser-presented
frames. CPU timing with the collector is instrumented and is not a performance
benchmark. Very brief failures between presented frames cannot be detected.

## Negative control

`test:negative` deliberately collapses the feed into one geometric column in an
isolated browser test. The production feed criterion must fail with the exact
`FEED_COLUMNS: expected 2, observed 1` diagnostic. Browser launch failures,
timeouts or arbitrary test failures do not count as detection. The wrapper exits
zero only for that specific detection and records a separate proof JSON. The
negative fixture never edits runtime files and is excluded from normal tests.

A separate render-negative browser fixture initializes a WebGL canvas but draws no scene, while CSS gradients and colored DOM are deliberately present. The exact `RENDER_PIXELS` failure is required; missing WebGL/launch failure does not prove detection. Capture hides all excluded descendant subtrees/pseudo-elements and neutralizes canvas/ancestor CSS backgrounds, borders and shadows. It never changes production buffer preservation or invokes the production render handler. Normal UI screenshots remain separate from isolated pixel proof.

The unit guard checks also verify coincident columns, transient menu overflow,
and transparent/solid image rejection. Capture-phase real input events must establish Escape actually arrived during opening/intermediate, and chat Close during generation.

## Render coverage must remain explicit

The separate `render-coverage` CI job is a real gate. Missing/failed/lost WebGL,
zero canvas, fallback, zero draw calls/triangles or blank canvas fail it; there
is no conditional skip, expected-failure annotation or `continue-on-error`.

When rendering exists, the guard observes real-time book/actor state progress,
a nonblank screenshot of the actual renderer canvas with noncanvas DOM temporarily hidden for capture, stable actor identity,
Skip to home, real actor activation, chat close and native scroll-to-dock. Three key images capture isolated intro canvas pixels, home UI and restored/scrolled dock UI. Its renderer string is captured. A
software renderer is possible under default Chromium and cannot establish
hardware GPU behavior. This first guard establishes only nonblank canvas and
actor/book controller continuity; scene fidelity, book geometry, contact
shadows and final visual judgment remain separate acceptance work.

Browser DOM tests can exercise the app's genuine fallback chat/content path
when WebGL is absent. That is recorded as fallback, never a Ball/book/render
pass. A green DOM job alone is not product acceptance. Even green DOM and render
jobs do not establish physical iPhone/Safari keyboard/IME, hardware GPU,
performance thresholds or final visual/user acceptance.

## Evidence and public artifact safety

`evidence/browser-run/` is ignored. The source-pinned run manifest records the
baseline/check-out commits, exact runtime and test-file hashes, Node/Playwright,
OS/kernel, viewport, outcomes and observed/blocked/unclaimed scope. Each test
attaches and persists a frame geometry/event timeline and explicit renderer availability.
Failed tests retain trace, screenshot and video. DOM failure artifacts and all
render-scope artifacts have seven-day CI retention.

Only this same-app authored demonstration and clearly synthetic test text are
used. No personal content, login, existing browser profile, credentials, storage
state, production endpoint or user data is loaded. Input is cleared on teardown
and contexts are discarded. Traces may retain the explicitly synthetic test
text they exercised. Do not repoint these upload rules at a real-user browser,
account, deployment or personal data without a separate artifact/privacy review.
The existing public-file heuristic remains, and is not a full secret audit.

## Review before publishing

Run the original `npm run check` and `npm test` unchanged, the new criterion
unit tests, the negative browser proof, DOM guards and render guard separately.
Report passed, failed, blocked and never-run stages as separate facts. Local
success does not establish GitHub Actions execution: inspect the exact candidate
commit's CI after an authorized draft PR is published. This candidate must not
be merged or described as accepted solely because CI is green.

## Bounded instrumentation timing comparison

`npm --prefix apps/web/tests/browser run test:timing` measures the same native first-card open/Escape-close flow. Repeat with `PERSONALOS_LIGHTWEIGHT_GUARD=1` to disable the frame collector, trace, video and screenshots while retaining minimal phase-event timestamps and environment/wall-time JSON. Hold the same cooperative heavy lock around each run. This is a diagnostic comparison, excluded from CI guard selection; host load is recorded and unrelated host work is uncontrolled. Semantic timeouts remain bounded, and no performance threshold or hardware/iPhone conclusion is evaluated. Preserve >8-second observations as environment/instrumentation timing signals even when later semantic completion is observed.

Canvas proof isolation changes paint only: visibility, backgrounds, shadow paint and border/outline color. It preserves border widths, generated pseudo-element layout and all source DOM layout. A same-JavaScript-turn before/during/after comparison covers root/body, world stage/canvas, app/header/content/feed and Ball hit geometry; any BCR change over 0.01 CSS px fails capture before pixel evaluation. The geometry proof is retained beside isolated and normal UI images.
