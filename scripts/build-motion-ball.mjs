import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, '.build/motion-ball');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ['scripts/prepare-motion-ball.mjs']);
if (!existsSync(path.join(stage, 'node_modules/three/package.json'))) throw new Error('Install pinned dependencies from official npm in .build/motion-ball first; see docs/MOTION_BALL_INTEGRATION.md.');
run('npm', ['run', 'typecheck'], stage);
run('npm', ['run', 'build:lib'], stage);
run(process.execPath, ['scripts/assemble-motion-ball.mjs']);
run(process.execPath, ['scripts/check-motion-ball-source.mjs']);
