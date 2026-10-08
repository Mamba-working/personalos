import {test, expect, enterFeed, expectPreview, chatEntry} from './guards.fixture.mjs';
import {requireFeedColumns, requireMenuContained} from './guard-model.mjs';
import {captureSettledScroll, readDocumentScroll} from './scroll-baseline.mjs';
import {armContentInterruption} from './intro-evidence.mjs';

const sample = page => page.evaluate(() => window.__browserGuard.sample());
const waitMenu = (page, phase) => expect(page.locator('.pos-menu')).toHaveAttribute('data-state', phase);

test('default All mixed feed and menu process/reversal have contained geometry', async ({page}) => {
  await enterFeed(page);
  const initial = await sample(page);
  requireFeedColumns(initial, initial.viewport.w <= 650 ? 2 : 3);
  const categories = await page.locator('#feed .card').evaluateAll(cards => cards.reduce((counts, card) => ({...counts, [card.dataset.category]: (counts[card.dataset.category] || 0)+1}), {}));
  expect(categories).toEqual({work: 6, thoughts: 6, labs: 6});
  const start = initial.t;
  const interrupt = page.waitForFunction(() => document.querySelector('.pos-menu')?.dataset.state === 'opening').then(() => page.keyboard.press('Escape'));
  await page.getByRole('button', {name: '打开空间菜单'}).click();
  await interrupt;
  expect(await page.evaluate(() => window.__browserGuard.events.some(event => event.name==='real-keydown' && event.key==='Escape' && event.menuPhase==='opening'))).toBe(true);
  await waitMenu(page, 'closed');
  await page.getByRole('button', {name: '打开空间菜单'}).press('Enter');
  await waitMenu(page, 'open');
  await page.getByRole('button', {name: '关闭空间菜单'}).click();
  await waitMenu(page, 'closed');
  const process = await page.evaluate(t => window.__browserGuard.rows.filter(row => row.t >= t), start);
  requireMenuContained(process);
  expect(process.some(row => row.menu?.phase === 'opening')).toBe(true);
  expect(process.some(row => row.menu?.phase === 'closing')).toBe(true);
  expect(Math.max(...process.map(row => Math.abs(row.document.scrollTop-initial.document.scrollTop)))).toBeLessThanOrEqual(1);
  expect(Math.max(...process.filter(row => row.header).map(row => Math.abs(row.header.y-initial.header.y)))).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', {name: '打开空间菜单'})).toBeFocused();
  // Native modal links drive the same controlled category owner.
  await page.getByRole('button', {name: '打开空间菜单'}).click();
  await waitMenu(page, 'open');
  await page.locator('[data-menu-category="work"]').click();
  await waitMenu(page, 'closed');
  await expect(page.locator('#feed .slot:not(.excluded)')).toHaveCount(6);
  await expect(page.locator('[data-filter="work"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('#feed .slot:not(.excluded)')).toHaveCount(18);
});

test('card uses native reader scroll, keeps node identity and handles close/back interruption', async ({page}) => {
  await enterFeed(page);
  const opener = page.locator('#feed .open-card').first();
  await opener.scrollIntoViewIfNeeded();
  const original = await opener.evaluate(button => {
    window.__originalCard = button.closest('.card');
    return {id: window.__originalCard.dataset.contentId, offset: document.scrollingElement.scrollTop};
  });
  await opener.click();
  await expect.poll(() => page.evaluate(() => window.personalOSContent.getState().phase)).toBe('detail');
  await expect(page.locator('#close')).toBeFocused();
  const reader = page.locator('#reader');
  await expect.poll(() => reader.evaluate(node => node.scrollHeight-node.clientHeight)).toBeGreaterThan(30);
  const bounds = await reader.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2, bounds.y+bounds.height/2);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => reader.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
  await page.keyboard.press('Escape');
  await expectPreview(page);
  expect(await page.evaluate(() => window.__originalCard === document.querySelector(`[data-content-id="${window.__originalCard.dataset.contentId}"]`))).toBe(true);
  expect(Math.abs((await sample(page)).document.scrollTop-original.offset)).toBeLessThanOrEqual(2);
  await expect(page.locator(`[data-content-id="${original.id}"] .open-card`)).toBeFocused();
  const interruption = await armContentInterruption(page, {contentId:original.id, timeout:30000, onSignal:() => page.keyboard.press('Escape')});
  try {
    await page.keyboard.press('Enter');
    await interruption.completed;
  } finally {
    await interruption.dispose();
  }
  expect(await page.evaluate(() => window.__browserGuard.events.some(event => event.name==='real-keydown' && event.key==='Escape' && event.trusted && event.contentPhase==='intermediate'))).toBe(true);
  await expectPreview(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.personalOSContent.getState().phase)).toBe('detail');
  await page.goBack();
  await expectPreview(page);
  expect(new URL(page.url()).searchParams.has('item')).toBe(false);
  const rows = await page.evaluate(() => window.__browserGuard.rows);
  expect(rows.some(row => row.content?.phase === 'intermediate')).toBe(true);
  expect(rows.some(row => row.content?.phase === 'return')).toBe(true);
});

