#!/usr/bin/env node
/**
 * Host-only weather UI contract harness.
 * Run: node --experimental-vm-modules --test scripts/test-motion-weather.mjs
 * No npm, engine edits, browser, GPU, or changes to the frozen host tests.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') throw new Error('Run: node --experimental-vm-modules --test scripts/test-motion-weather.mjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'integrations/motion-ball/weather.js');
const source = await readFile(sourcePath, 'utf8');
console.log(`Weather UI source SHA-256: ${createHash('sha256').update(source).digest('hex')}`);
const weatherNames = { sunny: '晴', cloudy: '多云', windy: '大风', rain: '雨', snow: '雪', fog: '雾' };
const times = ['auto', 'day', 'night'];
const plain = value => JSON.parse(JSON.stringify(value));

class MockEvent {
  constructor(type, init = {}) {
    Object.assign(this, { type, bubbles: true, cancelable: true, defaultPrevented: false }, init);
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
}
class MockTarget {
  constructor() { this.listeners = new Map(); this.parent = null; }
  addEventListener(type, fn, options = {}) {
    if (options.signal?.aborted) return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    options.signal?.addEventListener('abort', () => this.removeEventListener(type, fn), { once: true });
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  listenerCount() { return [...this.listeners.values()].reduce((sum, rows) => sum + rows.size, 0); }
  dispatchEvent(event) {
    event.target ||= this;
    for (let node = this; node; node = event.bubbles && !event.stopped ? node.parent : null) {
      event.currentTarget = node;
      for (const fn of [...(node.listeners.get(event.type) || [])]) fn(event);
    }
    return !event.defaultPrevented;
  }
}
class MockElement extends MockTarget {
  constructor(tag = 'div') {
    super(); this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
    this.dataset = {}; this.hidden = false; this.style = {}; this._text = ''; this.writes = 0; this.focusCount = 0;
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = []; this._text = ''; this.writes++;
    for (const child of children) this.appendChild(child);
  }
  setAttribute(name, value) {
    value = String(value); this.attributes.set(name, value); this.writes++;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    if (name === 'hidden') this.hidden = true;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; this.writes++; }
  set innerHTML(html) {
    this.replaceChildren();
    const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('</')) { stack.pop(); continue; }
      if (!token.startsWith('<')) { stack.at(-1)._text += token; continue; }
      const opening = token.match(/^<([a-z][\w:-]*)([\s\S]*?)\/?\s*>$/i);
      assert.ok(opening, `Unsupported test DOM markup: ${token}`);
      const element = new MockElement(opening[1]);
      const attrPattern = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      for (const attr of opening[2].matchAll(attrPattern)) element.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '');
      stack.at(-1).appendChild(element);
      if (!token.endsWith('/>') && !['BR', 'IMG', 'INPUT', 'HR', 'META', 'LINK'].includes(element.tagName)) stack.push(element);
    }
    assert.equal(stack.length, 1, 'Test DOM markup must be balanced');
  }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.getAttribute('class') || '').split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
    if (attr) return this.attributes.has(attr[1]) && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]);
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  closest(selector) { for (let node = this; node instanceof MockElement; node = node.parent) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [ ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector) ]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { this.focusCount++; }
}

async function harness(t, { initialScene = {}, available = true } = {}) {
  const doc = new MockTarget();
  const body = new MockElement('body'); body.parent = doc;
  const container = body.appendChild(new MockElement());
  const outside = body.appendChild(new MockElement('button'));
  const calls = [], notifications = [], forbidden = [], subscriptions = new Set();
  let sceneState = { weather: 'sunny', time: 'auto', ready: true, failed: null, ...initialScene };
  let sceneAvailable = available, api, unsubscribeCalls = 0, subscribeCalls = 0, dispatchDepth = 0, deliveries = 0;
  const snapshot = () => ({ scene: sceneAvailable ? { ...sceneState } : null,
    weather: api ? { ...api.getState() } : null, chat: { phase: 'closed' }, content: { phase: 'preview' }, reduced: false });
  const dispatch = next => {
    dispatchDepth++;
    assert.ok(dispatchDepth <= 4, 'Weather synchronization must not recursively call host.moduleChanged');
    try { for (const fn of [...subscriptions]) { deliveries++; fn(next); } }
    finally { dispatchDepth--; }
  };
  const methods = {
    getState() { return { ...sceneState }; },
    setWeather(name) {
      assert.ok(Object.hasOwn(weatherNames, name), 'UI may send only supported weather names');
      calls.push({ method: 'setWeather', args: [name] }); sceneState.weather = name;
      host.moduleChanged('scene'); return true;
    },
    setTime(mode) {
      assert.ok(times.includes(mode), 'UI may send only supported time modes');
      calls.push({ method: 'setTime', args: [mode] }); sceneState.time = mode;
      host.moduleChanged('scene'); return true;
    },
  };
  const scene = new Proxy({}, {
    get(_, key) {
      if (Object.hasOwn(methods, key)) return methods[key];
      forbidden.push(String(key)); throw new Error(`Non-public scene adapter access: ${String(key)}`);
    },
    set(_, key) { forbidden.push(`write:${String(key)}`); throw new Error('UI cannot mutate the scene adapter'); },
  });
  const host = {
    getState: snapshot,
    scene: () => sceneAvailable ? scene : undefined,
    subscribe(fn) {
      subscribeCalls++; subscriptions.add(fn);
      let stopped = false;
      return () => { if (!stopped) { stopped = true; unsubscribeCalls++; subscriptions.delete(fn); } };
    },
    moduleChanged(name) { notifications.push(name); dispatch(snapshot()); },
  };
  const context = vm.createContext({ document: doc, AbortController, console });
  const module = new vm.SourceTextModule(source, { context, identifier: pathToFileURL(sourcePath).href });
  await module.link(specifier => { throw new Error(`Weather UI must not import engine internals: ${specifier}`); });
  await module.evaluate();
  api = module.namespace.mountWeather({ host, container });
  const nodes = [container, ...container.querySelectorAll('button'), ...container.querySelectorAll('div'), ...container.querySelectorAll('span')];
  const label = container.querySelector('[data-weather-label]');
  const toggle = container.querySelector('.weather-toggle');
  const panel = container.querySelector('.weather-panel');
  const weatherButtons = panel.querySelectorAll('[data-weather]');
  const timeButtons = panel.querySelectorAll('[data-time]');
  assert.ok(label && toggle && panel, 'Expected native weather DOM controls');
  const h = {
    api, host, scene, doc, container, outside, label, toggle, panel, weatherButtons, timeButtons, nodes, calls, notifications, forbidden,
    get subscriptionCount() { return subscriptions.size; },
    get subscribeCalls() { return subscribeCalls; },
    get unsubscribeCalls() { return unsubscribeCalls; },
    get deliveries() { return deliveries; },
    click(node) { node.dispatchEvent(new MockEvent('click')); },
    weather(name) { this.click(weatherButtons.find(button => button.dataset.weather === name)); },
    time(mode) { this.click(timeButtons.find(button => button.dataset.time === mode)); },
    confirm(patch) { sceneState = { ...sceneState, ...patch }; dispatch(snapshot()); },
    emitScene(value) { dispatch({ ...snapshot(), scene: value }); },
    available(value) { sceneAvailable = value; dispatch(snapshot()); },
    check(weather, time) {
      assert.equal(label.textContent, weatherNames[weather], 'Weather label must reflect validated public scene state');
      assert.equal(api.getState().selected, weather); assert.equal(api.getState().preset, weather);
      assert.equal(api.getState().time, time);
      for (const button of weatherButtons) assert.equal(button.getAttribute('aria-pressed'), String(button.dataset.weather === weather), `aria-pressed for ${button.dataset.weather}`);
      for (const button of timeButtons) assert.equal(button.getAttribute('aria-pressed'), String(button.dataset.time === time), `aria-pressed for ${button.dataset.time}`);
    },
  };
  t.after(() => { api.dispose(); assert.deepEqual(forbidden, [], 'No private module or scene adapter access'); });
  return h;
}

test('native controls begin with all six weather choices and three time modes', async t => {
  const h = await harness(t);
  h.check('sunny', 'auto');
  assert.deepEqual(h.weatherButtons.map(button => button.dataset.weather), Object.keys(weatherNames));
  assert.deepEqual(h.timeButtons.map(button => button.dataset.time), times);
  assert.equal(h.panel.hidden, true);
});

test('native control clicks still use only public scene setWeather/setTime', async t => {
  const h = await harness(t);
  h.weather('rain'); h.time('night'); h.check('rain', 'night');
  assert.deepEqual(h.calls, [{ method: 'setWeather', args: ['rain'] }, { method: 'setTime', args: ['night'] }]);
  assert.equal(h.notifications.filter(name => name === 'weather').length, 2, 'One native UI notification per requested control change');
});

test('direct public scene changes synchronize the label and every aria-pressed value', async t => {
  const h = await harness(t);
  h.scene.setWeather('snow'); h.scene.setTime('night');
  h.check('snow', 'night');
  assert.equal(h.notifications.filter(name => name === 'weather').length, 0, 'External scene updates are DOM paint only');
});

test('source weather/time confirmations synchronize without issuing scene commands', async t => {
  const h = await harness(t);
  h.confirm({ weather: 'cloudy', time: 'day' }); h.check('cloudy', 'day');
  assert.deepEqual(h.calls, [], 'Confirmation cannot echo a setWeather or setTime back into the source');
  assert.deepEqual(h.notifications, [], 'Confirmation cannot notify host recursively');
});

test('pending desired values synchronize before ready and survive ready confirmation', async t => {
  const h = await harness(t, { initialScene: { ready: false } });
  h.scene.setWeather('snow'); h.scene.setTime('night'); h.check('snow', 'night');
  h.confirm({ ready: true, weather: 'snow', time: 'night' }); h.check('snow', 'night');
  assert.equal(h.calls.length, 2);
});

test('mount reads an existing validated scene selection, including pending state', async t => {
  const h = await harness(t, { initialScene: { weather: 'fog', time: 'night', ready: false } });
  h.check('fog', 'night');
  assert.deepEqual(h.calls, [], 'Mount cannot change an existing scene choice');
  assert.deepEqual(h.notifications, []);
});

test('valid partial snapshots update weather and time independently', async t => {
  const h = await harness(t);
  h.emitScene({ weather: 'windy' }); h.check('windy', 'auto');
  h.emitScene({ time: 'night' }); h.check('windy', 'night');
  h.emitScene({ weather: 'rain', time: 'unsupported' }); h.check('rain', 'night');
  h.emitScene({ weather: 'unsupported', time: 'day' }); h.check('rain', 'day');
  assert.deepEqual(h.calls, []); assert.deepEqual(h.notifications, []);
});

test('repeated unchanged snapshots have one subscription and never recurse', async t => {
  const h = await harness(t);
  assert.equal(h.subscriptionCount, 1, 'Weather UI needs exactly one host subscription');
  assert.equal(h.subscribeCalls, 1);
  const deliveries = h.deliveries;
  for (let index = 0; index < 6; index++) h.confirm({ weather: 'sunny', time: 'auto' });
  h.check('sunny', 'auto');
  assert.equal(h.deliveries - deliveries, 6);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.notifications, []);
});

test('invalid, absent, or unavailable snapshots never blank a valid UI choice', async t => {
  const h = await harness(t);
  h.weather('rain'); h.time('night'); h.check('rain', 'night');
  const calls = h.calls.length, notifications = h.notifications.length;
  for (const value of [null, undefined, {}, { weather: 'hurricane', time: 'twilight' }, { weather: '', time: '' }, { weather: null, time: null }]) {
    h.emitScene(value); h.check('rain', 'night');
  }
  h.available(false); h.check('rain', 'night');
  assert.equal(h.calls.length, calls); assert.equal(h.notifications.length, notifications);
});

test('native desired choices remain usable when the optional scene is unavailable', async t => {
  const h = await harness(t, { available: false });
  assert.equal(h.api.setWeather({ weather: 'fog' }), true);
  h.time('day'); h.check('fog', 'day');
  assert.deepEqual(h.calls, []);
  assert.equal(h.notifications.filter(name => name === 'weather').length, 2);
});

test('weather aliases validate before transmitting a public scene command', async t => {
  const h = await harness(t);
  assert.equal(h.api.setWeather({ preset: 'rain' }), true); h.check('rain', 'auto');
  assert.equal(h.api.setWeather({ selected: 'snow' }), true); h.check('snow', 'auto');
  const calls = h.calls.length, notifications = h.notifications.length;
  assert.equal(h.api.setWeather({ weather: 'hurricane' }), false);
  assert.equal(h.api.setWeather({}), false); h.check('snow', 'auto');
  assert.equal(h.calls.length, calls); assert.equal(h.notifications.length, notifications);
});

test('dispose unsubscribes exactly once and removes all control/document listeners', async t => {
  const h = await harness(t);
  assert.equal(h.subscriptionCount, 1);
  h.api.dispose(); h.api.dispose();
  assert.equal(h.subscriptionCount, 0); assert.equal(h.unsubscribeCalls, 1);
  assert.equal(h.api.getState().disposed, true); assert.equal(h.container.children.length, 0);
  assert.equal(h.doc.listenerCount(), 0); assert.ok(h.nodes.every(node => node.listenerCount() === 0));
  const writes = h.nodes.reduce((sum, node) => sum + node.writes, 0);
  const state = plain(h.api.getState()), notifications = h.notifications.length;
  h.confirm({ weather: 'snow', time: 'night' });
  assert.equal(h.nodes.reduce((sum, node) => sum + node.writes, 0), writes, 'A disposed subscription cannot paint detached DOM');
  assert.deepEqual(plain(h.api.getState()), state); assert.equal(h.notifications.length, notifications);
});

test('weather panel toggle, outside pointer, and Escape remain native DOM behavior', async t => {
  const h = await harness(t);
  h.click(h.toggle); assert.equal(h.panel.hidden, false); assert.equal(h.toggle.getAttribute('aria-expanded'), 'true');
  h.weather('cloudy'); assert.equal(h.panel.hidden, false);
  h.outside.dispatchEvent(new MockEvent('pointerdown')); assert.equal(h.panel.hidden, true);
  h.click(h.toggle); assert.equal(h.panel.hidden, false);
  h.container.dispatchEvent(new MockEvent('keydown', { key: 'Escape' }));
  assert.equal(h.panel.hidden, true); assert.equal(h.toggle.getAttribute('aria-expanded'), 'false'); assert.equal(h.toggle.focusCount, 1);
  h.check('cloudy', 'auto');
});
