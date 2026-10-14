#!/usr/bin/env node
/** Host-only asynchronous WeatherProvider tests. No DOM, network, or engine internals. */
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
console.log(`WeatherProvider source SHA-256: ${createHash('sha256').update(source).digest('hex')}`);
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function exports() {
  // Any attempt to access DOM, geolocation, or fetch fails in this minimal context.
  const module = new vm.SourceTextModule(source, { context: vm.createContext({ AbortController }), identifier: pathToFileURL(sourcePath).href });
  await module.link(specifier => { throw new Error(`WeatherProvider cannot import engine internals: ${specifier}`); });
  await module.evaluate();
  return module.namespace;
}
async function harness(t, { provider, initialScene = {}, available = true, disposeImmediately = false } = {}) {
  const { mountWeather, mockWeatherProvider } = await exports();
  let sceneState = { weather: 'sunny', time: 'auto', ready: false, ...initialScene }, api, unsubscribeCalls = 0, depth = 0;
  const calls = [], notifications = [], subscribers = new Set(), forbidden = [];
  const snapshot = () => ({ scene: available ? { ...sceneState } : null, weather: api?.getState() });
  const dispatch = next => {
    assert.ok(++depth < 4, 'Provider confirmations cannot recursively notify host');
    try { for (const fn of [...subscribers]) fn(next); } finally { depth--; }
  };
  const methods = {
    setWeather(weather) { calls.push({ method: 'setWeather', args: [weather] }); sceneState.weather = weather; host.moduleChanged('scene'); return true; },
    setTime(time) { calls.push({ method: 'setTime', args: [time] }); sceneState.time = time; host.moduleChanged('scene'); return true; },
  };
  const scene = new Proxy({}, { get(_, name) { if (Object.hasOwn(methods, name)) return methods[name]; forbidden.push(String(name)); throw new Error(`Non-public scene access: ${String(name)}`); } });
  const host = {
    getState: snapshot, scene: () => available ? scene : undefined,
    subscribe(fn) { subscribers.add(fn); let active = true; return () => { if (active) { active = false; subscribers.delete(fn); unsubscribeCalls++; } }; },
    moduleChanged(name) { notifications.push(name); dispatch(snapshot()); },
  };
  api = mountWeather({ host, provider: provider || mockWeatherProvider });
  if (disposeImmediately) api.dispose();
  const h = { api, host, calls, notifications, subscribers, scene,
    get unsubscribeCalls() { return unsubscribeCalls; },
    confirm(patch) { sceneState = { ...sceneState, ...patch }; dispatch(snapshot()); },
    emitScene(value) { dispatch({ ...snapshot(), scene: value }); },
    getState: () => plain(api.getState()),
    check(selected, time) { const s = api.getState(); assert.equal(s.preset, selected); assert.equal(s.selected, selected); assert.equal(s.time, time); },
  };
  t.after(() => { api.dispose(); assert.deepEqual(forbidden, [], 'Only adapter setWeather/setTime may be used'); assert.equal(subscribers.size, 0); });
  return h;
}

test('default mock is asynchronous, deterministic, and declares its source', async () => {
  const { mockWeatherProvider } = await exports();
  assert.equal(mockWeatherProvider.kind, 'mock');
  const controller = new AbortController();
  let settled = false;
  const loaded = mockWeatherProvider.load({ signal: controller.signal }).then(value => { settled = true; return value; });
  assert.equal(settled, false);
  assert.deepEqual(plain(await loaded), { weather: 'sunny', time: 'auto' });
  assert.deepEqual(plain(await mockWeatherProvider.load({ signal: controller.signal })), { weather: 'sunny', time: 'auto' });
});

