import { mountChat } from './chat-host.js';

// Native UI owns its DOM, history and clocks. The 3D module is optional.
const root = document.querySelector('#content-root'), app = document.querySelector('.app');
const chatButton = document.querySelector('#host-open-chat'), motionButton = document.querySelector('#host-motion');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const modules = new Map(), listeners = new Set();
let chat = null, userReduced = false, navigationIntent = 0, disposed = false;
const reduced = () => userReduced || motionQuery.matches;
const bounds = () => { const r = chatButton.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
const getState = () => ({ version: 5, ready: !!(chat && window.personalOSContent), entry: 'home', reduced: reduced(),
  story: { phase: 'home', reduced: reduced(), enabled: false },
  content: window.personalOSContent?.getState() || null, chat: chat?.getState() || null,
  menu: modules.get('menu')?.getState() || null, weather: modules.get('weather')?.getState() || null,
  scene: modules.get('scene')?.getState() || null });
function notify(action) { if (disposed) return; const state = { ...getState(), action }; for (const fn of listeners) fn(state); window.dispatchEvent(new CustomEvent('personalos:host-state', { detail: state })); }
function syncMotion() { motionButton.setAttribute('aria-pressed', String(reduced())); motionButton.setAttribute('aria-label', reduced() ? '恢复背景动态' : '暂停背景动态'); motionButton.disabled = motionQuery.matches; motionButton.title = motionQuery.matches ? '系统已启用减少动态' : ''; notify('motion'); }
function awaitState(api, predicate, action) {
  if (predicate()) return Promise.resolve(true);
  return new Promise(resolve => { let timer; const off = api.subscribe(() => { if (predicate()) { off(); clearTimeout(timer); resolve(true); } }); timer = setTimeout(() => { off(); resolve(false); }, 4000); action(); });
}
async function navigate(category) {
  if (!['all', 'work', 'thoughts', 'labs'].includes(category)) return false;
  const intent = ++navigationIntent;
  if (chat && chat.getState().phase !== 'closed' && !await awaitState(chat, () => chat.getState().phase === 'closed', () => chat.close())) return false;
  if (intent !== navigationIntent) return false;
  const content = window.personalOSContent;
  if (!content) return false;
  if (content.getState().phase !== 'preview' && !await awaitState(content, () => content.getState().phase === 'preview', () => content.cancel())) return false;
  if (intent !== navigationIntent) return false;
  content.setCategory(category); notify('navigate'); return true;
}
const host = window.personalOSHost = { version: 5, navigate, getState, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  registerModule(name, api) { if (modules.has(name)) return false; modules.set(name, api); notify('module-' + name); return true; },
  moduleChanged: name => notify('module-' + name),
  setWeather: patch => modules.get('weather')?.setWeather?.(patch) || false,
  setReduced(value) { userReduced = !!value; chat?.preferencesChanged(); syncMotion(); return reduced(); },
  select: id => window.personalOSContent?.select(id) || false, cancel: () => window.personalOSContent?.cancel(),
  setCategory: category => window.personalOSContent?.setCategory(category), chat: () => chat, scene: () => modules.get('scene'),
  chatBoundary: Object.freeze({ owner: 'native-chat-thread', presentation: 'control', simulation: true }) };
root.inert = false; app.dataset.entry = 'home'; document.body.dataset.entry = 'home'; document.documentElement.dataset.entry = 'home';
document.querySelector('.skip').onclick = e => { e.preventDefault(); document.querySelector('#feed').focus(); };
motionButton.onclick = () => host.setReduced(!reduced()); motionQuery.addEventListener('change', syncMotion); syncMotion();
chatButton.disabled = true; chatButton.onclick = () => chat?.show();
mountChat({ getPresentation: () => 'control', getSourceBounds: bounds, getReturnBounds: bounds, getRestoreFocus: () => chatButton,
  getClock: () => null, getBall: () => { const b = bounds(); return { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.min(b.w, b.h) / 2 }; },
  reduced, onActivity: () => notify('chat-activity') }).then(api => {
  if (disposed) return;
  chat = api; chatButton.disabled = false; api.subscribe(state => notify('chat-' + state.action)); notify('chat-ready');
  if (new URL(location.href).searchParams.get('chat') === 'open') api.show({ history: false });
}).catch(error => { chatButton.title = '聊天暂时不可用，请刷新重试'; document.querySelector('#announcer').textContent = chatButton.title; console.error(error); });
const contentChanged = () => notify('content'); window.addEventListener('personalos:content-transition', contentChanged);
window.addEventListener('pagehide', event => { if (event.persisted) return; disposed = true; motionQuery.removeEventListener('change', syncMotion); window.removeEventListener('personalos:content-transition', contentChanged); listeners.clear(); });
