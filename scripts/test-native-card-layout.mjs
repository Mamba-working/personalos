#!/usr/bin/env node
/**
 * Cloud-only native-card geometry/source contract tests, without npm or GPU.
 * Run: node --experimental-vm-modules --test scripts/test-native-card-layout.mjs
 * The DOM double has explicit synthetic rectangles. It is not browser layout,
 * typography, scrollbar, focus-rendering, or perceived-motion acceptance.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') throw new Error('Run: node --experimental-vm-modules --test scripts/test-native-card-layout.mjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(root, 'integrations/native-card/layout.js');
const helperSource = await readFile(helperPath, 'utf8');
const appSource = await readFile(path.join(root, 'integrations/native-card/app.js'), 'utf8');
const cssSource = await readFile(path.join(root, 'integrations/native-card/reader.css'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≠ ${expected}`);
const sameBox = (actual, expected, message = '') => { for (const key of ['x', 'y', 'w', 'h']) near(actual[key], expected[key], `${message}.${key}`); };

async function loadHelper(globals = {}) {
  const context = vm.createContext(globals);
  const module = new vm.SourceTextModule(helperSource, { context, identifier: pathToFileURL(helperPath).href });
  await module.link(specifier => { throw new Error(`Native geometry helper must remain dependency-free: ${specifier}`); });
  await module.evaluate();
  return module.namespace;
}
const math = await loadHelper();

const cssKey = key => key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
class MockStyle {
  constructor() {
    this.values = new Map();
    return new Proxy(this, {
      get(target, key) { if (key in target) { const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; } return target.getPropertyValue(cssKey(String(key))); },
      set(target, key, value) { target.setProperty(cssKey(String(key)), value); return true; },
    });
  }
  setProperty(key, value) { if (value === '' || value === null) this.values.delete(key); else this.values.set(key, String(value)); }
  getPropertyValue(key) { return this.values.get(key) || ''; }
  removeProperty(key) { const old = this.getPropertyValue(key); this.values.delete(key); return old; }
  text() { return [...this.values].map(([key, value]) => `${key}: ${value};`).join(' '); }
  replace(text) { this.values.clear(); for (const entry of text.split(';')) { const colon = entry.indexOf(':'); if (colon >= 0) this.setProperty(entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()); } }
}
class MockClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) { const next = force ?? !this.contains(value); if (next) this.add(value); else this.remove(value); return next; }
}
class MockNode {
  constructor(name, environment) {
    this.name = name; this.environment = environment; this.style = new MockStyle(); this.dataset = {};
    this.classList = new MockClassList(); this.children = []; this.parentNode = null; this.attributes = new Map(); this.focusCalls = [];
  }
  get nextSibling() { if (!this.parentNode) return null; return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null; }
  get isConnected() { for (let node = this; node; node = node.parentNode) if (node === this.environment.root) return true; return false; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  insertBefore(child, next) {
    if (child.parentNode) {
      const old = child.parentNode;
      old.children.splice(old.children.indexOf(child), 1);
      if (child.contains(this.environment.document.activeElement)) this.environment.document.activeElement = this.environment.root;
      // Model a browser clamping the empty reader when its only article leaves.
      if (old === this.environment.canvas && child === this.environment.article) this.environment.reader.scrollTop = 0;
    }
    child.parentNode = this;
    const at = next === null ? this.children.length : this.children.indexOf(next);
    assert.ok(at >= 0, 'A restored next sibling must still belong to its original parent');
    this.children.splice(at, 0, child);
    return child;
  }
  append(child) { return this.insertBefore(child, null); }
  getAttribute(key) { if (key === 'style') return this.style.text() || null; return this.attributes.get(key) ?? null; }
  setAttribute(key, value) { if (key === 'style') this.style.replace(value); else this.attributes.set(key, String(value)); }
  removeAttribute(key) { if (key === 'style') this.style.replace(''); else this.attributes.delete(key); }
  focus(options) { this.focusCalls.push(plain(options)); this.environment.document.activeElement = this; }
  getBoundingClientRect() {
    this.environment.log.push(`box:${this.name}`);
    const value = this.geometry();
    return { x: value.x, y: value.y, width: value.w, height: value.h, left: value.x, top: value.y,
      right: value.x + value.w, bottom: value.y + value.h };
  }
}
function transform(style) {
  const value = style.transform;
  const translated = value.match(/translate3d\(\s*([-+\d.eE]+)px\s*,\s*([-+\d.eE]+)px\s*,/);
  const scaled = value.match(/scale\(\s*([-+\d.eE]+)\s*\)/);
  return { x: translated ? Number(translated[1]) : 0, y: translated ? Number(translated[2]) : 0, scale: scaled ? Number(scaled[1]) : 1 };
}
function scalar(value, fallback) { return value === '' ? fallback : parseFloat(value); }

async function fixture(options = {}) {
  const config = { mobile: false, marker: '1', controlsHeight: 64, topbarBottom: 76,
    nativeWidth: 1040, nativeHeight: 660, gutter: 0, identityHeight: 240, bodyHeight: 700,
    lockedWidth: 340, slot: { x: 80.25, y: 210.75, w: 342, h: 330 }, previewScale: 1, ...options };
  const h = { config, log: [], document: { scrollingElement: { scrollTop: 125 }, activeElement: null } };
  h.root = new MockNode('root', h);
  for (const name of ['shell', 'reader', 'canvas', 'controls', 'topbar', 'slot', 'article', 'identity', 'body', 'focus', 'tail']) h[name] = new MockNode(name, h);
  h.root.append(h.topbar); h.root.append(h.slot); h.slot.append(h.article); h.root.append(h.shell);
  h.shell.append(h.controls); h.shell.append(h.reader); h.reader.append(h.canvas);
  h.article.append(h.identity); h.article.append(h.body); h.body.append(h.focus);
  h.document.activeElement = h.focus;
  let scrollOffset = 0;
  Object.defineProperty(h.reader, 'scrollTop', {
    get() { h.log.push('scroll:get'); return scrollOffset; },
    set(value) { h.log.push(`scroll:set:${value}`); scrollOffset = value; },
  });
  const shellRect = () => {
    if (h.shell.dataset.measuring === 'true') return { x: config.mobile ? 12 : 120, y: scalar(h.shell.style.getPropertyValue('--native-reader-top'), config.topbarBottom + 12), w: config.nativeWidth, h: config.nativeHeight };
    const shift = transform(h.shell.style);
    return { x: shift.x, y: shift.y, w: scalar(h.shell.style.width, config.nativeWidth), h: scalar(h.shell.style.height, config.nativeHeight) };
  };
  const canvasWidth = () => scalar(h.canvas.style.width,
    shellRect().w - 2 - (h.reader.classList.contains('reading') ? config.gutter : 0));
  const nativeIdentity = () => ({
    x: config.mobile ? 1 + (canvasWidth() - config.lockedWidth) / 2 : 25,
    y: 1 + config.controlsHeight + (config.mobile ? 24 : 40),
  });
  const nativeBody = () => ({ x: config.mobile ? 25 : 25 + config.lockedWidth + 24,
    y: 1 + config.controlsHeight + (config.mobile ? 24 + config.identityHeight + 24 : 48) });
  h.shell.geometry = shellRect;
  h.canvas.geometry = () => ({ ...shellRect(), w: canvasWidth() });
  h.controls.geometry = () => ({ ...shellRect(), h: config.controlsHeight });
  h.topbar.geometry = () => ({ x: 0, y: 0, w: config.nativeWidth, h: config.topbarBottom });
  h.slot.geometry = () => {
    if (config.throwPreview && h.article.parentNode === h.slot) throw new Error('Synthetic preview measurement failure');
    return { ...config.slot, h: scalar(h.slot.style.getPropertyValue('--height'), config.slot.h) };
  };
  Object.defineProperty(h.article, 'clientWidth', { get: () => h.article.parentNode === h.slot ? config.slot.w - 2 : canvasWidth() });
  Object.defineProperty(h.identity, 'offsetWidth', { get: () => scalar(h.identity.style.width, config.lockedWidth) });
  const leafRect = (node, native, width, height) => {
    const shift = transform(node.style);
    if (h.article.parentNode === h.slot) return { x: config.slot.x + 1 + shift.x, y: config.slot.y + 1 + shift.y, w: width * shift.scale, h: height * shift.scale };
    const bounds = shellRect();
    return { x: bounds.x + native.x + shift.x, y: bounds.y + native.y + shift.y - scrollOffset, w: width * shift.scale, h: height * shift.scale };
  };
  h.identity.geometry = () => leafRect(h.identity, nativeIdentity(), scalar(h.identity.style.width, config.lockedWidth), config.identityHeight);
  h.body.geometry = () => leafRect(h.body, nativeBody(), 400, config.bodyHeight);
  h.identity.style.transform = `scale(${config.previewScale})`;
  h.identity.style.setProperty('--live-module-style', 'retained');
  h.article.style.setProperty('--live-article-style', 'retained');
  h.body.style.setProperty('--live-body-style', 'retained');
  const getComputedStyle = node => ({
    getPropertyValue(key) {
      if (key === '--native-reader-layout' && node === h.shell) return config.marker;
      if (key === '--native-card-stacked' && node === h.article) return config.mobile ? '1' : '0';
      return node.style.getPropertyValue(key);
    },
    borderTopLeftRadius: node === h.article ? '20px' : config.mobile ? '22px' : '28px',
    borderBottomWidth: node === h.article ? '1px' : '0px',
  });
  h.module = await loadHelper({ document: h.document, getComputedStyle });
  h.layout = h.module.createReaderLayout({ shell: h.shell, reader: h.reader, canvas: h.canvas, controls: h.controls, topbar: h.topbar });
  h.a = { article: h.article, identity: h.identity, body: h.body, slot: h.slot, lockedWidth: config.lockedWidth,
    record: { height: config.slot.h } };
  h.rect = node => plain(h.module.box(node));
  h.mount = () => {
    const source = h.rect(h.identity), bounds = h.rect(h.slot), local = plain(h.module.origin(source, bounds));
    h.a.pose = { ...bounds, radius: 20, opacity: 1, progress: 0, scale: config.previewScale, ix: local.x, iy: local.y, bx: 0, by: 0 };
    h.canvas.append(h.article);
    h.a.layout = h.layout.measure(h.a);
    h.a.pose.bx = h.a.layout.body.x; h.a.pose.by = h.a.layout.body.y;
    h.layout.paint(h.a);
    return source;
  };
  return h;
}

function functionSource(source, name) {
  const declaration = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(source);
  assert.ok(declaration, `Expected canonical ${name} function`);
  let index = declaration.index + declaration[0].length, depth = 1;
  const skipString = (at, quote) => { for (let next = at + 1; next < source.length; next++) { if (source[next] === '\\') next++; else if (source[next] === quote) return next; } throw new Error('Unclosed JavaScript string'); };
  for (; index < source.length && depth; index++) {
    if (['"', "'", '`'].includes(source[index])) index = skipString(index, source[index]);
    else if (source[index] === '(') depth++;
    else if (source[index] === ')') depth--;
  }
  while (/\s/.test(source[index])) index++;
  assert.equal(source[index], '{', `Expected ${name} body`);
  const start = index++; depth = 1;
  for (; index < source.length && depth; index++) {
    const char = source[index];
    if (['"', "'", '`'].includes(char)) index = skipString(index, char);
    else if (char === '/' && source[index + 1] === '/') { index = source.indexOf('\n', index); if (index < 0) throw new Error('Unclosed line comment'); }
    else if (char === '/' && source[index + 1] === '*') { index = source.indexOf('*/', index + 2) + 1; if (index === 0) throw new Error('Unclosed comment'); }
    else if (char === '{') depth++;
    else if (char === '}') depth--;
  }
  assert.equal(depth, 0, `Expected complete ${name} body`);
  return { declaration: source.slice(declaration.index, index), body: source.slice(start + 1, index - 1) };
}
function before(text, earlier, later, message) {
  const a = text.indexOf(earlier), b = text.indexOf(later);
  assert.ok(a >= 0 && b >= 0 && a < b, `${message}: ${earlier} must precede ${later}`);
}

