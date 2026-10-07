# Motion clock mandatory review

Reviewed frozen candidate `619e000d170c8c16b22d2905227f3f9051884d54` and the isolated corrective successor. The frozen copy remains unchanged for its single renderer comparison. No weather merge, release identity change or publication is included.

Standards actually read: [review-animations](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/SKILL.md), [motion standards](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md), and [Apple interruptibility/velocity guidance](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md). This is a review of the timing change, not approval of all existing visual motion.

| Before | After | Why |
| --- | --- | --- |
| `619e` gave a newly requested Skip the entire preceding world-frame interval: input at 490 ms, frame at 500 ms, bridge advanced 490 ms | World forwards its RAF timestamp; `story/book-story.js` clips only the first new-intent interval to 10 ms | Time before an intention existed cannot belong to its animation. Pose is unchanged at the input boundary |
| `619e` similarly passed a complete 500 ms interval to new chat; layout retargets also lacked an intent epoch | `chat-host.js` records intent time for configure/open/close and clips the world delivery. Input occurring inside the current RAF retains its pending epoch for the next frame | Prevents an artificial first-frame jump and preserves current position/velocity. No new RAF owner or global GSAP change |
| Repeated card Close emitted another cancel event and reset its timing epoch | `app.js` ignores Close while the target is already the return state | Repeated input cannot indefinitely postpone completion or duplicate its cancellation event |
| A synchronous story listener could start another story while the old rewind advance still had elapsed time remaining; later listeners could see an action paired with a changed state | `story/lifecycle.js` checks the intent serial after phase notification and sends a single captured state for each event | Old overflow never advances a replacement intention; same-frame phase notifications stay internally consistent |
| Long visible gaps previously replayed a slow, capped timeline | Full elapsed analytical updates, bounded chat gate computation, one paint per delivered callback | Restores temporal correctness, but does not manufacture missing display frames or prove visual smoothness |

## Verdict

**Feel-breaking regressions:** Block adoption of `619e` as the final candidate because of the verified pre-intent time accounting and repeated-Close defects above. Those defects have minimal source fixes in the isolated successor and executable regressions; `619e` remains immutable as comparison evidence.

**Performance:** The successor does not add per-substep paint, browser events, layout reads or RAF callbacks. Chat uses at most 120 analytic substeps and can stop earlier; procedural world effects retain their 50 ms simulation cap. The existing animated shell dimensions and clip paths remain rendering-cost concerns outside this clock patch. An apparent single-step move after a long visible stall is still possible: the browser did not deliver the missing intermediate frames. Preventing that by replaying a fresh full animation would reintroduce latency. Do not describe this fix as “no jumps at any FPS” or as an FPS improvement.

**Interruptibility and timing:** New targets preserve displayed position and velocity. The world remains the delivery owner for story/chat; the card retains its existing RAF, and the existing GSAP ticker is only chat's fallback. Consumers now own precise intent epochs rather than inheriting older world time. Chat phase substeps emit no intermediate public events; native handoff still remeasures and gates input before enabling the existing inner layout. Story boundary callbacks can redirect the intention without inheriting old overflow. Repeated Close is idempotent; terminal events remain singular.

**Hidden/resume policy:** Freeze the last presented pose and velocity, cancel/suspend scheduled work, discard hidden wall time, then resume from that state. A frame after returning receives only the new visible interval. Foregrounding itself does not zero velocity or jump to the destination. A later genuinely slow visible frame still consumes its real elapsed time. This is an explicit pause policy, not a claim that the simulation evolves while hidden.

**Baseline and accessibility:** Original 60 Hz chat trajectories, velocity, retarget/reversal behavior and spring constants remain numerically equivalent. Card terminal velocity is deliberately normalized to zero. Existing reduced-motion behavior, native reading/Send/contour bytes and actor/input identities remain covered. Existing long choreography and keyboard-triggered return animation are not newly designed or independently accepted here.

Scoped decision for the corrective successor: approve the source-level clock/intent semantics. Complete verification is green: 257 web tests, 15 vendor/contracts/API/static tests, 159 syntax checks, public scan and exact vendor-byte verification. Keep final rendering/feel acceptance blocked pending its own focused browser evidence. Renderer observations for `619e` must name that exact commit and cannot be relabeled as successor coverage.

## Reproduction and checks

The frozen-negative proof captured all three concrete time/Close failures. The successor's focused suite passes 30/30, including the added actual-world Skip epoch, chat epoch/retarget/same-frame input, repeated-Close completion and synchronous story restart cases. Its 60/30/10/2 Hz, hidden pause, long-gap bounded-work, exact terminal state, native identity and byte-pinned old-source negative cases remain green. The full source/HTTP/DOM aggregate was rerun and passed for the successor; results are not inferred from the earlier candidate.
