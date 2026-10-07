import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import React, { StrictMode, act } from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createNavigationAuthority } from '../../lib/navigation/navigation-authority';
import type { LabRecord } from '../../../../packages/contracts/content-proof';
registerHooks({ load(url, context, nextLoad) { if (url.endsWith('.module.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return nextLoad(url, context); } });
const { default: ContentSurface } = await import('../../features/content-proof/ContentSurface');
const { default: CounterLab } = await import('../../features/content-proof/CounterLab');
const record: LabRecord = { id: 'small-counter', revision: 1, space: 'labs', title: '实验', summary: '演示', provenance: 'authored-demo', kind: 'counter-lab', instruction: 'server revision one', step: 1, sections: [] };
test('real React surface hydrates the same SSR article/input/scroll nodes; new revision retains state, focus and parent through open/close', async () => {
  let selected = false, revision = 1, ready = false;
  const phases: string[] = [], register = () => {}, onPhase = (_id: string, phase: string) => { phases.push(phase); };
  const element = () => React.createElement(StrictMode, null, React.createElement(ContentSurface, { record: { ...record, revision }, body: React.createElement(CounterLab, { instruction: revision === 1 ? 'server revision one' : 'server revision two', step: revision }), selected, otherSelected: false, ready, instant: true, itemHref: '?item=small-counter', closeHref: '/', revisionLink: null, onOpen() {}, onClose() {}, onPhase, register }));
  const dom = new JSDOM(`<div id="root">${renderToString(element())}</div>`, { url: 'http://localhost/proof/react-content', pretendToBeVisual: true }), env = dom.window, container = env.document.getElementById('root')!;
  env.matchMedia = () => ({ matches: true }) as never;
  env.HTMLElement.prototype.getBoundingClientRect = function () { return { x: 20, y: 100, top: 100, left: 20, right: 780, bottom: 600, width: 760, height: 500, toJSON() {} }; };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: env, document: env.document, navigator: env.navigator, HTMLElement: env.HTMLElement, HTMLInputElement: env.HTMLInputElement, HTMLTextAreaElement: env.HTMLTextAreaElement, Node: env.Node, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); }
  const article = container.querySelector('article')!, parent = article.parentNode, input = container.querySelector('input')!, host = container.querySelector<HTMLElement>('[data-proof-scroll]')!, errors: unknown[] = [];
  const { hydrateRoot } = await import('react-dom/client');
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, element(), { onRecoverableError: error => errors.push(error) }); });
    ready = true; await act(async () => { root!.render(element()); });
    const add = [...container.querySelectorAll('button')].find(button => button.textContent === '加 1')!;
    await act(async () => { add.click(); add.click(); });
    input.focus();
    await act(async () => { Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype, 'value')!.set!.call(input, '未完成的念头'); input.dispatchEvent(new env.Event('input', { bubbles: true })); });
    input.setSelectionRange(1, 5);
    selected = true; await act(async () => { root!.render(element()); });
    assert.equal(container.querySelector('[data-proof-frame]')?.getAttribute('data-phase'), 'detail');
    host.scrollTop = 210;
    revision = 2; await act(async () => { root!.render(element()); });
    assert.equal(container.querySelector('article'), article); assert.equal(article.parentNode, parent); assert.equal(container.querySelector('input'), input); assert.equal(container.querySelector('[data-proof-scroll]'), host);
    assert.equal(container.querySelector('output')?.textContent, '2'); assert.match(container.textContent!, /server revision two/); assert.equal(host.scrollTop, 210); assert.equal(env.document.activeElement, input); assert.equal(input.selectionStart, 1); assert.equal(input.selectionEnd, 5); assert.equal(input.value, '未完成的念头');
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === '加 2')!.click(); });
    assert.equal(container.querySelector('output')?.textContent, '4');
    selected = false; await act(async () => { root!.render(element()); });
    assert.equal(container.querySelector('[data-proof-frame]')?.getAttribute('data-phase'), 'preview'); assert.equal(article.parentNode, parent); assert.equal(env.document.activeElement, input); assert.equal(host.scrollTop, 0); assert.equal(input.value, '未完成的念头');
    selected = true; await act(async () => { root!.render(element()); }); assert.equal(host.scrollTop, 210); assert.equal(container.querySelector('output')?.textContent, '4'); assert.equal(input.value, '未完成的念头');
    selected = false; await act(async () => { root!.render(element()); });
    input.focus(); input.setSelectionRange(1, 5);
    for (const version of [1, 2]) {
      revision = version; await act(async () => { root!.render(element()); });
      assert.equal(host.scrollTop, 0); assert.equal(input.value, '未完成的念头'); assert.equal(container.querySelector('output')?.textContent, '4'); assert.equal(env.document.activeElement, input); assert.equal(input.selectionStart, 1); assert.equal(input.selectionEnd, 5);
    }
    selected = true; await act(async () => { root!.render(element()); }); assert.equal(host.scrollTop, 210, 'Closed preview revisions must not erase the separately saved reader position');
    assert.deepEqual(errors, []); assert.ok(phases.includes('opening') && phases.includes('closing'));
  } finally { if (root) await act(async () => root!.unmount()); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } env.close(); }
});
const pause = () => new Promise(resolve => setTimeout(resolve, 40));
test('refresh ledger restores only the current app entry, never framework markers or popped/departed ownership', async () => {
  const dom = new JSDOM('', { url: 'http://localhost/proof/react-content?rev=1' }), env = dom.window;
  const nav = createNavigationAuthority(env as unknown as Window, [{ id: 'small-counter', category: 'labs' }], () => ({ feed: 100, reader: 200 }));
  try {
    nav.open('small-counter'); const owned = env.history.state.personalosNext, depth = env.history.length;
    assert.equal(nav.replaceServerQuery({ rev: '2' }), true);
    env.history.replaceState({ framework: 'opaque-refresh-result' }, '', env.location.href);
    nav.reconcileServerRefresh(); assert.equal(env.history.state.personalosNext.id, owned.id); assert.equal(env.history.state.personalosNext.openedHere, true); assert.equal(env.history.state.framework, undefined); assert.equal(env.history.length, depth);
    env.history.replaceState({ framework: 'another-refresh' }, '', env.location.href);
    nav.close(); nav.reconcileServerRefresh(); await pause(); assert.equal(new URL(env.location.href).searchParams.get('item'), null); assert.equal(new URL(env.location.href).searchParams.get('rev'), '1');
    const feedId = env.history.state.personalosNext.id; nav.reconcileServerRefresh(); assert.equal(env.history.state.personalosNext.id, feedId);
    env.history.pushState({}, '', '/route-check?other=1'); nav.reconcileServerRefresh(); assert.deepEqual(env.history.state, {}); assert.equal(env.location.pathname, '/route-check');
  } finally { nav.dispose(); env.close(); }
});
test('deep-link refresh without an owned intent writes nothing; semantic query mutation is rejected', () => {
  const dom = new JSDOM('', { url: 'http://localhost/proof/react-content?rev=2&item=small-counter' }), env = dom.window;
  env.history.replaceState({ opaque: 'next' }, '', env.location.href);
  const nav = createNavigationAuthority(env as unknown as Window, [{ id: 'small-counter', category: 'labs' }], () => ({ feed: 0, reader: 0 }));
  nav.reconcileServerRefresh(); assert.deepEqual(env.history.state, { opaque: 'next' }); assert.throws(() => nav.replaceServerQuery({ item: 'other' })); nav.dispose(); env.close();
});
