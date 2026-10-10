/** Surface ownership contract. JSDOM does not render CSS calc/color-mix shadows;
 * actual computed values and clipped pixels require the live-browser tail check. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent,read} from './content-fixture.mjs';

const progress=f=>Number(f.$('#shell').style.getPropertyValue('--reader-surface-progress')||1);
for(const width of [390,1180])for(const reduced of [false,true]){
 test(`surface reaches its native clipped endpoint before ownership release at ${width}px reduced=${reduced}`,()=>{
  const f=bootContent({width,reduced});try{
   let endpoint;
   f.w.addEventListener('personalos:content-transition',e=>{
    if(e.detail.action==='progress'&&e.detail.phase==='return'&&e.detail.progress===0)
     endpoint={progress:progress(f),radius:f.$('#shell').style.getPropertyValue('--reader-surface-radius')};
   });
   f.w.contentStudy.open('work-context',{push:false});f.settle();
   assert.equal(progress(f),1,'reading keeps its authored elevation');
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.deepEqual(endpoint,{progress:0,radius:'20px'},'the last painted surface must already equal the native rounded/clipped card');
   assert.equal(f.$('#stage').hidden,true);
   assert.equal(f.$('[data-content-id="work-context"]').parentElement.dataset.id,'work-context');
   assert.equal(f.$('#shell').style.getPropertyValue('--reader-surface-progress'),'','release clears only its surface lease');
  }finally{f.close();}
 });
}

test('surface follows fractional progress and interrupted velocity, without affecting native text or body',()=>{
 const f=bootContent();try{
  const article=f.$('[data-content-id="thoughts-long"]'),nodes=[...article.querySelectorAll('*')];
  f.w.contentStudy.open('thoughts-long',{push:false});f.settle();
  for(const p of [.8,.2,.04,.001,0,.001,.2,1]){f.w.contentStudy.seek(p);assert.equal(progress(f),p);assert.deepEqual([...article.querySelectorAll('*')],nodes);}
  f.w.contentStudy.open('thoughts-long',{push:false});f.settle();f.w.contentStudy.close('test',{history:false});f.w.contentStudy.advance(.07);
  const before=f.w.contentStudy.snapshot();f.w.contentStudy.open('thoughts-long',{push:false});
  assert.deepEqual(f.w.contentStudy.snapshot().velocity,before.velocity);
  assert.equal(progress(f),Math.max(0,Math.min(1,before.pose.progress)));
  assert.doesNotMatch(article.querySelector('.identity').style.transform,/scale/);
  assert.doesNotMatch(article.querySelector('.detail-body').style.transform,/scale/);
 }finally{f.close();}
});

test('native source and shell share live shadow tokens and exact rounded-clip endpoints',()=>{
 const css=read('material.css'),compact=css.replace(/\s+/g,''),app=read('app.js');
 assert.match(compact,/--card-shadow-y:10px;--card-shadow-blur:26px;--reader-shadow-y:28px;--reader-shadow-blur:90px/);
 assert.match(compact,/box-shadow:0var\(--card-shadow-y\)var\(--card-shadow-blur\)var\(--card-shadow\)/);
 assert.match(compact,/calc\(var\(--card-shadow-y\)\+\(var\(--reader-shadow-y\)-var\(--card-shadow-y\)\)\*var\(--reader-surface-progress,1\)\)/);
 assert.match(compact,/calc\(var\(--card-shadow-blur\)\+\(var\(--reader-shadow-blur\)-var\(--card-shadow-blur\)\)\*var\(--reader-surface-progress,1\)\)/);
 assert.match(compact,/color-mix\(insrgb,var\(--card-shadow\)calc\(100%-var\(--reader-surface-progress,1\)\*100%\),var\(--reader-shadow\)calc\(var\(--reader-surface-progress,1\)\*100%\)\)/);
 assert.match(compact,/clip-path:inset\(calc\(-1\*var\(--reader-surface-outset\)\)roundcalc\(var\(--reader-surface-radius,20px\)\+var\(--reader-surface-outset\)\)\)/);
 assert.doesNotMatch(css,/transition:[^;}]*\b(?:box-shadow|clip-path)\b/,'no second surface interpolation clock');
 assert.equal((app.match(/requestAnimationFrame\(/g)||[]).length,2,'only the original two frame scheduling sites remain');
 // Backgrounds and border remain live under the existing category/theme owner.
 for(const token of ['--surface-work','--surface-thoughts','--surface-labs'])assert.ok(compact.includes(`background:var(${token})!important`));
 assert.match(compact,/\.travel-shell\{[^}]*border-color:var\(--stroke\)/);
});
