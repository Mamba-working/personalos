import '../host.js';
import {mountMenu} from './menu.js';
import {mountWeather} from './weather.js';
const host=window.personalOSHost;
// Each optional module receives one bounded mount point, not a page lifecycle.
const menu=mountMenu({host,container:document.querySelector('#host-menu')});
const weather=mountWeather({host,container:document.querySelector('#host-weather'),fieldContainer:document.querySelector('#weather-field'),overlayContainer:document.querySelector('#host-overlays')});
host.registerModule('menu',menu);host.registerModule('weather',weather);
fetch(new URL('../release-meta.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('Release metadata unavailable');return response.json();}).then(metadata=>{
 const label=document.querySelector('#product-version');label.textContent=metadata.productVersion;label.title=metadata.reviewLabel+'\n'+metadata.limitations.join('\n');label.setAttribute('aria-label',metadata.product+' '+metadata.productVersion+'，Alpha 待验收');
 document.documentElement.dataset.productVersion=metadata.productVersion;
}).catch(error=>console.warn(error.message));
window.addEventListener('pagehide',event=>{if(!event.persisted){menu.dispose();weather.dispose();}},{once:false});
