/* Original spatial path and distance clock. The cache is per transaction;
 * no DOM measurements, clocks or allocations are needed to build it per frame. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cubic=(a,b,c,d,t)=>{const q=1-t;return q*q*q*a+3*q*q*t*b+3*q*t*t*c+t*t*t*d;};
export const SEND_PATH=Object.freeze({duration:.32,samples:160,bowMax:40,bowPerVerticalPixel:.08,control1X:.78,control2Y:.62});
export function createSendPath(source,target,bounds=null){
 const x0=source.anchorX,y0=source.textY,x3=target.anchorX,y3=target.textY,dx=x3-x0,dy=y3-y0;
 const lower=bounds?.left??Math.min(x0,x3)-48,upper=bounds?.right??Math.max(x0,x3)+48;
 const rightRoom=upper-x0,leftRoom=x0-lower;
 const direction=Math.abs(dx)>=24?Math.sign(dx):(rightRoom>=leftRoom?1:-1);
 const bow=Math.min(SEND_PATH.bowMax,Math.abs(dy)*SEND_PATH.bowPerVerticalPixel);
 const x1=clamp(x0+direction*Math.max(Math.abs(dx)*SEND_PATH.control1X,bow),lower,upper),x2=x3,y1=y0,y2=y0+dy*SEND_PATH.control2Y;
 const point=t=>({x:cubic(x0,x1,x2,x3,t),y:cubic(y0,y1,y2,y3,t)});
 const table=[{t:0,length:0}],steps=SEND_PATH.samples;let previous=point(0),length=0;
 for(let i=1;i<=steps;i++){const p=point(i/steps);length+=Math.hypot(p.x-previous.x,p.y-previous.y);table.push({t:i/steps,length});previous=p;}
 return{source:{x:x0,y:y0},target:{x:x3,y:y3},control1:{x:x1,y:y1},control2:{x:x2,y:y2},table,length,point};
}
export function sampleSendPath(path,progress){
 // GSAP sine.inOut distance profile; parameter inversion keeps total 2D
 // velocity independent of control-point spacing, with a visible slow arrival.
 const p=clamp(progress,0,1),distance=(1-Math.cos(Math.PI*p))/2;
 if(p===0)return{...path.source,distance:0};if(p===1||path.length<1e-6)return{...path.target,distance:1};
 const wanted=distance*path.length,table=path.table;let lo=0,hi=table.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid].length<wanted)lo=mid;else hi=mid;}
 const a=table[lo],b=table[hi],fraction=(wanted-a.length)/Math.max(1e-9,b.length-a.length),t=a.t+(b.t-a.t)*fraction;
 return{...path.point(t),distance};
}
