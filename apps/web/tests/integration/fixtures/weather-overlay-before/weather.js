/**
 * PersonalOS weather port.
 * Climate preset values, solar math and exponential blending are adapted from
 * studies/living-space/shared-weather/environment-model.mjs (project source).
 * UI, lifecycle and bounded scene details below are new integration work.
 * No legacy renderer, aora geometry, textures, umbrella or third-party code is copied.
 * THREE is supplied by the existing world; its retained vendor license applies.
 */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fields = Object.freeze({altitude: [-20, 75], azimuth: [-70, 70], cloud: [0, 1], rain: [0, 1], wind: [0, 9], direction: [-180, 180]});
const freezePreset = p => Object.freeze(p);
export const WEATHER_PRESETS = Object.freeze({
  clear: freezePreset({label: '晴日微风', altitude: 33, azimuth: -14, cloud: .17, rain: 0, wind: 1.8, direction: -25}),
  cloudy: freezePreset({label: '云隙天光', altitude: 48, azimuth: 20, cloud: .58, rain: 0, wind: 2.8, direction: 62}),
  rain: freezePreset({label: '有风的雨夜', altitude: -18, azimuth: 32, cloud: .91, rain: .7, wind: 5.8, direction: 24}),
  // Wind is a new authored variation of the source's cloudy climate.
  wind: freezePreset({label: '风过此处', altitude: 22, azimuth: 20, cloud: .42, rain: 0, wind: 6.5, direction: 62}),
  dawn: freezePreset({label: '水边破晓', altitude: 4, azimuth: 12, cloud: .22, rain: 0, wind: 1.1, direction: 16}),
});
export const WEATHER_BUDGET = Object.freeze({rainStrokes: 32, windStrokes: 18, drawObjects: 3, geometries: 3, materials: 3, textures: 0, addedLights: 0});
const presetId = value => value === 'cloud' ? 'cloudy' : Object.hasOwn(WEATHER_PRESETS, value) ? value : null;
const values = p => Object.fromEntries(Object.keys(fields).map(key => [key, p[key]]));

/** Pure state owner. Shared world dt is the only source of elapsed time. */
export function createWeatherModel(initial = {}) {
  const selected = presetId(initial.preset || initial.selected) || 'cloudy';
  let preset = selected, target = values(WEATHER_PRESETS[selected]), effective = {...target};
  let enabled = true, paused = false, autoSun = false, custom = false, time = 0, disposed = false;
  function setWeather(patch = {}) {
    if (disposed || !patch || typeof patch !== 'object') return false;
    const before = JSON.stringify({preset, target, enabled, paused, autoSun, custom});
    const next = presetId(patch.preset || patch.selected);
    if (next) { preset = next; target = values(WEATHER_PRESETS[next]); custom = false; }
    const changes = {...patch.target, ...patch};
    if (Number.isFinite(changes.daylight)) changes.altitude = changes.daylight;
    for (const [key, limits] of Object.entries(fields)) if (Number.isFinite(changes[key])) {
      const value = clamp(changes[key], ...limits);
      if (value !== target[key]) { target[key] = value; custom = true; }
    }
    if (typeof patch.enabled === 'boolean') enabled = patch.enabled;
    if (typeof patch.paused === 'boolean') paused = patch.paused;
    if (typeof patch.autoSun === 'boolean') autoSun = patch.autoSun;
    return before !== JSON.stringify({preset, target, enabled, paused, autoSun, custom});
  }
  function unsettled() { return Object.keys(fields).some(k => Math.abs(effective[k] - target[k]) > .0001); }
  function step(dt, {hidden = false, reduced = false, quiet = false} = {}) {
    if (disposed || hidden || !enabled) return getState();
    if (reduced || paused) { effective = {...target}; return getState(); }
    if (quiet) return getState();
    dt = Number.isFinite(dt) && dt >= 0 && dt <= .5 ? Math.min(dt, .1) : 0;
    const blend = 1 - Math.exp(-dt * 1.7);
    for (const key of Object.keys(fields)) {
      effective[key] = mix(effective[key], target[key], blend);
      if (Math.abs(effective[key] - target[key]) < .0001) effective[key] = target[key];
    }
    time += dt;
    if (autoSun && target.altitude < 75) target.altitude = Math.min(75, target.altitude + dt * .012);
    return getState();
  }
  function getState() {
    const s = effective, angle = s.direction * Math.PI / 180, altitude = s.altitude * Math.PI / 180, azimuth = s.azimuth * Math.PI / 180;
    return {simulated: true, preset, selected: preset, label: WEATHER_PRESETS[preset].label, custom, enabled, paused, autoSun,
      target: {...target}, effective: {...s, day: smooth(-8, 7, s.altitude), solarEnergy: smooth(-3, 15, s.altitude) * (1 - s.cloud * .67),
        sun: [Math.cos(altitude) * Math.sin(azimuth), Math.sin(altitude), -Math.cos(altitude) * Math.cos(azimuth)],
        windVector: [s.wind * Math.cos(angle), s.wind * Math.sin(angle)]}, time, transitioning: unsettled(), disposed};
  }
  setWeather(initial);
  // First presentation has no predecessor. Later selections always retarget current values.
  effective = {...target};
  if (initial.effective) for (const [key, limits] of Object.entries(fields)) if (Number.isFinite(initial.effective[key])) effective[key] = clamp(initial.effective[key], ...limits);
  if (Number.isFinite(initial.time)) time = Math.max(0, initial.time);
  return {setWeather, step, getState, dispose() { disposed = true; }};
}

