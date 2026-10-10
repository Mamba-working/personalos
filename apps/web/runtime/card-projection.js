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

export function createCardProjection(entry) {
 const {article, identity} = entry;
 const origin = box(identity);
 const elements = [...identity.children];
 const styles = new Map([identity, ...elements, ...identity.querySelectorAll('.card-visual > *')].map(node => [node, node.style.cssText]));
 const source = new Map(elements.map(node => {
  const r = box(node);
  return [node, {x:r.x-origin.x, y:r.y-origin.y, w:r.w, h:r.h}];
 }));
 // A permanently hidden geometry probe measures responsive preview typography.
 // It never paints a second glyph layout or clones reader/lab controls.
 const preview = identity.cloneNode(true);
 preview.classList.add('projection-preview');
 preview.setAttribute('aria-hidden', 'true');
 preview.inert = true;
 for (const node of [preview, ...preview.querySelectorAll('*')]) {
  node.removeAttribute('id');
  node.removeAttribute('aria-labelledby');
  node.removeAttribute('aria-describedby');
 }
 preview.querySelector('.card-visual')?.remove();
 preview.style.width = entry.lockedWidth+'px';
 preview.style.pointerEvents = 'none';
 preview.style.visibility = 'hidden';
 preview.style.opacity = '0';
 // Preserve the exact original spacing without rendering another cover.
 const originalCover = identity.querySelector('.card-visual');
 const coverSVG=originalCover?.querySelector('svg');
 const originalAspect=coverSVG?.getAttribute('preserveAspectRatio');
 if (originalCover) {
  const spacer = document.createElement('div');
  spacer.className = 'card-visual';
  spacer.style.visibility = 'hidden';
  preview.querySelector('.card-foot')?.before(spacer);
 }
 const previewSurface=document.createElement('div');
 previewSurface.className='card projection-preview-surface';
 previewSurface.dataset.category=article.dataset.category;
 previewSurface.dataset.previewDensity=article.dataset.previewDensity||'regular';
 previewSurface.setAttribute('aria-hidden','true');previewSurface.inert=true;
 previewSurface.style.visibility='hidden';
 previewSurface.append(preview);
 let targets = new Map(), mounted = false;
 return {
  mount() {
   article.dataset.cardProjection = 'split';
   coverSVG?.setAttribute('preserveAspectRatio','xMidYMid slice');
   article.after(previewSurface);
   mounted = true;
  },
  retargetSource(width,density) {
   previewSurface.dataset.previewDensity=density;
   preview.style.width=width+'px';
   const transform=preview.style.transform;
   preview.style.transform='none';
   const root=box(preview),children=[...preview.children];
   elements.forEach((node,index)=>{const r=box(children[index]);source.set(node,{x:r.x-root.x,y:r.y-root.y,w:r.w,h:r.h});});
   const height=preview.offsetHeight;
   preview.style.transform=transform;
   return height;
  },
  configure(width) {
   identity.style.width = width+'px';
   identity.style.transform = 'none';
   for (const node of elements) node.style.transform = 'none';
   const root = box(identity);
   targets = new Map(elements.map(node => {
    const r = box(node);
    return [node, {x:r.x-root.x, y:r.y-root.y, w:r.w, h:r.h}];
   }));
   return identity.offsetHeight;
  },
  paint(pose) {
   const u = clamp01(pose.progress);
   // Identity is translation-only. Reading typography is laid out at its final
   // width before the first frame and never inherits shell/cover scale.
   identity.style.transform = `translate3d(${pose.ix}px,${pose.iy}px,0)`;
   preview.style.transform = `translate3d(${pose.ix}px,${pose.iy}px,0)`;
   for (const node of elements) {
    const from = source.get(node), to = targets.get(node);
    if (!to) continue;
    const dx = (from.x-to.x)*(1-u), dy = (from.y-to.y)*(1-u);
    if (node === originalCover) {
     const sx = Math.max(.001, mix(from.w/Math.max(1,to.w), 1, u));
     const sy = Math.max(.001, mix(from.h/Math.max(1,to.h), 1, u));
     node.style.transformOrigin = '0 0';
     node.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`;
     node.style.borderRadius = `${12/sx}px / ${12/sy}px`;
     for (const child of node.children) {
      // Graphics use one uniform visual scale under a separately projected crop.
      // Cover labels keep their glyph dimensions as the frame changes aspect.
      const scale = child.classList.contains('visual-label') ? 1 : Math.max(sx,sy);
      child.style.transformOrigin = 'center';
      child.style.transform = `scale(${scale/sx},${scale/sy})`;
     }
    } else {
     node.style.transform = `translate3d(${dx}px,${dy}px,0)`;
     // One visible text identity; no overlapping preview/final crossfade.
     node.style.opacity = '1';
    }
   }
  },
  release() {
   if (!mounted) return;
   mounted = false;
   previewSurface.remove();
   delete article.dataset.cardProjection;
   if(coverSVG){if(originalAspect===null)coverSVG.removeAttribute('preserveAspectRatio');else coverSVG.setAttribute('preserveAspectRatio',originalAspect);}
   for (const [node, css] of styles) node.style.cssText = css;
  }
 };
}
