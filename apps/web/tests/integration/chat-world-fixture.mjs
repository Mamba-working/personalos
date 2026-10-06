import path from 'node:path';
import {bootWorld} from './world-cpu-fixture.mjs';
import {read,runtime} from './content-fixture.mjs';
// Minimal fixture-only ESM evaluator for these first-party local modules.
// Bodies execute unchanged, with imports rebound in the same JSDOM realm.
export function loadLocalModule(f,name){
 const w=f.w;w.__localModules??={};if(w.__localModules[name])return w.__localModules[name];
 let source=read(name),bindings=[];
 source=source.replace(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?\s*$/gm,(_,binding,spec)=>{
  if(!spec.startsWith('.'))throw Error('Unexpected external import '+spec);
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),spec));loadLocalModule(f,target);
  const selected=binding.startsWith('* as ')?binding.slice(5):binding.replace(/\b(\w+)\s+as\s+(\w+)\b/g,'$1:$2');bindings.push(`const ${selected}=window.__localModules[${JSON.stringify(target)}];`);return'';
 });
 const names=[...source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/g)].map(x=>x[1]);
 source=source.replace(/\bexport\s+/g,'').replaceAll('import.meta.url',JSON.stringify(new URL(name,runtime).href));
 const value=w.eval(`(()=>{${bindings.join('\n')}\n${source}\nreturn {${names.join(',')}};})()`);w.__localModules[name]=value;return value;
}
export async function bootChatWorld({width=1180}={}){
 const f=bootWorld({enabled:true,manual:true,reduced:true,width}),w=f.w;
 const append=f.d.head.append.bind(f.d.head);f.d.head.append=(...nodes)=>{append(...nodes);for(const node of nodes)if(node.tagName==='LINK'&&node.rel==='stylesheet')queueMicrotask(()=>node.dispatchEvent(new w.Event('load')));};
 w.eval(read('chat/vendor/gsap/gsap.min.js'));w.gsap.ticker.sleep();
 const {mountChat}=loadLocalModule(f,'chat-host.js');
 const ball=()=>f.world.getState().world.screen;
 const chat=await mountChat({getBall:ball,getReturnBall:ball,getClock:()=>f.world,reduced:()=>false,getRestoreFocus:()=>f.$('.brand')});w.gsap.ticker.sleep();
 return {...f,chat,settleChat(){for(let i=0;i<300&&!['open','closed'].includes(chat.getState().phase);i++)f.study.step(1/60);return chat.getState();},destroy(){w.dispatchEvent(new w.Event('pagehide'));w.gsap.ticker.sleep();f.destroy();}};
}
