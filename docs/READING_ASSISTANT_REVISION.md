# Mobile reading assistant reservation

Initial alpha.5 candidate 0fc929ff0b602ac3b2769804ef7a447c61d30afa completed its browser interaction flows but visibly failed unobstructed mobile reading: the Ball and caption overlaid the scrolling body. That behavioral pass is not visual acceptance. The original source and inventory remain frozen as a negative reference.

| Before | After | Why |
| --- | --- | --- |
| Mobile reader extended underneath a viewport-corner assistant | The initial content target reserves a sibling assistant shelf and a 12 px gap | The actual native scroll viewport ends above the assistant; body padding cannot provide this guarantee |
| Actor position was independent of reader geometry | Host consumes the content owner's cached shelf actor rectangle | Same actor and spring, explicit placement inside the reserved area, no per-frame DOM measurement |
| Caption sat below the floating Ball | The same button's caption stays centered below it with a compact gap inside the shelf | Keeps the entry visible and usable without covering text or hiding the Ball |
| No overlap regression | Exact old-source fixtures plus native Range/clip intersection oracle | Negative control must fail and multiple native scroll positions must remain clear |

## Boundaries

Only app.js, host.js and an appended host.css section change at runtime. The content target has its final reserved height at selection; nothing suddenly shrinks when phase becomes detail. Width, body measure, font declarations, article/reader/input nodes, existing springs, history and scroll ownership remain intact. The same native reader occupies the shell below an explicit 64 px Close control area, with no extra nested scrolling element. The shelf uses the same opaque surface/stroke palette and adds no blur, glass or shadow.

The existing actor moves continuously to the shelf using the existing world placement spring. The same semantic button remains the entry to the same chat. Shelf geometry is committed only on selection/resize and cleared on terminal return. Fallback chat, when needed, shares the exact reserved rectangle. Desktop target geometry is unchanged.

The mobile shelf is 88 px high when space permits, with a 48 px actor; short viewports can reduce the shelf down to 80 px while preserving at least a 104 px shell (64 px controls plus 40 px native body viewport), and the gap. The full 50.4 px hit box and unchanged 11 px/16 px caption fit inside the shelf. At less than 196 px available vertical space, that simultaneous layout cannot fit; no unobstructed-reading claim is made for such an unusably short viewport. Device keyboard behavior remains a separate existing gate.

## Verification contract

Source tests compare initial targets and inner layout against pinned initial-alpha.5 code, exercise interruptions/return focus and native node/scroll retention, prohibit new frame-time DOM measurements, and prove that the rectangle oracle detects the former overlap. Synthetic line boxes are explicitly not real browser glyph measurements.

The reusable browser collector reads actual Range.getClientRects for body text, intersects those rectangles with the actual native reader clip, and compares visible ink against the projected actor, original hit button and caption. It also checks that those obstacles fit inside the shelf. A valid browser result needs native scrolling at top, middle, deep and end positions, visible actor/caption, unchanged body width/font, and reading→chat→return retention. Hiding the entry or adding bottom padding cannot count as success. Fresh browser and visual evidence must identify this revision rather than the initial alpha.5 commit.

Motion review: no new animation was introduced. Existing occasional spatial-ownership movement remains interruptible and velocity-preserving. The layout reservation is established at intention time, with the same outer shell morph. Source review alone cannot approve rendered clearance; the native geometry/screenshot gate remains required.

The reading dialog explicitly owns only the currently available original assistant button through aria-owns. Its Tab cycle routes both forward and backward across the external entry instead of assuming DOM order. Ownership is suspended during chat opening/open/closing, restored on close, updated on fallback/recovery and removed on terminal content return. This is a minimal external-ownership bridge for the shared actor; actual assistive-technology behavior still requires independent verification.

Keyboard focus preserves native reveal behavior for article links/buttons: those receive ordinary focus so offscreen targets scroll into the reader. Only the fixed close/assistant targets use preventScroll.

The reading-only focus outline keeps its existing2px stroke with a2px offset so it remains within the reserved shelf and clear of the compact caption. The browser oracle includes its computed outer bounds when focus-visible.


## Reading-controls r2 review

The immutable b917dda reading-shelf revision passed Range clearance against the assistant, but actual page pixels showed Close over visible body text and a half-Ball silhouette cut at y=780. Its first returned preview frame also changed caption spacing abruptly. Those findings override the narrower geometry pass.

| Before | After | Why |
| --- | --- | --- |
| Close floated over the full-height native reader | A real 64 px control area sits above the same native scroll viewport | Scrolling ink cannot pass behind Close; body width, typography and nodes are unchanged |
| Starting a reserved header could shift source content abruptly | The existing progress drives an inverse content-plane translation and header opacity | The source offset cancels at progress zero and joins the final header at progress one; no new clock or spring |
| Zero-scroll return kept the reading clip active | Every return removes reading overflow before translating the plane | The source card is not clipped until terminal reparenting |
| Caption switched from a compact gap to hero spacing at returned | One size-based CSS clamp owns spacing in every content phase | The same 50.4 px projected hit target has a 4 px gap before and after return; original large-hero spacing remains unchanged |

The caption rule is position-continuous at both breakpoints; its slope is piecewise, so source review does not certify perceived velocity smoothness. No animation duration, spring, actor/camera position, WebGL setting or rendering clock changes. Header transform/opacity derive from the existing reversible progress, including reduced-motion endpoints. Selection, interruption, zero/deep scroll return and keyboard focus retain their existing owners.

The half-Ball page cut remains unresolved at the time of this source revision. Same-world-frame raw WebGL pixels show the complete silhouette through y=803; floor, platter, story and weather ancestors are hidden. Canvas, GL viewport and published compositor-layer bounds are 844 px high. A rail visibility A/B/A control did not affect the y=780 cut. The recorded 780 px transition-stage paint rectangle starts at y=64 and is a repaint area, not a proven clipping owner. No product renderer workaround is included, and no visual acceptance is claimed from these diagnostics.

The revised native Range collector includes Close separately from footer containment. Source tests keep the actual old-alpha.5 overlap fixture, test synthetic Close collisions, and check header and caption continuity. Real page pixels and a full silhouette check remain required for acceptance; raw WebGL success alone does not substitute for what appears on the page.
