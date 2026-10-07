import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
test('production proof SSR serves distinct validated revisions and readable native deep links', async () => {
  const port = 4209, base = `http://127.0.0.1:${port}`, logs: string[] = [];
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => logs.push(String(chunk))); server.stderr.on('data', chunk => logs.push(String(chunk)));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(logs.join('')); try { if ((await fetch(`${base}/proof/react-content`)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(ready, true, logs.join(''));
    for (const revision of [1, 2]) {
      const response = await fetch(`${base}/proof/react-content?rev=${revision}&item=small-counter`), dom = new JSDOM(await response.text()), doc = dom.window.document;
      assert.equal(response.status, 200); assert.equal(doc.querySelectorAll('[data-proof-article]').length, 2); assert.equal(doc.querySelector('[data-react-content-proof]')?.getAttribute('data-revision'), String(revision));
      const article = doc.querySelector('[data-proof-article="quiet-reading"]')!; assert.ok(article.textContent!.length > 2500);
      assert.equal(article.textContent!.includes('服务器版本 2 新增'), revision === 2); assert.match(doc.querySelector('[data-server-instruction]')!.textContent!, new RegExp(`服务器版本 ${revision}`));
      const labSlot = doc.querySelector<HTMLElement>('[data-proof-slot="small-counter"]')!, close = labSlot.querySelector<HTMLAnchorElement>('[data-close]')!;
      assert.equal(close.closest('[hidden]'), null); assert.equal(new URL(close.href, base).searchParams.get('item'), null); assert.equal(labSlot.getAttribute('data-ready'), 'false');
      const styles = await Promise.all([...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(async link => (await fetch(new URL(link.href, base))).text()));
      const style = doc.createElement('style'); style.textContent = styles.join('\n'); doc.head.append(style); assert.equal(dom.window.getComputedStyle(labSlot).order, '-1');
      for (const surface of doc.querySelectorAll<HTMLElement>('[data-proof-frame]')) { assert.notEqual(dom.window.getComputedStyle(surface).position, 'fixed'); assert.equal(surface.closest('[inert],[hidden]'), null); }
      dom.window.close();
    }
  } finally { server.kill('SIGTERM'); await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve()); }); }
});
