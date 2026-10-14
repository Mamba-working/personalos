// The PersonalOS landing page: a host of the weather-scene library (src/lib). Everything here is
// page UI — the 3D scene is configured and driven only through the public API.
import './styles.css';
import { createWeatherScene, WEATHERS, WeatherSceneError, type TimeMode, type WeatherName } from './lib';
import { UI } from './ui/UI';

const CARD_LINES: Record<string, string> = { work: '工作相关 · 建设中', thoughts: '一些想法 · 整理中', labs: '实验与探索 · 敬请期待' };

async function main() {
  const container = document.getElementById('scene') as HTMLElement;
  // deep links: ?w=rain, ?time=night, ?quality=low|medium|high, ?tex=0 (procedural only), ?debug
  const params = new URLSearchParams(location.search);
  const w = params.get('w') as WeatherName | null;
  const time = params.get('time') as TimeMode | null;
  const quality = params.get('quality') as 'low' | 'medium' | 'high' | null;

  const scene = await createWeatherScene(container, {
    weather: w && WEATHERS.includes(w) ? w : 'sunny',
    time: time === 'day' || time === 'night' ? time : 'auto',
    quality: quality ?? 'auto',
    environmentAssets: params.get('tex') !== '0',
    input: { pointer: true, keyboard: true },
    autoPause: !params.has('debug'),   // the tuning tools step frames themselves
    debug: import.meta.env.DEV || params.has('debug'),
  });

  const ui = new UI({
    onWeather: (n) => scene.setWeather(n),
    onCycle: () => scene.nextWeather(),
    onAuto: (on) => scene.setAutoCycle(on),
    onSound: (on) => scene.setSound(on),
    onCard: (id) => scene.ball.cheer(CARD_LINES[id] ?? '…'),
    onTime: (m) => scene.setTime(m),
  });

  const sync = () => {
    ui.setWeather(scene.weather);
    ui.setTimeMode(scene.timeMode);
    document.body.dataset.weather = scene.weather;
    document.body.dataset.time = scene.isNight ? 'night' : 'day';
  };
  sync();
  scene.on('weatherchange', ({ weather }) => { ui.setWeather(weather); document.body.dataset.weather = weather; });
  scene.on('timechange', ({ mode }) => ui.setTimeMode(mode));
  scene.on('daynight', ({ night }) => { document.body.dataset.time = night ? 'night' : 'day'; });
  scene.on('say', ({ text, duration }) => ui.say(text, duration));
  scene.on('interact', () => ui.dismissHint());

  // overlay positions follow the ball every frame (transforms only); the hint stays above the cards
  let cardsTop = innerHeight;
  const measure = () => { const c = document.querySelector('.cards .card'); cardsTop = c ? c.getBoundingClientRect().top : innerHeight; };
  measure();
  addEventListener('resize', measure);
  let t = 0;
  scene.on('frame', ({ dt, anchors }) => {
    if ((t += dt) > 16) ui.dismissHint();
    ui.update(dt, [anchors.bubble.x, anchors.bubble.y], [anchors.ground.x, Math.min(anchors.ground.y, cardsTop - 20)]);
  });
}

main().catch((err) => {
  console.error(err);
  if (err instanceof WeatherSceneError) console.warn(`[weather-scene] ${err.code}`);
  (document.getElementById('fallback') as HTMLElement).hidden = false;
});
