// Shared criteria are intentionally independent of app state labels.
export function requireFeedColumns(sample, expected) {
  if (sample.columnBoxes.length !== expected) throw new Error(`FEED_COLUMNS: expected ${expected}, observed ${sample.columnBoxes.length}`);
  const xs = sample.columnBoxes.map(box => box.x);
  for (let a=0;a<xs.length;a++) for (let b=a+1;b<xs.length;b++) {
    if (Math.abs(xs[a]-xs[b]) < 20) throw new Error('FEED_COLUMNS: columns collapse to one geometric track');
  }
  for (const box of sample.columnBoxes) if (box.w < 80) throw new Error('FEED_COLUMNS: unreadably narrow column');
}
export function requireMenuContained(samples) {
  const live = samples.filter(sample => sample.menu?.open);
  if (!live.length) throw new Error('MENU_PROCESS: no open/intermediate frames captured');
  for (const sample of live) {
    if (sample.menu.scrollWidth > sample.menu.clientWidth+1) throw new Error(`MENU_OVERFLOW: ${sample.menu.scrollWidth} > ${sample.menu.clientWidth}`);
    if (sample.document.scrollWidth > sample.document.clientWidth+1) throw new Error('MENU_OVERFLOW: document overflow');
  }
}
