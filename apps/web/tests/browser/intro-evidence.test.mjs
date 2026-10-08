import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {installIntroObserver, requireStartedProgress, requireNativeControlClick, observeStartedProgress, installIntroEvidence, armNativeNotification, armContentInterruption} from './intro-evidence.mjs';

function evidence(reason = 'replay') {
  const seed = {t: 0, sequence: 2, source: reason === 'replay' ? 'story-event' : 'initial-public-state',
    action: reason === 'replay' ? 'started' : null, phase: reason === 'replay' ? 'rewind' : 'story',
    reason, serial: reason === 'replay' ? 2 : 1, time: 0, enabled: true, active: true,
    reduced: false, hidden: false, visibilityState: 'visible'};
  const row = (stamp, time, frames) => ({t: stamp, frameStamp: stamp, hidden: false,
    visibilityState: 'visible', availability: {status: 'ready', reason: null},
    story: {...seed, time}, actorUUID: 'persistent-ball', actorCount: 1, canvasCount: 1,
    domCanvasCount: 1, canvasIdentity: 1, canvasConnected: true, canvasWidth: 390,
    canvasHeight: 844, triangles: 4000, calls: 8, clockFrames: frames});
  const click = {t: 0, sequence: 1, source: 'native-control-click', target: '#host-replay',
    trusted: true, visible: true, enabled: true, connected: true, storySerial: 1,
    hidden: false, visibilityState: 'visible'};
  return {reason, status: 'progress', started: reason === 'replay' ? seed : null,
    replayClick: reason === 'replay' ? click : null, controlClicks: reason === 'replay' ? [click] : [],
    initialState: reason === 'autoplay' ? seed : null, before: row(0, 0, 0),
    observations: [row(500, .1, 1), row(1000, .25, 2), row(1500, .4, 3)],
    events: reason === 'replay' ? [seed] : [], errors: []};
}

test('actual replay start and independent fresh autoplay state can each prove progress', () => {
  for (const reason of ['replay', 'autoplay']) assert.equal(requireStartedProgress(evidence(reason), reason).reason, reason);
});

const rejectCases = [
  ['home alone', e => {e.initialState.active = false; e.initialState.phase = 'home';}, 'autoplay'],
  ['missing autoplay state', e => {e.initialState = null;}, 'autoplay'],
  ['replay substituted for fresh entry', e => {e.events.push({action: 'started', reason: 'replay'});}, 'autoplay'],
  ['later autoplay serial', e => {e.initialState.serial = 2;}, 'autoplay'],
  ['disabled intro', e => {e.started.enabled = false;}],
  ['inactive intro', e => {e.started.active = false;}],
  ['reduced-motion intro', e => {e.started.reduced = true;}],
  ['nonzero replay start', e => {e.started.time = 4;}],
  ['missing start timestamp', e => {delete e.started.t;}],
  ['state label replacing replay event', e => {e.started.source = 'initial-public-state';}],
  ['wrong lifecycle action', e => {e.started.action = 'rewound';}],
  ['missing native Replay click', e => {e.controlClicks = []; e.replayClick = null;}],
  ['untrusted Replay click', e => {e.replayClick.trusted = false;}],
  ['hidden Replay click', e => {e.replayClick.visible = false;}],
  ['disabled Replay click', e => {e.replayClick.enabled = false;}],
  ['disconnected Replay click', e => {e.replayClick.connected = false;}],
  ['Replay click while document hidden', e => {e.replayClick.hidden = true;}],
  ['Replay click after started event', e => {e.replayClick.sequence = 3;}],
  ['Replay click timestamp after start', e => {e.replayClick.t = 1;}],
  ['Replay click from old serial', e => {e.replayClick.storySerial = 0;}],
  ['cached Replay click without selected-run proof', e => {e.replayClick = null;}],
  ['no active presented progress', e => {e.status = 'ended-before-progress';}],
  ['missing three observations', e => {e.observations.pop();}],
  ['hidden initial state', e => {e.started.hidden = true; e.started.visibilityState = 'hidden';}],
  ['hidden presented frame', e => {e.observations[1].hidden = true;}],
  ['fallback renderer', e => {e.observations[1].availability.status = 'failed';}],
  ['zero draw calls', e => {e.observations[1].calls = 0;}],
  ['zero triangles', e => {e.observations[1].triangles = 0;}],
  ['missing actor', e => {e.observations[1].actorCount = 0;}],
  ['replaced actor', e => {e.observations[1].actorUUID = 'replacement';}],
  ['replaced canvas', e => {e.observations[1].canvasIdentity = 2;}],
  ['extra DOM canvas', e => {e.observations[1].domCanvasCount = 2;}],
  ['detached canvas', e => {e.observations[1].canvasConnected = false;}],
  ['zero-sized canvas', e => {e.observations[1].canvasWidth = 0;}],
  ['crossed story serial', e => {e.observations[1].story.serial++;}],
  ['later home snapshot', e => {e.observations[2].story.active = false; e.observations[2].story.time = 12.7;}],
  ['home phase with inconsistent active label', e => {e.observations[2].story.phase = 'home';}],
  ['unchanged real clock', e => {e.observations.forEach(row => {row.clockFrames = 0;});}],
  ['exact .2 second progress', e => {e.observations.forEach((row, i) => {row.story.time = (i + 1) / 15;});}],
  ['story progress without elapsed presentation', e => {e.observations.forEach((row, i) => {row.frameStamp = (i + 1) * 30;});}],
  ['shortened observation cadence', e => {e.observations.forEach((row, i) => {row.frameStamp = (i + 1) * 400;});}],
  ['nonmonotonic presented time', e => {e.observations[1].story.time = .05;}],
  ['observer error', e => {e.errors.push({message: 'snapshot threw'});}],
];
for (const [name, mutate, reason = 'replay'] of rejectCases) test(`oracle rejects ${name}`, () => {
  const data = evidence(reason); mutate(data);
  assert.throws(() => requireStartedProgress(data, reason), /INTRO_EVIDENCE:/);
});

