import {inspectPng} from './png-check.mjs';

// Playwright applies this only during capture and restores it afterward. Every
// excluded subtree and pseudo-element is hidden; real WebGL canvas stays live.
// Transparent canvas/ancestor CSS cannot supply gradients, borders or shadows.
export const CANVAS_PROOF_STYLE = `
  html, body, #ball-world-root, #world-stage, #world-stage canvas {
    background:transparent!important; background-image:none!important;
    border-color:transparent!important; outline-color:transparent!important; box-shadow:none!important;
  }
  body > :not(#ball-world-root), body > :not(#ball-world-root) *,
  #ball-world-root > :not(#world-stage), #ball-world-root > :not(#world-stage) * {
    visibility:hidden!important;
  }
  html::before, html::after, body::before, body::after,
  #ball-world-root::before, #ball-world-root::after,
  #world-stage::before, #world-stage::after {visibility:hidden!important;}
`;
export async function captureCanvasProof(canvas) {
  const layout=await canvas.page().evaluate(style => {
    const selectors=['html','body','#ball-world-root','#world-stage','#world-stage canvas','.app','.topbar','#content-root','#feed','#world-ball-hit'];
    const read=()=>selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map((node,index)=>{const r=node.getBoundingClientRect();return {selector,index,x:r.x,y:r.y,w:r.width,h:r.height};}));
    const before=read(),tag=document.createElement('style');tag.textContent=style;document.head.append(tag);
    const during=read();tag.remove();const after=read();
    const maxDelta=Math.max(0,...before.flatMap((row,index)=>['x','y','w','h'].flatMap(key=>[Math.abs(row[key]-during[index][key]),Math.abs(row[key]-after[index][key])])));
    return {before,during,after,maxDelta,sameJavaScriptTurn:true,layoutMutation:false,visibilityOnlyPaintIsolation:true};
  }, CANVAS_PROOF_STYLE);
  if(layout.maxDelta>.01) throw new Error('CANVAS_CAPTURE_LAYOUT_CHANGED: isolated CSS moved source geometry');
  const image=await canvas.screenshot({omitBackground:true, style:CANVAS_PROOF_STYLE});
  return {image,pixels:inspectPng(image),layout};
}
export function requireRenderedPixels(pixels) {
  if (!(pixels.visibleFraction>.02 && pixels.quantizedColors>20)) {
    throw new Error('RENDER_PIXELS: isolated renderer output is blank/solid');
  }
}
