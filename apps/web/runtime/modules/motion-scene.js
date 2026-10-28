/** Public-API-only mount. No internals, shaders, brain or renderer edits. */
export function mountMotionScene({ host, container, speech, status }) {
  let scene = null, pending = null, disposed = false, cached = false, ready = false, failed = null;
  let selected = 'sunny', time = 'auto', pointerLease = false, speechTimer = 0, paintPending = false, paintAgain = false;
  let state = host.getState(); const cleanups = [];
  const visibleHero = () => document.scrollingElement.scrollTop < Math.max(120, innerHeight * .8);
  const blocked = () => state.chat?.phase && state.chat.phase !== 'closed' || state.content?.phase && state.content.phase !== 'preview' || state.menu?.open || state.menu?.modal;
  const exploring = () => state.sceneExplore?.inputEnabled === true;
  const staticMode = () => (state.sceneExplore && !['reading','exploring'].includes(state.sceneExplore.phase)) || state.reduced || (!visibleHero() && !exploring()) || !!blocked();
  function notify() { host.moduleChanged('scene'); }
  function paintOnce() {
    if (!scene || !ready || failed || disposed || cached || document.hidden) return;
    if (paintPending) { paintAgain = true; return; }
    paintPending = true;
    // capture() is the upstream module's existing one-frame rendering API.
    scene.capture('image/jpeg', .1).catch(error => console.warn('3D 静态重绘失败', error)).finally(() => {
      paintPending = false;
      if (paintAgain) { paintAgain = false; paintOnce(); }
    });
  }
  function inputFor(target) {
    const allow = !!scene && ready && !failed && !document.hidden && !staticMode() && !cached && (!matchMedia('(pointer: coarse)').matches || exploring()) && target === scene.canvas;
    if (pointerLease !== allow) { pointerLease = allow; scene?.setInput({ pointer: allow, keyboard: false }); }
  }
  function policy() {
    if (!scene || !ready || disposed) return;
    if (staticMode() || failed || cached || document.hidden) pointerLease = false;
    scene.canvas.style.touchAction = exploring() ? 'none' : 'pan-y';
    scene.setInput({ pointer: pointerLease && !failed && !document.hidden && !staticMode() && !cached, keyboard: false });
    if (failed || cached || document.hidden || staticMode()) scene.pause(); else scene.resume();
  }
  function position(anchors) {
    if (!speech || speech.hidden) return;
    const r = container.getBoundingClientRect();
    speech.style.transform = `translate(${r.left + anchors.bubble.x}px, ${r.top + anchors.bubble.y}px) translate(-50%, -100%)`;
  }
  function say({ text, duration }) {
    if (disposed || !speech || blocked()) return;
    speech.textContent = text; speech.hidden = false; if (scene) position(scene.ball.anchors);
    clearTimeout(speechTimer); speechTimer = setTimeout(() => { speech.hidden = true; }, Math.max(400, duration * 1000));
  }
  async function initialize() {
    try {
      const { WeatherScene } = await import('../motion/weather-scene.js');
      if (disposed) return;
      pending = new WeatherScene(container, { assetBase: new URL('../motion/assets/', import.meta.url).href,
        weather: selected, time, input: { pointer: false, keyboard: false }, audio: false,
        autoCycle: false, autoPause: true, reducedMotion: state.reduced });
      cleanups.push(pending.on('say', say), pending.on('frame', ({ anchors }) => position(anchors)),
        // Ball clicks retain upstream play/gesture behavior. Chat activation is
        // the native DOM button, so pointercancel/lease release cannot open it.
        pending.on('weatherchange', ({ weather }) => { if (ready) { selected = weather; notify(); } }),
        pending.on('timechange', ({ mode }) => { if (ready) { time = mode; notify(); } }),
        pending.on('daynight', () => { if (ready) notify(); }));
      await pending.ready;
      if (disposed) { pending.dispose(); return; }
      scene = pending; ready = true; scene.canvas.style.touchAction = 'pan-y';
      scene.setWeather(selected, { instant: true }); scene.setTime(time, { instant: true, quiet: true });
      status.hidden = !failed; container.dataset.ready = 'true'; policy(); if (staticMode()) paintOnce(); notify();
    } catch (error) {
      pending?.dispose(); failed = error.code || 'init-failed'; ready = false;
      if (!disposed) { status.textContent = '3D 暂时不可用，内容和聊天仍可使用'; status.hidden = false; notify(); console.warn('3D 场景未能启动', error); }
    }
  }
  const stopHost = host.subscribe(next => { state = next; if (blocked()) { speech.hidden = true; pointerLease = false; } policy(); });
  const scroll = () => policy(), pointer = event => inputFor(event.target);
  const visibility = () => { policy(); if (!document.hidden && staticMode()) paintOnce(); };
  const resize = () => { scene?.resize(); if (staticMode()) paintOnce(); };
  const lost = event => { event.preventDefault(); pointerLease = false; failed = 'context-lost'; policy(); status.textContent = '3D 暂时不可用，内容和聊天仍可使用'; status.hidden = false; notify(); };
  const restored = () => { failed = null; status.hidden = true; policy(); if (staticMode()) paintOnce(); notify(); };
  const pagehide = event => { if (event.persisted) { cached = true; pointerLease = false; policy(); } else api.dispose(); };
  const pageshow = () => { cached = false; policy(); if (staticMode()) paintOnce(); };
  window.addEventListener('scroll', scroll, { passive: true }); document.addEventListener('pointerover', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pagehide); window.addEventListener('pageshow', pageshow);
  container.addEventListener('webglcontextlost', lost, true); container.addEventListener('webglcontextrestored', restored, true);
  const ro = new ResizeObserver(resize); ro.observe(container);
  const api = {
    getState: () => ({ ready, failed, weather: selected, time, night: scene ? scene.isNight : null, paused: !scene || scene.paused, reduced: !!state.reduced,
      pointerLease, anchors: scene?.ball?.anchors ? JSON.parse(JSON.stringify(scene.ball.anchors)) : null,
      canvasCount: container.querySelectorAll('canvas').length, source: 'motion-ball@957cec0', publicApiOnly: true }),
    setWeather(name) { selected = name; if (scene && ready) { scene.setWeather(name, { instant: staticMode() }); if (staticMode()) paintOnce(); } notify(); return true; },
    setTime(mode) { time = mode; if (scene && ready) { scene.setTime(mode, { instant: staticMode(), quiet: true }); if (staticMode()) paintOnce(); } notify(); return true; },
    getStats: () => scene?.getStats() || null, capture: (...args) => scene?.capture(...args),
    dispose() { if (disposed) return; disposed = true; stopHost(); ro.disconnect(); clearTimeout(speechTimer); for (const off of cleanups.splice(0)) off(); (scene || pending)?.dispose(); speech.hidden = true;
      window.removeEventListener('scroll', scroll); document.removeEventListener('pointerover', pointer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow); container.removeEventListener('webglcontextlost', lost, true); container.removeEventListener('webglcontextrestored', restored, true); },
  };
  initialize(); return api;
}
