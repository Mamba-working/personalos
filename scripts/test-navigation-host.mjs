#!/usr/bin/env node
/** Host navigation A source/DOM checks, not browser layout or pixel acceptance. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require(path.join(root, '.build/native-qa-deps/node_modules/jsdom'))); }
const candidate = path.join(root,'apps/web/runtime');
const read = file => readFileSync(path.join(candidate,file),'utf8');
const hostSource = readFileSync(path.join(root,'integrations/motion-ball/host.js'),'utf8');
async function harness(t) {
  const dom = new JSDOM(read('index.html').replace(/<link[^>]*>/g,''), {url:'https://prototype.local/alpha/v0.1.0-alpha.8/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, d = w.document, header = d.querySelector('.topbar'), hero = d.querySelector('.intro');
  const style = d.createElement('style');
  style.textContent = ['style.css','material.css','palette.css','host.css','modules/menu.css','liquid-glass.css'].map(read).join('\n'); d.head.append(style);
  // Exact class/semantic boundary of the retained native menu anchor.
  d.querySelector('#host-menu').innerHTML='<span class="pos-menu"><span class="pos-menu-anchor"><button class="pos-menu-toggle" type="button" aria-label="打开空间菜单"><span>Menu</span><span class="pos-menu-icon" aria-hidden="true"><i></i><i></i></span></button></span></span>';
  let heroBottom=700;
  header.getBoundingClientRect=()=>({bottom:96}); hero.getBoundingClientRect=()=>({bottom:heroBottom});
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  const chat = {getState:()=>({phase:'closed'}),subscribe:()=>()=>{},show(){},close(){},preferencesChanged(){}};
  w.mockMountChat = async () => chat;
  w.eval(hostSource.replace("import { mountChat } from './chat-host.js';","const mountChat=window.mockMountChat;"));
  await Promise.resolve(); await Promise.resolve();
  let sceneState={ready:false,night:null};
  w.personalOSHost.registerModule('scene',{getState:()=>sceneState});
  const h={w,d,header,hero,style:element=>w.getComputedStyle(element),scene(patch){sceneState={...sceneState,...patch};w.personalOSHost.moduleChanged('scene');},scroll(bottom){heroBottom=bottom;w.dispatchEvent(new w.Event('scroll'));}};
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));dom.window.close();});
  return h;
}

test('glass controls retain a transparent masthead and native header actions',async t=>{
  const h=await harness(t);
  assert.equal(h.style(h.header).backgroundColor,'rgba(0, 0, 0, 0)');
  assert.equal(h.style(h.header).boxShadow,'none');
  for(const selector of ['#host-motion','#host-open-chat','#host-menu .pos-menu-toggle']) {
    const button=h.d.querySelector(selector), css=h.style(button);
    assert.equal(button.tagName,'BUTTON'); assert.equal(parseFloat(css.borderRadius),999);
    assert.notEqual(css.boxShadow,'none');
    assert.ok(parseFloat(css.minHeight)>=44); assert.ok(parseFloat(css.minWidth)>=44);
  }
  assert.equal(h.d.querySelector('#host-open-chat').getAttribute('aria-label'),'Ball 聊天');
  assert.equal(h.d.querySelector('#host-open-chat').getAttribute('aria-controls'),'ai-canvas');
  assert.equal(h.d.querySelector('.brand').getAttribute('href'),'./');
});

test('only public ready/night host state changes masthead foreground tone',async t=>{
  const h=await harness(t); assert.equal(h.header.dataset.navTone,'day');
  h.scene({ready:false,night:true}); assert.equal(h.header.dataset.navTone,'day');
  h.scene({ready:true,night:true}); assert.equal(h.header.dataset.navTone,'night');
  assert.equal(h.style(h.header).getPropertyValue('--nav-ink'),'#f5f1ea');
  h.scene({ready:true,night:true,failed:'context-lost'}); assert.equal(h.header.dataset.navTone,'day');
  h.scene({night:false,failed:null}); assert.equal(h.header.dataset.navTone,'day');
  assert.equal(h.style(h.header).getPropertyValue('--nav-ink'),'#283348');
});

test('native scroll switches only masthead surface hint, keeping the current scene tone',async t=>{
  const h=await harness(t); h.scene({ready:true,night:true});
  h.scroll(90); assert.equal(h.header.dataset.navSurface,'content'); assert.equal(h.header.dataset.navTone,'night');
  // jsdom normalizes the CSS `none` shadow to transparent color in this cascade.
  assert.ok(['none','rgba(0, 0, 0, 0)'].includes(h.style(h.d.querySelector('#host-open-chat')).textShadow));
  assert.equal(h.style(h.header).backgroundColor,'rgba(0, 0, 0, 0)');
  h.scroll(700); assert.equal(h.header.dataset.navSurface,'scene');
});

test('non-persisted pagehide detaches header scroll/resize updates',async t=>{
  const h=await harness(t); assert.equal(h.header.dataset.navSurface,'scene');
  h.w.dispatchEvent(new h.w.Event('pagehide')); h.scroll(40);
  assert.equal(h.header.dataset.navSurface,'scene');
});

test('hero input/selection rules remain scoped and native filters remain interactive',async t=>{
  const h=await harness(t);
  for(const selector of ['.app','.page-scroll','#content-root','.intro h1','.intro .eyebrow']) assert.equal(h.style(h.d.querySelector(selector)).pointerEvents,'none',selector);
  for(const selector of ['.intro h1','.intro .eyebrow']) assert.equal(h.style(h.d.querySelector(selector)).userSelect,'none',selector);
  assert.equal(h.style(h.d.querySelector('.filters')).pointerEvents,'auto');
  assert.notEqual(h.style(h.d.querySelector('.filters')).userSelect,'none');
  assert.equal(h.d.querySelectorAll('.intro-note,#host-weather,.weather-panel').length,0);
  assert.equal(h.d.querySelectorAll('.filters button').length,4);
});

test('compact mobile label keeps Ball action, focus rules and 44px targets',()=>{
  const css=read('host.css');
  assert.match(css,/@media\(max-width:480px\)\{\.chat-label\{display:none\}\.chat-label-compact\{display:inline\}/);
  assert.ok(!/#host-open-chat\s*\{[^}]*display:none/.test(css));
  assert.match(css,/:focus-visible\{outline:2px solid var\(--nav-ink\);outline-offset:3px/);
  assert.match(css,/min-width:44px;min-height:44px/);
});

function luminance(hex) {const [r,g,b]=hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;}
function contrast(a,b) {const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('analytical day/night color pairs clear small-text contrast on representative sky/fallback colors',()=>{
  // This is color-pair arithmetic, not sampled live sky or rendered glyph proof.
  assert.ok(contrast('283348','d9dee7')>=4.5);
  assert.ok(contrast('3c4b64','d9dee7')>=4.5);
  assert.ok(contrast('f5f1ea','334c70')>=4.5);
  assert.ok(contrast('d0d9e7','334c70')>=4.5);
});

// UI-only boundary pinned to alpha.8 commit 0c8bb70db81654c279c306fb534204cbbdad04de.
// Deliberate future behavior changes must explicitly review this guard, not silently refresh it.
function treeFiles(relative) {
  return readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
    const name=`${relative}/${entry.name}`;
    return entry.isDirectory()?treeFiles(name):[name];
  });
}
test('glass update leaves every original controller, geometry stylesheet and 3D source byte-identical',()=>{
  const files=[...treeFiles('integrations').filter(file=>/\.(js|css)$/.test(file)&&file!=='integrations/native-shell/liquid-glass.css'),...treeFiles('modules/motion-ball')].sort();
  const hash=createHash('sha256');
  for(const file of files) hash.update(file).update('\0').update(readFileSync(path.join(root,file))).update('\0');
  assert.equal(hash.digest('hex'),'797df6032e4ac69ad57a936fd369b0aee1bacea02f9808fa9df9daab502164a9');
});
test('glass stylesheet adds no competing animation or transform ownership',()=>{
  const css=read('liquid-glass.css').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:animation(?:-[\w-]+)?|transition(?:-[\w-]+)?|transform(?:-[\w-]+)?|perspective|will-change)\s*:/i);
  assert.doesNotMatch(css,/@keyframes\b/i);
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for(const [,selector,body] of rules) {
    if(selector.trim()==='.topbar') assert.doesNotMatch(body,/(?:backdrop-filter|filter|contain)\s*:/i);
  }
  assert.match(css,/\.topbar\[data-nav-surface=content\]::before\s*\{/);
  assert.match(css,/\.topbar::before\s*\{[^}]*pointer-events:\s*none/);
});
