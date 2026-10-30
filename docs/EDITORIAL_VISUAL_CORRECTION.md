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