function observerWorld(reason = 'autoplay', options = {}, bindings = {}) {
  const windowListeners = new Map(), documentListeners = new Map(), frames = [];
  let stamp = 0, canvas = {isConnected: true, width: 390, height: 844};
  const story = {phase: reason === 'replay' ? 'rewind' : 'story', reason,
    serial: reason === 'replay' ? 2 : 1, time: 0, enabled: true, active: true, reduced: false};
  let clockFrames = 0, snapshotReads = 0;
  const context = {
    innerWidth: 390, innerHeight: 844,
    performance: {now: () => stamp},
    requestAnimationFrame: callback => {frames.push(callback); return frames.length;},
    document: {visibilityState: 'visible', hidden: false,
      addEventListener: (name, listener) => documentListeners.set(name, listener),
      querySelectorAll: selector => {assert.equal(selector, '#world-stage canvas'); return [canvas];}},
    window: {
      ...bindings,
      addEventListener: (name, listener) => windowListeners.set(name, listener),
      personalOSWorldAvailability: Object.freeze({status: 'ready', reason: null}),
      personalOSWorld: Object.freeze({story: Object.freeze({getState: () => ({...story})})}),
      ballStudy: Object.freeze({snapshot: () => {snapshotReads++; return {
        story: {...story}, clock: {frames: clockFrames}, actorUUID: 'persistent-ball',
        actorCount: 1, canvasCount: 1, triangles: 4000, calls: 8,
      };}}),
    },
    getComputedStyle: () => ({display: 'block', visibility: 'visible', opacity: '1'}),
  };
  context.options = options;
  runInNewContext(`(${installIntroObserver.toString()})(options)`, context);
  const emit = (name, detail = {}) => windowListeners.get(name)?.({detail});
  return {context, emit, story, queuedFrames: () => frames.length, reads: () => snapshotReads,
    click(target = '#host-replay', overrides = {}) {
      const node = {id: target.slice(1), isConnected: true, parentElement: null, hidden: false,
        getBoundingClientRect: () => ({width: 40, height: 40, left: 10, right: 50, top: 10, bottom: 50}),
        getClientRects: () => [1], matches: () => false, getAttribute: () => null,
        closest: selector => selector === '[inert]' ? null : selector.split(',').some(value => value.trim() === `#${node.id}`) ? node : null, ...overrides};
      documentListeners.get('click')?.({target: node, isTrusted: true});
    },
    frame(nextStamp, time, count) {stamp = nextStamp; story.time = time; clockFrames = count; frames.shift()?.(stamp);},
    laterHome() {stamp = 15000; story.active = false; story.phase = 'home'; story.time = 12.7; emit('personalos:story-state', {...story, action: 'settled'});},
    replaceCanvas() {canvas = {isConnected: true, width: 390, height: 844};},
  };
}

