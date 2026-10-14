import '../host.js';
import { mountMenu } from './menu.js';
import { mountWeather } from './weather.js';
import { mountMotionScene } from './motion-scene.js';
const host = window.personalOSHost;
const menu = mountMenu({ host, container: document.querySelector('#host-menu') });
const scene = mountMotionScene({ host, container: document.querySelector('#motion-scene'), speech: document.querySelector('#motion-speech'), status: document.querySelector('#motion-status') });
host.registerModule('scene', scene);
const weather = mountWeather({ host, container: document.querySelector('#host-weather') });
host.registerModule('menu', menu); host.registerModule('weather', weather);
// Keep the retained native menu byte-unchanged. Its modal/phase attributes are
// the host notification boundary; canvas input pauses before the next frame.
const menuObserver = new MutationObserver(() => host.moduleChanged('menu'));
menuObserver.observe(document.querySelector('#host-menu'), { subtree: true, attributes: true, attributeFilter: ['open', 'data-state'] });
fetch(new URL('../release-meta.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('Release metadata unavailable'); return r.json(); }).then(metadata => {
  const label = document.querySelector('#product-version'); label.textContent = metadata.productVersion; label.title = metadata.reviewLabel + '\n' + metadata.limitations.join('\n'); label.setAttribute('aria-label', metadata.product + ' ' + metadata.productVersion + '，Alpha 待验收'); document.documentElement.dataset.productVersion = metadata.productVersion;
}).catch(error => console.warn(error.message));
window.addEventListener('pagehide', event => { if (!event.persisted) { menuObserver.disconnect(); menu.dispose(); weather.dispose(); scene.dispose(); } });
