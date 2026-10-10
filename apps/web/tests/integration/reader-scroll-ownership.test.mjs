import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent} from './content-fixture.mjs';

// JSDOM does not implement native scrolling-box lifetime. This bounded double
// models the reader's existing CSS contract: .reading owns overflow:auto;
// without it, overflow:visible has no scrolling box. Writes then do nothing,
// getters report zero, and the browser may retain the previous native offset.
// This is controller regression coverage, not browser/layout acceptance.
function bootNativeReader({width = 390, reduced = false} = {}) {
 const writes = [];
 let retained = 0;
 const f = bootContent({width, reduced, beforeBoot: ({$}) => {
  const reader = $('#reader');
  const hasBox = () => reader.classList.contains('reading') && !$('#stage').hidden;
  Object.defineProperty(reader, 'scrollTop', {
   configurable: true,
   get() { return hasBox() ? retained : 0; },
   set(value) {
    const accepted = hasBox();
    writes.push({value: Number(value), accepted});
    if (accepted) retained = Number(value);
   }
  });
 }});
 return {...f, writes};
}

async function resize(f, width) {
 Object.defineProperty(f.w, 'innerWidth', {value: width, configurable: true});
 f.w.dispatchEvent(new f.w.Event('resize'));
 // The production resize owner debounces for 80 ms.
 await new Promise(resolve => setTimeout(resolve, 110));
}

test('native-reader double ignores no-box writes and preserves its latent offset', () => {
 const f = bootNativeReader();
 try {
  f.w.contentStudy.open('thoughts-long', {push: false});
  f.settle();
  const reader = f.$('#reader');
  reader.scrollTop = 474;
  reader.classList.remove('reading');
  assert.equal(reader.scrollTop, 0);
  reader.scrollTop = 0;
  assert.deepEqual(f.writes.at(-1), {value: 0, accepted: false});
  reader.classList.add('reading');
  assert.equal(reader.scrollTop, 474);
 } finally { f.close(); }
});

for (const reduced of [false, true]) {
 test(`new reader does not inherit narrow-reader scroll after desktop resize, reduced=${reduced}`, async () => {
  const f = bootNativeReader({reduced});
  try {
   const reader = f.$('#reader');
   const work = f.$('[data-content-id="work-context"]');
   f.w.contentStudy.open('thoughts-long', {push: false});
   f.settle();
   reader.scrollTop = 474;
   f.w.contentStudy.close('test', {history: false});
   f.settle();
   assert.equal(f.w.personalOSContent.getState().phase, 'preview');
   assert.equal(reader.scrollTop, 0);

   await resize(f, 1180);
   f.w.contentStudy.open('work-context', {push: false});
   if (!reduced) {
    const writesBeforeMotion = f.writes.length;
    for (let i = 0; i < 6; i++) f.w.contentStudy.advance(.02);
    assert.equal(f.w.personalOSContent.getState().phase, 'intermediate');
    assert.equal(reader.scrollTop, 0);
    assert.equal(f.writes.length, writesBeforeMotion, 'motion must not reset scroll every frame');
   }
   f.settle();
   assert.equal(f.w.personalOSContent.getState().phase, 'detail');
   assert.equal(f.$('#reader'), reader);
   assert.equal(f.$('#canvas').firstElementChild, work);
   assert.equal(reader.scrollTop, 0, 'fresh Work reader must not recover the previous 474px offset');
   assert.deepEqual(f.errors, []);
  } finally { f.close(); }
 });
}

test('settled resize and same-card retarget preserve native reading, but the next card starts at zero', async () => {
 const f = bootNativeReader();
 try {
  const reader = f.$('#reader');
  f.w.contentStudy.open('thoughts-long', {push: false});
  f.settle();
  reader.scrollTop = 303;
  await resize(f, 1180);
  f.settle();
  assert.equal(reader.scrollTop, 303, 'resize completion is not a fresh reading session');

  f.w.contentStudy.open('thoughts-long', {push: false});
  f.settle();
  assert.equal(reader.scrollTop, 303, 'same-card retarget must preserve native reading');

  f.w.contentStudy.close('test', {history: false});
  f.settle();
  await resize(f, 390);
  f.w.contentStudy.open('work-context', {push: false});
  f.settle();
  assert.equal(f.$('#reader'), reader);
  assert.equal(reader.scrollTop, 0, 'a different card owns a fresh reading session');
  assert.deepEqual(f.errors, []);
 } finally { f.close(); }
});
