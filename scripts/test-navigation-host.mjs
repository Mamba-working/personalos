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
test('editorial integration retains original scene, card geometry, chat and menu bytes',()=>{
  // Reviewed exceptions: host state and scene input lease adapter, feed composition,
  // authored demo content. New editorial/explore files own only new presentation.
  const files=["integrations/motion-ball/host.css", "integrations/motion-ball/mount.js", "integrations/motion-ball/weather.js", "integrations/native-card/app.js", "integrations/native-card/layout.js", "integrations/native-card/reader.css", "integrations/native-shell/chat-contour.js", "integrations/native-shell/chat-host.css", "integrations/native-shell/chat-host.js", "integrations/native-shell/chat-motion.js", "integrations/native-shell/chat/chat-fluid-send.js", "integrations/native-shell/chat/chat-mobile-flow-page.js", "integrations/native-shell/chat/chat-mobile-flow.css", "integrations/native-shell/chat/chat-page-lock.js", "integrations/native-shell/chat/chat-reading-flow.js", "integrations/native-shell/chat/chat-reading-interior.js", "integrations/native-shell/chat/chat-reading.css", "integrations/native-shell/chat/chat-turn-scroll.js", "integrations/native-shell/chat/chat-viewport.js", "integrations/native-shell/chat/contextual-chat-layout.js", "integrations/native-shell/chat/contextual-chat.css", "integrations/native-shell/chat/send-continuity-model.js", "integrations/native-shell/chat/send-continuity.js", "integrations/native-shell/chat/send-path.js", "integrations/native-shell/chat/send-text-layout.js", "integrations/native-shell/chat/vendor/gsap/Flip.min.js", "integrations/native-shell/chat/vendor/gsap/gsap.min.js", "integrations/native-shell/comparison-status.js", "integrations/native-shell/comparison-visibility.js", "integrations/native-shell/diagnostics/keyboard-diagnostics.js", "integrations/native-shell/feed-compact.css", "integrations/native-shell/feed-reflow.js", "integrations/native-shell/material.css", "integrations/native-shell/modules/menu.css", "integrations/native-shell/modules/menu.js", "integrations/native-shell/palette.css", "integrations/native-shell/send-comparison.css", "integrations/native-shell/send-comparison.js", "integrations/native-shell/story/content-presentation.js", "integrations/native-shell/style.css", "modules/motion-ball/.gitignore", "modules/motion-ball/SOURCE-PROVENANCE.json", "modules/motion-ball/agent.md", "modules/motion-ball/asset-candidates.html", "modules/motion-ball/docs/architecture.md", "modules/motion-ball/docs/configuration.md", "modules/motion-ball/docs/development.md", "modules/motion-ball/docs/interaction.md", "modules/motion-ball/docs/library.md", "modules/motion-ball/docs/models.md", "modules/motion-ball/index.html", "modules/motion-ball/package-lock.json", "modules/motion-ball/package.json", "modules/motion-ball/public/hdri/kloofendal_48d_partly_cloudy_puresky.hdr", "modules/motion-ball/public/hdri/kloofendal_misty_morning_puresky.hdr", "modules/motion-ball/public/hdri/kloofendal_overcast_puresky.hdr", "modules/motion-ball/public/hdri/snow_field.hdr", "modules/motion-ball/public/models/.gitkeep", "modules/motion-ball/public/moon/albedo.webp", "modules/motion-ball/public/moon/height.webp", "modules/motion-ball/public/terrain/kawaguchi_detail.webp", "modules/motion-ball/public/terrain/kawaguchi_polar.u16", "modules/motion-ball/public/textures/aerial_beach_01/diff.webp", "modules/motion-ball/public/textures/aerial_beach_01/nor.webp", "modules/motion-ball/public/textures/brown_mud_03/diff.webp", "modules/motion-ball/public/textures/brown_mud_03/nor.webp", "modules/motion-ball/public/textures/brown_mud_03/rough.webp", "modules/motion-ball/public/textures/rock_face_03/diff.webp", "modules/motion-ball/public/textures/rock_face_03/nor.webp", "modules/motion-ball/public/textures/snow_02/diff.webp", "modules/motion-ball/public/textures/snow_02/nor.webp", "modules/motion-ball/scripts/copy-lib-assets.mjs", "modules/motion-ball/src/app/App.ts", "modules/motion-ball/src/app/CameraRig.ts", "modules/motion-ball/src/app/Input.ts", "modules/motion-ball/src/app/debug.ts", "modules/motion-ball/src/audio/Ambience.ts", "modules/motion-ball/src/characters/ball/BallBrain.ts", "modules/motion-ball/src/characters/ball/GltfBall.ts", "modules/motion-ball/src/characters/ball/ProceduralBall.ts", "modules/motion-ball/src/characters/ball/faceGlsl.ts", "modules/motion-ball/src/characters/ball/surfacePatch.ts", "modules/motion-ball/src/characters/factory.ts", "modules/motion-ball/src/characters/types.ts", "modules/motion-ball/src/characters/umbrella/GltfUmbrella.ts", "modules/motion-ball/src/characters/umbrella/ProceduralUmbrella.ts", "modules/motion-ball/src/characters/umbrella/UmbrellaRig.ts", "modules/motion-ball/src/config/assets.ts", "modules/motion-ball/src/core/math.ts", "modules/motion-ball/src/core/noise.ts", "modules/motion-ball/src/core/patch.ts", "modules/motion-ball/src/fx/DepthOfFieldPass.ts", "modules/motion-ball/src/fx/LensPass.ts", "modules/motion-ball/src/fx/PostFX.ts", "modules/motion-ball/src/fx/shaders.ts", "modules/motion-ball/src/lib/WeatherScene.ts", "modules/motion-ball/src/lib/config.ts", "modules/motion-ball/src/lib/emitter.ts", "modules/motion-ball/src/lib/index.ts", "modules/motion-ball/src/main.ts", "modules/motion-ball/src/styles.css", "modules/motion-ball/src/ui/UI.ts", "modules/motion-ball/src/weather/ParticleRenderer.ts", "modules/motion-ball/src/weather/ParticleSystem.ts", "modules/motion-ball/src/weather/TimeOfDay.ts", "modules/motion-ball/src/weather/Weather.ts", "modules/motion-ball/src/weather/presets.ts", "modules/motion-ball/src/world/EnvAssets.ts", "modules/motion-ball/src/world/Ground.ts", "modules/motion-ball/src/world/InteractionMap.ts", "modules/motion-ball/src/world/Lighting.ts", "modules/motion-ball/src/world/PlanarReflection.ts", "modules/motion-ball/src/world/Sky.ts", "modules/motion-ball/src/world/Terrain.ts", "modules/motion-ball/src/world/atmosphere.ts", "modules/motion-ball/src/world/clouds/CloudNoise.ts", "modules/motion-ball/src/world/clouds/cloudsGlsl.ts", "modules/motion-ball/tools/terrain/build_dem.py", "modules/motion-ball/tools/terrain/build_detail_z13.py", "modules/motion-ball/tools/terrain/get_tiles.sh", "modules/motion-ball/tools/terrain/get_tiles_z13.sh", "modules/motion-ball/tsconfig.json", "modules/motion-ball/tsconfig.lib.json", "modules/motion-ball/vite.config.ts", "modules/motion-ball/vite.lib.config.ts"];
  const hash=createHash('sha256');
  for(const file of files) hash.update(file).update('\0').update(readFileSync(path.join(root,file))).update('\0');
  assert.equal(hash.digest('hex'),'69dfadf420b6a0813ca611856722b2625cdc0f40b2a5b0927f56afb00d41d7a8');
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
