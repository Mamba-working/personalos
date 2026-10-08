// Test-only observation. Never changes the app clock, story, renderer, DOM,
// visibility or motion preferences. Install before navigation so a slow goto
// cannot erase the finite intro's real, earlier active frames.
export function installIntroObserver({progressBinding = null} = {}) {
  const events = [], controlClicks = [], visibility = [], availability = [], errors = [], runs = [];
  const canvasIDs = new WeakMap();
  let nextCanvasID = 0, sequence = 0, current = null, scheduled = false;
  const boundedPush = (rows, row, limit = 64) => {rows.push(row); if (rows.length > limit) rows.shift();};
  const string = value => typeof value === 'string' ? value : null;
  const number = value => Number.isFinite(value) ? value : null;
  const boolean = value => typeof value === 'boolean' ? value : null;
  const visible = () => ({visibilityState: document.visibilityState, hidden: document.hidden});
  const storyFields = state => ({
    phase: string(state?.phase), reason: string(state?.reason),
    serial: number(state?.serial), time: number(state?.time),
    enabled: boolean(state?.enabled), active: boolean(state?.active),
    reduced: boolean(state?.reduced),
  });
  const availabilityFields = state => ({status: string(state?.status) ?? 'starting', reason: string(state?.reason)});
  const recordVisibility = () => boundedPush(visibility, {t: performance.now(), ...visible()}, 32);
  recordVisibility();
  document.addEventListener('visibilitychange', recordVisibility);
  const fail = error => {
    const message = String(error?.message ?? error);
    boundedPush(errors, {t: performance.now(), message}, 16);
    if (current && current.status === 'observing') current.status = 'observer-error';
  };
  document.addEventListener('click', event => {
    try {
      // The host controls are the public UI. Alpha7 hides the world's internal
      // transport; its app-owned proxy actions never count as native input.
      const node = event.target?.closest?.('#host-replay, #host-skip');
      if (!node) return;
      const rect = node.getBoundingClientRect();
      let painted = node.getClientRects().length > 0 && rect.width > 0 && rect.height > 0 &&
        rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      for (let ancestor = node; painted && ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        painted = !ancestor.hidden && style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0;
      }
      const state = window.personalOSWorld?.story?.getState();
      boundedPush(controlClicks, {t: performance.now(), sequence: ++sequence,
        source: 'native-control-click', target: `#${node.id}`, trusted: event.isTrusted === true,
        visible: painted, enabled: !node.matches(':disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.closest('[inert]'),
        connected: node.isConnected === true, storySerial: number(state?.serial), ...visible()}, 32);
    } catch (error) {fail(error);}
  }, true);
  const readSnapshot = stamp => {
    const state = window.ballStudy?.snapshot();
    if (!state) return null;
    const canvases = document.querySelectorAll('#world-stage canvas'), canvas = canvases[0];
    if (canvas && !canvasIDs.has(canvas)) canvasIDs.set(canvas, ++nextCanvasID);
    return {
      t: performance.now(), frameStamp: stamp, ...visible(),
      availability: availabilityFields(window.personalOSWorldAvailability),
      story: storyFields(state.story), actorUUID: string(state.actorUUID),
      actorCount: number(state.actorCount), canvasCount: number(state.canvasCount),
      domCanvasCount: canvases.length, canvasIdentity: canvas ? canvasIDs.get(canvas) : null,
      canvasConnected: canvas?.isConnected ?? false,
      canvasWidth: canvas?.width ?? 0, canvasHeight: canvas?.height ?? 0,
      triangles: number(state.triangles), calls: number(state.calls),
      clockFrames: number(state.clock?.frames),
    };
  };
  const schedule = () => {
    if (scheduled || !current || current.status !== 'observing') return;
    scheduled = true;
    requestAnimationFrame(sample);
  };
  function sample(stamp) {
    scheduled = false;
    const run = current;
    if (!run || run.status !== 'observing') return;
    try {
      if (performance.now() - run.seed.t >= 30000) {run.status = 'observation-timeout'; return;}
      // Retain the original 500 ms observation cadence and stop as soon as
      // the original before + three observations and real progress exist.
      if (run.lastSampleStamp === null || stamp - run.lastSampleStamp >= 500) {
        run.lastSampleStamp = stamp;
        const row = readSnapshot(stamp);
        if (row) {
          run.sampleCount++;
          if (!run.before) run.before = row;
          else boundedPush(run.observations, row, 15);
          if (!row.story.active || row.story.serial !== run.seed.serial) run.status = 'ended-before-progress';
          else if (run.observations.length >= 3 &&
              row.story.time > run.before.story.time + .2 &&
              row.frameStamp > run.before.frameStamp + 200 &&
              row.clockFrames > run.before.clockFrames) {
            run.status = 'progress';
            // Transport the same completed evidence, without another framed
            // read. Only Node may perform the actual native Skip action.
            if (run.reason === 'replay' && typeof progressBinding === 'string') {
              const signal = {kind: 'intro-progress', name: progressBinding, t: performance.now(), stage: 'observed'};
              window.__nativeGuardSignals ??= [];
              boundedPush(window.__nativeGuardSignals, signal, 32);
              try {
                Promise.resolve(window[progressBinding](window.__introEvidence.read('replay'))).catch(error => {
                  boundedPush(window.__nativeGuardSignals, {...signal, t: performance.now(), stage: 'delivery-error', message: String(error?.message ?? error)}, 32);
                });
              } catch (error) {
                boundedPush(window.__nativeGuardSignals, {...signal, t: performance.now(), stage: 'delivery-error', message: String(error?.message ?? error)}, 32);
              }
            }
          }
        }
      }
    } catch (error) {fail(error);}
    schedule();
  }
  function begin(seed, started = null, initialState = null) {
    if (current?.status === 'observing') current.status = 'replaced-before-progress';
    const replayClick = seed.reason === 'replay' ? controlClicks.findLast(row => row.target === '#host-replay' && row.sequence < seed.sequence) ?? null : null;
    const run = {reason: seed.reason, seed, started, initialState, replayClick, before: null,
      observations: [], sampleCount: 0, lastSampleStamp: null, status: 'observing'};
    boundedPush(runs, run, 8);
    current = run;
    schedule();
  }
  window.addEventListener('personalos:story-state', event => {
    try {
      const detail = event.detail;
      const row = {t: performance.now(), sequence: ++sequence, source: 'story-event',
        action: string(detail?.action), ...storyFields(detail), ...visible()};
      boundedPush(events, row);
      if (row.action === 'started' && ['autoplay', 'replay'].includes(row.reason)) begin(row, row);
      else if (row.action === 'settled' && current?.status === 'observing' && row.serial === current.seed.serial) {
        current.status = 'ended-before-progress';
      }
    } catch (error) {fail(error);}
  });
  window.addEventListener('personalos:world-ready', () => {
    try {
      const state = window.personalOSWorld?.story?.getState();
      const row = {t: performance.now(), sequence: ++sequence, source: 'initial-public-state', action: null,
        ...storyFields(state), ...visible()};
      // Alpha7 starts autoplay in the lifecycle constructor, before book-story
      // subscribes to it. There is no public autoplay "started" event. Preserve
      // this actual initial public state separately; never invent that event.
      if (row.reason === 'autoplay' && row.active && row.enabled && !current) begin(row, null, row);
    } catch (error) {fail(error);}
  });
  window.addEventListener('personalos:world-availability', event => {
    boundedPush(availability, {t: performance.now(), ...availabilityFields(event.detail)}, 16);
  });
  const latest = reason => runs.findLast(run => run.reason === reason);
  window.__introEvidence = {
    status: reason => latest(reason)?.status ?? 'waiting-for-start',
    current: () => readSnapshot(performance.now()),
    read: reason => {
      const run = latest(reason);
      return JSON.parse(JSON.stringify({
        reason, status: run?.status ?? 'waiting-for-start', started: run?.started ?? null,
        initialState: run?.initialState ?? null, replayClick: run?.replayClick ?? null, before: run?.before ?? null,
        observations: run?.observations ?? [], sampleCount: run?.sampleCount ?? 0,
        events, controlClicks, visibility, availability, errors,
      }));
    },
  };
}

export async function installIntroEvidence(page, {progressBinding = null} = {}) {
  await page.addInitScript(installIntroObserver, {progressBinding});
}

export async function readIntroEvidence(page, reason) {
  return page.evaluate(reason => window.__introEvidence?.read(reason) ?? null, reason);
}

// A live continuity check for after pixel capture/home. It is not a presented
// intro frame and must never substitute for the retained rAF evidence.
export async function readCurrentRendererSnapshot(page) {
  return page.evaluate(() => window.__introEvidence?.current() ?? null);
}

// Dependency-free oracles are also exercised against synthetic negative cases.
export function requireNativeControlClick(evidence, target, {afterSequence = 0, beforeSequence = Infinity, storySerial} = {}) {
  const reject = message => {throw new Error(`INTRO_EVIDENCE: ${message}`);};
  if (!['#host-replay', '#host-skip'].includes(target)) reject('unknown native control');
  const click = evidence?.controlClicks?.findLast(row => row.target === target && row.sequence > afterSequence && row.sequence < beforeSequence);
  if (!click || click.source !== 'native-control-click' || click.trusted !== true || click.visible !== true || click.enabled !== true || click.connected !== true || click.hidden !== false || click.visibilityState !== 'visible' || !Number.isFinite(click.t) || !Number.isInteger(click.sequence)) {
    reject(`${target} requires a trusted, visible, enabled, connected native click`);
  }
  if (storySerial !== undefined && click.storySerial !== storySerial) reject(`${target} click belongs to a different story serial`);
  return click;
}

export function requireStartedProgress(evidence, reason) {
  const reject = message => {throw new Error(`INTRO_EVIDENCE: ${message}`);};
  if (!['autoplay', 'replay'].includes(reason)) reject('unknown start reason');
  if (!evidence || evidence.reason !== reason) reject(`missing ${reason} evidence`);
  if (evidence.errors?.length) reject('read-only observer reported an error');
  const seed = reason === 'replay' ? evidence.started : evidence.initialState ?? evidence.started;
  if (!seed || seed.reason !== reason || seed.enabled !== true || seed.active !== true || seed.reduced !== false || seed.time !== 0 || !Number.isInteger(seed.serial) || seed.serial < 1 || !Number.isFinite(seed.t)) {
    reject(`missing enabled, active ${reason} start at time zero`);
  }
  if (reason === 'replay' && (seed.source !== 'story-event' || seed.action !== 'started' || seed.phase !== 'rewind')) {
    reject('replay requires the actual started event, not a later state label');
  }
  if (reason === 'replay') {
    if (!Number.isInteger(seed.sequence)) reject('replay started event has no observed order');
    const click = requireNativeControlClick(evidence, '#host-replay', {beforeSequence: seed.sequence, storySerial: seed.serial - 1});
    if (!evidence.replayClick || evidence.replayClick.sequence !== click.sequence || click.t > seed.t) reject('replay started event did not follow its native Replay click');
  }
  if (reason === 'autoplay') {
    if (!['initial-public-state', 'story-event'].includes(seed.source) || seed.phase !== 'story' || seed.serial !== 1) reject('fresh entry requires the first real autoplay serial');
    if (seed.source === 'story-event' && seed.action !== 'started') reject('autoplay event is not started');
    if (evidence.events?.some(event => event.reason === 'replay' && event.action === 'started')) reject('replay cannot stand in for fresh entry');
    if (evidence.controlClicks?.some(click => click.target === '#host-replay')) reject('fresh entry must not use Replay');
  }
  if (seed.hidden !== false || seed.visibilityState !== 'visible') reject('start was not visible');
  if (evidence.status !== 'progress') reject(`no presented active progress (${evidence.status})`);
  const before = evidence.before, observations = evidence.observations ?? [];
  if (!before || observations.length < 3) reject('missing before + three presented observations');
  const rows = [before, ...observations];
  if (typeof before.actorUUID !== 'string' || !before.actorUUID || !Number.isInteger(before.canvasIdentity)) reject('missing persistent actor/canvas identity');
  let prior = null;
  for (const row of rows) {
    if (row.hidden !== false || row.visibilityState !== 'visible') reject('observation was not visible');
    if (row.availability?.status !== 'ready') reject('renderer fallback/unavailable cannot pass');
    if (row.story?.enabled !== true || row.story.active !== true || row.story.reduced !== false || row.story.reason !== reason || row.story.serial !== seed.serial || !Number.isFinite(row.story.time) || row.story.time < 0 || !['rewind', 'story', 'handoff'].includes(row.story.phase)) reject('observation is not the same enabled, active intro');
    if (row.actorUUID !== before.actorUUID || row.actorCount !== 1 || row.canvasCount !== 1 || row.domCanvasCount !== 1 || row.canvasIdentity !== before.canvasIdentity || row.canvasConnected !== true || !(row.canvasWidth > 0 && row.canvasHeight > 0)) reject('actor/canvas continuity failed');
    if (!(row.triangles > 0 && row.calls > 0) || !Number.isInteger(row.clockFrames)) reject('missing positive draw calls/triangles or real clock frames');
    if (!Number.isFinite(row.frameStamp) || !Number.isFinite(row.t) || row.t < seed.t) reject('invalid presented-frame timestamp');
    if (prior && row.frameStamp - prior.frameStamp < 500) reject('original 500 ms observation cadence was not retained');
    if (prior && (row.frameStamp <= prior.frameStamp || row.clockFrames < prior.clockFrames || row.story.time < prior.story.time)) reject('presented observations are not ordered');
    prior = row;
  }
  const after = observations.at(-1);
  if (!(after.story.time > before.story.time + .2 && after.frameStamp > before.frameStamp + 200 && after.clockFrames > before.clockFrames)) reject('intro did not make >.2 s of real presented progress');
  return evidence;
}

// Node owns both the deadline and the one-shot action. The exposed page binding
// only transports an observed packet; it never clicks, presses or changes state.
const nativeNotificationCounters = new WeakMap();
export async function armNativeNotification(page, {name, onSignal, timeout = 30000} = {}) {
  if (typeof onSignal !== 'function') throw new TypeError('NATIVE_NOTIFICATION: onSignal is required');
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 30000) throw new RangeError('NATIVE_NOTIFICATION: timeout must be within 30000 ms');
  const serial = (nativeNotificationCounters.get(page) ?? 0) + 1;
  nativeNotificationCounters.set(page, serial);
  name ??= `__nativeGuardSignal_${serial}`;
  if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) throw new TypeError('NATIVE_NOTIFICATION: invalid binding name');
  let active = true, signalled = false, settled = false, terminalError = null, timer;
  let resolveCompleted, rejectCompleted;
  const completed = new Promise((resolve, reject) => {resolveCompleted = resolve; rejectCompleted = reject;});
  // A caller may still be awaiting its Enter/Replay command when the deadline
  // or callback fails. Keep the rejection available without an unhandled race.
  completed.catch(() => {});
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    terminalError = error ?? null;
    active = false;
    clearTimeout(timer);
    if (error) rejectCompleted(error); else resolveCompleted(value);
  };
  try {
    await page.exposeBinding(name, async (source, packet) => {
      if (!active || signalled || source.page !== page || source.frame !== page.mainFrame()) return {accepted: false};
      signalled = true;
      try {
        // Invoke directly at binding delivery, without a poll or page read.
        const result = await onSignal(packet);
        if (terminalError) throw terminalError;
        finish(null, {packet, result});
        return {accepted: true};
      } catch (error) {
        finish(error);
        throw error;
      }
    });
  } catch (error) {
    finish(error);
    throw error;
  }
  if (!settled) timer = setTimeout(() => finish(new Error(`NATIVE_NOTIFICATION: ${name} timed out after ${timeout} ms`)), timeout);
  return {
    name, completed,
    dispose() {
      active = false;
      clearTimeout(timer);
      if (!settled) finish(new Error(`NATIVE_NOTIFICATION: ${name} disposed before completion`));
    },
  };
}