test('default mock respects cancellation before and during its async boundary', async () => {
  const { mockWeatherProvider } = await exports();
  const before = new AbortController(); before.abort();
  await assert.rejects(mockWeatherProvider.load({ signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController(); const loaded = mockWeatherProvider.load({ signal: during.signal }); during.abort();
  await assert.rejects(loaded, { name: 'AbortError' });
});

test('mount returns immediately and default mock applies through public API before scene ready', async t => {
  const h = await harness(t);
  assert.equal(h.api.getState().phase, 'loading'); assert.deepEqual(h.calls, []);
  assert.equal(await h.api.ready, true); h.check('sunny', 'auto');
  assert.equal(h.api.getState().phase, 'ready'); assert.equal(h.api.getState().source, 'mock'); assert.equal(h.api.getState().simulated, true);
  assert.deepEqual(h.calls, [{ method: 'setWeather', args: ['sunny'] }, { method: 'setTime', args: ['auto'] }]);
  assert.equal(h.notifications.filter(name => name === 'weather').length, 1);
});

test('injected provider runs once and only supported public weather/time are transmitted', async t => {
  const gate = deferred(); let count = 0, signal;
  const h = await harness(t, { provider: { kind: 'live', load(context) { count++; signal = context.signal; return gate.promise; } } });
  await flush(); assert.equal(count, 1); assert.equal(signal.aborted, false); assert.deepEqual(h.calls, []);
  gate.resolve({ weather: 'rain', time: 'night' }); assert.equal(await h.api.ready, true); h.check('rain', 'night');
  assert.equal(h.api.getState().source, 'live'); assert.equal(h.api.getState().simulated, false);
  h.confirm({ ready: true }); h.confirm({ ready: true }); assert.equal(count, 1);
  assert.deepEqual(h.calls, [{ method: 'setWeather', args: ['rain'] }, { method: 'setTime', args: ['night'] }]);
});

test('pending provider retains a validated existing scene as fallback', async t => {
  const gate = deferred();
  const h = await harness(t, { initialScene: { weather: 'fog', time: 'day' }, provider: { kind: 'mock', load: () => gate.promise } });
  h.check('fog', 'day'); assert.equal(h.api.getState().phase, 'loading'); assert.equal(h.api.getState().simulated, true);
  gate.resolve({ weather: 'snow', time: 'night' }); await h.api.ready; h.check('snow', 'night');
});

test('provider rejection keeps valid current defaults and exposes an honest fallback', async t => {
  const h = await harness(t, { initialScene: { weather: 'cloudy', time: 'day' }, provider: { kind: 'live', load: async () => { throw new Error('offline'); } } });
  assert.equal(await h.api.ready, false); h.check('cloudy', 'day'); assert.deepEqual(h.calls, []);
  assert.equal(h.api.getState().phase, 'fallback'); assert.equal(h.api.getState().source, 'fallback');
  assert.equal(h.api.getState().simulated, true); assert.equal(h.api.getState().error, 'weather-unavailable');
});

test('synchronous provider failure is contained without blocking native initialization', async t => {
  const h = await harness(t, { provider: { kind: 'mock', load() { throw new Error('failure'); } } });
  assert.equal(await h.api.ready, false); h.check('sunny', 'auto'); assert.deepEqual(h.calls, []);
  assert.equal(h.api.getState().phase, 'fallback');
});

test('invalid provider payloads never send unsupported scene values', async t => {
  for (const result of [null, {}, { weather: 'hurricane', time: 'auto' }, { weather: 'rain', time: 'twilight' }, { weather: 'rain' }]) {
    const h = await harness(t, { provider: { kind: 'mock', load: async () => result } });
    assert.equal(await h.api.ready, false); h.check('sunny', 'auto'); assert.deepEqual(h.calls, []);
    assert.equal(h.api.getState().phase, 'fallback');
  }
});

test('dispose before provider invocation prevents work and detaches the host subscription', async t => {
  let calls = 0;
  const h = await harness(t, { disposeImmediately: true, provider: { kind: 'mock', load() { calls++; return Promise.resolve({ weather: 'rain', time: 'night' }); } } });
  h.api.dispose(); h.api.dispose(); assert.equal(await h.api.ready, false);
  assert.equal(calls, 0); assert.equal(h.unsubscribeCalls, 1); assert.deepEqual(h.calls, []); assert.deepEqual(h.notifications, []);
});

test('dispose during provider load aborts and ignores a late successful response', async t => {
  const gate = deferred(); let signal;
  const h = await harness(t, { provider: { kind: 'mock', load(context) { signal = context.signal; return gate.promise; } } });
  await flush(); h.api.dispose(); const state = h.getState(); assert.equal(signal.aborted, true);
  gate.resolve({ weather: 'rain', time: 'night' }); assert.equal(await h.api.ready, false);
  assert.deepEqual(h.getState(), state); assert.deepEqual(h.calls, []); assert.deepEqual(h.notifications, []);
});

test('a rejected late response after dispose cannot notify or revive weather', async t => {
  const gate = deferred();
  const h = await harness(t, { provider: { kind: 'mock', load: () => gate.promise } });
  await flush(); h.api.dispose(); gate.reject(new Error('cancelled')); assert.equal(await h.api.ready, false);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.notifications, []); assert.equal(h.api.getState().disposed, true);
});

test('a newer explicit host choice cancels a pending provider and wins its late response', async t => {
  const gate = deferred(); let signal;
  const h = await harness(t, { provider: { kind: 'mock', load(context) { signal = context.signal; return gate.promise; } } });
  await flush(); assert.equal(h.api.setWeather({ weather: 'fog', time: 'day' }), true);
  assert.equal(signal.aborted, true); h.check('fog', 'day'); assert.equal(h.api.getState().phase, 'overridden');
  gate.resolve({ weather: 'snow', time: 'night' }); assert.equal(await h.api.ready, false); h.check('fog', 'day');
  assert.equal(h.api.getState().source, 'manual'); assert.equal(h.calls.length, 2);
});

test('invalid host choices do not cancel or overwrite an in-flight provider', async t => {
  const gate = deferred(); let signal;
  const h = await harness(t, { provider: { kind: 'mock', load(context) { signal = context.signal; return gate.promise; } } });
  await flush(); assert.equal(h.api.setWeather({ weather: 'hurricane' }), false); assert.equal(h.api.setWeather({ weather: 'rain', time: 'twilight' }), false);
  assert.equal(signal.aborted, false); assert.deepEqual(h.calls, []);
  gate.resolve({ weather: 'windy', time: 'auto' }); assert.equal(await h.api.ready, true); h.check('windy', 'auto');
});

test('host weather aliases preserve existing public diagnostic control compatibility', async t => {
  const h = await harness(t); await h.api.ready;
  assert.equal(h.api.setWeather({ preset: 'rain', time: 'night' }), true); h.check('rain', 'night');
  assert.equal(h.api.setWeather({ selected: 'snow' }), true); h.check('snow', 'night');
  for (const weather of ['sunny', 'cloudy', 'windy', 'rain', 'snow', 'fog']) assert.equal(h.api.setWeather({ weather }), true);
  assert.equal(h.api.setWeather({}), false);
});

test('public scene confirmations update state without echoing scene commands', async t => {
  const h = await harness(t); await h.api.ready; const calls = h.calls.length, notifications = h.notifications.length;
  h.confirm({ weather: 'snow', time: 'night', ready: true }); h.check('snow', 'night');
  h.emitScene({ weather: 'fog' }); h.check('fog', 'night'); h.emitScene({ time: 'day' }); h.check('fog', 'day');
  assert.equal(h.calls.length, calls); assert.equal(h.notifications.length, notifications);
});

test('unchanged and invalid scene snapshots never blank valid state or recurse', async t => {
  const h = await harness(t); await h.api.ready; h.confirm({ weather: 'rain', time: 'night' });
  const calls = h.calls.length, notifications = h.notifications.length;
  for (const value of [null, undefined, {}, { weather: 'hurricane', time: 'twilight' }, { weather: '', time: '' }, { weather: 'rain', time: 'night' }]) { h.emitScene(value); h.check('rain', 'night'); }
  assert.equal(h.subscribers.size, 1); assert.equal(h.calls.length, calls); assert.equal(h.notifications.length, notifications);
});

test('optional scene failure does not prevent provider completion or native UI availability', async t => {
  const h = await harness(t, { available: false });
  assert.equal(await h.api.ready, true); h.check('sunny', 'auto'); assert.deepEqual(h.calls, []);
  assert.equal(h.api.setWeather({ weather: 'rain' }), true); h.check('rain', 'auto');
});

test('repeated dispose removes one subscription and rejects later explicit choices', async t => {
  const h = await harness(t); await h.api.ready; h.api.dispose(); h.api.dispose(); const state = h.getState(), calls = h.calls.length, notifications = h.notifications.length;
  h.confirm({ weather: 'rain', time: 'night' }); assert.equal(h.api.setWeather({ weather: 'snow' }), false);
  assert.deepEqual(h.getState(), state); assert.equal(h.calls.length, calls); assert.equal(h.notifications.length, notifications); assert.equal(h.unsubscribeCalls, 1);
});