test('box copies fractional viewport geometry without mutating or remeasuring', () => {
  const input = Object.freeze({ x: -40.25, y: 18.75, width: 375.5, height: 280.125 });
  let reads = 0;
  assert.deepEqual(plain(math.box({ getBoundingClientRect() { reads++; return input; } })), { x: -40.25, y: 18.75, w: 375.5, h: 280.125 });
  assert.equal(reads, 1);
});

test('origin and projection use desired minus measured origin, including negatives', () => {
  const fixtures = [
    [{ x: 0, y: 0 }, { x: 24, y: 104 }],
    [{ x: -20.25, y: 83.125 }, { x: 18.75, y: -64.5 }],
    [{ x: 71.5, y: -235.75 }, { x: -30.25, y: 120.25 }],
  ];
  for (const [desired, native] of fixtures) {
    const frozenDesired = Object.freeze({ ...desired }), frozenNative = Object.freeze({ ...native });
    const projected = plain(math.projection(frozenDesired, frozenNative));
    near(native.x + projected.x, desired.x); near(native.y + projected.y, desired.y);
    assert.deepEqual(plain(math.origin(frozenDesired, frozenNative)), projected);
  }
});

test('native reader CSS marker is required before the layout factory can mount', async () => {
  await assert.rejects(fixture({ marker: '0' }), /reader\.css is required/);
  assert.match(cssSource, /--native-reader-layout\s*:\s*1/);
});

