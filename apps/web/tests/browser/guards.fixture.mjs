import {test as base, expect} from '@playwright/test';

export const test = base.extend({
  page: async ({page, browser}, use, testInfo) => {
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4381') return route.continue();
      return route.abort('blockedbyclient');
    });
    const light = process.env.PERSONALOS_LIGHTWEIGHT_GUARD === '1';
    if (!light) await page.addInitScript(() => {
      const rows = [], events = [];
      const box = node => {
        if (!node || !node.getClientRects().length) return null;
        const r = node.getBoundingClientRect();
        return {x: r.x, y: r.y, w: r.width, h: r.height};
      };
      const snap = () => {
        const menu = document.querySelector('.pos-menu-dialog');
        const scroller = document.querySelector('.pos-menu-content');
        const chat = document.querySelector('#ai-canvas');
        const background = document.querySelector('.mobile-chat-background');
        const sample = {
          t: performance.now(), viewport: {w: innerWidth, h: innerHeight},
          document: {scrollTop: document.scrollingElement?.scrollTop || 0, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth},
          content: window.personalOSContent?.getState() || null,
          menu: menu && {open: menu.open, phase: document.querySelector('.pos-menu')?.dataset.state, scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth, panel: box(document.querySelector('.pos-menu-panel'))},
          chat: chat && {hidden: chat.hidden, phase: window.personalOSChat?.getState().phase, mobileFlow: window.personalOSChat?.getState().mobileFlow, backgroundShown: !background?.hidden, background: box(background), panel: box(chat)},
          header: box(document.querySelector('.topbar')),
          feed: box(document.querySelector('#feed')),
          columnBoxes: [...document.querySelectorAll('#feed > .feed-column')].map(box).filter(Boolean),
          world: {availability: window.personalOSWorldAvailability || null, canvasCount: document.querySelectorAll('#world-stage canvas').length},
        };
        rows.push(sample);
        if (rows.length > 2400) rows.shift();
        requestAnimationFrame(snap);
      };
      for (const name of ['personalos:content-transition', 'personalos:chat-state', 'personalos:story-state']) {
        window.addEventListener(name, event => events.push({t: performance.now(), name, action: event.detail?.action, phase: event.detail?.phase}));
      }
      window.addEventListener('keydown', event => {
        if (!['Escape', 'Enter', 'Tab'].includes(event.key)) return;
        events.push({t:performance.now(), name:'real-keydown', key:event.key, menuPhase:document.querySelector('.pos-menu')?.dataset.state, contentPhase:window.personalOSContent?.getState().phase, chatPhase:window.personalOSChat?.getState().phase});
      }, true);
      document.addEventListener('click', event => {
        const target=event.target.closest('button,a');
        if (!target) return;
        events.push({t:performance.now(), name:'real-click', target:target.id||target.dataset.menuCategory||target.className, generating:document.querySelector('#ai-canvas')?.dataset.generating==='true', chatPhase:window.personalOSChat?.getState().phase});
      }, true);
      window.__browserGuard = {rows, events, sample: () => rows.at(-1)};
      requestAnimationFrame(snap);
    });
    try {await use(page);} finally {
      if (!page.isClosed()) {
        const evidence = await page.evaluate(() => ({timeline: window.__browserGuard?.rows || [], events: window.__browserGuard?.events || [], availability: window.personalOSWorldAvailability || null, timingDiagnostic: window.__timingDiagnostic || null, userAgent: navigator.userAgent})).catch(error => ({captureError: error.message}));
        await testInfo.attach('process-timeline', {body: JSON.stringify({...evidence, pageErrors: failures, browserVersion: browser.version()}, null, 2), contentType: 'application/json'});
        // The test context is discarded next. Clear test input before final screenshots.
        await page.locator('#question').evaluate(node => {node.value='';}).catch(() => {});
      }
    }
  },
});
export {expect};
export async function enterFeed(page) {
  await page.goto('/?space=all');
  await expect(page.locator('#content-root')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#feed .card')).toHaveCount(18);
  await expect.poll(() => page.evaluate(() => window.personalOSHost?.getState().ready)).toBe(true);
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
}
export async function expectPreview(page) {
  await expect.poll(() => page.evaluate(() => window.personalOSContent?.getState().phase)).toBe('preview');
  await expect(page.locator('#stage')).toBeHidden();
  await expect(page.locator('#feed')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#feed .card')).toHaveCount(18);
}
export async function chatEntry(page) {
  const fallback = page.locator('#host-open-chat');
  if (await fallback.isVisible()) return fallback;
  return page.locator('#world-ball-hit');
}