test('early autoplay evidence survives slow navigation and natural completion without inventing an event', () => {
  const world = observerWorld();
  world.emit('personalos:world-ready');
  world.emit('personalos:world-availability', {status: 'ready', reason: null});
  for (const [stamp, time, frames] of [[0, 0, 0], [500, .1, 1], [1000, .25, 2], [1500, .4, 3]]) world.frame(stamp, time, frames);
  assert.equal(world.reads(), 4);
  assert.equal(world.queuedFrames(), 0, 'collector stops once the bounded proof exists');
  world.laterHome();
  const result = world.context.window.__introEvidence.read('autoplay');
  assert.equal(result.started, null);
  assert.equal(result.initialState.source, 'initial-public-state');
  assert.equal(result.events.filter(row => row.action === 'started').length, 0);
  assert.doesNotThrow(() => requireStartedProgress(result, 'autoplay'));
  world.replaceCanvas();
  assert.equal(world.context.window.__introEvidence.current().canvasIdentity, 2, 'live continuity read detects a replaced node');
});

test('replay retains the synchronous actual started event and observes progress through real rewind', () => {
  const world = observerWorld('replay'), event = {...world.story, action: 'started'};
  world.story.serial = 1;
  world.click();
  world.story.serial = 2;
  world.emit('personalos:story-state', event);
  event.time = 9;
  for (const [stamp, time, frames] of [[0, 0, 0], [500, 0, 1], [1000, .1, 2], [1500, .6, 3]]) {
    if (stamp >= 900) world.story.phase = 'story';
    world.frame(stamp, time, frames);
  }
  const result = world.context.window.__introEvidence.read('replay');
  assert.equal(result.started.time, 0, 'record is primitive data, not a mutable event reference');
  assert.equal(result.started.phase, 'rewind');
  assert.equal(result.replayClick.trusted, true);
  assert.ok(result.started.sequence > result.replayClick.sequence);
  assert.doesNotThrow(() => requireStartedProgress(result, 'replay'));
});

test('Skip proof requires a trusted visible control click after replay start on the same serial', () => {
  const data = evidence();
  const click = {...data.replayClick, target: '#host-skip', sequence: 3, t: 1500, storySerial: 2};
  data.controlClicks.push(click);
  assert.equal(requireNativeControlClick(data, '#host-skip', {afterSequence: data.started.sequence, storySerial: data.started.serial}), click);
  assert.throws(() => requireNativeControlClick(data, '#host-skip', {afterSequence: 3}), /trusted, visible/);
  click.enabled = false;
  assert.throws(() => requireNativeControlClick(data, '#host-skip', {afterSequence: 2}), /trusted, visible/);
});

test('observer records native control state before its handler changes the story', () => {
  const world = observerWorld('replay');
  world.click('#host-skip');
  world.click('#host-replay', {hidden: true});
  const data = world.context.window.__introEvidence.read('replay');
  assert.equal(data.controlClicks[0].target, '#host-skip');
  assert.equal(data.controlClicks[0].visible, true);
  assert.equal(data.controlClicks[0].storySerial, 2);
  assert.equal(data.controlClicks[1].visible, false);
  assert.equal(data.controlClicks[1].trusted, true);
});

