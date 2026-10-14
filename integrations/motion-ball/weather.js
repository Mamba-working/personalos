const names = { sunny: '晴', cloudy: '多云', windy: '大风', rain: '雨', snow: '雪', fog: '雾' };
export function mountWeather({ host, container }) {
  let selected = 'sunny', time = 'auto', disposed = false;
  const abort = new AbortController();
  container.innerHTML = `<button class="weather-toggle" type="button" aria-expanded="false" aria-controls="motion-weather-panel">天气 · <span data-weather-label>晴</span> ↗</button><div id="motion-weather-panel" class="weather-panel" hidden><p>模拟天气 · 无定位或天气 API</p><div class="weather-presets">${Object.entries(names).map(([key, text]) => `<button type="button" data-weather="${key}" aria-pressed="${key === selected}">${text}</button>`).join('')}</div><div class="weather-presets" aria-label="场景时间"><button type="button" data-time="auto" aria-pressed="true">随时间</button><button type="button" data-time="day" aria-pressed="false">白天</button><button type="button" data-time="night" aria-pressed="false">夜晚</button></div></div>`;
  const toggle = container.querySelector('.weather-toggle'), panel = container.querySelector('.weather-panel');
  function paint() { container.querySelector('[data-weather-label]').textContent = names[selected]; for (const b of panel.querySelectorAll('[data-weather]')) b.setAttribute('aria-pressed', String(b.dataset.weather === selected)); for (const b of panel.querySelectorAll('[data-time]')) b.setAttribute('aria-pressed', String(b.dataset.time === time)); }
  function close() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  function setWeather(patch = {}) { const next = patch.preset || patch.selected || patch.weather; if (disposed || !Object.hasOwn(names, next)) return false; selected = next; host.scene()?.setWeather(selected); paint(); host.moduleChanged('weather'); return true; }
  function sync(snapshot) {
    if (disposed || !snapshot?.scene) return;
    const scene = snapshot.scene;
    const nextWeather = Object.hasOwn(names, scene.weather) ? scene.weather : selected;
    const nextTime = ['auto', 'day', 'night'].includes(scene.time) ? scene.time : time;
    if (selected === nextWeather && time === nextTime) return;
    selected = nextWeather; time = nextTime; paint();
  }
  const unsubscribe = host.subscribe(sync);
  sync(host.getState());
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); }, { signal: abort.signal });
  panel.addEventListener('click', e => { const b = e.target.closest('button'); if (b?.dataset.weather) setWeather({ weather: b.dataset.weather }); if (b?.dataset.time) { time = b.dataset.time; host.scene()?.setTime(time); paint(); host.moduleChanged('weather'); } }, { signal: abort.signal });
  document.addEventListener('pointerdown', e => { if (!container.contains(e.target)) close(); }, { signal: abort.signal });
  container.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); toggle.focus(); } }, { signal: abort.signal });
  return { setWeather, getState: () => ({ simulated: true, preset: selected, selected, time, disposed }), dispose() { if (disposed) return; disposed = true; unsubscribe(); abort.abort(); container.replaceChildren(); } };
}