for (const [name, config] of [
  ['desktop', {}],
  ['compact mobile with classic gutter', { mobile: true, nativeWidth: 366, gutter: 15, lockedWidth: 158, slot: { x: 16.5, y: -72.25, w: 160, h: 270 } }],
  ['fractional rescaled preview', { mobile: true, nativeWidth: 351, gutter: 15, lockedWidth: 320, previewScale: 0.6, slot: { x: 11.75, y: 145.125, w: 194, h: 250 } }],
]) {
  test(`source identity rectangle survives first projection: ${name}`, async () => {
    const h = await fixture(config), source = h.mount();
    sameBox(h.rect(h.identity), source, 'source→lift');
    assert.equal(h.article.parentNode, h.canvas);
    assert.equal(h.a.pose.scale, h.config.previewScale);
    assert.equal(h.canvas.style.transform, '', 'No counteroffset canvas transform');
    assert.equal(h.identity.style.getPropertyValue('--live-module-style'), 'retained');
  });
}

test('actual controls/topbar measurements reproject without moving the desired identity', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 158, gutter: 15 });
  h.mount();
  const displayed = h.rect(h.identity);
  for (const height of [40, 64, 88, 103.5]) {
    h.config.controlsHeight = height; h.config.topbarBottom = height + 20;
    h.a.layout = h.layout.measure(h.a); h.layout.paint(h.a);
    near(h.a.layout.controlsHeight, height);
    near(parseFloat(h.shell.style.getPropertyValue('--native-reader-top')), height + 32);
    sameBox(h.rect(h.identity), displayed, 'measured header change');
  }
});

