# Liquid Glass material candidate

Based on main `0c8bb70db81654c279c306fb534204cbbdad04de`.

The only product implementation changes are one final stylesheet and its HTML
link. `integrations/native-shell/liquid-glass.css` is canonical; the normal build
copies it into the runtime. Runtime provenance is refreshed for these UI files.

## Scope

- Compact segmented filter capsule; the existing measured indicator and its
  transform/width transition remain responsible for selection motion.
- Chat, motion and menu triggers receive a rounded glass material while retaining
  their existing labels, hit targets, listeners and opening/closing controllers.
- Preview cards use a local navy reading gradient (72% at the top, 62% through
  the text region, 20% at the lower edge) and only 2px backdrop blur.
  Text is neither filtered nor outlined with a shadow. The reader uses a stronger
  88% tint for long-form readability without changing its measured layout.
- The masthead receives a separate noninteractive scrim only over scrolled
  content. The header itself never becomes a filtered/transformed containing
  block, so fixed menu geometry stays viewport-relative.
- Native document/feed/reader scrolling, original motion declarations, all
  controller JavaScript, original 3D module, host and generated 3D payload stay
  byte-identical. Filter capsule spacing intentionally changes; it is not a
  promise of unchanged initial card coordinates.

## Compatibility

This is a CSS glass fallback with edge highlights and backdrop blur, **not true
optical refraction**. No React dependency or new animation library is added.
The upstream [liquid-glass-react](https://github.com/rdev/liquid-glass-react)
README explicitly notes that Safari and Firefox do not show its displacement.
Non-backdrop-filter and reduced-transparency fallbacks preserve legibility.

## Verification boundary

Build (including motion-ball TypeScript), `npm run check`, and `npm test` passed
in the cloud under Node 24.22.1 (repository pin is 24.19.0). Web suite: 74 tests,
including new baseline hash guards for 129 original integration/3D files and
checks that the new sheet adds no competing animation/transform ownership.
Navigation tests explicitly load the new sheet; intentional capsule expectations
are updated without removing state, focus, labels or target-size assertions.

Cloud browser launch was blocked by socket sandbox restrictions. The permitted
escalated launch then failed in environment setup before the browser ran. Thus
normal-speed motion, actual CSS pixels, repeated/interrupted browser flows,
Safari, GPU composition and physical mobile behavior are **not verified** by
this candidate. Source/hash checks do not substitute for those acceptance gates.
The candidate is now submitted as a draft pull request. No merge or deployment
is included. A separate Chromium/SwiftShader CI workflow captures actual
rendering and repeated interactions; its report is software-rendered browser
evidence, not physical GPU or mobile acceptance.