test('an internal hidden world Replay proxy never supplies public native Replay proof', () => {
  const world = observerWorld('replay');
  world.story.serial = 1;
  world.click('#world-replay');
  world.story.serial = 2;
  world.emit('personalos:story-state', {...world.story, action: 'started'});
  for (const [stamp, time, frames] of [[0, 0, 0], [500, 0, 1], [1000, .1, 2], [1500, .6, 3]]) world.frame(stamp, time, frames);
  const data = world.context.window.__introEvidence.read('replay');
  assert.equal(data.controlClicks.length, 0);
  assert.equal(data.replayClick, null);
  assert.throws(() => requireStartedProgress(data, 'replay'), /#host-replay requires a trusted/);
});

test('natural home completion before a presented progress pair stays a failed observation', () => {
  const world = observerWorld();
  world.emit('personalos:world-ready');
  world.frame(0, 0, 0);
  world.laterHome();
  const result = world.context.window.__introEvidence.read('autoplay');
  assert.equal(result.status, 'ended-before-progress');
  assert.throws(() => requireStartedProgress(result, 'autoplay'), /no presented active progress/);
});

test('a home-only world-ready state does not become invented autoplay evidence', () => {
  const world = observerWorld();
  world.story.phase = 'home'; world.story.active = false; world.story.time = 12.7;
  world.emit('personalos:world-ready');
  const result = world.context.window.__introEvidence.read('autoplay');
  assert.equal(result.initialState, null);
  assert.equal(result.started, null);
  assert.equal(world.queuedFrames(), 0);
  assert.throws(() => requireStartedProgress(result, 'autoplay'), /missing enabled, active autoplay start/);
});

function handlePage(data, jsonError = null) {
  const calls = [];
  const page = {
    evaluate: () => assert.fail('a second framed evaluate is forbidden'),
    async waitForFunction(predicate, reason, options) {
      calls.push('wait');
      assert.equal(reason, data.reason);
      assert.deepEqual(options, {timeout: 30000, polling: 100});
      const context = {reason, window: {__introEvidence: {status: () => 'observing', read: () => data}}};
      const invoke = () => runInNewContext(`(${predicate.toString()})(reason)`, context);
      assert.equal(invoke(), false, 'pending observation remains pending');
      context.window.__introEvidence.status = () => data.status;
      assert.equal(invoke(), data, 'the single framed wait returns the finished evidence itself');
      return {
        async jsonValue() {calls.push('jsonValue'); if (jsonError) throw jsonError; return data;},
        async dispose() {calls.push('dispose');},
      };
    },
  };
  return {page, calls};
}

test('progress wait reads and disposes its evidence handle without another framed evaluate', async () => {
  const data = evidence(), mock = handlePage(data);
  assert.equal(await observeStartedProgress(mock.page, 'replay'), data);
  assert.deepEqual(mock.calls, ['wait', 'jsonValue', 'dispose']);
});

test('a rejected progress oracle still disposes the completed wait handle', async () => {
  const data = evidence(); data.status = 'ended-before-progress';
  const mock = handlePage(data);
  await assert.rejects(observeStartedProgress(mock.page, 'replay'), /no presented active progress/);
  assert.deepEqual(mock.calls, ['wait', 'jsonValue', 'dispose']);
});

test('a handle-read failure still disposes the completed wait handle', async () => {
  const mock = handlePage(evidence(), new Error('synthetic handle read failure'));
  await assert.rejects(observeStartedProgress(mock.page, 'replay'), /synthetic handle read failure/);
  assert.deepEqual(mock.calls, ['wait', 'jsonValue', 'dispose']);
});


test('intro options install the transport before navigation without any additional observation', async () => {
  const calls = [];
  await installIntroEvidence({async addInitScript(fn, options) {calls.push({fn, options});}}, {progressBinding: '__progress'});
  assert.equal(calls[0].fn, installIntroObserver);
  assert.deepEqual(calls[0].options, {progressBinding: '__progress'});
});

test('replay notifies once at the unchanged fourth presented frame and keeps its evidence intact', () => {
  const packets = [];
  const world = observerWorld('replay', {progressBinding: '__progress'}, {__progress: packet => {packets.push(packet);}});
  world.story.serial = 1; world.click(); world.story.serial = 2;
  world.emit('personalos:story-state', {...world.story, action: 'started'});
  for (const [stamp, time, frames] of [[0, 0, 0], [500, 0, 1], [1000, .1, 2]]) world.frame(stamp, time, frames);
  assert.equal(packets.length, 0);
  world.frame(1500, .6, 3);
  assert.equal(packets.length, 1);
  assert.equal(world.reads(), 4, 'notification performs no extra renderer read');
  assert.equal(world.queuedFrames(), 0);
  assert.deepEqual(packets[0], world.context.window.__introEvidence.read('replay'));
  assert.doesNotThrow(() => requireStartedProgress(packets[0], 'replay'));
  world.frame(2000, .8, 4); world.laterHome();
  assert.equal(packets.length, 1, 'later frames or completion never retry notification');
});

test('autoplay never emits the replay progress notification', () => {
  let notified = 0;
  const world = observerWorld('autoplay', {progressBinding: '__progress'}, {__progress: () => {notified++;}});
  world.emit('personalos:world-ready');
  for (const [stamp, time, frames] of [[0, 0, 0], [500, .1, 1], [1000, .25, 2], [1500, .4, 3]]) world.frame(stamp, time, frames);
  assert.equal(notified, 0);
  assert.doesNotThrow(() => requireStartedProgress(world.context.window.__introEvidence.read('autoplay'), 'autoplay'));
});

test('notification delivery failure is diagnostic and never replaces the original observation', async () => {
  const world = observerWorld('replay', {progressBinding: '__progress'}, {__progress: async () => {throw new Error('native action failed');}});
  world.story.serial = 1; world.click(); world.story.serial = 2;
  world.emit('personalos:story-state', {...world.story, action: 'started'});
  for (const [stamp, time, frames] of [[0, 0, 0], [500, 0, 1], [1000, .1, 2], [1500, .6, 3]]) world.frame(stamp, time, frames);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(world.context.window.__nativeGuardSignals.at(-1).stage, 'delivery-error');
  assert.match(world.context.window.__nativeGuardSignals.at(-1).message, /native action failed/);
  assert.doesNotThrow(() => requireStartedProgress(world.context.window.__introEvidence.read('replay'), 'replay'));
});

function notificationPage({deferDelivery = false} = {}) {
  const listeners = new Map(), bindings = new Map(), deliveries = [], calls = [];
  const state = {phase: 'preview', contentId: 'card-a'};
  const context = {performance: {now: () => 123}, window: {
    personalOSContent: {getState: () => ({...state})},
    addEventListener(name, listener) {if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener);},
    removeEventListener(name, listener) {listeners.get(name)?.delete(listener);},
  }};
  const frame = {};
  const page = {
    mainFrame: () => frame,
    async exposeBinding(name, callback) {
      calls.push(`binding:${name}`); bindings.set(name, callback);
      context.window[name] = packet => deferDelivery ? new Promise((resolve, reject) => {
        deliveries.push(() => Promise.resolve(callback({page, frame}, packet)).then(resolve, reject));
      }) : callback({page, frame}, packet);
    },
    async evaluate(fn, args) {calls.push('evaluate'); context.args = args; return runInNewContext(`(${fn.toString()})(args)`, context);},
    keyboard: {async press(key) {calls.push({key, contentPhase: state.phase});}},
  };
  return {page, state, context, calls, bindings, frame,
    emit(detail) {for (const listener of [...(listeners.get('personalos:content-transition') ?? [])]) listener({detail});},
    listenerCount: () => listeners.get('personalos:content-transition')?.size ?? 0,
    async deliver() {await Promise.all(deliveries.splice(0).map(delivery => delivery()));},
  };
}

