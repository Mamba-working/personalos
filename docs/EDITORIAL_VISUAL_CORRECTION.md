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
