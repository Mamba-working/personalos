import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(root, p));
const hash = b => createHash('sha256').update(b).digest('hex');
const source = JSON.parse(read('modules/motion-ball/SOURCE-PROVENANCE.json'));
const runtime = 'apps/web/runtime/';
const walk = dir => readdirSync(path.join(root, dir)).flatMap(name => {
  const p = path.posix.join(dir, name);
  return statSync(path.join(root, p)).isDirectory() ? walk(p) : [p];
});
assert.equal(source.files.length, 84);
for (const f of source.files) {
  const b = read('modules/motion-ball/' + f.path);
  assert.equal(b.length, f.size); assert.equal(hash(b), f.sha256, f.path);
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex'), f.sha, f.path);
  if (f.path !== 'package-lock.json') assert.deepEqual(read('.build/motion-ball/' + f.path), b, `effective ${f.path}`);
  if (f.path.startsWith('public/') && !path.basename(f.path).startsWith('.')) assert.equal(hash(read(runtime + 'motion/assets/' + f.path.slice(7))), f.sha256, `asset ${f.path}`);
}
const upstreamLock = JSON.parse(read('modules/motion-ball/package-lock.json'));
const effectiveLock = JSON.parse(read('.build/motion-ball/package-lock.json'));
for (const [name, pkg] of Object.entries(upstreamLock.packages)) {
  const copy = structuredClone(effectiveLock.packages[name]);
  if (pkg.resolved) copy.resolved = pkg.resolved;
  assert.deepEqual(copy, pkg, name);
}
for (const p of walk('integrations/native-shell')) assert.deepEqual(read(p), read(runtime + p.slice('integrations/native-shell/'.length)), p);
assert.deepEqual(read('integrations/native-card/app.js'), read(runtime + 'app.js'));
for (const name of ['layout.js', 'reader.css']) assert.deepEqual(read('integrations/native-card/' + name), read(runtime + 'native-card/' + name));
for (const [sourceFile, runtimeFile] of [['host.css','host.css'],['host.js','host.js'],['motion-scene.js','modules/motion-scene.js'],['weather.js','modules/weather.js'],['mount.js','modules/mount.js']]) {
  assert.deepEqual(read('integrations/motion-ball/' + sourceFile), read(runtime + runtimeFile), sourceFile);
}
const html = read(runtime + 'index.html').toString(), hostCSS = read(runtime + 'host.css').toString();
assert(!/intro-note|host-weather|weather-panel|weather-toggle/.test(html));
assert(/\.intro h1,\.intro \.eyebrow\{pointer-events:none;user-select:none;-webkit-user-select:none\}/.test(hostCSS));
assert(!/\.intro h1[^{}]*\{[^{}]*pointer-events:auto/.test(hostCSS));
const header = html.match(/<header class="topbar">[\s\S]*?<\/header>/)[0]
  .replace(/<button id="host-explore"[^>]*>探索场景<\/button>/, '')
  .replace(' aria-label="Ball 聊天"', '')
  .replace('<span class="chat-label">Ball 聊天</span><span class="chat-label-compact" aria-hidden="true">Ball</span>', 'Ball 聊天');
assert.equal(hash(header), '55eadf6498b4d2d3b90921e99a6c669e35098d8be2b41e48dcdf4147d9334fe3', 'Retain original native header actions');
for (const p of walk('.build/motion-ball/dist-lib').filter(p => p.endsWith('.js'))) assert.deepEqual(read(p), read(runtime + 'motion/' + path.basename(p)), p);
assert.equal(JSON.parse(read('.build/motion-ball/node_modules/three/package.json')).version, '0.186.1');
assert(!existsSync(path.join(root, 'integrations/motion-ball/overrides')));
assert(!existsSync(path.join(root, runtime, 'world')));
const ts = createRequire(path.join(root, '.build/motion-ball/package.json'))('typescript');
let importEdges = 0;
for (const p of walk('apps/web/runtime').filter(p => p.endsWith('.js'))) {
  const code = read(p).toString();
  assert(!/world-ball-hit|ball-world-root|personalOSWorld|worldAvailability|window\.ballStudy/.test(code), p);
  const tree = ts.createSourceFile(p, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  function visit(node) {
    const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
    if (literal && ts.isStringLiteral(literal)) {
      const ref = literal.text;
      const target = ref.startsWith('.') ? path.resolve(root, path.dirname(p), ref)
        : ref === 'three' ? path.join(root, runtime, 'motion/vendor/three/three.module.js')
        : ref.startsWith('three/addons/') ? path.join(root, runtime, 'motion/vendor/three/addons/', ref.slice(13))
        : /^(?:https?:|data:)/.test(ref) ? null : undefined;
      assert(target !== undefined, `unmapped ${p} → ${ref}`);
      if (target) { assert(existsSync(target), `${p} → ${ref}`); importEdges++; }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
let links = 0;
for (const p of ['agent.md', ...walk('docs').filter(p => p.endsWith('.md')), ...source.files.filter(f => f.path.endsWith('.md')).map(f => 'modules/motion-ball/' + f.path)]) {
  for (const [, href] of read(p).toString().matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    const local = decodeURIComponent(href.split('#')[0]);
    if (local) { assert(existsSync(path.resolve(root, path.dirname(p), local)), `${p} → ${href}`); links++; }
  }
}
console.log(JSON.stringify({ upstreamFiles: 84, effectiveUnmodifiedFiles: 83, registryOnlyLockMirror: true,
  canonicalNativeFiles: walk('integrations/native-shell').length, runtimeFiles: walk('apps/web/runtime').length,
  importEdges, documentationLinks: links, three: '0.186.1', internalPatches: 0,
  acceptance: 'Source/import/docs checks only; GPU/mobile/performance incomplete' }));