// Read-only public-event observation. The listener checks the event and the
// actual public state before sending one primitive packet to the Node binding.
export function installContentInterruptionObserver({name, contentId}) {
  const signal = (stage, extra = {}) => {
    const rows = window.__nativeGuardSignals ??= [];
    rows.push({kind: 'content-interruption', name, contentId, t: performance.now(), stage, ...extra});
    if (rows.length > 32) rows.shift();
  };
  const cleanups = window.__nativeGuardSignalCleanups ??= Object.create(null);
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    window.removeEventListener('personalos:content-transition', listener);
    delete cleanups[name];
    signal('removed');
  };
  const listener = event => {
    if (!active) return;
    try {
      const detail = event.detail, state = window.personalOSContent?.getState();
      if (detail?.action !== 'select' || detail.phase !== 'intermediate' || detail.contentId !== contentId ||
          state?.phase !== 'intermediate' || state.contentId !== contentId) return;
      const packet = {kind: 'content-interruption', name, t: performance.now(), action: 'select',
        phase: 'intermediate', contentId, publicPhase: state.phase, publicContentId: state.contentId};
      cleanup();
      signal('observed', {action: packet.action, phase: packet.phase, publicPhase: packet.publicPhase});
      try {
        Promise.resolve(window[name](packet)).catch(error => signal('delivery-error', {message: String(error?.message ?? error)}));
      } catch (error) {signal('delivery-error', {message: String(error?.message ?? error)});}
    } catch (error) {signal('observer-error', {message: String(error?.message ?? error)});}
  };
  cleanups[name] = cleanup;
  window.addEventListener('personalos:content-transition', listener);
  signal('armed');
}