test('native arm accepts only this page current main frame and invokes its Node action once', async () => {
  const mock = notificationPage(); let actions = 0, release;
  const pendingAction = new Promise(resolve => {release = resolve;});
  const arm = await armNativeNotification(mock.page, {onSignal: async packet => {actions++; assert.equal(packet, 'observed'); await pendingAction; return 'native-result';}});
  const callback = mock.bindings.get(arm.name);
  assert.deepEqual(await callback({page: {}, frame: mock.frame}, 'wrong-page'), {accepted: false});
  assert.deepEqual(await callback({page: mock.page, frame: {}}, 'subframe'), {accepted: false});
  assert.equal(actions, 0);
  const first = callback({page: mock.page, frame: mock.frame}, 'observed');
  assert.equal(actions, 1, 'action begins at binding delivery');
  assert.deepEqual(await callback({page: mock.page, frame: mock.frame}, 'duplicate'), {accepted: false});
  release(); await first;
  assert.deepEqual(await arm.completed, {packet: 'observed', result: 'native-result'});
  await arm.dispose();
  assert.deepEqual(await callback({page: mock.page, frame: mock.frame}, 'late'), {accepted: false});
  assert.equal(actions, 1);
});

test('native arm waits for binding installation and generates unique per-page names', async () => {
  const mock = notificationPage(); const expose = mock.page.exposeBinding; let release, ready = false;
  mock.page.exposeBinding = async (...args) => {await new Promise(resolve => {release = resolve;}); await expose(...args);};
  const pending = armNativeNotification(mock.page, {onSignal: () => {}}).then(arm => {ready = true; return arm;});
  await Promise.resolve(); assert.equal(ready, false);
  release(); const first = await pending;
  mock.page.exposeBinding = expose;
  const second = await armNativeNotification(mock.page, {onSignal: () => {}});
  assert.notEqual(first.name, second.name);
  first.dispose(); second.dispose();
  await assert.rejects(first.completed, /disposed before completion/);
  await assert.rejects(second.completed, /disposed before completion/);
});

