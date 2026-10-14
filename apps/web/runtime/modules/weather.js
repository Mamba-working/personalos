/**
 * Host-only weather input. WeatherProvider is { kind: 'mock' | 'live',
 * load({ signal }): Promise<{ weather, time }> }. It does not own scene rendering.
 * The default provider is deterministic mock data: no network or location access.
 */
const weathers = new Set(['sunny', 'cloudy', 'windy', 'rain', 'snow', 'fog']);
const times = new Set(['auto', 'day', 'night']);
export const mockWeatherProvider = Object.freeze({
  kind: 'mock',
  async load({ signal }) {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();
    return { weather: 'sunny', time: 'auto' };
  },
});

export function mountWeather({ host, provider = mockWeatherProvider }) {
  let selected = 'sunny', time = 'auto', phase = 'loading', source = 'fallback', error = null, disposed = false, intent = 0;
  const abort = new AbortController();
  function sync(snapshot) {
    if (disposed || !snapshot?.scene) return;
    if (weathers.has(snapshot.scene.weather)) selected = snapshot.scene.weather;
    if (times.has(snapshot.scene.time)) time = snapshot.scene.time;
  }
  sync(host.getState());
  const unsubscribe = host.subscribe(sync);
  function apply(weather, mode) {
    // The adapter queues desired public values even when WeatherScene is not ready.
    const scene = host.scene();
    selected = weather; time = mode;
    scene?.setWeather(weather); scene?.setTime(mode);
    host.moduleChanged('weather');
  }
  const request = intent;
  const ready = Promise.resolve().then(() => {
    if (disposed || request !== intent) return;
    return provider.load({ signal: abort.signal });
  }).then(result => {
    if (disposed || request !== intent) return false;
    if (!weathers.has(result?.weather) || !times.has(result?.time)) throw new TypeError('Unsupported weather provider result');
    phase = 'ready'; source = provider.kind === 'live' ? 'live' : 'mock';
    apply(result.weather, result.time);
    return true;
  }).catch(() => {
    if (disposed || request !== intent) return false;
    // Retain the scene's current valid/default selection; content never waits on weather.
    phase = 'fallback'; source = 'fallback'; error = 'weather-unavailable';
    host.moduleChanged('weather');
    return false;
  });
  return {
    ready,
    setWeather(patch = {}) {
      const next = patch.preset || patch.selected || patch.weather;
      const mode = patch.time ?? time;
      if (disposed || !weathers.has(next) || !times.has(mode)) return false;
      // A newer explicit host choice takes ownership over a pending provider result.
      intent++; abort.abort(); phase = 'overridden'; source = 'manual'; error = null;
      apply(next, mode); return true;
    },
    getState: () => ({ phase, source, simulated: source !== 'live', preset: selected, selected, time, error, disposed }),
    dispose() { if (disposed) return; disposed = true; intent++; abort.abort(); unsubscribe(); },
  };
}
