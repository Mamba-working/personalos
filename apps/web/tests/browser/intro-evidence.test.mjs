import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {installIntroObserver, requireStartedProgress, requireNativeControlClick, observeStartedProgress} from './intro-evidence.mjs';

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

function observerWorld(reason = 'autoplay') {
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
  runInNewContext(`(${installIntroObserver.toString()})()`, context);
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
