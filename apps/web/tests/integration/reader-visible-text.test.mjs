import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent} from './content-fixture.mjs';

for(const id of ['work-context','thoughts-type','thoughts-long','labs-spring']){
 test(`one visible native text identity throughout ${id} projection`,()=>{
  const f=bootContent();
  try{
   const article=f.$(`[data-content-id="${id}"]`),original=[...article.querySelectorAll('*')];
   f.w.contentStudy.open(id,{push:false});
   const title=article.querySelector('h2'),identity=article.querySelector('.identity');
   for(const p of [0,.04,.12,.3,.6,.9,1,.7,.25,.05,0]){
    f.w.contentStudy.seek(p);
    assert.equal(f.$('#canvas .projection-preview').style.visibility,'hidden','preview geometry probe must never draw a second glyph layout');
    assert.equal(f.$('#canvas .projection-preview-surface').style.visibility,'hidden');
    for(const node of [...identity.children].filter(node=>!node.classList.contains('card-visual'))){
     assert.equal(node.style.opacity,'1','the one real text identity stays visible without a crossfade');
     assert.doesNotMatch(node.style.transform,/scale/);
    }
    assert.equal(f.d.querySelectorAll(`#title-${id}`).length,1);
    assert.equal(article.querySelector('h2'),title);
    assert.deepEqual([...article.querySelectorAll('*')],original);
   }
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.equal(f.$('#canvas .projection-preview'),null);
   assert.deepEqual([...article.querySelectorAll('*')],original);
  }finally{f.close();}
 });
}
