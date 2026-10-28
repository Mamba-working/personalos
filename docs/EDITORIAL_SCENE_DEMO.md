# Editorial / scene exploration demo

PR #10 evolves the glass-material experiment into the selected editorial layout.
Work uses illustrated covers, Thoughts uses plain typography, and Labs uses a
smaller preview. These are authored demo content and original SVG illustrations,
not claims about the owner's real projects. Categories remain interleaved in the
same native feed. Mobile uses one native scrolling column.

## Ownership and continuity

- `scene-explore.js` owns only the content layer's opacity, focus and input lease.
  No card reflow or scene transform follows the ball.
- `reading → entering → exploring → returning → reading` is reversible. A closed-
  form critically damped spring with omega 14 preserves position and velocity
  when interrupted. Reduced motion settles immediately.
- The layer becomes inert before fading. Wheel, touch and page-navigation keys
  cannot change its saved scroll position while exploring. Escape or the return
  button restores the same DOM, scroll position and prior focus.
- Existing scene public APIs handle actual pointer dragging and ground clicks.
  Mobile canvas uses `pan-y` in reading and `none` only in exploration. Existing
  modal/menu/chat states deny acquisition. A new scene is never instantiated.
- Original `modules/motion-ball` sources/assets, generated scene, native card
  geometry/controller, menu and chat controllers remain byte-identical. Four
  reviewed integration exceptions are host state exposure, the scene-input
  adapter, native feed sizing, and authored content. 125 original files retain
  a pinned hash guard. No shader/renderer/brain edits.
- Detail still transfers the same semantic article through preview, intermediate
  and detail geometry. The editorial identity retains its typography and cover
  dimensions when moved into the reader.

## Verification

The CI workflow records actual Chromium WebM at wall-clock speed and emits a JSON
report, screenshots and action timestamps. No generated video, slideshow,
manual animation advancement, frame interpolation or speed-up is used.

SwiftShader is **software WebGL**, not physical GPU or real iOS acceptance.
Instrumented frame times and a raw recording cannot establish real-device
smoothness. Desktop/mobile viewport behavior, actual pointer effects, preserved
scroll/focus and reversal assertions must all pass before calling a run verified.
Latest exact commit/run evidence is recorded in the PR description.

No production deploy or merge is included.
