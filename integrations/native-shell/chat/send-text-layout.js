/* Width is native/intrinsic; visual layers never change their line layout. */
export const sameTextLayout=(a,b)=>!!a&&!!b&&Math.abs(a.height-b.height)<.5&&a.lineWidths.length===b.lineWidths.length&&a.lineWidths.every((w,i)=>Math.abs(w-b.lineWidths[i])<.5);
const smooth=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p);};
export const sendLayoutBlend=p=>smooth((p-.62)/.28);
export function paintedTextWindow(frame,layer,align,fullSource,fullTarget,panel){
 const inkWidth=layer.metrics?.maxLine??layer.width;
 let anchorX=frame.anchorX;
 // A wider old layout may need a few pixels of room while it fades into a
 // narrower native layout. Keep that ink inside the real panel, without scale.
 if(panel&&fullSource&&fullTarget){const lo=panel.x+inkWidth*align,hi=panel.x+panel.w-inkWidth*(1-align);if(lo<=hi)anchorX=Math.max(lo,Math.min(hi,anchorX));}
 let left=frame.clipX+anchorX-frame.anchorX,top=frame.clipY,right=left+frame.clipW,bottom=top+frame.clipH;
 if(fullSource&&fullTarget){left=Math.min(left,anchorX-inkWidth*align);right=Math.max(right,anchorX+inkWidth*(1-align));top=Math.min(top,frame.textY);bottom=Math.max(bottom,frame.textY+layer.height);}
 return{anchorX,x:left,y:top,w:Math.max(0,right-left),h:Math.max(0,bottom-top)};
}

// Conservative painted-window bounds; no DOM read or clock is needed here.
export function outgoingWindowClearsComposer(frame,composer){
 if(!composer)return false;const scale=frame.scale??1,cx=frame.clipX+frame.clipW/2,cy=frame.clipY+frame.clipH/2;
 const left=cx-frame.clipW*scale/2,right=cx+frame.clipW*scale/2,top=cy-frame.clipH*scale/2,bottom=cy+frame.clipH*scale/2;
 return right<=composer.x||left>=composer.x+composer.w||bottom<=composer.y||top>=composer.y+composer.h;
}