test('native action failure rejects completion and cannot trigger a retry', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armNativeNotification(mock.page, {onSignal: () => {actions++; throw new Error('native input missed phase');}});
  const callback = mock.bindings.get(arm.name), source = {page: mock.page, frame: mock.frame};
  await assert.rejects(callback(source, {}), /native input missed phase/);
  await assert.rejects(arm.completed, /native input missed phase/);
  assert.deepEqual(await callback(source, {}), {accepted: false});
  assert.equal(actions, 1); arm.dispose();
});

test('missing native notification times out and ignores a later signal without acting', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armNativeNotification(mock.page, {timeout: 5, onSignal: () => {actions++;}});
  await assert.rejects(arm.completed, /timed out/);
  assert.deepEqual(await mock.bindings.get(arm.name)({page: mock.page, frame: mock.frame}, {}), {accepted: false});
  assert.equal(actions, 0); arm.dispose();
});

test('disposal before notification cancels completion and ignores late delivery', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armNativeNotification(mock.page, {onSignal: () => {actions++;}});
  arm.dispose();
  await assert.rejects(arm.completed, /disposed before completion/);
  assert.deepEqual(await mock.bindings.get(arm.name)({page: mock.page, frame: mock.frame}, {}), {accepted: false});
  assert.equal(actions, 0);
});

test('an action still pending at the bounded deadline remains a failure after its eventual return', async () => {
  const mock = notificationPage(); let release;
  const arm = await armNativeNotification(mock.page, {timeout: 5, onSignal: () => new Promise(resolve => {release = resolve;})});
  const delivery = mock.bindings.get(arm.name)({page: mock.page, frame: mock.frame}, {});
  await assert.rejects(arm.completed, /timed out/);
  release('too-late'); await assert.rejects(delivery, /timed out/);
  await assert.rejects(arm.completed, /timed out/); arm.dispose();
});

test('native arm rejects an expanded deadline or failed binding installation', async () => {
  const mock = notificationPage();
  await assert.rejects(armNativeNotification(mock.page, {timeout: 30001, onSignal: () => {}}), /within 30000/);
  assert.equal(mock.bindings.size, 0);
  mock.page.exposeBinding = async () => {throw new Error('registration failed');};
  await assert.rejects(armNativeNotification(mock.page, {onSignal: () => {}}), /registration failed/);
});

test('content interruption installs before Enter and notifies only matching event plus public intermediate state', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armContentInterruption(mock.page, {contentId: 'card-a', onSignal: async packet => {
    actions++; assert.equal(packet.publicPhase, 'intermediate'); await mock.page.keyboard.press('Escape');
  }});
  assert.equal(mock.listenerCount(), 1);
  assert.deepEqual(mock.calls, [`binding:${arm.name}`, 'evaluate']);
  mock.state.phase = 'intermediate';
  mock.emit({action: 'select', phase: 'intermediate', contentId: 'other-card'});
  mock.emit({action: 'detail-ready', phase: 'intermediate', contentId: 'card-a'});
  mock.emit({action: 'select', phase: 'detail', contentId: 'card-a'});
  assert.equal(actions, 0);
  mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  await arm.completed;
  assert.equal(mock.listenerCount(), 0, 'one-shot listener removes itself before delivery');
  assert.equal(actions, 1);
  assert.deepEqual(mock.calls.find(call => typeof call === 'object'), {key: 'Escape', contentPhase: 'intermediate'});
  mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  assert.equal(actions, 1);
  await arm.dispose();
  assert.equal(Object.keys(mock.context.window.__nativeGuardSignalCleanups).length, 0);
});

test('content notification cannot invent an intermediate phase after actual public state has moved on', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armContentInterruption(mock.page, {contentId: 'card-a', timeout: 5, onSignal: () => {actions++;}});
  mock.state.phase = 'detail';
  mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  await assert.rejects(arm.completed, /timed out/); await arm.dispose();
  assert.equal(actions, 0); assert.equal(mock.listenerCount(), 0);
});