function activityPolicy(state = {}) {
  const phase = state.story?.phase || state.phase || 'home';
  const chat = state.chat?.phase;
  const activity = state.activity?.state || 'idle';
  const placement = state.placement;
  return {hidden: !!state.hidden,
    reduced: !!(state.reduced || state.story?.reduced),
    quiet: !!(state.quiet || state.readingQuiet || (state.content?.phase && state.content.phase !== 'preview') || (chat && chat !== 'closed') ||
      !['idle', 'closed'].includes(activity) || phase !== 'home' ||
      (placement && (placement.quiet || placement.mode !== 'hero' || placement.progress > .02)))};
}

function makeEffect({THREE, scene, actor, requestFrame = () => {}, getState = () => ({})}, model, syncExternal, paintField = () => {}) {
  if (!THREE || !scene?.add || !actor?.position || !actor?.scale) throw new TypeError('Weather requires the existing THREE scene and actor');
  let disposed = false, wasHidden = false, lastExternal = '', phaseTime = 0, updates = 0;
  const root = new THREE.Group(); root.name = 'PersonalOS / bounded simulated weather';
  const ownedGeometry = [], ownedMaterial = [];
  const material = m => { ownedMaterial.push(m); return m; };
  const geometry = g => { ownedGeometry.push(g); return g; };
  const rainArray = new Float32Array(WEATHER_BUDGET.rainStrokes * 6);
  const rainGeometry = geometry(new THREE.BufferGeometry());
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainArray, 3));
  rainGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const rainMaterial = material(new THREE.LineBasicMaterial({color: '#7D90AC', transparent: true, opacity: .38, depthWrite: false, depthTest: true}));
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.name = 'weather / 32 rain strokes'; rain.frustumCulled = false;
  const windArray = new Float32Array(WEATHER_BUDGET.windStrokes * 6);
  const windGeometry = geometry(new THREE.BufferGeometry());
  windGeometry.setAttribute('position', new THREE.BufferAttribute(windArray, 3));
  windGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const windMaterial = material(new THREE.LineBasicMaterial({color: '#F5F1EA', transparent: true, opacity: .42, depthWrite: false, depthTest: true}));
  const wind = new THREE.LineSegments(windGeometry, windMaterial); wind.name = 'weather / 18 wind strokes'; wind.frustumCulled = false;
  // One fixed shader program. Selection only updates uniforms; no shader recompile.
  const poolMaterial = material(new THREE.ShaderMaterial({transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {uRain: {value: 0}, uCloud: {value: .5}, uDay: {value: 1}, uTime: {value: 0}, uMotion: {value: 0},
      uIvory: {value: new THREE.Color('#F5F1EA')}, uBlue: {value: new THREE.Color('#788BA8')}},
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float uRain,uCloud,uDay,uTime,uMotion; uniform vec3 uIvory,uBlue;
      void main(){float r=length((vUv-.5)*2.0); float edge=(1.0-smoothstep(.72,1.0,r))*smoothstep(.28,.64,r);
      float ripple=.5+.5*cos(r*24.0-uTime*2.4*uMotion); float a=edge*(.09+.09*uCloud+.09*uRain*ripple);
      vec3 color=mix(uBlue,uIvory,uDay*(1.0-uCloud*.68));gl_FragColor=vec4(color,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` }));
  const pool = new THREE.Mesh(geometry(new THREE.PlaneGeometry(3.15, 3.15)), poolMaterial);
  pool.name = 'weather / soft ground light'; pool.rotation.x = -Math.PI / 2; pool.position.y = -.872; // Just above the source actor's .88-radius contact plane.
  root.add(pool, rain, wind); root.visible = false; scene.add(root);
  // Existing light identity/intensity/color is restored exactly whenever weather is inactive.
  const lights = scene.children.filter(o => o.isHemisphereLight || o.isDirectionalLight).map(light => ({light, intensity: light.intensity, color: light.color.clone()}));
  const cool = new THREE.Color('#DDE6F7'); let lightApplied = false;
  function restoreLight() { if (!lightApplied) return; for (const entry of lights) { entry.light.intensity = entry.intensity; entry.light.color.copy(entry.color); } lightApplied = false; }
  function stateOf(override) {
    const state = {...getState(), ...override};
    if (syncExternal && state.weather) {
      const signature = JSON.stringify(state.weather.target ? {preset: state.weather.preset, target: state.weather.target, enabled: state.weather.enabled, paused: state.weather.paused, autoSun: state.weather.autoSun} : state.weather);
      if (signature !== lastExternal) { lastExternal = signature; model.setWeather(state.weather); }
    }
    return state;
  }
  function update(dt = 0, override) {
    if (disposed) return;
    const state = stateOf(override), policy = activityPolicy(state);
    if (policy.hidden) { wasHidden = true; root.visible = false; restoreLight(); return; }
    if (wasHidden || !Number.isFinite(dt) || dt < 0 || dt > .5) dt = 0;
    wasHidden = false;
    const weather = model.step(dt, policy), s = weather.effective;
    paintField(weather, policy, dt);
    const active = weather.enabled && !policy.quiet;
    root.visible = active;
    if (!active) { restoreLight(); return; }
    const moving = !policy.reduced && !weather.paused;
    if (moving) phaseTime += Math.min(dt, .1);
    root.position.copy(actor.position); root.scale.copy(actor.scale);
    for (const entry of lights) {
      const dim = entry.light.isHemisphereLight ? mix(.86, 1.03, s.day) : mix(.77, 1.02, s.day);
      entry.light.intensity = entry.intensity * dim * (1 - s.cloud * .075);
      entry.light.color.copy(entry.color).lerp(cool, (1 - s.day) * .14 + s.cloud * .035);
    }
    lightApplied = true;
    rain.visible = s.rain > .005;
    rainMaterial.opacity = .14 + s.rain * .44;
    const angle = s.direction * Math.PI / 180;
    const leanX = Math.cos(angle) * s.wind * .005, leanZ = Math.sin(angle) * s.wind * .005;
    for (let i = 0; i < WEATHER_BUDGET.rainStrokes; i++) {
      const a = i * 2.399963229728653, r = 1.04 + (i % 7) / 7 * .38;
      const fall = ((i * .61803398875 + phaseTime * (.75 + s.rain * .7)) % 1);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = -.13 - fall * .72;
      rainArray.set([x, y, z, x + leanX, y - .11, z + leanZ], i * 6);
    }
    rainGeometry.attributes.position.needsUpdate = true;
    wind.visible = s.wind > 3.1 && s.rain < .1;
    windMaterial.opacity = smooth(3.1, 7, s.wind) * .52;
    for (let i = 0; i < WEATHER_BUDGET.windStrokes; i++) {
      const a = (i / WEATHER_BUDGET.windStrokes) * Math.PI * 2 + phaseTime * s.wind * .08;
      const r = 1.23 + (i % 3) * .065, y = -.63 + Math.sin(a * 2) * .07;
      windArray.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a + .1) * r, y + .012, Math.sin(a + .1) * r], i * 6);
    }
    windGeometry.attributes.position.needsUpdate = true;
    Object.assign(poolMaterial.uniforms.uRain, {value: s.rain});
    poolMaterial.uniforms.uCloud.value = s.cloud; poolMaterial.uniforms.uDay.value = s.day;
    poolMaterial.uniforms.uTime.value = phaseTime; poolMaterial.uniforms.uMotion.value = moving ? 1 : 0;
    updates++;
  }
  function needsFrame() {
    if (disposed) return false;
    const policy = activityPolicy(stateOf()), s = model.getState();
    return !policy.hidden && !policy.quiet && !policy.reduced && s.enabled && !s.paused &&
      (s.transitioning || s.effective.rain > .005 || (s.effective.wind > 3.1 && s.effective.rain < .1) || (s.autoSun && s.target.altitude < 75));
  }
  update(0); requestFrame();
  return {update, needsFrame, getState: () => ({...model.getState(), effect: {attached: !disposed, visible: root.visible, updates, phaseTime, budget: {...WEATHER_BUDGET}}}),
    dispose() { if (disposed) return; disposed = true; root.visible = false; restoreLight(); root.removeFromParent(); for (const g of ownedGeometry) g.dispose(); for (const m of ownedMaterial) m.dispose(); if (syncExternal) model.dispose(); }};
}

/** Public effect factory for the existing world. No renderer or clock is created. */
export function createWeatherEffect(context) {
  return makeEffect(context, createWeatherModel(context.getState?.().weather || {}), true);
}

/** Paint-only viewport field. No CSS animation or independent time owner. */
function createAmbientField(container) {
  if (!container?.ownerDocument) return {paint() {}, getState: () => ({available: false, mode: 'unavailable', writes: 0}), dispose() {}};
  const element = container.ownerDocument.createElement('div');
  element.className = 'weather-atmosphere'; element.setAttribute('aria-hidden', 'true'); container.append(element);
  let disposed = false, signature = '', elapsed = .1, writes = 0, mode = 'static', lastFlags = '';
  function paint(weather, policy = {}, dt = 0, fallback = false) {
    if (disposed || policy.hidden) return;
    const flags = [weather.enabled, policy.quiet, policy.reduced, weather.paused, fallback].join(':');
    elapsed += Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    if (signature && flags === lastFlags && elapsed < .1 && weather.transitioning) return;
    lastFlags = flags; elapsed = 0;
    mode = !weather.enabled ? 'disabled' : fallback ? 'static-fallback' : policy.quiet ? 'quiet-static' : policy.reduced || weather.paused ? 'static' : 'shared-climate';
    element.hidden = !weather.enabled;
    if (!weather.enabled) return;
    const s = weather.effective, calm = policy.quiet ? .24 : 1;
    const daylight = s.day, cloud = s.cloud, rain = s.rain;
    // All stops stay within cool gray-blue/ivory. Quiet retains atmosphere while
    // reducing contrast and removing decorative rain grain behind reading text.
    const night = [191, 206, 225], day = [239, 240, 234], baseline = [217, 222, 231];
    const shade = [10, 7, 2];
    const rgb = day.map((v, i) => Math.round(mix(baseline[i], mix(night[i], v, daylight) - shade[i] * cloud - rain * 2, calm)));
    const base = `rgb(${rgb.join(',')})`;
    const alpha = n => (Math.round(clamp(n) * 100) / 100).toFixed(2);
    const cloudAlpha = alpha((.12 + cloud * .35) * calm), sunAlpha = alpha((.14 + s.solarEnergy * .54) * calm);
    const rainAlpha = alpha(rain * .055 * (policy.quiet ? 0 : 1));
    const windAlpha = alpha(smooth(3.1, 7, s.wind) * .16 * calm);
    const sunX = Math.round(32 + s.azimuth * .35), rainAngle = Math.round(108 + s.direction * .12);
    const wash = [
      'linear-gradient(to bottom, #D9DEE7 0px, transparent 150px)',
      `radial-gradient(ellipse at ${sunX}% 5%, rgba(255,249,237,${sunAlpha}) 0%, transparent 65%)`,
      `radial-gradient(ellipse at 86% 32%, rgba(127,151,185,${cloudAlpha}) 0%, transparent 67%)`,
      `radial-gradient(ellipse at 8% 68%, rgba(241,244,247,${cloudAlpha}) 0%, transparent 64%)`,
      `linear-gradient(${rainAngle + 14}deg, transparent 23%, rgba(236,242,250,${windAlpha}) 48%, transparent 76%)`,
      `repeating-linear-gradient(${rainAngle}deg, transparent 0px, transparent 34px, rgba(98,123,159,${rainAlpha}) 35px, transparent 36px)`
    ].join(',');
    const next = `${base}|${wash}`;
    if (next !== signature) { signature = next; element.style.backgroundColor = base; element.style.backgroundImage = wash; writes++; }
    element.dataset.mode = mode;
  }
  return {paint, getState: () => ({available: !disposed, mode, writes, owner: 'shared-weather-model', maxPaintHz: 10, layers: 6}),
    dispose() { if (disposed) return; disposed = true; element.remove(); }};
}

const mounted = new WeakMap();
export function mountWeather({host, container, fieldContainer = null}) {
  if (!host?.getState || !host?.subscribe || !container?.ownerDocument) throw new TypeError('Weather requires a host and supplied container');
  if (mounted.has(container)) return mounted.get(container);
  const document = container.ownerDocument;
  const model = createWeatherModel();
  const ambient = createAmbientField(fieldContainer);
  const root = document.createElement('details'); root.className = 'weather-module';
  root.innerHTML = `<summary class="weather-summary"><span class="weather-mark" aria-hidden="true">◌</span><span data-weather-label>云隙天光</span><small>模拟</small></summary>
    <section class="weather-panel" aria-label="模拟天气设置">
      <div class="weather-heading"><span>WEATHER / SIMULATED</span><button type="button" data-weather-close aria-label="关闭天气设置">×</button></div>
      <h2>让天光，慢慢变化。</h2><p class="weather-note">本地模拟，不读取位置或实时天气</p>
      <div class="weather-presets" role="group" aria-label="模拟天气场景">${Object.entries(WEATHER_PRESETS).map(([id,p])=>`<button type="button" data-weather-preset="${id}" aria-pressed="false">${p.label}</button>`).join('')}</div>
      <div class="weather-fields"><label><span>天光高度 <output data-weather-output="altitude"></output></span><input type="range" min="-20" max="75" step="1" data-weather-field="altitude" aria-label="模拟太阳高度"></label>
      <label><span>风速 <output data-weather-output="wind"></output></span><input type="range" min="0" max="9" step=".1" data-weather-field="wind" aria-label="模拟风速"></label></div>
      <div class="weather-switches"><label><input type="checkbox" data-weather-flag="enabled">环境开启</label><label><input type="checkbox" data-weather-flag="paused">暂停流动</label><label><input type="checkbox" data-weather-flag="autoSun">天光缓慢移动</label></div>
      <p class="weather-status" role="status"></p><p class="weather-note">阅读、对话和开场时，天气会安静下来</p>
    </section>`;
  container.append(root);
  let disposed = false, world = null, effect = null, unregister = null, attached = false;
  const summary = root.querySelector('summary'), panel = root.querySelector('.weather-panel');
  const motionQuery = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disclosureOpen = false, disclosureAnimation = null;
  root.dataset.disclosure = 'closed'; summary.setAttribute('aria-expanded', 'false');
  panel.inert = true; panel.setAttribute('aria-hidden', 'true');
  const disclosureReduced = (state = host.getState()) => !!(motionQuery?.matches || state.reduced || state.story?.reduced);
  function settleDisclosure(open) {
    const animation = disclosureAnimation; disclosureAnimation = null;
    if (animation) { animation.onfinish = null; animation.cancel(); }
    disclosureOpen = open; root.open = open; root.dataset.disclosure = open ? 'open' : 'closed';
    summary.setAttribute('aria-expanded', String(open)); panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
  }
  function syncDisclosurePreference(state) {
    if (!disposed && disclosureAnimation && disclosureReduced(state)) settleDisclosure(disclosureOpen);
  }
  const preferenceChanged = () => syncDisclosurePreference(host.getState());
  motionQuery?.addEventListener?.('change', preferenceChanged);
  function setDisclosure(open) {
    if (disposed) return;
    if (disclosureOpen === open && (disclosureAnimation || root.open === open)) return;
    const previous = disclosureOpen; disclosureOpen = open;
    summary.setAttribute('aria-expanded', String(open)); panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    if (!open) summary.focus({preventScroll: true});
    if (disclosureReduced() || typeof panel.animate !== 'function') { settleDisclosure(open); return; }
    // Keep native details mounted until the exit completes. Only this fixed-layout
    // panel animates; reversing reuses its current presentation and timeline.
    root.open = true; root.dataset.disclosure = open ? 'opening' : 'closing';
    if (disclosureAnimation) { if (previous !== open) disclosureAnimation.reverse(); return; }
    const animation = panel.animate([
      {opacity: 0, transform: 'translateY(-6px) scale(.985)'},
      {opacity: 1, transform: 'translateY(0px) scale(1)'}
    ], {duration: 200, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both'});
    disclosureAnimation = animation;
    animation.onfinish = () => { if (!disposed && disclosureAnimation === animation) settleDisclosure(disclosureOpen); };
    if (!open) { animation.currentTime = 200; animation.reverse(); }
  }
  function getState() { return {...model.getState(), renderer: attached ? 'attached' : 'unavailable', atmosphere: ambient.getState(), disclosure: {open: disclosureOpen, phase: root.dataset.disclosure, animating: !!disclosureAnimation}, ...(effect ? {effect: effect.getState().effect} : {})}; }
  function renderUI(state = host.getState()) {
    if (disposed) return;
    syncDisclosurePreference(state);
    const s = model.getState();
    root.dataset.preset = s.preset; root.dataset.enabled = String(s.enabled);
    root.querySelector('[data-weather-label]').textContent = s.custom ? '自定义天光' : s.label;
    for (const button of root.querySelectorAll('[data-weather-preset]')) button.setAttribute('aria-pressed', String(!s.custom && button.dataset.weatherPreset === s.preset));
    for (const input of root.querySelectorAll('[data-weather-field]')) {
      const key = input.dataset.weatherField; input.value = s.target[key];
      root.querySelector(`[data-weather-output="${key}"]`).textContent = key === 'wind' ? s.target[key].toFixed(1) + ' m/s' : Math.round(s.target[key]) + '°';
    }
    for (const input of root.querySelectorAll('[data-weather-flag]')) input.checked = s[input.dataset.weatherFlag];
    const policy = activityPolicy(state);
    root.querySelector('.weather-status').textContent = !attached ? (ambient.getState().available ? '静态模拟天光 · 动态角色天气暂不可用' : '动态画面暂不可用，模拟参数仍可调整') : !ambient.getState().available ? '角色天气已就绪，背景天光暂不可用' : !s.enabled ? '环境已关闭' : policy.reduced ? '减少动态：保留静态天光' : s.paused ? '流动已暂停' : policy.quiet ? '正在安静陪伴' : '模拟天光 · 与角色共享同一个空间';
  }
  function setWeather(patch) {
    if (disposed || !model.setWeather(patch)) return false;
    if (!attached) { model.step(0, {reduced: true}); ambient.paint(model.getState(), activityPolicy(host.getState()), 0, true); }
    renderUI(); world?.requestFrame?.(); host.moduleChanged?.('weather'); return true;
  }
  function detach() { unregister?.(); unregister = null; effect?.dispose(); effect = null; world = null; attached = false; }
  function reconcile(state) {
    if (disposed) return;
    const next = host.world?.() || null;
    if (next !== world) {
      detach();
      if (next?.registerEffect) {
        world = next;
        try {
          unregister = next.registerEffect('weather', context => {
            effect = makeEffect({...context, getState: () => ({...context.getState(), weather: model.getState()})}, model, false, (weather, policy, dt) => ambient.paint(weather, policy, dt));
            return effect;
          });
          attached = !!effect;
        } catch { detach(); }
      }
    }
    if (!attached) { model.step(0, {reduced: true}); ambient.paint(model.getState(), activityPolicy(state), 0, true); }
    renderUI(state); world?.requestFrame?.();
  }
  function click(event) {
    if (event.target.closest('summary') === summary) { event.preventDefault(); setDisclosure(!(disclosureAnimation ? disclosureOpen : root.open)); return; }
    const button = event.target.closest('button'); if (!button || !root.contains(button)) return;
    if (button.hasAttribute('data-weather-close')) setDisclosure(false);
    else if (button.dataset.weatherPreset) setWeather({preset: button.dataset.weatherPreset});
  }
  function input(event) {
    const element = event.target;
    if (element.dataset.weatherField) setWeather({[element.dataset.weatherField]: Number(element.value)});
    else if (element.dataset.weatherFlag) setWeather({[element.dataset.weatherFlag]: element.checked});
  }
  function keydown(event) { if (event.key === 'Escape' && root.open) { event.preventDefault(); event.stopPropagation(); setDisclosure(false); } }
  root.addEventListener('click', click); root.addEventListener('input', input); root.addEventListener('keydown', keydown);
  const unsubscribe = host.subscribe(reconcile);
  const api = {getState, setWeather, dispose() { if (disposed) return; disposed = true; settleDisclosure(false); motionQuery?.removeEventListener?.('change', preferenceChanged); unsubscribe?.(); detach(); ambient.dispose(); model.dispose(); root.removeEventListener('click', click); root.removeEventListener('input', input); root.removeEventListener('keydown', keydown); root.remove(); mounted.delete(container); }};
  mounted.set(container, api); reconcile(host.getState()); return api;
}