test('local demo chat retains draft/send and restores close underlay and scroll', async ({page}) => {
  await enterFeed(page);
  await page.locator('#feed .open-card').first().scrollIntoViewIfNeeded();
  let entry = await chatEntry(page);
  await entry.scrollIntoViewIfNeeded();
  const initial = await captureSettledScroll(page);
  await entry.click();
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('open');
  const input = page.getByRole('textbox', {name: '聊天问题'});
  const draft = 'Guard demo';
  await input.click();
  await page.keyboard.type(draft);
  await expect(input).toHaveValue(draft);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('closed');
  await expect(page.locator('#ai-canvas')).toBeHidden();
  expect(Math.abs((await readDocumentScroll(page))-initial.scrollTop)).toBeLessThanOrEqual(2);
  entry = await chatEntry(page);
  await entry.press('Enter');
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('open');
  await expect(input).toHaveValue(draft);
  await input.click();
  const closeStart = (await sample(page)).t;
  const interruptGeneration = page.waitForFunction(() => document.querySelector('#ai-canvas')?.dataset.generating === 'true').then(() => page.getByRole('button', {name: '关闭聊天'}).click());
  await page.keyboard.press('Enter');
  await interruptGeneration;
  await expect(page.locator('.message.user')).toHaveText(draft);
  // Close immediately makes the dialog inert and then hidden. Inspect the
  // same retained textarea's state; all typing still uses the visible role.
  await expect(page.locator('#question')).toHaveValue('');
  await expect(page.locator('.message.assistant .stream-text')).not.toBeEmpty();
  expect(await page.evaluate(() => window.__browserGuard.events.some(event => event.name==='real-click' && event.target==='ai-close' && event.generating))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('closed');
  await expect(page.locator('#ai-canvas')).toBeHidden();
  await expect(page.locator('.app')).not.toHaveAttribute('inert', '');
  expect(Math.abs((await readDocumentScroll(page))-initial.scrollTop)).toBeLessThanOrEqual(2);
  const closing = await page.evaluate(t => window.__browserGuard.rows.filter(row => row.t >= t && row.chat?.phase === 'closing'), closeStart);
  expect(closing.length).toBeGreaterThan(0);
  if (initial.viewportWidth <= 650) {
    expect(closing.some(row => row.chat.backgroundShown && row.chat.background?.w > 0)).toBe(true);
    expect(closing.filter(row => row.chat.backgroundShown).every(row => row.header?.h > 20)).toBe(true);
  }
  await (await chatEntry(page)).click();
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('open');
  await expect(input).toHaveValue('');
  await expect(page.locator('.message.user')).toHaveText(draft);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.personalOSChat.getState().phase)).toBe('closed');
});


