import {withoutReadingShelfCSS} from '../integration/reading-shelf-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const lum=rgb=>rgb.reduce((a,c,i)=>a+[.2126,.7152,.0722][i]*(c/255<=.04045?c/255/12.92:((c/255+.055)/1.055)**2.4),0);
test('V5 changes only semantic secondary ink and contains no panel/halo/layout/animation',()=>{
 const css=read('./fixtures/v5/host-reading.css').replace(/\/\*[\s\S]*?\*\//g,'').trim();assert.equal(css,'.intro-note .example-note{color:#181F2B;color:color-mix(in srgb,var(--ink,#283348) 60%,#000)}');
 assert.doesNotMatch(css,/::before|shadow|blur|background|position|transform|animation|transition|mask|filter/);
 assert.equal(withoutReadingShelfCSS(read('../../runtime/host.css')),read('./fixtures/alpha4-host.css')+read('./fixtures/v5/host-reading.css'));
});
test('V5 retains all V4 motion, field CSS and original-world hook byte-identically',()=>{
 for(const name of ['weather.js','weather.css'])assert.equal(read('./fixtures/v4/'+name),read('../../runtime/modules/'+name));
 assert.equal(read('./fixtures/v4/world-response.txt'),read('./fixtures/v5/world-response.txt'));
});
test('shade calculation clears 4.5 at recorded V1 JPEG sample backgrounds, explicitly a prediction not V5 pixel acceptance',()=>{
 const foreground=[40*.6,51*.6,72*.6];
 for(const background of [[138,155,181],[132,152,177],[127,147,174],[125,145,172],[122,141,171],[136,156,181]])assert.ok((lum(background)+.05)/(lum(foreground)+.05)>4.8);
});
