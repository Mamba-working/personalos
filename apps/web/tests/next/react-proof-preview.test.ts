import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, createRef } from 'react';
import { JSDOM } from 'jsdom';
import RevisionBoundary from '../../features/content-proof/RevisionBoundary';
import { captureAnchor, restoreAnchor } from '../../features/content-proof/scroll-anchor';
async function fixture(reading: boolean, run: (value: { host: HTMLDivElement; original: HTMLElement; render(revision: number): Promise<void> }) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true }), env = dom.window;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: env, document: env.document, navigator: env.navigator, HTMLElement: env.HTMLElement, HTMLInputElement: env.HTMLInputElement, HTMLTextAreaElement: env.HTMLTextAreaElement, Node: env.Node, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); }
  const { createRoot } = await import('react-dom/client'), root = createRoot(env.document.getElementById('root')!), host = createRef<HTMLDivElement>();
  const box = (top: number, height: number) => ({ x: 0, y: top, top, left: 0, right: 500, bottom: top + height, width: 500, height, toJSON() {} });
  env.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.scrollHost !== undefined) return box(24, 280);
    const inserted = !!env.document.querySelector('[data-reading-anchor="one:revision-note"]'), offset = host.current?.scrollTop ?? 0;
    const position = this.dataset.readingAnchor === 'one:revision-note' ? 320 : this.dataset.readingAnchor === 'one:original' ? 320 + (inserted ? 151 : 0) : 620 + (inserted ? 151 : 0);
    return box(24 + position - offset, this.dataset.readingAnchor === 'one:revision-note' ? 151 : 300);
  };
  const render = async (revision: number) => { await act(async () => root.render(React.createElement('div', { ref: host, 'data-scroll-host': '', style: { height: 280, overflow: reading ? 'auto' : 'hidden' } }, React.createElement(RevisionBoundary as React.ComponentType<any>, { revision, scrollHost: host, reading }, React.createElement('article', null, React.createElement('h2', null, '标题必须留在预览顶部'), React.createElement('section', { 'data-section-id': 'one' }, ...(revision === 2 ? [React.createElement('p', { key: 'revision-note', 'data-reading-anchor': 'one:revision-note' }, '新增段落')] : []), React.createElement('p', { key: 'original', 'data-reading-anchor': 'one:original' }, '稳定原段落'), React.createElement('p', { key: 'second', 'data-reading-anchor': 'one:second' }, '第二段落'))))))); };
  try { await render(1); await run({ host: host.current!, original: env.document.querySelector<HTMLElement>('[data-reading-anchor="one:original"]')!, render }); }
  finally { await act(async () => root.unmount()); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } env.close(); }
}
test('inactive preview stays at top through real React revision 1→2→1→2 commits', async () => {
  await fixture(false, async ({ host, original, render }) => {
    assert.equal(host.scrollTop, 0);
    for (const revision of [2, 1, 2]) { await render(revision); assert.equal(host.scrollTop, 0, `Preview revision ${revision} must not restore an offscreen reading anchor`); assert.equal(host.querySelector('[data-reading-anchor="one:original"]'), original); }
  });
});
test('active reader at top preserves its top rather than a below-viewport paragraph', async () => {
  await fixture(true, async ({ host, render }) => { for (const revision of [2, 1, 2]) { await render(revision); assert.equal(host.scrollTop, 0); } });
});
test('active scrolled reader preserves its visible paragraph through insertion and removal', async () => {
  await fixture(true, async ({ host, original, render }) => {
    host.scrollTop = 450; const before = original.getBoundingClientRect().top;
    for (const revision of [2, 1, 2]) { await render(revision); assert.equal(original.getBoundingClientRect().top, before); assert.equal(host.scrollTop, revision === 2 ? 601 : 450); }
  });
});
test('a saved reader anchor survives a preview revision without scrolling that preview', async () => {
  await fixture(false, async ({ host, original, render }) => {
    host.scrollTop = 450; const saved = captureAnchor(host), before = original.getBoundingClientRect().top; host.scrollTop = 0;
    await render(2); assert.equal(host.scrollTop, 0); restoreAnchor(host, saved); assert.equal(original.getBoundingClientRect().top, before); assert.equal(host.scrollTop, 601);
  });
});
test('closing a tall reader at top then revising its preview reopens at top', async () => {
  await fixture(false, async ({ host, render }) => {
    const originalBox = host.getBoundingClientRect;
    host.getBoundingClientRect = () => ({ top: 24, bottom: 824, height: 800 } as DOMRect);
    assert.equal(host.scrollTop, 0);
    const savedTop = captureAnchor(host); // First paragraph is visible in this full-height reader.
    host.getBoundingClientRect = originalBox;
    await render(2); assert.equal(host.scrollTop, 0);
    host.getBoundingClientRect = () => ({ top: 24, bottom: 824, height: 800 } as DOMRect);
    restoreAnchor(host, savedTop); assert.equal(host.scrollTop, 0, 'Saved reader-at-top must not become a paragraph anchor');
  });
});