test('fixed measured canvas width isolates centered identity from reading gutter changes', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 158, gutter: 15 });
  h.mount();
  near(parseFloat(h.canvas.style.width), 349);
  const before = h.rect(h.identity);
  h.reader.classList.add('reading'); h.layout.paint(h.a);
  sameBox(h.rect(h.identity), before, 'reading gutter on');
  h.reader.classList.remove('reading'); h.layout.paint(h.a);
  sameBox(h.rect(h.identity), before, 'reading gutter off');
});

test('measure restores scroll, reading state and unowned styles after neutral reads', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 158, gutter: 15 });
  h.mount(); h.reader.classList.add('reading'); h.reader.scrollTop = 185.5;
  h.shell.style.setProperty('--live-shell-style', 'keep'); h.canvas.style.setProperty('--live-canvas-style', 'keep');
  const projection = h.identity.style.transform, bodyProjection = h.body.style.transform;
  h.a.layout = h.layout.measure(h.a);
  assert.equal(h.reader.scrollTop, 185.5); assert.equal(h.reader.classList.contains('reading'), true);
  assert.equal(h.identity.style.transform, projection); assert.equal(h.body.style.transform, bodyProjection);
  assert.equal(h.shell.style.getPropertyValue('--live-shell-style'), 'keep'); assert.equal(h.canvas.style.getPropertyValue('--live-canvas-style'), 'keep');
  assert.equal(h.shell.dataset.measuring, undefined);
  assert.equal(h.identity.style.width, '158px'); assert.equal(h.canvas.style.width, '349px');
});

