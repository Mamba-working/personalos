// Deliberately bounded DOM/GSAP/scroll doubles for Node contract tests.
// Production reading-flow and fluid-send code execute unchanged. This does not
// simulate browser layout, keyboard, painting, popover support or native scroll.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// A deterministic measurement double, not a browser text-shaping engine.
// CJK/emoji use 16px, Latin uses 8px; production uses real Range rectangles.
const segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});
const glyphWidth=g=>/[\p{Script=Han}\p{Extended_Pictographic}\u3000-\u303f\uff00-\uffef]/u.test(g)?16:8;
const lineInk=text=>[...segmenter.segment(text)].reduce((sum,{segment})=>sum+glyphWidth(segment),0);
function lineWidths(text,width){const result=[];for(const line of text.split('\n')){let used=0;for(const {segment}of segmenter.segment(line)){const w=glyphWidth(segment);if(used+w>width&&used){result.push(used);used=0;}used+=w;}result.push(used);}return result;}
class Style {
 constructor(){this.values=new Map();}
 setProperty(k,v,p=''){this.values.set(k,{v:String(v),p});this[k]=String(v);}
 removeProperty(k){this.values.delete(k);delete this[k];}
 getPropertyValue(k){return this.values.get(k)?.v||this[k]||'';}
 getPropertyPriority(k){return this.values.get(k)?.p||'';}
}
class Element {
 constructor(doc,tag='div'){this.ownerDocument=doc;this.tagName=tag;this.nodeType=1;this.children=[];this.style=new Style();this.dataset={};this.attributes=new Map();this.hidden=false;this._text='';this.parentNode=null;this.scrollTop=0;this.clientWidth=400;this.clientHeight=480;this.clientTop=0;this.clientLeft=0;this.listeners=new Map();this.className='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');},toggle:(name,on)=>{const set=new Set(this.className.split(' '));if(on)set.add(name);else set.delete(name);this.className=[...set].filter(Boolean).join(' ');}};}
 get isConnected(){return this===this.ownerDocument.body||this===this.ownerDocument.head||!!this.parentNode?.isConnected;}
 get firstChild(){return this._text?{nodeType:3,textContent:this._text,parentNode:this}:this.children[0]||null;}
 set textContent(v){this._text=String(v);this.replaceChildren();}
 get textContent(){return this._text+this.children.map(n=>n.textContent||'').join('');}
 prepend(...nodes){for(const node of [...nodes].reverse()){node.remove();node.parentNode=this;this.children.unshift(node);}}
 append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
 before(node){const parent=this.parentNode;if(!parent)throw Error('No parent');node.remove();node.nativeRect=this.getBoundingClientRect();node.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,node);}
 remove(){if(this.parentNode){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
 setAttribute(k,v){this.attributes.set(k,String(v));if(k==='id')this.id=String(v);if(k==='class')this.className=String(v);}
 getAttribute(k){return this.attributes.has(k)?this.attributes.get(k):null;}
 removeAttribute(k){this.attributes.delete(k);if(k==='style')this.style=new Style();}
 addEventListener(k,fn){const list=this.listeners.get(k)||new Set();list.add(fn);this.listeners.set(k,list);}
 removeEventListener(k,fn){this.listeners.get(k)?.delete(fn);}
 matches(selector){if(selector===':popover-open')return !!this.popoverOpen;if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return selector.slice(1).split('.').every(c=>this.className.split(' ').includes(c));return this.tagName===selector;}
 closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
 querySelector(selector){for(const child of this.children){if(child.matches(selector))return child;const nested=child.querySelector(selector);if(nested)return nested;}return null;}
 querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 showPopover(){this.popoverOpen=true;}
 hidePopover(){this.popoverOpen=false;}
 getBoundingClientRect(){let r=this.nativeRect||{x:0,y:0,width:100,height:44};if(this.matches('.message.user')){const intrinsic=Math.max(...this._text.split('\n').map(lineInk))+28;const width=this.style.width==='fit-content'?Math.min(intrinsic,this.ownerDocument.userMaxWidth*.84):Math.min(this.ownerDocument.userMaxWidth,parseFloat(this.style.width)||this.ownerDocument.userWidth);const lines=lineWidths(this._text,Math.max(8,width-28)).length;r={x:this.ownerDocument.messageRight-width,y:140,width,height:lines*24+20};}else if(this.style.left==='-100000px'){const width=parseFloat(this.style.width)||100;r={x:-100000,y:0,width,height:lineWidths(this._text,width).length*24};}if(this.popoverOpen){const m=this.style.transform?.match(/translate3d\(([-.\d]+)px,\s*([-.\d]+)px/);r={x:m?+m[1]:0,y:m?+m[2]:0,width:parseFloat(this.style.width)||r.width,height:parseFloat(this.style.height)||r.height};}return{...r,left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height};}
}
function createDocument(){const listeners=new Map();const doc={hidden:false,userWidth:210,userMaxWidth:380,messageRight:500,createElement:tag=>new Element(doc,tag),createElementNS:(_ns,tag)=>new Element(doc,tag),createRange(){let node,start=0,end=0;return{selectNodeContents(n){node=n;},getClientRects(){const width=parseFloat(node.style.width)||318;return lineWidths(node.textContent,width).map(w=>({width:w,height:24}));},setStart(n,s){node=n;start=s;},setEnd(_n,e){end=e;},getBoundingClientRect(){const b=node.parentNode.getBoundingClientRect();return{x:b.x+8+start*8,y:b.y+8,width:Math.max(1,end-start)*8,height:24};}};},addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};doc.body=new Element(doc,'body');doc.head=new Element(doc,'head');doc.defaultView={innerWidth:1000,innerHeight:800,location:{search:''},getComputedStyle:(node,pseudo)=>({fontFamily:'fixture-system',fontSize:'16px',fontWeight:'400',fontStyle:'normal',fontStretch:'normal',fontVariant:'normal',lineHeight:'24px',letterSpacing:'0px',wordSpacing:'0px',textAlign:'start',direction:'ltr',textTransform:'none',tabSize:'8',overflowWrap:'break-word',wordBreak:'normal',color:'rgb(32,33,35)',backgroundColor:node.matches('.message.user')?'rgb(234,234,236)':'rgb(255,255,255)',borderTopColor:'rgba(118,122,130,1)',borderTopWidth:pseudo?'1px':'0px',borderTopLeftRadius:pseudo?'24px':'18px',boxShadow:'none',padding:'10px 14px',marginTop:'0px',marginRight:'0px',marginBottom:'0px',marginLeft:'0px',paddingLeft:node.tagName==='textarea'?'0px':'14px',paddingRight:node.tagName==='textarea'?'0px':'14px',paddingTop:'10px',paddingBottom:'10px'}),addEventListener(){},removeEventListener(){}};return doc;}
function createGSAP(){const tweens=[];return{tweens,ticker:{add(){},remove(){}},to(proxy,config){const t={proxy,config,duration:config.duration,elapsed:0,killed:false,done:false,kill(){this.killed=true;}};tweens.push(t);return t;},advance(seconds){for(const t of [...tweens]){if(t.killed||t.done)continue;t.elapsed+=seconds;t.proxy.p=Math.min(1,t.elapsed/t.duration);t.config.onUpdate?.();if(t.elapsed>=t.duration&&!t.killed){t.done=true;t.config.onComplete?.();}}}};}
export async function loadFlow(flowPath,projectionPath,key){
 const source=fs.readFileSync(flowPath,'utf8').replace("import {createChatTurnScroll} from './chat-turn-scroll.js';",`const createChatTurnScroll=globalThis[${JSON.stringify(key)}];`).replace("from './send-continuity.js'",`from ${JSON.stringify(pathToFileURL(projectionPath).href)}`);
 return(await import('data:text/javascript;base64,'+Buffer.from(source+'\n//# sourceURL='+key+'.js').toString('base64'))).createReadingChatFlow;
}
export async function fixture({flowPath,projectionPath,hostSource,label}){
 const doc=createDocument(),gsap=createGSAP(),timers=[],scrollCalls=[],users=[];let reduce=false,flow,open=true,activity='idle',id=0,hostCommits=0;const key='__sendCommitScroll_'+label;
 const panel=doc.createElement('section');doc.body.append(panel);const plane=doc.createElement('div');plane.nativeRect={x:100,y:80,width:420,height:600};panel.append(plane);const scrollHost=doc.createElement('div');scrollHost.nativeRect={x:100,y:140,width:420,height:480};plane.append(scrollHost);const messages=doc.createElement('div');messages.id='messages';scrollHost.append(messages);const composer=doc.createElement('div');composer.className='composer-wrap';composer.nativeRect={x:112,y:622,width:396,height:54};plane.append(composer);const field=doc.createElement('div');field.className='composer-field';field.nativeRect={x:112,y:622,width:344,height:54};composer.append(field);const input=doc.createElement('textarea');input.value='';input.nativeRect={x:125,y:627,width:318,height:44};input.clientWidth=318;input.clientHeight=44;field.append(input);const send=doc.createElement('button'),latest=doc.createElement('button');panel.append(send,latest);
 const anchors=new Map();const scroll={captureReadingAnchor:()=>({top:scrollHost.scrollTop}),restoreReadingAnchor:a=>scrollCalls.push(['restore',a.top]),appendTurn({node,user,deferUntilLayout}){messages.append(node);users.push(user);id++;scrollCalls.push(['append',id,deferUntilLayout]);return id;},setUserAnchor:(turn,user,anchor)=>anchors.set(turn,{user,anchor}),state:()=>({turnId:id,top:scrollHost.scrollTop,geometry:{target:0}}),layoutCommitted(){scrollCalls.push(['layout']);},resumeTurn(){},streamUpdated(){},finishTurn(){},cancelTurn(){},setOpen(){},preferencesChanged(){},readingViewportSettled(){},destroy(){},jumpToLatest(){}};
 globalThis[key]=()=>scroll;
 const createFlow=await loadFlow(flowPath,projectionPath,key);const ui={panel,input,send,field,latest,setSendState(){}};
 const layout={plane,scroll:scrollHost,messages,applyMode(mode){core.ctx.requestedMode=mode;}};
 const core={ctx:{layout,requestedMode:'empty',composerPin:false,responsive:false,alpha:{p:1,segment:null},regions:[{n:messages,alpha:1}],contourPose:null},canvas:{p:1,g:1,v:0,target:{x:100,y:80,w:420,h:600},presented:{x:100,y:80,w:420,h:600}},chatWanted:true,chatPhase:'open',shapeActive:()=>false,conversationScrollHost:()=>scrollHost};
 // Evaluate the exact production prepareConversationSend method. Only the
 // native DOM layout measurement is doubled; its flow commit remains singular.
 const method=hostSource.match(/prepareConversationSend\(\)\{[^\n]+\},/)?.[0];if(!method)throw Error('Production host method not found');
 function commitLayout(reason,anchor){hostCommits++;scrollCalls.push(['host',reason]);flow.layoutCommitted(anchor);}
 core.prepareConversationSend=()=>new Function('core','flow','layout','commitLayout',`return ({${method}}).prepareConversationSend();`)(core,flow,layout,commitLayout);
 flow=createFlow({ui,core,gsap,reduced:()=>reduce,getOpen:()=>open,toggleCanvas:()=>{},setAgent:next=>{activity=next;},resolveTopic:()=> 'work',answers:{work:'ok'},component:()=>'',evidence:()=>'',later(fn,delay){timers.push({fn,delay});return timers.length;},cancelTimers(){timers.length=0;},onState(){},fluidSend:true});
 return{setReduced(value){reduce=value;flow.preferencesChanged();},flow,projection:flow.sendProjection,doc,ui,core,gsap,users,messages,scrollCalls,get hostCommits(){return hostCommits;},get activity(){return activity;},flushResponse(){for(let i=0;timers.length&&i<20;i++)timers.shift().fn();if(timers.length)throw Error('Unbounded response timers');},send(text='hello'){input.value=text;return flow.send();},advance:seconds=>gsap.advance(seconds),resize({wrap=false}={}){flow.inputChanging();if(wrap)doc.userMaxWidth=150;doc.defaultView.innerWidth=800;flow.sendProjection.prepareNativeCommit();commitLayout('viewport',null);},close(){open=false;core.chatWanted=false;core.chatPhase='closing';flow.setOpen(false);flow.cancel();},hide(){core.ctx.alpha.p=0;panel.hidden=true;flow.sendProjection.paintPresented();},destroy(){flow.destroy();delete globalThis[key];}};
}