export async function armContentInterruption(page, {contentId, onSignal, timeout = 30000} = {}) {
  if (typeof contentId !== 'string' || !contentId) throw new TypeError('CONTENT_INTERRUPTION: contentId is required');
  if (typeof onSignal !== 'function') throw new TypeError('CONTENT_INTERRUPTION: onSignal is required');
  const arm = await armNativeNotification(page, {timeout, onSignal: packet => {
    if (packet?.kind !== 'content-interruption' || packet.name !== arm.name || packet.action !== 'select' ||
        packet.phase !== 'intermediate' || packet.contentId !== contentId || packet.publicPhase !== 'intermediate' ||
        packet.publicContentId !== contentId || !Number.isFinite(packet.t)) {
      throw new Error('CONTENT_INTERRUPTION: missing matching observed intermediate phase');
    }
    return onSignal(packet);
  }});
  const cleanup = () => page.evaluate(name => window.__nativeGuardSignalCleanups?.[name]?.(), arm.name);
  try {
    await page.evaluate(installContentInterruptionObserver, {name: arm.name, contentId});
  } catch (error) {
    arm.dispose();
    await cleanup().catch(() => {});
    throw error;
  }
  // Timeout/failure must remove an unmatched listener too. Caller disposal
  // awaits cleanup; observed delivery errors remain in the primitive log.
  arm.completed.catch(() => cleanup().catch(() => {}));
  return {...arm, async dispose() {arm.dispose(); await cleanup();}};
}

export async function observeStartedProgress(page, reason) {
  const handle = await page.waitForFunction(reason => {
    const observer = window.__introEvidence, status = observer?.status(reason);
    if (!status || ['waiting-for-start', 'observing'].includes(status)) return false;
    return observer.read(reason);
  }, reason, {timeout: 30000, polling: 100});
  try {
    return requireStartedProgress(await handle.jsonValue(), reason);
  } finally {
    await handle.dispose();
  }
}
