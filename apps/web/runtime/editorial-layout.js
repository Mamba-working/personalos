// Settle native card measurements after the bundled font arrives.
// No new scroll, transition, camera or actor controller.
document.fonts.ready.then(() => window.dispatchEvent(new Event('resize')));
