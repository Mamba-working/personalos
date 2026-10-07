import {test, enterFeed} from './guards.fixture.mjs';
import {requireFeedColumns} from './guard-model.mjs';

// This opt-in fixture must fail the exact production-feed criterion. It is never
// applied to runtime files, and the wrapper checks the diagnostic, not any failure.
test('known one-column regression @negative-feed', async ({page}) => {
  await enterFeed(page);
  await page.locator('#feed').evaluate(feed => {
    const column = document.createElement('div');
    column.className = 'feed-column';
    [...feed.querySelectorAll('.slot')].forEach(slot => column.append(slot));
    feed.replaceChildren(column);
  });
  const observed = await page.locator('#feed > .feed-column').evaluateAll(nodes => ({columnBoxes: nodes.map(node => {const r=node.getBoundingClientRect();return {x:r.x,w:r.width};})}));
  requireFeedColumns(observed, 2);
});
