import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const css = readFileSync(new URL('../../features/content-proof/proof.module.css', import.meta.url), 'utf8');
function fixture(presenting: boolean) {
  const dom = new JSDOM(`<style>${css}</style><main class="proof"><div class="slot" data-ready="true"><div class="frame" data-presenting="${presenting}"><div class="surfaceTools"><a ${presenting ? 'hidden inert aria-hidden="true"' : ''}>打开</a><div ${presenting ? '' : 'hidden inert aria-hidden="true"'}><a>载入较长的服务器内容版本</a><a>返回</a></div></div><div class="scrollHost"><article class="article"><h2>正文标题</h2></article></div></div></div></main>`);
  const doc = dom.window.document, style = (selector: string) => dom.window.getComputedStyle(doc.querySelector(selector)!);
  return { dom, doc, style };
}
for (const presenting of [false, true]) test(`proof ${presenting ? 'reader' : 'preview'} CSS reserves a flow control row outside its native scroll viewport`, () => {
  const f = fixture(presenting);
  try {
    assert.equal(f.style('.frame').display, 'flex'); assert.equal(f.style('.frame').flexDirection, 'column');
    assert.notEqual(f.style('.surfaceTools').position, 'absolute'); assert.equal(f.style('.surfaceTools').display, 'grid'); assert.equal(f.style('.surfaceTools').minHeight, '62px');
    assert.equal(f.style('.scrollHost').minHeight, '0'); assert.equal(f.style('.scrollHost').flexGrow, '1');
    assert.equal(f.style('.article').paddingTop, '0px'); assert.equal(f.style('.article').paddingLeft, '40px');
  } finally { f.dom.window.close(); }
});
test('inactive controls reserve intrinsic row height while remaining invisible and inert', () => {
  for (const presenting of [false, true]) {
    const f = fixture(presenting);
    try { const hidden = f.doc.querySelector('.surfaceTools > [hidden]')!; assert.equal(f.dom.window.getComputedStyle(hidden).visibility, 'hidden'); assert.notEqual(f.dom.window.getComputedStyle(hidden).display, 'none'); assert.equal(hidden.hasAttribute('inert'), true); assert.equal(hidden.getAttribute('aria-hidden'), 'true'); }
    finally { f.dom.window.close(); }
  }
});
test('controls can wrap enlarged or localized text without reducing type size', () => {
  const f = fixture(true);
  try { assert.equal(f.style('.surfaceTools > div').flexWrap, 'wrap'); assert.equal(f.style('.surfaceTools a').whiteSpace, 'normal'); assert.equal(f.style('.surfaceTools a').overflowWrap, 'anywhere'); assert.equal(f.style('.surfaceTools a').fontSize, '12px'); }
  finally { f.dom.window.close(); }
});
