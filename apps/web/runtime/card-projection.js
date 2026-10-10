/* Independent live-DOM projection, inspired by Motion's public MIT App Store
 * fixture. No Motion+ source, demo photographs, React runtime or extra clock.
 * See vendor/motion/NOTICE.md for the pinned reference and license.
 */
const clamp01 = value => Math.max(0, Math.min(1, value));
const mix = (from, to, progress) => from + (to - from) * progress;
const box = node => {
 const r = node.getBoundingClientRect();
 return {x:r.x, y:r.y, w:r.width, h:r.height};
};
const typeProperties = ['font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-feature-settings','font-variation-settings','font-kerning','line-height','letter-spacing','word-spacing','text-transform','text-indent','text-align','white-space','overflow-wrap','word-break','text-wrap','direction','column-gap','row-gap','flex-wrap','align-items','justify-content'];
const number = value => Number.parseFloat(value) || 0;

export function createCardProjection(entry) {
 const {article, identity} = entry;
 const elements = [...identity.children];
 const allNodes = [identity, ...identity.querySelectorAll('*')];
 const styles = new Map(allNodes.map(node => [node, node.style.cssText]));
 const originalCover = identity.querySelector('.card-visual');
 const textBlocks = elements.filter(node => node !== originalCover);
 const textNodes = textBlocks.flatMap(node => [node, ...node.querySelectorAll('*')]);
 const labels = [...(originalCover?.querySelectorAll('.visual-label') || [])];
 const art = [...(originalCover?.children || [])].filter(node => !labels.includes(node));
 let source = new Map(), typeStyles = new Map(), coverSource = null;
 let targets = new Map(), coverTarget = null, mounted = false;

 // This inert probe never paints. It preserves the actual per-card native
 // typography/line breaks, cover geometry and responsive preview composition.
 const preview = identity.cloneNode(true);
 preview.classList.add('projection-preview');
 preview.setAttribute('aria-hidden', 'true');
 preview.inert = true;
 for (const node of [preview, ...preview.querySelectorAll('*')]) {
  node.removeAttribute('id');
  node.removeAttribute('aria-labelledby');
  node.removeAttribute('aria-describedby');
 }
 preview.style.width = entry.lockedWidth+'px';
 preview.style.pointerEvents = 'none';
 preview.style.visibility = 'hidden';
 preview.style.opacity = '0';
 const previewSurface = document.createElement('div');
 previewSurface.className = 'card projection-preview-surface';
 previewSurface.dataset.category = article.dataset.category;
 previewSurface.dataset.previewDensity = article.dataset.previewDensity || 'regular';
 previewSurface.setAttribute('aria-hidden','true');
 previewSurface.inert = true;
 previewSurface.style.visibility = 'hidden';
 previewSurface.append(preview);
 const probeNodes = [preview, ...preview.querySelectorAll('*')];
 const peers = new Map(allNodes.map((node,index) => [node,probeNodes[index]]));

 function captureSource(root, peer) {
  const origin = box(root);
  source = new Map(elements.map(node => {
   const r = box(peer(node));
   return [node,{x:r.x-origin.x,y:r.y-origin.y,w:r.w,h:r.h}];
  }));
  typeStyles = new Map([...textNodes,...labels].map(node => {
   const css = getComputedStyle(peer(node));
   return [node,new Map(typeProperties.map(key => [key,css.getPropertyValue(key)]).filter(([,value]) => value))];
  }));
  if (originalCover) {
   const probeCover=peer(originalCover),r=box(probeCover),css=getComputedStyle(probeCover);
   const borders={left:number(css.borderLeftWidth),right:number(css.borderRightWidth),top:number(css.borderTopWidth),bottom:number(css.borderBottomWidth)};
   const inner={w:Math.max(1,r.w-borders.left-borders.right),h:Math.max(1,r.h-borders.top-borders.bottom)};
   coverSource={borders,inner,radius:number(css.borderTopLeftRadius || css.borderRadius),art:new Map(art.map(node => {
    const child=box(peer(node));
    return [node,{x:child.x-r.x-borders.left,y:child.y-r.y-borders.top,w:child.w,h:child.h}];
   })),labels:new Map(labels.map(node => {const c=getComputedStyle(peer(node));return [node,{left:c.left,bottom:c.bottom,width:box(peer(node)).w}];}))};
  }
 }
 function pinNativeText() {
  for (const [node,properties] of typeStyles) for (const [key,value] of properties) node.style.setProperty(key,value);
  // The same glyph layout travels in both directions. Only the reading body
  // adopts the wide reading column; header text never changes wrapping at land.
  for (const node of textBlocks) node.style.width=source.get(node).w+'px';
  for (const [node,anchor] of coverSource?.labels || []) {
   node.style.left=anchor.left;node.style.bottom=anchor.bottom;node.style.width=anchor.width+'px';
  }
 }
 captureSource(identity,node=>node);

 return {
  mount() {
   article.dataset.cardProjection = 'split';
   article.after(previewSurface);
   mounted = true;
  },
  retargetSource(width,density) {
   previewSurface.dataset.previewDensity=density;
   preview.style.width=width+'px';
   captureSource(preview,node=>peers.get(node));
   return preview.offsetHeight;
  },
  configure(width) {
   // Read one normal-flow destination, then hold its layout for this lease.
   // Restoring these styles is synchronous measurement, never a painted frame.
   for (const [node,css] of styles) node.style.cssText=css;
   identity.style.width=width+'px';
   identity.style.transform='none';
   pinNativeText();
   const root=box(identity);
   targets=new Map(elements.map(node => {const r=box(node);return [node,{x:r.x-root.x,y:r.y-root.y,w:r.w,h:r.h}];}));
   const height=identity.offsetHeight;
   if (originalCover) coverTarget={radius:number(getComputedStyle(originalCover).borderTopLeftRadius || getComputedStyle(originalCover).borderRadius)};
   identity.style.height=height+'px';
   for (const node of elements) {
    const target=targets.get(node);
    Object.assign(node.style,{position:'absolute',left:target.x+'px',top:target.y+'px',width:target.w+'px',margin:'0'});
    // Text remains intrinsically sized so late font/content changes can be
    // observed without the animated cover changing the header's flow each frame.
   }
   return height;
  },
  paint(pose) {
   const u=clamp01(pose.progress);
   identity.style.transform=`translate3d(${pose.ix}px,${pose.iy}px,0)`;
   for (const node of elements) {
    const from=source.get(node),to=targets.get(node);
    if (!to) continue;
    const dx=(from.x-to.x)*(1-u),dy=(from.y-to.y)*(1-u);
    node.style.transform=`translate3d(${dx}px,${dy}px,0)`;
    if (node===originalCover) {
     const w=mix(from.w,to.w,u),h=mix(from.h,to.h,u),b=coverSource.borders;
     node.style.width=w+'px';node.style.height=h+'px';
     node.style.borderRadius=mix(coverSource.radius,coverTarget.radius,u)+'px';
     const innerW=Math.max(1,w-b.left-b.right),innerH=Math.max(1,h-b.top-b.bottom);
     const scale=Math.max(innerW/coverSource.inner.w,innerH/coverSource.inner.h);
     const x=(innerW-coverSource.inner.w*scale)/2,y=(innerH-coverSource.inner.h*scale)/2;
     for (const child of art) {
      const plane=coverSource.art.get(child);
      // Preserve the authored native artwork plane (including SVG aspect policy)
      // and uniformly scale it behind a separately sized crop. At u=0 it is exact.
      Object.assign(child.style,{position:'absolute',left:x+plane.x*scale+'px',top:y+plane.y*scale+'px',width:plane.w+'px',height:plane.h+'px',transformOrigin:'0 0',transform:`scale(${scale})`});
     }
    } else node.style.opacity='1';
   }
  },
  release() {
   if (!mounted) return;
   mounted=false;
   previewSurface.remove();
   delete article.dataset.cardProjection;
   for (const [node,css] of styles) node.style.cssText=css;
  }
 };
}
