// Pure rectangle oracle. Browser collection below uses actual text Range rects;
// unit callers must explicitly describe their rectangles as synthetic geometry.
// 1e-7 CSS px removes IEEE-754 edge noise, far below rendered subpixel precision.
export function intersection(a,b){if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.w,b.x+b.w),bottom=Math.min(a.y+a.h,b.y+b.h);return right-x>1e-7&&bottom-y>1e-7?{x,y,w:right-x,h:bottom-y}:null;}
export function readingClearance({reader,textRects,obstacles,shelf}){
 const visible=textRects.map(r=>intersection(r,reader)).filter(Boolean),collisions=[];
 visible.forEach((ink,index)=>{for(const [name,rect]of Object.entries(obstacles)){const overlap=intersection(ink,rect);if(overlap&&overlap.w*overlap.h>.5)collisions.push({index,name,ink,overlap});}});
 const contained=shelf&&Object.entries(obstacles).filter(([name])=>name!=='close').every(([,r])=>r.x>=shelf.x-.5&&r.y>=shelf.y-.5&&r.x+r.w<=shelf.x+shelf.w+.5&&r.y+r.h<=shelf.y+shelf.h+.5);
 const captionRingOverlap=intersection(obstacles.caption,obstacles.focusRing);
 return{readerStartsBelowClose:!obstacles.close||reader.y>=obstacles.close.y+obstacles.close.h-.5,visibleLines:visible.length,collisions,clear:collisions.length===0&&!captionRingOverlap,captionClearOfFocusRing:!captionRingOverlap,shelfContainsObstacles:!!contained,readerEndsAboveShelf:!!shelf&&reader.y+reader.h<=shelf.y+.5};
}
// This self-contained function can be passed directly to page.evaluate. It reads
// production geometry only; it does not change scroll, styles, clocks or handlers.
export function collectReadingGeometry(){
 const rect=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};},reader=document.querySelector('#reader'),body=document.querySelector('#canvas .detail-body'),shelf=document.querySelector('#reader-assistant-rail'),button=document.querySelector('#world-ball-hit'),caption=button?.querySelector('.ball-hint');
 const textRects=[];const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);for(let n=walker.nextNode();n;n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const b of range.getClientRects())if(b.width>0&&b.height>0)textRects.push({x:b.x,y:b.y,w:b.width,h:b.height});}
 const screen=window.personalOSWorld.getState().world.screen,obstacles={actor:{x:screen.x-screen.r,y:screen.y-screen.r,w:2*screen.r,h:2*screen.r},button:rect(button),caption:rect(caption),close:rect(document.querySelector('#close'))};const style=getComputedStyle(body),captionStyle=getComputedStyle(caption),buttonStyle=getComputedStyle(button);
 if(button.matches(':focus-visible')&&buttonStyle.outlineStyle!=='none'){const size=Math.max(0,parseFloat(buttonStyle.outlineWidth)||0)+Math.max(0,parseFloat(buttonStyle.outlineOffset)||0),b=obstacles.button;if(size)obstacles.focusRing={x:b.x-size,y:b.y-size,w:b.w+size*2,h:b.h+size*2};}
 return{reader:rect(reader),textRects,obstacles,shelf:shelf&&!shelf.hidden?rect(shelf):null,scrollTop:reader.scrollTop,scrollHeight:reader.scrollHeight,clientHeight:reader.clientHeight,phase:window.personalOSContent.getState().phase,body:{width:rect(body).w,fontSize:style.fontSize,fontFamily:style.fontFamily,lineHeight:style.lineHeight,transform:style.transform},buttonAvailable:buttonStyle.visibility!=='hidden'&&buttonStyle.display!=='none'&&!button.closest('[inert]'),captionVisible:captionStyle.visibility!=='hidden'&&captionStyle.display!=='none',actorUUID:window.personalOSWorld.getState().world.actorUUID,canvasCount:document.querySelectorAll('#world-stage canvas').length};
}
