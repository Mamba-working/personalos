#!/usr/bin/env node
/**
 * Host-only contract checks. No npm, browser, GPU, or upstream source patching.
 * Run: node --experimental-vm-modules --test scripts/test-motion-host.mjs
 *
 * WeatherScene is replaced at its dynamic-import boundary. Its mock exposes
 * only the unchanged, documented public API and reproduces release-on-disable
 * input semantics. These checks do not claim real WebGL/pixel acceptance.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') {
  throw new Error('Run with: node --experimental-vm-modules --test scripts/test-motion-host.mjs');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adapterPath = path.join(root, 'integrations/motion-ball/motion-scene.js');
const source = await readFile(adapterPath, 'utf8');
const adapterURL = pathToFileURL(adapterPath).href;
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class MockEvent {
  constructor(type, init = {}) {
    Object.assign(this, {
      type, bubbles: true, cancelable: true, defaultPrevented: false,
      isTrusted: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: 300, clientY: 250,
    }, init);
    this._stopped = false;
    this._immediate = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
  stopImmediatePropagation() { this._stopped = this._immediate = true; }
  composedPath() { return [...this._path]; }
}

class MockTarget {
  constructor() { this._listeners = new Map(); this._parent = null; }
  addEventListener(type, fn, opts = {}) {
    const options = typeof opts === 'boolean' ? { capture: opts } : opts;
    if (options.signal?.aborted) return;
    const rows = this._listeners.get(type) || [];
    const capture = !!options.capture;
    if (!rows.some(row => row.fn === fn && row.capture === capture)) {
      rows.push({ fn, capture, once: !!options.once });
      this._listeners.set(type, rows);
      options.signal?.addEventListener('abort', () => this.removeEventListener(type, fn, capture), { once: true });
    }
  }
  removeEventListener(type, fn, opts = {}) {
    const capture = typeof opts === 'boolean' ? opts : !!opts.capture;
    this._listeners.set(type, (this._listeners.get(type) || []).filter(row => row.fn !== fn || row.capture !== capture));
  }
  listenerCount() { return [...this._listeners.values()].reduce((n, rows) => n + rows.length, 0); }
  _invoke(event, capture) {
    event.currentTarget = this;
    for (const row of [...(this._listeners.get(event.type) || [])]) {
      if (row.capture !== capture || event._immediate) continue;
      if (row.once) this.removeEventListener(event.type, row.fn, row.capture);
      if (typeof row.fn === 'function') row.fn.call(this, event);
      else row.fn.handleEvent(event);
    }
  }
  dispatchEvent(event) {
    event.target ||= this;
    event._path = [];
    for (let node = this; node; node = node._parent) event._path.push(node);
    for (const node of [...event._path].reverse()) {
      node._invoke(event, true);
      if (event._stopped) return !event.defaultPrevented;
    }
    this._invoke(event, false);
    if (event.bubbles && !event._stopped) {
      for (const node of event._path.slice(1)) {
        node._invoke(event, false);
        if (event._stopped) break;
      }
    }
    return !event.defaultPrevented;
  }
}

class MockElement extends MockTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.hidden = false;
    this.textContent = '';
    this.bounds = { left: 15, top: 30, width: 960, height: 720 };
  }
  appendChild(child) {
    child.remove();
    child._parent = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (this._parent?.children) this._parent.children = this._parent.children.filter(child => child !== this);
    this._parent = null;
  }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getBoundingClientRect() {
    return { ...this.bounds, x: this.bounds.left, y: this.bounds.top,
      right: this.bounds.left + this.bounds.width, bottom: this.bounds.top + this.bounds.height };
  }
  matches(selector) {
    return selector.split(',').some(part => {
      const item = part.trim();
      if (item.startsWith('#')) return this.getAttribute('id') === item.slice(1);
      if (item.startsWith('.')) return (this.getAttribute('class') || '').split(/\s+/).includes(item.slice(1));
      const attribute = item.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
      if (attribute) return this.attributes.has(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
      return this.tagName.toLowerCase() === item.toLowerCase();
    });
  }
  closest(selector) {
    for (let node = this; node instanceof MockElement; node = node._parent) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [ ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector) ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
}

const publicEvents = new Set(['ready', 'weatherchange', 'timechange', 'daynight', 'say', 'ball', 'interact', 'cursor', 'frame', 'pause', 'dispose']);
const publicOptions = new Set(['weather', 'time', 'moonPhase', 'assetBase', 'assets', 'environmentAssets', 'presets', 'night', 'daylight', 'quality', 'maxPixelRatio', 'pixelBudget', 'layout', 'input', 'cursor', 'audio', 'speech', 'autoCycle', 'autoPause', 'reducedMotion', 'debug']);

async function makeHarness({ delayImport = false, holdCaptures = false, initial = {}, constructorError = null, coarse = false } = {}) {
  const win = new MockTarget();
  const doc = new MockTarget();
  doc._parent = win;
  doc.hidden = false;
  doc.scrollingElement = { scrollTop: 0 };
  doc.documentElement = new MockElement('html');
  doc.documentElement._parent = doc;
  doc.body = doc.documentElement.appendChild(new MockElement('body'));
  doc.createElement = tag => new MockElement(tag);
  const container = doc.body.appendChild(new MockElement());
  const speech = doc.body.appendChild(new MockElement());
  const status = doc.body.appendChild(new MockElement());
  speech.hidden = status.hidden = true;
  const button = doc.body.appendChild(new MockElement('button'));
  const textarea = doc.body.appendChild(new MockElement('textarea'));
  const weatherPanel = doc.body.appendChild(new MockElement());
  weatherPanel.setAttribute('class', 'weather-panel');
  const weatherButton = weatherPanel.appendChild(new MockElement('button'));
  let now = 0, timerID = 0;
  const timers = new Map();
  const observers = [];
  class MockResizeObserver {
    constructor(fn) { this.fn = fn; this.active = false; observers.push(this); }
    observe(target) { this.target = target; this.active = true; }
    disconnect() { this.active = false; }
    fire() { if (this.active) this.fn([{ target: this.target, contentRect: this.target.getBoundingClientRect() }]); }
  }
  const calls = [], instances = [], warnings = [], forbidden = [];
  const importGate = deferred();
  if (!delayImport) importGate.resolve();
  let importCount = 0, chatOpenCount = 0, state, api;
  const subscribers = new Set(), notifications = [];
  state = { reduced: false, chat: { phase: 'closed' }, content: { phase: 'preview' },
    menu: { open: false, modal: false }, weather: { open: false }, ...initial };
  const host = {
    getState: () => state,
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    moduleChanged(name) {
      notifications.push(name);
      const next = { ...state, scene: api?.getState() || null };
      for (const fn of [...subscribers]) fn(next);
    },
    chat: () => ({ show() { chatOpenCount++; } }),
  };

  class PublicWeatherScene {
    static weathers = ['sunny', 'cloudy', 'windy', 'rain', 'snow', 'fog'];
    constructor(target, options) {
      if (constructorError) throw constructorError;
      for (const key of Object.keys(options)) assert.ok(publicOptions.has(key), `Unchanged public option required: ${key}`);
      assert.equal(instances.filter(item => !item.disposed).length, 0, 'Only one active WeatherScene may be constructed');
      const readyGate = deferred(), events = new Map();
      const canvas = target.appendChild(new MockElement('canvas'));
      canvas.bounds = { ...target.bounds };
      canvas.style.touchAction = 'none';
      const record = { options: plain(options), canvas, readyGate, events, paused: false,
        weather: options.weather ?? 'sunny', time: options.time ?? 'auto', input: { pointer: true, keyboard: false, ...plain(options.input) },
        disposed: false, disposeCalls: 0, disposeEffects: 0, captures: [], press: null };
      instances.push(record);
      const log = (method, args = []) => calls.push({ method, args: plain(args) });
      const emit = (type, payload) => {
        assert.ok(publicEvents.has(type), `Only upstream public events are exposed: ${type}`);
        for (const fn of [...(events.get(type) || [])]) fn(payload);
      };
      record.emit = emit;
      record.completeReady = () => {
        // Upstream startup events precede the ready promise continuation. They
        // intentionally carry constructor values, exercising pending choices.
        if (!record.disposed) {
          emit('weatherchange', { weather: record.weather, previous: record.weather });
          emit('timechange', { mode: record.time });
          emit('ready', { scene: proxy });
        }
        readyGate.resolve();
      };
      const release = () => {
        if (!record.press) return;
        const press = record.press;
        record.press = null;
        emit('interact', { target: 'ball', action: press.moved < 6 ? 'click' : 'drag' });
      };
      const down = event => {
        if (record.input.pointer) record.press = { x: event.clientX, y: event.clientY, moved: 0 };
      };
      const move = event => {
        if (record.input.pointer && record.press) record.press.moved = Math.max(record.press.moved,
          Math.hypot(event.clientX - record.press.x, event.clientY - record.press.y));
      };
      canvas.addEventListener('pointerdown', down);
      win.addEventListener('pointermove', move, { passive: true });
      win.addEventListener('pointerup', release);
      win.addEventListener('pointercancel', release);
      win.addEventListener('blur', release);
      const anchors = { ball: { x: 300, y: 250, radius: 35 }, bubble: { x: 300, y: 200 }, ground: { x: 300, y: 285 } };
      const ballMethods = new Set(['jump', 'flip', 'say', 'cheer', 'push', 'wake']);
      const ball = new Proxy({}, { get(_, key) {
        if (key === 'anchors') return anchors;
        if (ballMethods.has(key)) return (...args) => log(`ball.${key}`, args);
        forbidden.push(`ball.${String(key)}`);
        throw new Error(`Non-public ball access: ${String(key)}`);
      } });
      const on = (type, fn) => {
        assert.ok(publicEvents.has(type), `Unchanged WeatherScene event required: ${type}`);
        if (!events.has(type)) events.set(type, new Set());
        events.get(type).add(fn);
        return () => events.get(type)?.delete(fn);
      };
      const methods = {
        on,
        once(type, fn) { let off; off = on(type, value => { off(); fn(value); }); return off; },
        off(type, fn) { events.get(type)?.delete(fn); },
        setWeather(name, options = {}) {
          assert.ok(PublicWeatherScene.weathers.includes(name), `Invalid weather: ${name}`);
          log('setWeather', [name, options]);
          const previous = record.weather; record.weather = name;
          emit('weatherchange', { weather: name, previous });
        },
        setTime(mode, options = {}) {
          assert.ok(['auto', 'day', 'night'].includes(mode), `Invalid time: ${mode}`);
          log('setTime', [mode, options]); record.time = mode;
          emit('timechange', { mode });
        },
        setInput(options) {
          log('setInput', [options]);
          assert.equal(options.keyboard, false, 'Host must always keep upstream window keyboard shortcuts off');
          Object.assign(record.input, options);
          if (options.pointer === false) release();
        },
        pause() { log('pause'); record.paused = true; },
        resume() { log('resume'); record.paused = false; },
        resize() { log('resize', [target.getBoundingClientRect()]); },
        getStats() { log('getStats'); return { fps: 60, frameMs: 16.7, renderScale: 1, cloudSteps: 64,
          quality: 'auto', width: target.bounds.width, height: target.bounds.height }; },
        capture(...args) {
          log('capture', args);
          const gate = deferred();
          const result = new Blob(['public-capture'], { type: args[0] || 'image/png' });
          const capture = { gate, result, settled: false, weather: record.weather, time: record.time };
          record.captures.push(capture);
          if (!holdCaptures) { capture.settled = true; gate.resolve(result); }
          return gate.promise;
        },
        dispose() {
          log('dispose'); record.disposeCalls++;
          if (record.disposed) return;
          record.disposed = true; record.disposeEffects++; record.press = null;
          canvas.removeEventListener('pointerdown', down);
          win.removeEventListener('pointermove', move);
          win.removeEventListener('pointerup', release);
          win.removeEventListener('pointercancel', release);
          win.removeEventListener('blur', release);
          canvas.remove(); events.clear();
        },
      };
      for (const name of ['nextWeather', 'setAutoCycle', 'updatePreset', 'getPreset', 'setSun', 'setMoonPhase', 'setMoon',
        'updateNight', 'updateDaylight', 'setSound', 'setSpeech', 'setLines', 'setLayout', 'setQuality']) {
        methods[name] = (...args) => log(name, args);
      }
      const proxy = new Proxy({}, {
        get(_, key) {
          if (key === 'then') return undefined;
          if (key === Symbol.toStringTag) return 'WeatherScene';
          if (key === 'canvas') return canvas;
          if (key === 'ready') return readyGate.promise;
          if (key === 'ball') return ball;
          if (key === 'paused') return record.paused;
          if (key === 'isDisposed') return record.disposed;
          if (key === 'weather') return record.weather;
          if (key === 'timeMode') return record.time;
          if (key === 'isNight') return record.night ?? record.time === 'night';
          if (['sound', 'autoCycle'].includes(key)) return false;
          if (key === 'nightAmount') return record.time === 'night' ? 1 : 0;
          if (Object.hasOwn(methods, key)) return methods[key];
          forbidden.push(String(key));
          throw new Error(`Non-public WeatherScene access: ${String(key)}`);
        },
        set(_, key) {
          forbidden.push(`write:${String(key)}`);
          throw new Error(`Host cannot mutate WeatherScene properties: ${String(key)}`);
        },
      });
      record.publicScene = proxy;
      return proxy;
    }
  }

  const context = vm.createContext({ window: win, document: doc, innerHeight: 900, matchMedia: () => ({ matches: coarse }),
    URL, Blob, AbortController, ResizeObserver: MockResizeObserver, Event: MockEvent, PointerEvent: MockEvent,
    CustomEvent: MockEvent, queueMicrotask, performance: { now: () => now },
    setTimeout(fn, delay = 0) { const id = ++timerID; timers.set(id, { fn, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args), log() {} },
  });
  const upstream = new vm.SyntheticModule(['WeatherScene'], function () {
    this.setExport('WeatherScene', PublicWeatherScene);
  }, { context, identifier: new URL('../motion/weather-scene.js', adapterURL).href });
  await upstream.link(() => { throw new Error('Public mock has no imports'); });
  await upstream.evaluate();
  const adapter = new vm.SourceTextModule(source, {
    context, identifier: adapterURL,
    initializeImportMeta(meta) { meta.url = adapterURL; },
    importModuleDynamically: async specifier => {
      importCount++;
      assert.equal(specifier, '../motion/weather-scene.js', 'Import only the unchanged compiled module entry');
      await importGate.promise;
      return upstream;
    },
  });
  await adapter.link(specifier => { throw new Error(`Unexpected static import: ${specifier}`); });
  await adapter.evaluate();
  api = adapter.namespace.mountMotionScene({ host, container, speech, status });
  await flush();
  const h = {
    api, win, doc, container, speech, status, button, textarea, weatherPanel, weatherButton,
    calls, instances, observers, timers, notifications, warnings, forbidden,
    get scene() { assert.equal(instances.length, 1, 'Exactly one scene expected'); return instances[0]; },
    get importCount() { return importCount; },
    get chatOpenCount() { return chatOpenCount; },
    get subscriberCount() { return subscribers.size; },
    async releaseImport() { importGate.resolve(); await flush(); },
    async rejectImport(error) { importGate.reject(error); await flush(); },
    async ready() { this.scene.completeReady(); await flush(); assert.equal(api.getState().ready, true, status.textContent || 'Scene must become ready'); },
    async rejectReady(error) { this.scene.readyGate.reject(error); await flush(); },
    state(patch) {
      state = { ...state, ...patch };
      for (const fn of [...subscribers]) fn(state);
    },
    event(target, type, init = {}) { const event = new MockEvent(type, init); target.dispatchEvent(event); return event; },
    over(target) { return this.event(target, 'pointerover'); },
    async finishCapture(index = this.scene.captures.findIndex(capture => !capture.settled), error = null) {
      const capture = this.scene.captures[index];
      assert.ok(capture && !capture.settled, 'A pending capture must exist');
      capture.settled = true;
      if (error) capture.gate.reject(error); else capture.gate.resolve(capture.result);
      await flush();
    },
    advanceTimers(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
    },
    count(method) { return calls.filter(call => call.method === method).length; },
    latest(method) { return calls.filter(call => call.method === method).at(-1); },
    checkPublicOnly() { assert.deepEqual(forbidden, [], 'No internal/non-public API may be accessed'); },
    dispose() { api.dispose(); },
  };
  return h;
}

async function mounted(t, options) {
  const h = await makeHarness(options);
  t.after(() => { h.dispose(); h.checkPublicOnly(); });
  return h;
}

test('dynamic import uses only the unchanged public API and constructs one scene', async t => {
  const h = await mounted(t);
  assert.equal(h.importCount, 1);
  assert.equal(h.instances.length, 1);
  assert.deepEqual(h.scene.options.input, { pointer: false, keyboard: false });
  assert.equal(h.scene.options.audio, false);
  assert.equal(h.scene.options.autoCycle, false);
  assert.equal(h.scene.options.autoPause, true);
  assert.equal(h.scene.options.assetBase, new URL('../motion/assets/', adapterURL).href);
  await h.ready();
  assert.equal(h.api.getState().canvasCount, 1);
  assert.equal(h.api.getState().publicApiOnly, true);
  for (const name of ['rain', 'snow', 'fog', 'windy', 'cloudy', 'sunny']) h.api.setWeather(name);
  h.api.setTime('night'); h.api.setTime('day'); h.api.setTime('auto');
  assert.equal(h.instances.length, 1, 'Weather/time updates cannot reinstantiate the module');
});

test('dispose before import prevents construction and detaches host listeners', async t => {
  const h = await mounted(t, { delayImport: true });
  h.dispose(); h.dispose();
  await h.releaseImport();
  assert.equal(h.instances.length, 0);
  assert.equal(h.subscriberCount, 0);
  assert.equal(h.win.listenerCount(), 0);
  assert.equal(h.doc.listenerCount(), 0);
  assert.equal(h.container.listenerCount(), 0);
  assert.ok(h.observers.every(observer => !observer.active));
  assert.equal(h.api.getState().ready, false);
});

test('dispose before ready releases pending resources once and cannot revive', async t => {
  const h = await mounted(t);
  h.dispose(); h.dispose();
  assert.equal(h.scene.disposeEffects, 1);
  h.scene.completeReady(); await flush();
  assert.equal(h.scene.disposeEffects, 1, 'Repeated public dispose remains harmless');
  assert.equal(h.api.getState().ready, false);
  assert.equal(h.api.getState().canvasCount, 0);
  assert.equal(h.count('resume'), 0);
  assert.equal(h.win.listenerCount(), 0);
  assert.equal(h.doc.listenerCount(), 0);
  assert.equal(h.subscriberCount, 0);
});

test('desired weather/time and current reduced preference survive delayed import', async t => {
  const h = await mounted(t, { delayImport: true });
  h.api.setWeather('rain'); h.api.setTime('night'); h.state({ reduced: true });
  await h.releaseImport();
  assert.equal(h.scene.options.weather, 'rain');
  assert.equal(h.scene.options.time, 'night');
  assert.equal(h.scene.options.reducedMotion, true);
  await h.ready();
  assert.equal(h.scene.weather, 'rain'); assert.equal(h.scene.time, 'night');
  assert.equal(h.scene.paused, true);
});

test('startup events cannot overwrite desired choices changed while ready is pending', async t => {
  const h = await mounted(t);
  h.api.setWeather('snow'); h.api.setTime('night');
  await h.ready();
  assert.equal(h.scene.weather, 'snow'); assert.equal(h.scene.time, 'night');
  assert.equal(h.api.getState().weather, 'snow'); assert.equal(h.api.getState().time, 'night');
  assert.deepEqual(h.latest('setWeather').args, ['snow', { instant: true }]);
  assert.deepEqual(h.latest('setTime').args, ['night', { instant: true, quiet: true }]);
});

test('import failure leaves native UI available with a visible fallback', async t => {
  const h = await mounted(t, { delayImport: true });
  await h.rejectImport(new Error('Unavailable module'));
  assert.equal(h.api.getState().ready, false);
  assert.equal(h.api.getState().failed, 'init-failed');
  assert.equal(h.instances.length, 0);
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /聊天仍可使用/);
  assert.equal(h.api.getStats(), null);
  assert.equal(h.api.capture(), undefined);
});

test('constructor WebGL failure reports the original public error code', async t => {
  const h = await mounted(t, { constructorError: Object.assign(new Error('No WebGL2'), { code: 'webgl2-unavailable' }) });
  assert.equal(h.api.getState().failed, 'webgl2-unavailable');
  assert.equal(h.api.getState().canvasCount, 0);
  assert.equal(h.status.hidden, false);
});

test('ready rejection releases the scene and later dispose stays idempotent', async t => {
  const h = await mounted(t);
  await h.rejectReady(Object.assign(new Error('Asset startup failed'), { code: 'init-failed' }));
  assert.equal(h.api.getState().ready, false);
  assert.equal(h.api.getState().failed, 'init-failed');
  assert.equal(h.scene.disposeEffects, 1);
  assert.equal(h.api.getState().canvasCount, 0);
  assert.equal(h.status.hidden, false);
  h.dispose(); h.dispose();
  assert.equal(h.scene.disposeEffects, 1);
});

test('runtime reduced preference pauses using public methods without re-instantiation', async t => {
  const h = await mounted(t); await h.ready();
  assert.equal(h.scene.paused, false);
  h.over(h.scene.canvas); assert.equal(h.scene.input.pointer, true);
  h.state({ reduced: true });
  assert.equal(h.scene.paused, true); assert.equal(h.scene.input.pointer, false);
  assert.equal(h.api.getState().reduced, true);
  h.state({ reduced: false });
  assert.equal(h.scene.paused, false);
  assert.equal(h.instances.length, 1);
  assert.equal(h.scene.options.reducedMotion, false, 'Runtime host pause does not pretend the unchanged module has a preference setter');
});

test('pointer lease belongs only to the canvas; native UI and keys stay isolated', async t => {
  const h = await mounted(t); await h.ready();
  assert.equal(h.scene.canvas.style.touchAction, 'pan-y', 'Native vertical touch scrolling remains available');
  h.over(h.scene.canvas); assert.equal(h.scene.input.pointer, true);
  for (const element of [h.button, h.textarea, h.weatherButton, h.container]) {
    h.over(element); assert.equal(h.scene.input.pointer, false, `Pointer isolation for ${element.tagName}`);
    h.event(element, 'pointerdown');
    const key = h.event(element, 'keydown', { key: '1' });
    assert.equal(key.defaultPrevented, false);
    assert.equal(h.scene.input.keyboard, false);
    h.over(h.scene.canvas); assert.equal(h.scene.input.pointer, true);
  }
});

test('Ball click/doubleclick/drag/cancel/blur/lease release never activate native chat', async t => {
  const h = await mounted(t); await h.ready();
  const canvas = h.scene.canvas;
  h.over(canvas); h.event(canvas, 'pointerdown'); h.event(canvas, 'pointerup');
  h.scene.emit('interact', { target: 'ball', action: 'doubleclick' });
  h.over(canvas); h.event(canvas, 'pointerdown'); h.event(canvas, 'pointermove', { clientY: 280 }); h.event(canvas, 'pointerup');
  h.over(canvas); h.event(canvas, 'pointerdown', { pointerType: 'touch' }); h.event(canvas, 'pointercancel', { pointerType: 'touch' });
  h.over(canvas); h.event(canvas, 'pointerdown'); h.event(h.win, 'blur');
  h.over(canvas); h.event(canvas, 'pointerdown'); h.over(h.weatherButton);
  h.over(canvas); h.event(canvas, 'pointerdown'); h.state({ menu: { open: true, modal: true } });
  h.scene.emit('interact', { target: 'ball', action: 'click' });
  h.scene.emit('interact', { target: 'ground', action: 'click' });
  h.scene.emit('interact', { target: 'ball', action: 'key', key: ' ' });
  assert.equal(h.chatOpenCount, 0, 'The stable native DOM button is the only host chat activator');
});

test('chat, reader, menu and closing modal pause and revoke scene interaction', async t => {
  const h = await mounted(t); await h.ready();
  const blockers = [
    { chat: { phase: 'opening' } }, { chat: { phase: 'open' } }, { chat: { phase: 'closing' } },
    { content: { phase: 'opening' } }, { content: { phase: 'reader' } }, { content: { phase: 'closing' } },
    { menu: { open: true, modal: true } }, { menu: { open: false, modal: true } },
  ];
  for (const blocker of blockers) {
    h.state({ chat: { phase: 'closed' }, content: { phase: 'preview' }, menu: { open: false, modal: false } });
    h.over(h.scene.canvas); h.scene.emit('say', { text: 'Hello', duration: 1 });
    assert.equal(h.scene.input.pointer, true);
    h.state(blocker);
    assert.equal(h.scene.paused, true, JSON.stringify(blocker));
    assert.equal(h.scene.input.pointer, false, JSON.stringify(blocker));
    assert.equal(h.speech.hidden, true);
    h.over(h.scene.canvas); assert.equal(h.scene.input.pointer, false);
  }
  h.state({ chat: { phase: 'closed' }, content: { phase: 'preview' }, menu: { open: false, modal: false } });
  assert.equal(h.scene.paused, false);
});

test('weather control keeps changes visible while its native pointer target owns input', async t => {
  const h = await mounted(t); await h.ready();
  h.state({ weather: { open: true } });
  assert.equal(h.scene.paused, false, 'Weather control itself is intentionally not an animation blocker');
  h.over(h.scene.canvas); h.over(h.weatherButton);
  assert.equal(h.scene.input.pointer, false);
  h.api.setWeather('rain'); h.api.setTime('night');
  assert.equal(h.scene.weather, 'rain'); assert.equal(h.scene.time, 'night');
  assert.deepEqual(h.latest('setWeather').args, ['rain', { instant: false }]);
  assert.deepEqual(h.latest('setTime').args, ['night', { instant: false, quiet: true }]);
});

test('off-hero scrolling and hidden documents pause without a replacement scene', async t => {
  const h = await mounted(t); await h.ready();
  h.over(h.scene.canvas);
  h.doc.scrollingElement.scrollTop = 900; h.event(h.win, 'scroll');
  assert.equal(h.scene.paused, true); assert.equal(h.scene.input.pointer, false);
  h.doc.scrollingElement.scrollTop = 0; h.event(h.win, 'scroll');
  assert.equal(h.scene.paused, false);
  h.doc.hidden = true; h.event(h.doc, 'visibilitychange');
  assert.equal(h.scene.paused, true); assert.equal(h.scene.input.pointer, false);
  h.over(h.scene.canvas); assert.equal(h.scene.input.pointer, false);
  h.doc.hidden = false; h.event(h.doc, 'visibilitychange');
  assert.equal(h.scene.paused, false);
  assert.equal(h.instances.length, 1);
});

test('static weather/time updates snap and repaint only through capture()', async t => {
  const h = await mounted(t, { initial: { reduced: true }, holdCaptures: true }); await h.ready();
  assert.equal(h.count('capture'), 1);
  assert.equal(h.scene.paused, true);
  h.api.setWeather('rain'); h.api.setTime('night'); h.api.setWeather('fog');
  assert.deepEqual(h.latest('setWeather').args, ['fog', { instant: true }]);
  assert.deepEqual(h.latest('setTime').args, ['night', { instant: true, quiet: true }]);
  assert.equal(h.count('capture'), 1, 'Only one encode may be in flight');
  await h.finishCapture(0);
  assert.equal(h.count('capture'), 2, 'Queued changes need one final static frame');
  assert.equal(h.scene.captures[1].weather, 'fog'); assert.equal(h.scene.captures[1].time, 'night');
  assert.deepEqual(h.latest('capture').args, ['image/jpeg', 0.1]);
  await h.finishCapture(1);
  assert.equal(h.count('capture'), 2, 'No continuous repaint loop');
  assert.equal(h.count('resume'), 0, 'A static capture cannot restart animation');
});

test('a rejected static capture reports a warning and releases the repaint gate', async t => {
  const h = await mounted(t, { initial: { reduced: true }, holdCaptures: true }); await h.ready();
  await h.finishCapture(0, new Error('Encoder unavailable'));
  assert.ok(h.warnings.some(args => String(args[0]).includes('静态重绘失败')));
  h.api.setWeather('snow');
  assert.equal(h.count('capture'), 2);
  await h.finishCapture(1);
  assert.equal(h.scene.paused, true);
});

test('container resize forwards its latest dimensions and requests a static frame', async t => {
  const h = await mounted(t, { initial: { reduced: true } }); await h.ready();
  const before = h.count('capture');
  h.container.bounds = { left: 5, top: 12, width: 420, height: 900 };
  h.observers[0].fire(); await flush();
  assert.equal(h.count('resize'), 1);
  assert.equal(h.latest('resize').args[0].width, 420);
  assert.equal(h.latest('resize').args[0].height, 900);
  assert.equal(h.count('capture'), before + 1);
  assert.equal(h.scene.paused, true);
  assert.equal(h.instances.length, 1);
});

test('stats and explicit capture are transparent public API forwards', async t => {
  const h = await mounted(t, { holdCaptures: true });
  assert.equal(h.api.getStats(), null); assert.equal(h.api.capture(), undefined);
  await h.ready();
  assert.equal(h.api.getStats().width, 960);
  const pending = h.api.capture('image/webp', 0.7);
  assert.deepEqual(h.latest('capture').args, ['image/webp', 0.7]);
  await h.finishCapture(0);
  assert.equal(await pending, h.scene.captures[0].result);
});

test('speech uses public screen anchors and its timer is disposed cleanly', async t => {
  const h = await mounted(t); await h.ready();
  h.scene.emit('say', { text: 'A public line', duration: 1.5 });
  assert.equal(h.speech.textContent, 'A public line'); assert.equal(h.speech.hidden, false);
  assert.equal(h.speech.style.transform, 'translate(315px, 230px) translate(-50%, -100%)');
  h.scene.emit('frame', { dt: 0.016, anchors: { bubble: { x: 200, y: 150 } } });
  assert.equal(h.speech.style.transform, 'translate(215px, 180px) translate(-50%, -100%)');
  h.advanceTimers(1499); assert.equal(h.speech.hidden, false);
  h.advanceTimers(1); assert.equal(h.speech.hidden, true);
  h.scene.emit('say', { text: 'Another line', duration: 10 }); h.dispose();
  assert.equal(h.speech.hidden, true); assert.equal(h.timers.size, 0);
});

test('context loss cancels browser default and keeps later host policy paused', async t => {
  const h = await mounted(t); await h.ready(); h.over(h.scene.canvas);
  const lost = h.event(h.scene.canvas, 'webglcontextlost', { bubbles: false });
  assert.equal(lost.defaultPrevented, true);
  assert.equal(h.api.getState().failed, 'context-lost');
  assert.equal(h.status.hidden, false); assert.equal(h.scene.paused, true);
  const resumes = h.count('resume');
  h.state({ reduced: false }); h.event(h.win, 'scroll'); h.event(h.doc, 'visibilitychange');
  h.over(h.scene.canvas);
  assert.equal(h.scene.paused, true); assert.equal(h.scene.input.pointer, false);
  assert.equal(h.count('resume'), resumes, 'A host notification cannot resume a lost context');
  h.event(h.scene.canvas, 'webglcontextrestored', { bubbles: false });
  assert.equal(h.api.getState().failed, null); assert.equal(h.status.hidden, true);
  assert.equal(h.scene.paused, false); assert.equal(h.instances.length, 1);
});

test('context loss immediately disables a previously active pointer lease', async t => {
  const h = await mounted(t); await h.ready(); h.over(h.scene.canvas);
  assert.equal(h.scene.input.pointer, true);
  h.event(h.scene.canvas, 'webglcontextlost', { bubbles: false });
  assert.equal(h.scene.input.pointer, false, 'Input must be disabled at context loss, without a later host event');
});

test('context loss while ready is pending keeps fallback visible after startup settles', async t => {
  const h = await mounted(t);
  h.event(h.scene.canvas, 'webglcontextlost', { bubbles: false });
  assert.equal(h.api.getState().failed, 'context-lost');
  assert.equal(h.status.hidden, false);
  await h.ready();
  assert.equal(h.api.getState().failed, 'context-lost');
  assert.equal(h.scene.paused, true);
  assert.equal(h.scene.input.pointer, false);
  assert.equal(h.status.hidden, false, 'Ready completion cannot hide a still-active context-loss fallback');
  assert.equal(h.count('capture'), 0);
  h.event(h.scene.canvas, 'webglcontextrestored', { bubbles: false });
  assert.equal(h.status.hidden, true); assert.equal(h.scene.paused, false);
  assert.equal(h.instances.length, 1);
});

test('BFCache keeps one live instance, disables input, and restores host policy', async t => {
  const h = await mounted(t); await h.ready(); h.over(h.scene.canvas);
  h.event(h.win, 'pagehide', { persisted: true });
  assert.equal(h.scene.paused, true); assert.equal(h.scene.disposeEffects, 0);
  assert.equal(h.scene.input.pointer, false, 'Frozen pages cannot retain the canvas pointer lease');
  h.event(h.win, 'pageshow', { persisted: true });
  assert.equal(h.scene.paused, false);
  assert.equal(h.instances.length, 1); assert.equal(h.api.getState().canvasCount, 1);
  h.state({ reduced: true }); h.event(h.win, 'pagehide', { persisted: true }); h.event(h.win, 'pageshow', { persisted: true });
  assert.equal(h.scene.paused, true);
  assert.equal(h.instances.length, 1);
});

test('BFCache entered before ready cannot start animation until pageshow', async t => {
  const h = await mounted(t);
  h.event(h.win, 'pagehide', { persisted: true });
  await h.ready();
  assert.equal(h.scene.paused, true); assert.equal(h.scene.input.pointer, false);
  assert.equal(h.count('resume'), 0); assert.equal(h.count('capture'), 0);
  assert.equal(h.scene.disposeEffects, 0);
  h.event(h.win, 'pageshow', { persisted: true });
  assert.equal(h.scene.paused, false); assert.equal(h.instances.length, 1);
});

test('ready rejection after disposal cannot post a fallback or revive host work', async t => {
  const h = await mounted(t);
  h.dispose();
  const notifications = h.notifications.length;
  await h.rejectReady(new Error('Disposed startup failed'));
  assert.equal(h.notifications.length, notifications);
  assert.equal(h.status.hidden, true); assert.equal(h.speech.hidden, true);
  assert.equal(h.scene.disposeEffects, 1);
  assert.equal(h.count('resume'), 0); assert.equal(h.count('capture'), 0);
  assert.equal(h.api.getState().ready, false);
  assert.equal(h.subscriberCount, 0);
});

test('non-BFCache pagehide and repeated dispose release listeners and resources once', async t => {
  const h = await mounted(t); await h.ready();
  h.event(h.win, 'pagehide', { persisted: false }); h.dispose(); h.dispose();
  assert.equal(h.scene.disposeEffects, 1); assert.equal(h.scene.disposeCalls, 1);
  assert.equal(h.api.getState().canvasCount, 0); assert.equal(h.subscriberCount, 0);
  assert.equal(h.win.listenerCount(), 0); assert.equal(h.doc.listenerCount(), 0);
  assert.equal(h.container.listenerCount(), 0); assert.ok(h.observers.every(observer => !observer.active));
  const calls = h.calls.length;
  h.event(h.win, 'pageshow', { persisted: true }); h.event(h.win, 'scroll');
  h.event(h.doc, 'visibilitychange'); h.observers[0].fire();
  assert.equal(h.calls.length, calls, 'Disposed host listeners cannot reach the old public scene');
});

test('pending static capture completion cannot repaint after disposal', async t => {
  const h = await mounted(t, { initial: { reduced: true }, holdCaptures: true }); await h.ready();
  h.api.setWeather('rain'); h.dispose(); await h.finishCapture(0);
  assert.equal(h.count('capture'), 1);
  assert.equal(h.scene.disposeEffects, 1);
});

test('pending static capture completion cannot repaint a lost or cached context', async t => {
  const h = await mounted(t, { initial: { reduced: true }, holdCaptures: true }); await h.ready();
  h.api.setWeather('rain'); h.event(h.scene.canvas, 'webglcontextlost', { bubbles: false });
  await h.finishCapture(0); assert.equal(h.count('capture'), 1);
  h.event(h.scene.canvas, 'webglcontextrestored', { bubbles: false }); assert.equal(h.count('capture'), 2);
  h.api.setTime('night'); h.event(h.win, 'pagehide', { persisted: true });
  await h.finishCapture(1); assert.equal(h.count('capture'), 2);
  h.event(h.win, 'pageshow', { persisted: true }); assert.equal(h.count('capture'), 3);
  await h.finishCapture(2);
  assert.equal(h.scene.paused, true); assert.equal(h.instances.length, 1);
});


test('header tone observes only public isNight state and daynight notifications', async t => {
  const h = await mounted(t);
  assert.equal(h.api.getState().night, null);
  await h.ready(); assert.equal(h.api.getState().night, false);
  h.api.setTime('night'); assert.equal(h.api.getState().night, true);
  h.api.setTime('auto'); assert.equal(h.api.getState().night, false);
  const notifications = h.notifications.length;
  h.scene.night = true; h.scene.emit('daynight', { night: true });
  assert.equal(h.api.getState().night, true); assert.equal(h.notifications.length, notifications + 1);
  h.checkPublicOnly();
});


test('explicit scene exploration resumes off-hero without a new scene and revokes on return', async t => {
 const h=await mounted(t,{coarse:true}); await h.ready();
 h.over(h.scene.canvas); assert.equal(h.scene.input.pointer,false,'mobile reading preserves native pan-y');
 h.doc.scrollingElement.scrollTop=1200;h.event(h.win,'scroll');assert.equal(h.scene.paused,true);
 h.state({sceneExplore:{phase:'entering',inputEnabled:false}});h.over(h.scene.canvas);assert.equal(h.scene.input.pointer,false);
 h.state({sceneExplore:{phase:'exploring',inputEnabled:true}});h.over(h.scene.canvas);assert.equal(h.scene.paused,false);assert.equal(h.scene.input.pointer,true);assert.equal(h.scene.canvas.style.touchAction,'none');
 h.state({sceneExplore:{phase:'returning',inputEnabled:false}});assert.equal(h.scene.input.pointer,false);assert.equal(h.scene.paused,true);
 h.state({sceneExplore:{phase:'reading',inputEnabled:false}});assert.equal(h.scene.canvas.style.touchAction,'pan-y');assert.equal(h.instances.length,1);
});

test('first canvas press after an exploration fade acquires input before the canvas handler', async t => {
 const h=await mounted(t); await h.ready();
 h.state({sceneExplore:{phase:'entering',inputEnabled:false}});
 h.over(h.scene.canvas);assert.equal(h.scene.input.pointer,false);
 h.state({sceneExplore:{phase:'exploring',inputEnabled:true}});
 assert.equal(h.scene.input.pointer,false,'Settling does not invent a pointerover event');
 const press=h.event(h.scene.canvas,'pointerdown');
 assert.equal(h.scene.input.pointer,true);
 assert.ok(h.scene.press,'The same first press reaches the upstream canvas handler with input enabled');
 assert.equal(press.defaultPrevented,false);
 h.event(h.scene.canvas,'pointerup');
 for(const element of [h.button,h.textarea,h.weatherButton,h.container]){
  h.event(element,'pointerdown');
  assert.equal(h.scene.input.pointer,false,'Overlay presses cannot acquire canvas input');
  assert.equal(h.scene.press,null);
  h.event(h.scene.canvas,'pointerdown');assert.ok(h.scene.press);
  h.event(h.scene.canvas,'pointerup');
 }
 h.state({sceneExplore:{phase:'returning',inputEnabled:false}});
 h.event(h.scene.canvas,'pointerdown');assert.equal(h.scene.input.pointer,false);assert.equal(h.scene.press,null);
 h.dispose();assert.equal(h.doc.listenerCount(),0,'Capture listener is removed on disposal');
});
