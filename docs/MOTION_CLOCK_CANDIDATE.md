# Active-visible motion clock candidate

This is an isolated source candidate based on public alpha.4 commit `64c36696dcc54ba2fa108437a3be49ac830100ef`. It is not a release, deployment, GPU/device acceptance, or an FPS improvement claim. Existing alpha.4 release/provenance records remain unchanged. This clock input is now incorporated into the separately identified local alpha.5 composite; its active inventory explicitly accounts for changed bytes.

## Timing policy

- Visible elapsed time belongs to timelines and closed-form critical springs. Slow frame delivery can omit intermediate images, but cannot stretch a transition by silently throwing time away.
- World RAF wake starts an elapsed-time epoch. Idle, hidden and suspended intervals are excluded; resume starts from the last displayed pose with existing velocity, without replaying hidden time.
- New Skip/chat/retarget intentions are timestamped and receive only elapsed time after their own input epoch, including when input occurs inside a delivered RAF. Repeated card Close is idempotent.
- Story advance consumes the remaining rewind interval and then its leftover elapsed time. Handoff and terminal events each occur once. Large gaps require no per-frame replay.
- Content keeps the authored critical-spring frequencies 17/19 and all native layout/reader behavior. Targets retain the current pose and velocity when reversed. A settled pose is exact and has zero residual velocity.
- Chat retains its authored spring constants and phase gates. Closed-form substeps sample those gates at up to the existing 60 Hz cadence, bounded to 120 computations per delivered frame; there is one paint, not one paint per substep. No elapsed interval is discarded. A settled transition stops immediately.
- The GSAP fallback reads raw `performance.now()` elapsed time, excluding hidden intervals, instead of its lag-smoothed delta. Global GSAP settings and Send are untouched.
- Procedural world effects still receive at most 50 ms per update. Their bounded simulation policy is intentionally separate from presentation time; this is not removal of all physics clamps.

## Scope and motion review

The existing occasional card/dialog motion explains spatial ownership and preserves the same actor. This patch changes clocks, not the visual design, spring tuning, inner layout, scroll ownership, menu WAAPI, Send choreography or weather model.

| Before | After | Why |
| --- | --- | --- |
| World discarded time beyond 50 ms; story discarded time beyond 100 ms | Visible elapsed timeline with bounded phase transitions | A slow frame cannot prolong Skip into many seconds |
| Card critical springs discarded time beyond 32 ms | Exact closed-form update consumes the complete visible interval | Same dynamics and reversible velocity, independent of frame frequency |
| Chat discarded time beyond 40 ms and tested gates once per delivered frame | Bounded analytic substeps consume the interval and resolve existing gates | Sparse frames do not add an entire frame delay at each gate |
| Fallback accepted GSAP lag smoothing | Local elapsed clock with explicit hidden pause | No hidden catch-up, and no changes to global Send timing |
| Uncapped world clock could feed arbitrary effects | Effect update retains its existing 50 ms ceiling | Avoid unstable procedural simulation steps |

Scoped verdict: source timing and interruption checks pass; no new motion design is approved by these checks. Existing shell width/height/clip-path rendering and long authored choreography remain outside this timing patch. Real renderer timing, hardware/device feel and broader rendering cost require separate evidence.

## Verification

The new deterministic suite covers 60/30/10/2 Hz, rewind/handoff overflow, old-source negative controls, hidden/idle resume, card retarget/reversal at multiple phases, chat reversal and resize, zero terminal velocity, single terminal events, original content/input/actor identity, fallback lag smoothing and bounded long-stall work. Original chat trajectories at 60 Hz remain numerically identical to the byte-pinned alpha.4 source.

Accepted native/Send/contour primitives remain byte-pinned. The exact approved clock wrappers are removed only for those pre-existing byte comparisons; independent executable timing tests verify their changed behavior. The old-source fixtures have their own SHA-256 inventory.

Run `npm run check:syntax`, `npm run check:public`, `npm run check:vendor` and `npm test`. `npm run check:provenance` now selects the explicit local alpha.5 inventory and independently pins historical alpha.4 records. A passing source inventory is not release or visual acceptance.