test('scrolled close captures displayed leaves before resetting native scroll', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 158, gutter: 15 });
  h.mount(); h.a.pose.progress = 1; h.layout.paint(h.a); h.reader.classList.add('reading'); h.reader.scrollTop = 183.75;
  const identity = h.rect(h.identity), body = h.rect(h.body);
  h.log.length = 0;
  const captured = plain(h.layout.captureScroll(h.a));
  const reset = h.log.indexOf('scroll:set:0');
  assert.ok(reset >= 0);
  assert.ok(h.log.indexOf('box:identity') >= 0 && h.log.indexOf('box:identity') < reset);
  assert.ok(h.log.indexOf('box:body') >= 0 && h.log.indexOf('box:body') < reset);
  near(captured.identity.y, identity.y - h.rect(h.shell).y);
  assert.equal(h.reader.scrollTop, 0); assert.equal(h.reader.classList.contains('reading'), false);
  sameBox(h.rect(h.identity), identity, 'scrolled close identity'); sameBox(h.rect(h.body), body, 'scrolled close body');
});

test('prepared preview measures one semantic subtree and restores parent, styles, scroll and focus', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 320, gutter: 15, slot: { x: 17.25, y: 98.5, w: 194, h: 280 } });
  h.mount(); h.canvas.append(h.tail); h.reader.classList.add('reading'); h.reader.scrollTop = 150;
  h.document.activeElement = h.focus;
  const styles = [h.article, h.identity, h.body].map(node => node.getAttribute('style'));
  const before = h.rect(h.identity), windowOffset = h.document.scrollingElement.scrollTop;
  const preview = plain(h.layout.preview(h.a));
  sameBox(preview.bounds, h.config.slot, 'prepared slot'); near(preview.scale, 0.6);
  assert.deepEqual(preview.identity, { x: 1, y: 1 });
  assert.equal(h.article.parentNode, h.canvas); assert.equal(h.article.nextSibling, h.tail);
  assert.deepEqual([h.article, h.identity, h.body].map(node => node.getAttribute('style')), styles);
  assert.equal(h.reader.scrollTop, 150); assert.equal(h.document.scrollingElement.scrollTop, windowOffset);
  assert.equal(h.document.activeElement, h.focus); assert.deepEqual(h.focus.focusCalls.at(-1), { preventScroll: true });
  sameBox(h.rect(h.identity), before, 'preview lease restoration');
});

test('prepared preview restores ownership and reader scroll even when its read fails', async () => {
  const h = await fixture(); h.mount(); h.canvas.append(h.tail); h.reader.classList.add('reading'); h.reader.scrollTop = 73;
  h.document.activeElement = h.focus;
  const styles = [h.article, h.identity, h.body].map(node => node.getAttribute('style'));
  h.config.throwPreview = true;
  assert.throws(() => h.layout.preview(h.a), /Synthetic preview measurement failure/);
  assert.equal(h.article.parentNode, h.canvas); assert.equal(h.article.nextSibling, h.tail);
  assert.deepEqual([h.article, h.identity, h.body].map(node => node.getAttribute('style')), styles);
  assert.equal(h.reader.scrollTop, 73); assert.equal(h.document.activeElement, h.focus);
});

test('return target consumes prepared identity/radius/scale and lands without geometry correction', async () => {
  const h = await fixture({ mobile: true, nativeWidth: 366, lockedWidth: 320, gutter: 15, slot: { x: 17.25, y: 98.5, w: 194, h: 280 } });
  h.mount(); h.a.preview = h.layout.preview(h.a);
  const source = functionSource(appSource, 'returnDestination').declaration;
  const context = vm.createContext({ rect: node => h.rect(node) });
  const destination = new vm.Script(`(${source})`).runInContext(context);
  h.a.pose = destination(h.a); h.layout.paint(h.a);
  const lastAir = h.rect(h.identity);
  const prepared = h.a.preview;
  near(lastAir.x, prepared.bounds.x + prepared.identity.x); near(lastAir.y, prepared.bounds.y + prepared.identity.y);
  near(lastAir.w, h.config.lockedWidth * prepared.scale); near(lastAir.h, h.config.identityHeight * prepared.scale);
  h.layout.returnToSlot(h.a);
  sameBox(h.rect(h.identity), lastAir, 'last-air→native');
  assert.equal(h.article.parentNode, h.slot);
  assert.deepEqual([h.article, h.identity, h.body].map(node => node.getAttribute('style')), plain(prepared.styles));
});

