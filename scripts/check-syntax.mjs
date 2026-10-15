import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const ignored = new Set(['.git', '.build', '.next', 'node_modules']);
let checked = 0;
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(?:js|mjs|cjs)$/.test(f.name)) {
      const result = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || p);
      checked++;
    }
  }
}
walk('.');
console.log(`${checked} JavaScript files parse; backend TypeScript is checked during check:api; upstream TypeScript during build:web`);
