/* Native reading chrome only. Original input/messages/buttons remain owned by app. */
const arrow='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const stop='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>';
export async function installReadingInterior({document,search=location.search}={}){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./chat-reading.css',import.meta.url).href;
 const ready=new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=()=>reject(new Error('Reading stylesheet unavailable'));});document.head.append(css);
 try{await ready;}catch{css.remove();return null;}
 const panel=document.querySelector('#ai-canvas'),input=panel.querySelector('#question'),send=panel.querySelector('#send-button'),note=panel.querySelector('.composer-note');
 const oldNoteNodes=[...note.childNodes],oldSendNodes=[...send.childNodes],moved=[];
 const composer=input.closest('.composer-wrap'),field=document.createElement('div');field.className='composer-field';composer.insertBefore(field,input);field.append(input);
 document.body.dataset.chatInterior='reading';panel.dataset.chatInterior='reading';
 panel.querySelector('.canvas-intro h2').textContent='有什么想了解的？';panel.querySelector('.canvas-intro p').textContent='问一个问题，或从这里开始。';
 const labels=['了解项目','聊聊想法','看看实验'];panel.querySelectorAll('.prompt-list button').forEach((n,i)=>{n.textContent=labels[i]||n.textContent;});
 const tools=document.createElement('details');tools.className='chat-reading-debug-tools';tools.hidden=!new URLSearchParams(search).has('chatDebug');const summary=document.createElement('summary');summary.textContent='演示工具';tools.append(summary);
 for(const node of [panel.querySelector('#canvas-pet'),panel.querySelector('#simulate-error')].filter(Boolean)){moved.push({node,parent:node.parentNode,next:node.nextSibling});tools.append(node);}document.body.append(tools);
 const label=document.createElement('span');label.textContent='本地演示 · 未接入 AI';note.replaceChildren(label);
 const disc=document.createElement('span');disc.className='send-disc';send.replaceChildren(disc);
 const latest=document.createElement('button');latest.type='button';latest.className='jump-latest';latest.hidden=true;latest.setAttribute('aria-label','回到最新回复');latest.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';panel.querySelector('.canvas-composer').append(latest);
 let disposed=false;
 const setSendState=({stopping=false}={})=>{if(disposed)return;disc.innerHTML=stopping?stop:arrow;send.disabled=!stopping&&!input.value.trim();send.setAttribute('aria-label',stopping?'停止生成并保留内容':'发送消息');};setSendState();
 return{panel,input,send,field,latest,setSendState,destroy(){if(disposed)return;disposed=true;composer.insertBefore(input,field);field.remove();latest.remove();for(const {node,parent,next}of moved)parent.insertBefore(node,next?.parentNode===parent?next:null);note.replaceChildren(...oldNoteNodes);send.replaceChildren(...oldSendNodes);tools.remove();css.remove();delete document.body.dataset.chatInterior;delete panel.dataset.chatInterior;}};
}
