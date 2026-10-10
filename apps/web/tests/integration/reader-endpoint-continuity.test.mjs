/**
 * Endpoint ownership regression using the actual projection/controller/CSS.
 * JSDOM has no layout engine: this fixture resolves the bounded font/media units
 * used by this header and supplies deterministic block widths and text heights.
 * It is a style/geometry-contract double, NOT browser glyph/layout acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootContent,read} from './content-fixture.mjs';

const TEXT=['h2','.summary','.card-meta','.card-foot','.visual-label'];
const round=value=>Math.round(value*10000)/10000;
function bootEndpoint(width){
 const resize={};
 const fixture=bootContent({width,beforeBoot({w,d,box}){
  const mobile=width<=650,rootFont=16;
  const length=(value,font=rootFont,basis=0)=>{
   const v=String(value||'').trim();
   if(v.endsWith('rem'))return parseFloat(v)*rootFont;
   if(v.endsWith('em'))return parseFloat(v)*font;
   if(v.endsWith('vw'))return parseFloat(v)*width/100;
   if(v.endsWith('%'))return parseFloat(v)*basis/100;
   return Number.isFinite(parseFloat(v))?parseFloat(v):0;
  };
  // Expand shorthands before cascading: JSDOM otherwise lets an older `font`
  // incorrectly override a later font-size longhand. Resolve unsupported clamp.
  const css=[read('style.css'),read('feed-compact.css'),read('card-projection.css')].join('\n')
   .replace(/font:([^;}]+)/g,(_,value)=>{
    const temp=d.createElement('div');temp.style.font=value;
    return Array.from({length:temp.style.length},(_,i)=>temp.style[i])
     .filter(key=>key!=='font').map(key=>`${key}:${temp.style.getPropertyValue(key)}`).join(';');
   }).replace(/clamp\(([^,]+),([^,]+),([^\)]+)\)/g,(_,min,value,max)=>
    `${Math.max(length(min),Math.min(length(max),length(value)))}px`);
  const source=d.createElement('style');source.textContent=css;d.head.append(source);
  const mediaMatches=condition=>{
   if(condition.includes('prefers-reduced-motion'))return false;
   const max=condition.match(/max-width:\s*([\d.]+)px/),min=condition.match(/min-width:\s*([\d.]+)px/);
   return(!max||width<=Number(max[1]))&&(!min||width>=Number(min[1]));
  };
  const flatten=rules=>Array.from(rules).flatMap(rule=>rule.cssRules
   ?mediaMatches(rule.conditionText||'')?flatten(rule.cssRules):[]:[rule.cssText]).join('\n');
  const resolved=flatten(source.sheet.cssRules);source.textContent=resolved;
  const nativeStyle=w.getComputedStyle.bind(w);
  const fontSize=node=>length(nativeStyle(node).fontSize)||rootFont;
  w.getComputedStyle=node=>{
   const style=nativeStyle(node),font=fontSize(node);
   const values={fontSize:`${round(font)}px`,lineHeight:`${round(style.lineHeight==='normal'||!style.lineHeight?font*1.2:/^[\d.]+$/.test(style.lineHeight)?Number(style.lineHeight)*font:length(style.lineHeight,font))}px`,letterSpacing:style.letterSpacing==='normal'||!style.letterSpacing?'0px':`${round(length(style.letterSpacing,font))}px`};
   return new Proxy(style,{get(target,key){
    if(key==='getPropertyValue')return name=>{
     const camel=name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
     return values[camel]??target.getPropertyValue(name);
    };
    if(key in values)return values[key];
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }});
  };
  let feedWidth=width-(mobile?32:96);
  resize.setFeedWidth=value=>{feedWidth=value;};
  const columnWidth=()=>{const n=Math.max(1,d.querySelectorAll('.feed-column').length),gap=mobile?12:20;return(feedWidth-(n-1)*gap)/n;};
  const explicitWidth=node=>{
   const style=w.getComputedStyle(node),raw=node.style.width||style.width;
   if(raw&&!raw.includes('%')&&!raw.includes('var(')&&raw!=='auto')return length(raw,fontSize(node));
   return null;
  };
  const identityWidth=node=>explicitWidth(node)??columnWidth()-2;
  const innerWidth=node=>{
   const style=w.getComputedStyle(node);
   return identityWidth(node)-length(style.paddingLeft,fontSize(node))-length(style.paddingRight,fontSize(node));
  };
  const textWidth=node=>{
   const fixed=explicitWidth(node);if(fixed!==null)return fixed;
   if(node.matches('.visual-label')){
    // Bounded shrink-to-fit case for the authored monospace absolute label.
    const cover=node.closest('.card-visual'),cs=w.getComputedStyle(cover),labelStyle=w.getComputedStyle(node);
    const natural=(node.textContent||'').length*(fontSize(node)*.6+length(labelStyle.letterSpacing,fontSize(node)));
    const available=textWidth(cover)-length(cs.borderLeftWidth)-length(cs.borderRightWidth)-length(labelStyle.left);
    return Math.min(natural,Math.max(1,available));
   }
   const root=node.closest('.identity');return root?innerWidth(root):350;
  };
  const textHeight=node=>{
   const font=fontSize(node),line=length(w.getComputedStyle(node).lineHeight,font);
   const advance=node.matches('.visual-label')
    ?(node.textContent||'').length*(font*.6+length(w.getComputedStyle(node).letterSpacing,font))
    :Array.from(node.textContent||'').reduce((sum,c)=>sum+font*(c.codePointAt(0)>255?1:.55),0);
   return Math.max(1,Math.ceil(advance/Math.max(1,textWidth(node))))*line;
  };
  const coverHeight=node=>length(w.getComputedStyle(node).height)||128;
  const identityHeight=node=>{
   const style=w.getComputedStyle(node);let total=length(style.paddingTop)+length(style.paddingBottom);
   for(const child of node.children){const cs=w.getComputedStyle(child);total+=length(cs.marginTop)+length(cs.marginBottom)+(child.matches('.card-visual')?coverHeight(child):textHeight(child));}
   return total;
  };
  const originalRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.id==='feed')return box(mobile?16:48,600,feedWidth,1600);
   if(this.matches('.slot'))return box(mobile?16:48,600-d.scrollingElement.scrollTop,columnWidth(),parseFloat(this.style.getPropertyValue('--height'))||400);
   if(this.matches('.identity'))return box(0,0,identityWidth(this),identityHeight(this));
   if(this.matches('.identity > *')){
    const parent=this.parentElement,ps=w.getComputedStyle(parent);let y=length(ps.paddingTop);
    for(const child of parent.children){const cs=w.getComputedStyle(child);y+=length(cs.marginTop);if(child===this)break;y+=(child.matches('.card-visual')?coverHeight(child):textHeight(child))+length(cs.marginBottom);}
    return box(length(ps.paddingLeft),y,textWidth(this),this.matches('.card-visual')?coverHeight(this):textHeight(this));
   }
   if(this.matches('.visual-label'))return box(0,0,textWidth(this),textHeight(this));
   return originalRect.call(this);
  };
 }});
 return {...fixture,...resize};
}
function metrics(f,article){
 return Object.fromEntries(TEXT.filter(selector=>article.querySelector(selector)).map(selector=>{
  const node=article.querySelector(selector),style=f.w.getComputedStyle(node),bounds=node.getBoundingClientRect();
  return[selector,{fontSize:style.fontSize,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,fontWeight:style.fontWeight,fontFamily:style.fontFamily,gap:style.gap,width:round(bounds.width),height:round(bounds.height)}];
 }));
}
function effectiveRadius(f,cover){
 const value=f.w.getComputedStyle(cover).borderTopLeftRadius||f.w.getComputedStyle(cover).borderRadius;
 const [x,y=x]=String(value).split('/').map(part=>parseFloat(part));
 const match=cover.style.transform.match(/scale\(([-.\d]+)(?:,\s*([-.\d]+))?\)/);
 return[round(x*(match?Number(match[1]):1)),round(y*(match?Number(match[2]||match[1]):1))];
}
for(const width of [390,1180]){
 test(`preview-native header metrics and widths survive every projection phase at ${width}px (bounded double)`,()=>{
  const f=bootEndpoint(width);try{
   const article=f.$('[data-content-id="thoughts-long"]'),original=[...article.querySelectorAll('*')],body=article.querySelector('.detail-body');
   const before=metrics(f,article);
   f.w.contentStudy.open('thoughts-long',{push:false});
   const bodyWidth=article.style.getPropertyValue('--body-width');
   for(const progress of [0,.001,.01,.04,.3,.7,1,.7,.04,.01,.001,0]){
    f.w.contentStudy.seek(progress);
    assert.deepEqual(metrics(f,article),before,`source typography/wrapping must already own the painted header at progress=${progress}`);
    assert.deepEqual([...article.querySelectorAll('*')],original,'native article subtree must remain identical');
    assert.equal(article.querySelector('.detail-body'),body);
    assert.equal(article.style.getPropertyValue('--body-width'),bodyWidth,'body layout must stay at its native reading width');
    assert.doesNotMatch(body.style.transform,/scale/);
    for(const selector of TEXT.filter(selector=>article.querySelector(selector)))assert.notEqual(f.w.getComputedStyle(article.querySelector(selector)).visibility,'hidden',`${selector} cannot mask an endpoint switch`);
   }
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.deepEqual(metrics(f,article),before,'release must not change source-native type/width');
   assert.deepEqual([...article.querySelectorAll('*')],original);
  }finally{f.close();}
 });
 test(`cancelled return and responsive source width retain native header ownership at ${width}px (bounded double)`,async()=>{
  const f=bootEndpoint(width);try{
   const article=f.$('[data-content-id="work-context"]'),original=[...article.querySelectorAll('*')],body=article.querySelector('.detail-body');
   const before=metrics(f,article);
   f.w.contentStudy.open('work-context',{push:false});f.settle();
   const bodyWidth=article.style.getPropertyValue('--body-width');
   f.w.contentStudy.close('test',{history:false});f.w.contentStudy.advance(.04);
   const reversing=f.w.contentStudy.snapshot();
   assert.ok(reversing.velocity.progress<0,'exercise a moving return, not a stationary seek');
   f.w.contentStudy.open('work-context',{push:false});
   assert.deepEqual(f.w.contentStudy.snapshot().velocity,reversing.velocity,'same-card reversal keeps current velocity');
   assert.deepEqual(metrics(f,article),before,'reversal cannot reset typography to reading styles');
   // Change the available native column width without inventing a new browser
   // media/layout engine. Both widths remain in their existing density profile.
   f.setFeedWidth(width<=650?326:964);
   f.w.dispatchEvent(new f.w.Event('resize'));
   await new Promise(resolve=>setTimeout(resolve,110));
   const preview=f.$('#canvas .projection-preview'),responsive=metrics(f,preview);
   assert.notEqual(responsive.h2.width,before.h2.width,'the source width really changed');
   assert.deepEqual(metrics(f,article),responsive,'resized painted text must adopt the actual responsive source width');
   assert.equal(article.style.getPropertyValue('--body-width'),bodyWidth,'source retargeting leaves native reading-body width alone');
   for(const progress of [.04,.001,0]){f.w.contentStudy.seek(progress);assert.deepEqual(metrics(f,article),responsive);}
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.deepEqual(metrics(f,article),responsive,'post-resize release cannot introduce a second rewrap');
   assert.deepEqual([...article.querySelectorAll('*')],original);
   assert.equal(article.querySelector('.detail-body'),body);
  }finally{f.close();}
 });
 test(`final projected frame equals released typography and visibility at ${width}px (bounded double)`,()=>{
  const f=bootEndpoint(width);try{
   const article=f.$('[data-content-id="work-context"]');let projected,released;
   f.w.addEventListener('personalos:content-transition',event=>{
    const e=event.detail;
    if(e.action==='progress'&&e.phase==='return'&&e.progress===0)projected={metrics:metrics(f,article),open:f.w.getComputedStyle(article.querySelector('.open-label')).visibility};
    if(e.action==='returned')released={metrics:metrics(f,article),open:f.w.getComputedStyle(article.querySelector('.open-label')).visibility};
   });
   f.w.contentStudy.open('work-context',{push:false});f.settle();
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.ok(projected,'must sample the exact projected endpoint before release');assert.ok(released,'must sample the released original nodes');
   assert.deepEqual(projected,released,'release is ownership-only, never a typography/visibility commit');
  }finally{f.close();}
 });
 test(`cover artwork, source radius and Open + survive the zero-progress handoff at ${width}px (bounded double)`,()=>{
  const f=bootEndpoint(width);try{
   const article=f.$('[data-content-id="labs-spring"]'),cover=article.querySelector('.card-visual'),svg=cover.querySelector('svg'),open=article.querySelector('.open-label');
   const aspect=svg.getAttribute('preserveAspectRatio'),radius=effectiveRadius(f,cover),visibility=f.w.getComputedStyle(open).visibility;
   const label=cover.querySelector('.visual-label'),labelWidth=label.getBoundingClientRect().width;
   f.w.contentStudy.open('labs-spring',{push:false});
   for(const progress of [0,.01,.7,1,.7,.01,0]){
    f.w.contentStudy.seek(progress);
    const actual={aspect:svg.getAttribute('preserveAspectRatio'),visibility:f.w.getComputedStyle(open).visibility};
    const expected={aspect,visibility};
    if(progress===0){actual.radius=effectiveRadius(f,cover);expected.radius=radius;}
    assert.deepEqual(actual,expected,'authored artwork, Open + and the source crop already match before release');
    // The real absolute label is shrink-to-fit: an auto width could unwrap as
    // the crop grows. Require its captured source width explicitly, without
    // pretending this bounded fixture implements browser inline formatting.
    assert.equal(parseFloat(label.style.width),labelWidth,'cover growth must not change the label line-breaking width');
   }
   f.w.contentStudy.close('test',{history:false});f.settle();
   assert.equal(cover.querySelector('svg'),svg);assert.equal(svg.getAttribute('preserveAspectRatio'),aspect);
   assert.deepEqual(effectiveRadius(f,cover),radius);assert.equal(f.w.getComputedStyle(open).visibility,visibility);
  }finally{f.close();}
 });
}

test('narrow long cover label retains its source wrapping while its crop expands (bounded double)',()=>{
 const f=bootEndpoint(360);try{
  const article=f.$('[data-content-id="work-structure"]'),label=article.querySelector('.visual-label');
  const before=metrics(f,article)['.visual-label'],line=parseFloat(before.lineHeight);
  assert.equal(before.height,line*2,'exercise the authored long label in a two-line source crop');
  f.w.contentStudy.open('work-structure',{push:false});
  for(const progress of [0,.01,.04,.5,1,.5,.04,.01,0]){
   f.w.contentStudy.seek(progress);
   assert.deepEqual(metrics(f,article)['.visual-label'],before,'independent cover growth must not rewrap the one painted label');
  }
  f.w.contentStudy.seek(1);
  const pinned=label.style.width;label.style.removeProperty('width');
  assert.equal(metrics(f,article)['.visual-label'].height,line,'the regression would detect the old auto-width one-line reader state');
  label.style.width=pinned;
  f.w.contentStudy.close('test',{history:false});f.settle();
  assert.deepEqual(metrics(f,article)['.visual-label'],before,'release retains the same two source lines');
 }finally{f.close();}
});
