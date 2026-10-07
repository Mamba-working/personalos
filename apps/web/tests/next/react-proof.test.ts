import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContentFrame, type FrameClock } from '../../engines/motion/content-frame';
import { parseContentProof } from '../../../../packages/contracts/content-proof';
import { captureAnchor, restoreAnchor } from '../../features/content-proof/scroll-anchor';
import { JSDOM } from 'jsdom';
function clockFixture() {
  let now = 0, hidden = false, sequence = 0;
  const frames = new Map<number, (time: number) => void>(), listeners = new Set<() => void>();
  const clock: FrameClock = { now: () => now, request(fn) { frames.set(++sequence, fn); return sequence; }, cancel: id => { frames.delete(id); }, hidden: () => hidden, subscribeVisibility(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; } };
  return { clock, frames, listeners, advance(ms: number) { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); }, visibility(value: boolean) { hidden = value; listeners.forEach(fn => fn()); }, elapse(ms: number) { now += ms; } };
}
for (const hz of [15, 30, 60, 120]) test(`React proof frame settles using full visible time at ${hz} Hz`, () => {
  const f = clockFixture(), style = { transform: '', clipPath: '' } as CSSStyleDeclaration, settled: boolean[] = [];
  const motion = createContentFrame({ style }, f.clock, open => settled.push(open));
  motion.initialize({ x: 0, y: 320, clip: 400 }); motion.target({ x: 0, y: 0, clip: 0 }, true);
  for (let elapsed = 0; elapsed < 260; elapsed += 1000 / hz) f.advance(1000 / hz);
  assert.deepEqual(settled, [true]); assert.equal(f.frames.size, 0); assert.equal(motion.snapshot().pose.y, 0);
  motion.target({ x: 0, y: 320, clip: 400 }, false); f.advance(1000); assert.deepEqual(settled, [true, false]);
  motion.dispose(); motion.dispose(); assert.equal(f.frames.size, 0); assert.equal(f.listeners.size, 0);
});
test('React proof frame hidden gap is excluded and reversal starts at the current pose', () => {
  const f = clockFixture(), style = { transform: '', clipPath: '' } as CSSStyleDeclaration, settled: boolean[] = [], motion = createContentFrame({ style }, f.clock, value => settled.push(value));
  motion.initialize({ x: 0, y: 300, clip: 400 }); motion.target({ x: 0, y: 0, clip: 0 }, true); f.advance(60);
  const before = motion.snapshot().pose; f.visibility(true); f.elapse(600000); f.visibility(false); assert.deepEqual(motion.snapshot().pose, before); f.advance(10); assert.equal(settled.length, 0);
  const reversed = motion.snapshot().pose; motion.target({ x: 0, y: 300, clip: 400 }, false); assert.deepEqual(motion.snapshot().pose, reversed); f.advance(180); assert.deepEqual(settled, [false]); motion.dispose();
});
test('React proof frame instant motion has no RAF and stale/disposed callbacks cannot finish', () => {
  const f = clockFixture(), style = { transform: '', clipPath: '' } as CSSStyleDeclaration, settled: boolean[] = [], motion = createContentFrame({ style }, f.clock, value => settled.push(value));
  motion.target({ x: 0, y: 0, clip: 0 }, true, true); assert.deepEqual(settled, [true]); assert.equal(f.frames.size, 0);
  motion.target({ x: 0, y: 10, clip: 10 }, false); const stale = [...f.frames.values()][0]; motion.dispose(); stale(100000); assert.deepEqual(settled, [true]); assert.equal(style.transform, '');
});
const record = { id: 'sample', revision: 1, space: 'thoughts', kind: 'essay', title: '演示', summary: '摘要', provenance: 'authored-demo', sections: [{ id: 'first', heading: '一', paragraphs: [{ id: 'p1', text: '正文' }] }] };
const payload = () => ({ schemaVersion: 1, source: 'server-fixture', revision: 1, records: [structuredClone(record)] });
test('proof runtime contract validates records and rejects duplicate identity/unsafe renderer/invalid lab', () => {
  assert.equal(parseContentProof(payload()).records[0].id, 'sample');
  for (const bad of [{ ...payload(), records: [record, record] }, { ...payload(), records: [{ ...record, kind: 'arbitrary-js' }] }, { ...payload(), records: [{ ...record, kind: 'counter-lab', step: 0, instruction: 'bad' }] }, { ...payload(), records: [{ ...record, sections: [...record.sections, ...record.sections] }] }]) assert.throws(() => parseContentProof(bad));
});
test('section anchor preserves the paragraph position when a server revision inserts earlier content', () => {
  const dom = new JSDOM('<div id="host"><section data-section-id="first"></section><section data-section-id="second"></section></div>');
  const host = dom.window.document.querySelector<HTMLElement>('#host')!, [first, second] = [...host.children] as HTMLElement[];
  let precedingHeight = 500; host.scrollTop = 540;
  host.getBoundingClientRect = () => ({ top: 24, bottom: 304 } as DOMRect);
  first.getBoundingClientRect = () => ({ top: 24 - host.scrollTop, bottom: 24 + precedingHeight - host.scrollTop } as DOMRect);
  second.getBoundingClientRect = () => ({ top: 24 + precedingHeight - host.scrollTop, bottom: 24 + precedingHeight + 300 - host.scrollTop } as DOMRect);
  const anchor = captureAnchor(host); assert.equal(anchor.section, 'second'); assert.equal(anchor.offset, -40);
  precedingHeight += 140; restoreAnchor(host, anchor); assert.equal(host.scrollTop, 680); assert.equal(second.getBoundingClientRect().top, -16); dom.window.close();
});
test('proof source keeps React ownership, server slots, stable keys, real payload application, and isolated engine writes', () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const files = ['features/content-proof/ContentProof.tsx', 'features/content-proof/ContentSurface.tsx', 'features/content-proof/ContentBody.tsx', 'features/content-proof/CounterLab.tsx'];
  for (const file of files) assert.doesNotMatch(read(file), /dangerouslySetInnerHTML|innerHTML|appendChild|replaceChildren|createPortal|\.append\(/);
  const proof = read(files[0]); assert.match(proof, /key=\{entry\.record\.id\}/); assert.match(proof, /if \(!busy &&/); assert.match(proof, /setApplied\(\{ entries, revision \}\)/); assert.match(proof, /replaceServerQuery\(/); assert.match(proof, /router\.refresh\(/); assert.doesNotMatch(proof, /history\.(?:pushState|replaceState|back)/);
  assert.match(read('app/proof/react-content/page.tsx'), /body: <ContentBody key=\{record.id\}/);
  const motion = read('engines/motion/content-frame.ts'); assert.doesNotMatch(motion, /scrollTop|querySelector|append|innerHTML|setState|style\.(?:width|height|left|top)/);
  assert.match(read('features/content-proof/RevisionBoundary.tsx'), /getSnapshotBeforeUpdate/);
});
test('a cancelled older epoch callback cannot consume or duplicate the replacement frame', () => {
  const f = clockFixture(), style = { transform: '', clipPath: '' } as CSSStyleDeclaration, motion = createContentFrame({ style }, f.clock, () => {});
  motion.initialize({ x: 0, y: 300, clip: 400 }); motion.target({ x: 0, y: 0, clip: 0 }, true);
  const stale = [...f.frames.values()][0]; f.advance(60); motion.target({ x: 0, y: 300, clip: 400 }, false);
  const before = motion.snapshot(); stale(100000); assert.deepEqual(motion.snapshot(), before); assert.equal(f.frames.size, 1); f.advance(180); assert.equal(f.frames.size, 0); motion.dispose();
});
test('paragraph anchor survives an insertion earlier in the same section', () => {
  const dom = new JSDOM('<div id="host"><section data-section-id="one"><p data-reading-anchor="one:original">原文</p></section></div>');
  const host = dom.window.document.getElementById('host')!, paragraph = host.querySelector<HTMLElement>('p')!; let precedingHeight = 100;
  host.scrollTop = 160; host.getBoundingClientRect = () => ({ top: 24, bottom: 304 } as DOMRect);
  paragraph.getBoundingClientRect = () => ({ top: 24 + precedingHeight - host.scrollTop, bottom: 324 + precedingHeight - host.scrollTop } as DOMRect);
  const anchor = captureAnchor(host); assert.equal(anchor.section, 'one:original'); precedingHeight += 150; restoreAnchor(host, anchor); assert.equal(host.scrollTop, 310); assert.equal(paragraph.getBoundingClientRect().top, -36); dom.window.close();
});
test('capture ignores prose entirely below the native reader viewport', () => {
  const dom = new JSDOM('<div id="host"><p data-reading-anchor="far-below">还没读到</p></div>');
  const host = dom.window.document.getElementById('host')!, paragraph = host.querySelector<HTMLElement>('p')!; host.scrollTop = 120;
  host.getBoundingClientRect = () => ({ top: 24, bottom: 304 } as DOMRect); paragraph.getBoundingClientRect = () => ({ top: 600, bottom: 900 } as DOMRect);
  assert.deepEqual(captureAnchor(host), { section: null, offset: 0, scrollTop: 120 }); dom.window.close();
});