test('a late delivered intermediate packet cannot substitute for actual Escape during intermediate', async () => {
  const mock = notificationPage({deferDelivery: true});
  const arm = await armContentInterruption(mock.page, {contentId: 'card-a', onSignal: packet => {
    assert.equal(packet.publicPhase, 'intermediate'); return mock.page.keyboard.press('Escape');
  }});
  mock.state.phase = 'intermediate'; mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  mock.state.phase = 'detail'; await mock.deliver(); await arm.completed;
  const actualKey = mock.calls.find(call => typeof call === 'object');
  assert.throws(() => assert.equal(actualKey.contentPhase, 'intermediate'), /detail/,
    'the mandatory captured actual-key phase assertion still fails when the native input misses');
  await arm.dispose();
});

test('a malformed or wrong-phase exposed packet fails without issuing actual input', async () => {
  for (const packet of [{}, {kind: 'content-interruption', action: 'select', phase: 'detail', contentId: 'card-a', publicPhase: 'detail', publicContentId: 'card-a', t: 123}]) {
    const mock = notificationPage(); let actions = 0;
    const arm = await armContentInterruption(mock.page, {contentId: 'card-a', onSignal: () => {actions++;}});
    await assert.rejects(mock.bindings.get(arm.name)({page: mock.page, frame: mock.frame}, {...packet, name: arm.name}), /matching observed intermediate/);
    await assert.rejects(arm.completed, /matching observed intermediate/);
    await arm.dispose(); assert.equal(actions, 0); assert.equal(mock.listenerCount(), 0);
  }
});

test('disposing a content arm removes its listener and late content events never invoke input', async () => {
  const mock = notificationPage(); let actions = 0;
  const arm = await armContentInterruption(mock.page, {contentId: 'card-a', onSignal: () => {actions++;}});
  await arm.dispose(); await assert.rejects(arm.completed, /disposed before completion/);
  mock.state.phase = 'intermediate'; mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  assert.equal(actions, 0); assert.equal(mock.listenerCount(), 0);
  assert.equal(mock.context.window.__nativeGuardSignals.at(-1).stage, 'removed');
});

test('content listener diagnostics remain bounded primitive records after action failure', async () => {
  const mock = notificationPage();
  const arm = await armContentInterruption(mock.page, {contentId: 'card-a', onSignal: () => {throw new Error('Escape unavailable');}});
  mock.state.phase = 'intermediate'; mock.emit({action: 'select', phase: 'intermediate', contentId: 'card-a'});
  await assert.rejects(arm.completed, /Escape unavailable/); await Promise.resolve();
  await arm.dispose();
  const signals = mock.context.window.__nativeGuardSignals;
  assert.ok(signals.length <= 32);
  assert.ok(signals.some(row => row.stage === 'delivery-error' && row.message === 'Escape unavailable'));
  assert.ok(signals.every(row => Object.values(row).every(value => ['string', 'number', 'boolean'].includes(typeof value))));
  assert.equal(mock.listenerCount(), 0);
});


test('replay progress notification cannot turn a missed visible Skip phase into native-control proof', () => {
  const packets = [];
  const world = observerWorld('replay', {progressBinding: '__progress'}, {__progress: packet => {packets.push(packet);}});
  world.story.serial = 1; world.click(); world.story.serial = 2;
  world.emit('personalos:story-state', {...world.story, action: 'started'});
  for (const [stamp, time, frames] of [[0, 0, 0], [500, 0, 1], [1000, .1, 2], [1500, .6, 3]]) world.frame(stamp, time, frames);
  assert.doesNotThrow(() => requireStartedProgress(packets[0], 'replay'));
  world.laterHome(); world.click('#host-skip', {hidden: true});
  const result = world.context.window.__introEvidence.read('replay');
  assert.throws(() => requireNativeControlClick(result, '#host-skip', {afterSequence: result.started.sequence, storySerial: result.started.serial}), /trusted, visible/);
});

test('failed content listener installation cleans up a partially installed listener and native arm', async () => {
  const mock = notificationPage(), evaluate = mock.page.evaluate;
  let first = true, actions = 0;
  mock.page.evaluate = async (...args) => {
    const value = await evaluate(...args);
    if (first) {first = false; throw new Error('installation failed after registration');}
    return value;
  };
  await assert.rejects(armContentInterruption(mock.page, {contentId: 'card-a', onSignal: () => {actions++;}}), /installation failed/);
  assert.equal(mock.listenerCount(), 0);
  const [name, callback] = [...mock.bindings][0];
  assert.ok(name);
  assert.deepEqual(await callback({page: mock.page, frame: mock.frame}, {}), {accepted: false});
  assert.equal(actions, 0);
});
