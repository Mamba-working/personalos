# Editorial visual correction

The previous functional demo did not meet the selected editorial visual target. This revision is not yet visual acceptance.

- Retain the original motion-ball source, assets, camera and actor. Concept-image scenery is not a replacement target.
- Keep visual studies in the primary column and Thoughts in the narrow reading column. Labs and secondary Work use image-and-copy rows.
- Bound the warm paper reading scrim to the content side, with clear scenery on the right. The scrim belongs to the fading content, not the scene.
- Use bundled subset Noto Serif CJK SC for consistent Chinese editorial titles and text. Source: https://github.com/notofonts/noto-cjk (SIL OFL, included license). The subset covers authored fixture copy; unlisted text falls back to system serif.
- Use the unmodified Phosphor regular arrow-right icon, MIT license included. Source: https://github.com/phosphor-icons/core.
- The three WebP card covers are original AI-generated fictional concept art: a cream desktop/mobile product study, glass spheres over reflective water, and a quiet lakeside interior. These are demonstration artwork, not the owner's real project portfolio or photography. They do not replace any 3D asset.
- Header categories retain the same native filter actions. The original header-action byte check removes only the relocated categories before verifying the unchanged controls.

## Verification gates

Compare actual desktop captures at 1505 × 1045 against the selected scrolling reference: first Work image partially above the viewport, Labs header at 344 px, and independent Thoughts beside it. Also inspect the top state and mobile viewport. Passing interaction assertions does not certify visual fidelity. Browser recordings remain actual wall-clock SwiftShader software rendering, not hardware smoothness acceptance.

## Spacing, interaction and readability pass (2026-11-05)

Editorial CSS only (`integrations/native-shell/editorial.css`). The scene, camera, actor, card geometry and card/menu/chat controllers are unchanged.

- Mixed feed at 1101 px and wider: Thoughts no longer pull 3.8vw left over a 3vw gap, which overlapped the Labs/Work copy track by 9–15 px at 1101–1920 px. The feed widens so Thoughts keep a ~21vw measure, and the first Thought stays level with `labs-spring`.
- One vertical rhythm per breakpoint: 56 px desktop, 48 px tablet, 40 px mobile. Before: 34 px with a 14 px exception, 34 px, and 12 px (the compact rule overrode the editorial 34 px).
- Line measure: the `work-map` copy track never drops below 140 px, and tablet Thoughts headings clamp to 21–27 px. Headings use `text-wrap: balance`, summaries `text-wrap: pretty`. No one-character last lines at 1920, 1505, 1366, 1280, 1101, 1024, 768, 390 or 320 px.
- Touch: mobile filters keep their 30 px visual row with a 44 px hit area; the motion toggle is 44 × 44 px.
- States: card hover and keyboard focus share one state (ink-filled arrow, 3 px nudge). Transitions sit on the base state, so leaving hover eases back instead of snapping. Filters darken on hover. Reduced motion removes these transitions.
- Readability: summaries and category labels use the card body ink. At night a second veil, bounded to the feed's right edge, fades in, and Thoughts body copy takes full ink. On mobile, Work copy and category labels get the same local paper support Labs copy already had.

Verification ran in headless Chrome 156 on an Apple M5 GPU (ANGLE Metal hardware WebGL, not SwiftShader), with trusted pointer, touch and keyboard input:

- Text contrast was measured on rendered pixels with the text hidden: the darkest 5% of each text box against the text colour, at the 1505 × 1045 reference scroll and the 390 × 844 reading scroll. Before: desktop night Thoughts 1.9–2.4:1, Labs/Work summaries 3.3:1; mobile night `work-map` title 1.4:1; mobile Labs/Work category labels about 2:1 by day. After: every measured element is at least 4.8:1 by day and at night.
- Card open, Escape close and mid-open reversal show no frame-to-frame jumps in the travel shell; card handoff stays within 0.3 px; scroll and focus return to the same card. Filters, Explore, menu and chat keep their phases, focus return and Escape behaviour. Baseline and patched runs show the same card motion timing.
- Not covered: Safari/iOS, weather states other than the default day and forced night, `prefers-reduced-transparency` rendering, and visual acceptance by the owner. Sporadic 60–490 ms frames on a card's first open or close appeared in both baseline and patched runs, without main-thread long tasks (likely image decode or raster); they are not addressed here.

## Narrow-screen pass (2026-11-05, after owner feedback)

The owner judged the narrow homepage (the 545 px preview pane) ugly: a heavy three-row masthead with a band under it, hero copy fading into a grey fog over the mountain, per-line paper boxes behind card text, the first card touching the actor, and a detail sheet whose paper vanished in one frame at the end of closing.

- 360–650 px: a two-row masthead, 100 px instead of 130 px (brand, chat, menu; then categories, pause/resume, Explore), with no band or hairline under it. Controls are 36 px hairline pills with 44 px hit areas, and the "≈" glyph is drawn as pause/resume for the same button and labels. Below 360 px the three-row masthead stays.
- Hero: paper holds the title and a darker description, then clears before the actor. The first card starts 47–68 px below the actor instead of touching it.
- Feed: one soft paper sheet behind the mobile feed, fading in just below the actor, replaces the per-line text boxes, the label chips and the clipped radial behind Thoughts.
- Detail sheet: its paper, shadow and blur follow the card's travel progress. The hash-guarded card controller exposes progress only as the backdrop's inline opacity, so the editorial layer reads that value in four steps blended over 90 ms. A cleaner hook would be a progress variable written by the controller, which needs the owner's approval to change.
- Card hover: the ring darkens and the arrow steps forward, without an ink fill, and only on pointers that can hover.

Measured with the same headless Chrome on Apple M5: hero description at 545 × 694 went from 1.3:1 to 5.2:1 by day and from 2.2:1 to 4.9:1 at night; mobile feed text is at least 7.0:1 day and night; the last visible sheet alpha when closing went from 0.97 to at most 0.16, changing at most 0.16 per frame. Card handoff geometry and focus and scroll restoration are unchanged. This pass still needs the owner's visual review.

Masthead, second pass (same day): the owner still found the bubble controls ugly. On narrow screens the chat, menu, pause/resume and Explore controls are now quiet text buttons in the masthead's label style, with no fill, border or shadow, 44 × 44 px hit areas, and their labels on the content's right edge. The pause/resume glyph is centred (a grid had put the hidden "≈" text in its own row). "All" no longer renders at 10 px and 70% opacity like a disabled item. At 360 px the second row now fits instead of pushing Explore onto a third line, and at 651–700 px the single-row tablet masthead no longer pushes the menu off-screen.
