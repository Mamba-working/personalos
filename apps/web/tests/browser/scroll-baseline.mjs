// Read the native document, never the collector's most recent presented frame.
// Keep the unchanged enclosing flow budget: a moving/hidden page cannot wait forever.
export async function captureSettledScroll(page) {
  return page.evaluate(async () => {
    let previous = document.scrollingElement.scrollTop;
    for (;;) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const scrollTop = document.scrollingElement.scrollTop;
      if (scrollTop === previous) return {scrollTop, viewportWidth: innerWidth};
      previous = scrollTop;
    }
  });
}

export const readDocumentScroll = page => page.evaluate(() => document.scrollingElement.scrollTop);
