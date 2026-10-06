import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {LIMITS,readKeyboardGeometry,createKeyboardRecorder,mountKeyboardDiagnostics} from '../../runtime/diagnostics/keyboard-diagnostics.js';
class Target {
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn,options){const a=this.listeners.get(type)||[];a.push({fn,options});this.listeners.set(type,a);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn));}
 emit(type,event={}){for(const {fn} of [...(this.listeners.get(type)||[])])fn(event);}
 get count(){return [...this.listeners.values()].reduce((a,b)=>a+b.length,0);}
}
function clock(){const win=new Target(),doc=new Target(),vv=new Target();let now=0,id=0;const timers=new Map(),frames=new Map();Object.assign(win,{visualViewport:vv,performance:{now:()=>now},requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},setTimeout(fn,ms){timers.set(++id,{at:now+ms,fn});return id;},clearTimeout(id){timers.delete(id);}});doc.visibilityState='visible';return{win,doc,vv,jumpWithoutTimers(ms){now+=ms;},advance(ms){const until=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>until)break;now=Math.max(now,next[1].at);timers.delete(next[0]);next[1].fn();}now=until;},frame(ms=16){this.advance(ms);const work=[...frames.values()];frames.clear();for(const fn of work)fn(now);},get pending(){return timers.size+frames.size;}};}
const read=()=>({viewport:{height:335,offsetTop:120},state:{activeElementType:'textarea'}});
test('query opt-in is required and does not touch DOM when absent',()=>{
 let touched=false;assert.equal(mountKeyboardDiagnostics({location:{search:''}},{querySelector(){touched=true;}}),null);assert.equal(touched,false);
 assert.equal(mountKeyboardDiagnostics({location:{search:'?keyboardDiagnostics=0'}},{querySelector(){touched=true;}}),null);assert.equal(touched,false);
});
test('construction never records/listens, explicit Start opens a bounded session',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});assert.equal(c.win.count+c.doc.count+c.vv.count,0);assert.equal(rec.state().count,0);assert.equal(rec.start(),true);assert.equal(rec.start(),false);assert.equal(rec.state().count,1);assert.equal(rec.state().running,true);assert.ok(c.pending>0);
 c.advance(12000);assert.equal(rec.state().running,false);assert.equal(rec.state().stopReason,'elapsed-limit');assert.equal(c.pending,0);assert.equal(c.win.count+c.doc.count+c.vv.count,0);
});
test('rAF sampling is throttled, events coalesce, and all samples remain bounded',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();for(let i=0;i<100;i++){c.vv.emit('scroll');c.vv.emit('resize');c.win.emit('scroll');c.frame(10);}
 const trace=rec.trace();assert.ok(trace.samples.length<=22,trace.samples.length);assert.ok(trace.samples.some(s=>s.reasons.includes('viewport-scroll')&&s.reasons.includes('viewport-resize')&&s.reasons.includes('page-scroll')));rec.stop();
});
test('focus-event flood cannot exceed ring cap; dropped count and chronological order retained',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();for(let i=0;i<1000;i++){c.advance(1);c.doc.emit('focus');}rec.stop();const t=rec.trace();assert.equal(t.samples.length,LIMITS.maxSamples);assert.ok(t.dropped>0);assert.ok(t.samples.every((s,i,a)=>i===0||s.t>=a[i-1].t));assert.equal(t.samples.at(-1).reasons[0],'stop');
});
test('only passive geometry events are watched; no text, keys, selection or gesture handlers',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();const all=[c.win,c.doc,c.vv].flatMap(t=>[...t.listeners.entries()]);for(const [type,items]of all){assert.ok(!['input','beforeinput','keydown','keyup','keypress','selectionchange','pointerdown','touchstart','touchmove','compositionupdate'].includes(type));for(const item of items)assert.equal(item.options.passive,true);}rec.stop();
});
test('pagehide, hidden visibility and dispose stop and remove all active work',()=>{
 for(const why of ['pagehide','hidden','disposed']){const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();if(why==='pagehide')c.win.emit('pagehide');if(why==='hidden'){c.doc.visibilityState='hidden';c.doc.emit('visibilitychange');}if(why==='disposed')rec.dispose();assert.equal(rec.state().running,false);assert.equal(c.pending,0);assert.equal(c.win.count+c.doc.count+c.vv.count,0);}
});
test('stop is idempotent, clear is local, and restart replaces the previous recording',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();assert.equal(rec.clear(),false);assert.equal(rec.stop(),true);const n=rec.state().count;assert.equal(rec.stop(),false);assert.equal(rec.state().count,n);rec.start();assert.equal(rec.state().count,1);rec.stop();rec.clear();assert.equal(rec.trace().samples.length,0);
});
test('geometry failures do not leave runaway sampling or leak error text',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read(){throw new Error('SECRET INPUT');}});rec.start();c.advance(12000);const t=JSON.stringify(rec.trace());assert.ok(t.includes('geometry-unavailable'));assert.ok(!t.includes('SECRET'));assert.equal(c.pending,0);assert.equal(c.win.count+c.doc.count+c.vv.count,0);
});
function element(tag='DIV'){
 const node={tagName:tag,style:{top:'-1240px',left:'0px'},dataset:{},hidden:false,scrollTop:0,scrollLeft:0,clientWidth:393,clientHeight:335,scrollWidth:393,scrollHeight:660,getBoundingClientRect:()=>({x:0,y:120,width:393,height:335,top:120,right:393,bottom:455,left:0}),querySelector:()=>null};
 for(const key of ['value','textContent','innerText','innerHTML','selectionStart','selectionEnd','id','name','placeholder'])Object.defineProperty(node,key,{get(){throw new Error('Read forbidden field '+key);}});return node;
}
test('snapshot reads only explicit numeric/enum geometry, never text or selected content',()=>{
 const input=element('TEXTAREA'),panel=element('SECTION'),body=element('BODY'),root=element('HTML');panel.dataset={motionPhase:'open',chatViewport:'keyboard',chatScrollMode:'READING'};body.dataset.chatOpen='true';panel.querySelector=s=>s==='#question'?input:element();
 const doc={documentElement:root,body,scrollingElement:root,activeElement:input,visibilityState:'visible',querySelector:s=>s==='#ai-canvas'?panel:element(),getSelection(){throw new Error('forbidden');}};
 const win={visualViewport:{height:335,width:393,offsetTop:120,offsetLeft:0,pageTop:120,pageLeft:0,scale:1},innerWidth:393,innerHeight:660,scrollX:0,scrollY:0,devicePixelRatio:3,personalOSChat:{isPageLocked:()=>true,feedOffset:()=>1240,getState(){throw new Error('forbidden full state');}},getComputedStyle:()=>({position:'fixed',overflowX:'clip',overflowY:'clip',transform:'none',top:'120px',left:'0px',fontSize:'16px',maxHeight:'104px'})};
 const result=readKeyboardGeometry(win,doc);assert.equal(result.state.activeElementType,'textarea');assert.equal(result.state.logicalFeedOffset,1240);assert.equal(result.nodes.body.inlineTop,-1240);assert.equal(result.nodes.input.fontSize,16);assert.equal(result.viewport.pageTop,120);assert.equal(result.document.scrollTop,0);assert.equal(result.nodes.dialog.overflowY,'clip');
 assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('custom event collects only the numeric layout commit counter',()=>{
 const c=clock(),rec=createKeyboardRecorder({...c,read});rec.start();const detail={layoutCommits:8};Object.defineProperty(detail,'text',{get(){throw new Error('private');}});c.win.emit('personalos:chat-state',{detail});c.frame();assert.equal(rec.trace().samples.at(-1).observedLayoutCommits,8);rec.stop();
});
test('source has no telemetry/persistence or product focus/scroll/touch mutation',()=>{
 const src=fs.readFileSync(new URL('../../runtime/diagnostics/keyboard-diagnostics.js',import.meta.url),'utf8');assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|\.preventDefault\s*\(|\.stopPropagation\s*\(|\.focus\s*\(|\.blur\s*\(|\.scrollTo\s*\(/);assert.match(src,/get\('share'\)\.addEventListener\('click'/);assert.match(src,/navigator\.share\(\{files:\[file\]/);assert.match(src,/error\?\.name==='AbortError'\)return/);assert.match(src,/URL\.createObjectURL/);
 const index=fs.readFileSync(new URL('../../runtime/index.html',import.meta.url),'utf8');assert.match(index,/get\("keyboardDiagnostics"\)==="1"\)\{import/);
});
test('normal-flow diagnostics add only geometry and an allowlisted phase',()=>{const source=fs.readFileSync(new URL('../../runtime/diagnostics/keyboard-diagnostics.js',import.meta.url),'utf8');assert.match(source,/mobileFlow: choice\(panel\?\.dataset.mobileFlow, \['opening','flow','closing'\]\)/);assert.match(source,/siteRoot: doc.querySelector\('\.app'\)/);assert.match(source,/detailRoot: doc.querySelector\('#stage'\)/);assert.match(source,/BASELINE_COMMIT = 'e0c92f6e45317b962a6c382fb7bb58a00c92043f'/);});
test('delayed timers cannot read/export post-deadline geometry through focus or RAF',()=>{
 for(const event of ['focus','frame']){const c=clock();let reads=0;const rec=createKeyboardRecorder({...c,read(){reads++;return read();}});rec.start();const before=reads;c.jumpWithoutTimers(20000);if(event==='focus')c.doc.emit('focus');else c.frame(0);assert.equal(reads,before);assert.equal(rec.state().running,false);assert.equal(rec.state().elapsedMs,12000);assert.equal(c.pending,0);assert.ok(rec.trace().samples.every(s=>s.t<=12000));}
});
function uiFixture({sharing=true,shareError=null,clipboard='available',dropSharedFile=false}={}) {
 const c=clock(),effects={shared:[],downloads:[],urls:[],revoked:[],copied:[],selected:0,received:[]};
 const makeNode=tag=>{const n=new Target();Object.assign(n,{tagName:tag.toUpperCase(),style:{},dataset:{},children:[],attributes:{},parts:{},hidden:false,scrollTop:0,scrollLeft:0,clientWidth:393,clientHeight:660,scrollWidth:393,scrollHeight:660,getBoundingClientRect:()=>({x:0,y:0,width:393,height:660,top:0,right:393,bottom:660,left:0}),querySelector(s){return this.parts[s]||null;},append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;},select(){effects.selected++;},click(){effects.downloads.push({href:this.href,name:this.download});}});Object.defineProperty(n,'innerHTML',{set(html){for(const item of html.matchAll(/<(\w+)([^>]*class="(kd-[\w-]+)"[^>]*)>/g)){const n=makeNode(item[1]);n.hidden=/\bhidden\b/.test(item[2]);n.disabled=/\bdisabled\b/.test(item[2]);n.readOnly=/\breadonly\b/.test(item[2]);this.parts['.'+item[3]]=n;}}});return n;};
 c.doc.head=makeNode('head');c.doc.body=makeNode('body');c.doc.documentElement=makeNode('html');c.doc.scrollingElement=c.doc.documentElement;c.doc.activeElement=c.doc.body;c.doc.createElement=makeNode;c.doc.querySelector=()=>null;
 Object.assign(c.win,{location:{search:'?keyboardDiagnostics=1'},innerWidth:393,innerHeight:660,scrollX:0,scrollY:0,devicePixelRatio:3,File,Blob,URL:{createObjectURL(file){effects.urls.push(file);return 'blob:local-test';},revokeObjectURL(url){effects.revoked.push(url);}},navigator:{canShare:()=>sharing,async share(value){effects.shared.push(value);if(shareError)throw {name:shareError};effects.received.push(dropSharedFile?{title:value.title||null}:value);},clipboard:clipboard==='missing'?undefined:{async writeText(text){if(clipboard==='denied')throw new Error('NotAllowedError');effects.copied.push(text);}}},getComputedStyle:()=>({position:'static',overflowX:'visible',overflowY:'visible',transform:'none',top:'auto',left:'auto',fontSize:'16px',maxHeight:'none'})});
 const mounted=mountKeyboardDiagnostics(c.win,c.doc),control=c.doc.body.children[0];
 return{...c,effects,mounted,control,button:key=>control.querySelector('.kd-'+key),async click(key){const node=control.querySelector('.kd-'+key);await Promise.all((node.listeners.get('click')||[]).map(({fn})=>fn({target:node})));}};
}
test('download is visible/enabled after capture and emits exact complete JSON bytes',async()=>{
 const f=uiFixture();assert.equal(f.button('download').hidden,false);assert.equal(f.button('download').disabled,true);assert.equal(f.effects.downloads.length,0);assert.equal(f.effects.copied.length,0);assert.equal(f.effects.shared.length,0);
 await f.click('start');f.advance(12000);assert.equal(f.button('download').hidden,false);assert.equal(f.button('download').disabled,false);await f.click('download');assert.equal(f.effects.downloads.length,1);assert.equal(f.effects.shared.length,0);
 const blob=f.effects.urls[0],text=await blob.text(),trace=JSON.parse(text);assert.equal(trace.schemaVersion,1);assert.ok(trace.samples.length>0);assert.equal(blob.size,Buffer.byteLength(text,'utf8'));assert.ok(f.button('metrics').textContent.includes(String(blob.size)+' 字节'));assert.ok(f.button('metrics').textContent.includes('样本 '+trace.samples.length+' 条'));assert.ok(f.button('metrics').textContent.includes('"schemaVersion": 1'));f.advance(1000);assert.deepEqual(f.effects.revoked,['blob:local-test']);
});
test('clipboard writes happen only on explicit Copy and contain the full downloadable record',async()=>{
 const f=uiFixture();await f.click('start');f.advance(12000);assert.equal(f.effects.copied.length,0);await f.click('copy');assert.equal(f.effects.copied.length,1);await f.click('download');assert.equal(f.effects.copied[0],await f.effects.urls[0].text());assert.equal(JSON.parse(f.effects.copied[0]).schemaVersion,1);assert.equal(f.effects.shared.length,0);
});
test('missing or denied clipboard exposes readonly full JSON with explicit selection only',async()=>{
 for(const clipboard of ['missing','denied']){const f=uiFixture({clipboard});await f.click('start');f.advance(12000);await f.click('copy');assert.equal(f.effects.copied.length,0);assert.equal(f.button('fallback').hidden,false);assert.equal(f.button('text').readOnly,true);assert.equal(JSON.parse(f.button('text').value).schemaVersion,1);assert.equal(f.effects.selected,0);await f.click('select');assert.equal(f.effects.selected,1);assert.equal(f.effects.downloads.length,0);}
});
test('viewing full JSON does not write clipboard or share it',async()=>{
 const f=uiFixture();await f.click('start');f.advance(12000);await f.click('view');assert.equal(f.button('fallback').hidden,false);assert.equal(f.button('text').readOnly,true);assert.ok(JSON.parse(f.button('text').value).samples.length>0);assert.equal(f.effects.copied.length+f.effects.shared.length+f.effects.downloads.length,0);
});
test('native share is secondary, file-only, and does not claim receipt when receiver drops the file',async()=>{
 const f=uiFixture({dropSharedFile:true});await f.click('start');f.advance(12000);assert.equal(f.effects.shared.length,0);await f.click('share');assert.equal(f.effects.shared.length,1);assert.deepEqual(Object.keys(f.effects.shared[0]),['files']);assert.equal(f.effects.shared[0].files[0].name,'personalos-mobile-flow-trace.json');assert.deepEqual(f.effects.received[0],{title:null});assert.ok(f.button('status').textContent.includes('无法确认接收方收到完整文件'));assert.equal(f.button('download').disabled,false);assert.equal(f.button('copy').disabled,false);assert.equal(f.effects.downloads.length,0);await f.click('download');assert.equal(f.effects.downloads.length,1);
});
test('unsupported, failed, or cancelled share never auto-downloads or copies',async()=>{
 for(const settings of [{sharing:false},{shareError:'AbortError'},{shareError:'NotAllowedError'}]){const f=uiFixture(settings);await f.click('start');f.advance(12000);await f.click('share');assert.equal(f.effects.downloads.length+f.effects.copied.length,0);assert.equal(f.button('download').disabled,false);assert.equal(f.button('download').hidden,false);}
});
test('clear/restart removes old export text and re-disables complete-record actions',async()=>{
 const f=uiFixture();await f.click('start');f.advance(12000);await f.click('view');assert.ok(f.button('text').value.length>0);await f.click('clear');assert.equal(f.button('text').value,'');assert.equal(f.button('fallback').hidden,true);assert.equal(f.button('download').disabled,true);assert.equal(f.button('metrics').textContent,'暂无完整记录');await f.click('start');assert.equal(f.button('copy').disabled,true);assert.equal(f.effects.copied.length,0);
});