test('a wider destination grows the measured slot before returning a tall locked identity', async () => {
  const h = await fixture({ lockedWidth: 344, identityHeight: 320,
    slot: { x: 36.5, y: 200.25, w: 540, h: 360 } });
  h.mount();
  h.a.preview = h.layout.preview(h.a);
  const preview = h.a.preview, scale = (540 - 2) / 344;
  const requiredHeight = Math.ceil(1 + 320 * scale + 1);
  near(preview.scale, scale); assert.equal(preview.bounds.h, requiredHeight);
  assert.equal(h.a.record.height, requiredHeight);
  assert.equal(h.slot.style.getPropertyValue('--height'), `${requiredHeight}px`);
  assert.ok(requiredHeight > 360, 'The previous height demonstrably clipped the enlarged identity');
  const destination = new vm.Script(`(${functionSource(appSource, 'returnDestination').declaration})`)
    .runInContext(vm.createContext({ rect: node => h.rect(node) }));
  h.a.pose = destination(h.a); h.layout.paint(h.a);
  const lastAir = h.rect(h.identity);
  h.layout.returnToSlot(h.a);
  const identity = h.rect(h.identity), slot = h.rect(h.slot);
  sameBox(identity, lastAir, 'wide destination last-air→native');
  assert.ok(identity.y + identity.h + 1 <= slot.y + slot.h,
    'The entire measured identity, including its bottom border clearance, fits the native slot');
});

test('canonical source captures initial identity before moving the intact article', () => {
  const open = functionSource(appSource, 'open').body;
  before(open, 'identityOrigin=origin(rect(e.identity),b)', 'canvas.append(e.article)', 'Source origin capture');
  before(open, 'sourceIdentity:rect(e.identity)', 'canvas.append(e.article)', 'Source rectangle capture');
  before(open, 'a.layout=layout(a)', 'paint()', 'Measured layout precedes first paint');
  assert.match(open, /ix:identityOrigin\.x,iy:identityOrigin\.y/);
  assert.doesNotMatch(open, /cloneNode\s*\(/);
});

test('canonical close prepares its measured endpoint before choosing a return target', () => {
  const close = functionSource(appSource, 'close').body;
  before(close, 'compensateReading(a)', 'a.preview=readerLayout.preview(a)', 'Displayed close capture');
  before(close, 'a.preview=readerLayout.preview(a)', 'setTarget(a,returnDestination(a))', 'Prepared native return target');
  const destination = functionSource(appSource, 'returnDestination').body;
  assert.match(destination, /radius:p\.radius,scale:p\.scale,ix:p\.identity\.x,iy:p\.identity\.y/);
  const finish = functionSource(appSource, 'finishClose').body;
  before(finish, 'readerLayout.returnToSlot(a)', 'configureReadingAssistant(null)', 'Native ownership before shell release');
  assert.doesNotMatch(finish, /identity\.style\.(?:transform|width)\s*=/, 'No completion-time projection correction');
  assert.doesNotMatch(finish, /cloneNode\s*\(|innerHTML\s*=/, 'No article clone/rebuild');
});

test('canonical resize captures visible positions then measures and reprojects once', () => {
  const resize = functionSource(appSource, 'resizeContent').body;
  before(resize, 'readerLayout.displayed(active)', 'reflow.finish()', 'Displayed identity captured before layout mutation');
  before(resize, 'a.layout=layout(a)', 'a.pose.ix=display.identity.x', 'Neutral layout before desired-origin restoration');
  before(resize, 'a.pose.iy=display.identity.y+reader.scrollTop', 'paint()', 'Scrolled identity reprojection before paint');
  assert.equal((resize.match(/a\.layout=layout\(a\)/g) || []).length, 1, 'Only one neutral measurement per resize');
});

test('native geometry ownership has no control-height bridge or canvas counteroffset', () => {
  assert.match(appSource, /createReaderLayout\(\{shell,reader,canvas,controls:readingControls,topbar:/);
  assert.doesNotMatch(appSource, /controlsHeight\s*:\s*64|--reader-controls-height|canvas\.style\.transform\s*=\s*`translate/);
  assert.doesNotMatch(cssSource, /--reader-controls-height|height\s*:\s*64px/);
  assert.match(cssSource, /\.content-canvas\{[^}]*transform:none/);
  assert.match(appSource, /handoffs:\(\)=>handoffs\.map/);
});
