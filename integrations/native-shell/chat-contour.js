/**
 * A local two-lobe material contour, not a scaled DOM rectangle.
 * The rounded body and anchored capsule overlap at the body centre; their
 * polynomial smooth union is star-shaped there, so bounded radial sampling
 * produces one closed outline without marching an entire screen texture.
 * CSS pixels throughout. These are authored parameters, not Apple constants.
 */
export const CHAT_CONTOUR = Object.freeze({
  samples: 128, searchSteps: 13, bodySizeLag: .4,
  neckRadius: 14, unionSoftness: 14, cornerExtra: 58,
  releaseStart: .58, releaseEnd: .91, finalRadius: 24
});
const clamp = x => Math.max(0, Math.min(1, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const centre = r => ({ x: r.x+r.w/2, y: r.y+r.h/2 });
function roundedBox(x, y, box, radius) {
  const qx = Math.abs(x-box.x-box.w/2)-box.w/2+radius;
  const qy = Math.abs(y-box.y-box.h/2)-box.h/2+radius;
  return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
}
function capsule(x, y, a, b, radius) {
  const dx=b.x-a.x, dy=b.y-a.y, length=dx*dx+dy*dy;
  const t=length ? clamp(((x-a.x)*dx+(y-a.y)*dy)/length) : 0;
  return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)-radius;
}
function smoothUnion(a,b,k) {
  if(k<.001)return Math.min(a,b);
  const h=Math.max(k-Math.abs(a-b),0)/k;
  return Math.min(a,b)-h*h*k*.25;
}
const n = value => Number(value.toFixed(3));
export function chatContourPath(points) {
  const len=points.length;
  const midpoint=(a,b)=>`${n((a.x+b.x)/2)} ${n((a.y+b.y)/2)}`;
  return `M ${midpoint(points[len-1],points[0])} `+points.map((p,i)=>
    `Q ${n(p.x)} ${n(p.y)} ${midpoint(p,points[(i+1)%len])}`).join(' ')+' Z';
}
export function describeChatContour(pose, actor, parameters=CHAT_CONTOUR) {
  const p=clamp(pose.p), envelope=p===0||p===1?0:Math.sin(Math.PI*p), a=centre(actor), c=centre(pose);
  const lag=Math.pow(p,parameters.bodySizeLag);
  const w=Math.max(1,mix(actor.w,pose.w,lag)), h=Math.max(1,mix(actor.h,pose.h,lag));
  const body={x:c.x-w/2,y:c.y-h/2,w,h};
  const release=smooth(parameters.releaseStart,parameters.releaseEnd,p);
  // The source lobe joins the body locally, then disappears inside it. Its
  // shoulder migrates into the body instead of leaving a thinning needle.
  const source={x:mix(a.x,c.x,release),y:mix(a.y,c.y,release)};
  const r=Math.min(actor.w/2,parameters.neckRadius)*(1-release);
  const radius=Math.min(w/2,h/2,parameters.finalRadius+parameters.cornerExtra*envelope);
  const softness=parameters.unionSoftness*(1-release)*envelope;
  const field=(x,y)=>smoothUnion(roundedBox(x,y,body,radius),capsule(x,y,source,c,r),softness);
  const reach=Math.hypot(w,h)/2+Math.hypot(source.x-c.x,source.y-c.y)+r+softness+2;
  const points=[];
  for(let i=0;i<parameters.samples;i++){
    const angle=i*2*Math.PI/parameters.samples, dx=Math.cos(angle),dy=Math.sin(angle);
    let lo=0,hi=reach;
    for(let j=0;j<parameters.searchSteps;j++){
      const mid=(lo+hi)/2;
      if(field(c.x+dx*mid,c.y+dy*mid)<=0)lo=mid;else hi=mid;
    }
    points.push({x:c.x+dx*(lo+hi)/2,y:c.y+dy*(lo+hi)/2});
  }
  const xs=points.map(v=>v.x),ys=points.map(v=>v.y);
  const bounds={x:Math.min(...xs)-1,y:Math.min(...ys)-1,w:Math.max(...xs)-Math.min(...xs)+2,h:Math.max(...ys)-Math.min(...ys)+2};
  const local=points.map(v=>({x:v.x-bounds.x,y:v.y-bounds.y}));
  return {kind:'anchored-smooth-union',progress:p,bounds,path:chatContourPath(local),points,
    body,source:{...source,radius:r},radius,softness,neckActive:release<1&&p>.001&&p<.91};
}
