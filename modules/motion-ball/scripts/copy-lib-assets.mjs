// Copy the runtime assets (textures, skies, terrain, moon, models) next to the library build, so a
// host can serve `dist-lib/assets/` and pass its URL as `assetBase`.
import { cpSync, existsSync, readdirSync } from 'node:fs';
const src = new URL('../public/', import.meta.url), dst = new URL('../dist-lib/assets/', import.meta.url);
for (const name of readdirSync(src)) {
  if (name.startsWith('.')) continue;
  cpSync(new URL(name, src), new URL(name, dst), { recursive: true, filter: (p) => !p.includes('/.') });
}
console.log('assets →', dst.pathname, existsSync(dst) ? 'ok' : 'missing');
