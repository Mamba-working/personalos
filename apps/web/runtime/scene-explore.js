// A reversible input lease around the unchanged scene. The document never moves.
const host = window.personalOSHost;
const layer = document.querySelector('#content-root');
const enterButton = document.querySelector('#host-explore');
const returnButton = document.querySelector('#scene-explore-return');
const controls = document.querySelector('#scene-explore-controls');
const blockedControls = [document.querySelector('#host-open-chat'), document.querySelector('#host-menu')];
let phase = 'reading', value = 1, velocity = 0, target = 1, frame = 0, last = null;
let savedScroll = 0, savedFocus = null, restoring = false, disposed = false;
const reduced = () => host.getState().reduced;
const canEnter = () => { const s = host.getState(); return s.scene?.ready && !s.scene.failed && s.content?.phase === 'preview' && !s.content.reflow?.active && s.chat?.phase === 'closed' && !s.menu?.open && !s.menu?.modal; };
const getState = () => ({ phase, opacity: value, velocity, target, savedScroll, inputEnabled: phase === 'exploring', contentInert: layer.inert, scrollY });
const emit = () => host.moduleChanged('sceneExplore');
function paint() { layer.style.opacity = String(value); document.documentElement.dataset.sceneExplore = phase; }
function finish() {
  frame = 0; last = null; value = target; velocity = 0;
  phase = target === 0 ? 'exploring' : 'reading';
  if (phase === 'reading') {
    layer.inert = false; layer.removeAttribute('aria-hidden'); controls.hidden = true;
    blockedControls.forEach(node => { if(node) node.inert = false; });
    enterButton.setAttribute('aria-expanded','false'); enterButton.textContent = '探索场景';
    scrollTo({ top: savedScroll, behavior: 'instant' });
    if(savedFocus?.isConnected && !savedFocus.closest('[inert]')) savedFocus.focus({ preventScroll: true });
  } else returnButton.focus({ preventScroll: true });
  paint(); emit();
}
function tick(now) {
  frame = 0; const dt = last === null ? 0 : Math.max(0,(now-last)/1000); last=now;
  // Closed-form critical damping preserves both position and velocity on reversal.
  const omega=14, x=value-target, c=velocity+omega*x, decay=Math.exp(-omega*dt);
  value=target+(x+c*dt)*decay; velocity=(velocity-omega*c*dt)*decay;
  paint();
  if(reduced() || (Math.abs(value-target)<.001 && Math.abs(velocity)<.01)) finish();
  else frame=requestAnimationFrame(tick);
}
function retarget(next) {
  target=next; phase=next===0?'entering':'returning'; paint(); emit();
  if(reduced()) { cancelAnimationFrame(frame); finish(); return; }
  if(!frame){ last=performance.now(); frame=requestAnimationFrame(tick); }
}
function enter() {
  if(disposed || phase==='exploring' || phase==='entering')return false;
  if(phase==='reading') {
    if(!canEnter())return false;
    savedScroll=scrollY; savedFocus=document.activeElement;
    layer.inert=true; layer.setAttribute('aria-hidden','true'); controls.hidden=false;
    blockedControls.forEach(node=>{if(node)node.inert=true;});
    enterButton.setAttribute('aria-expanded','true'); enterButton.textContent='返回内容';
    returnButton.focus({preventScroll:true});
  }
  retarget(0); return true;
}
function exit() { if(disposed || phase==='reading' || phase==='returning')return false; retarget(1); return true; }
enterButton.addEventListener('click',()=>target===0?exit():enter()); returnButton.addEventListener('click',exit);
const keydown=e=>{if(phase==='reading')return;if(e.key==='Escape'){e.preventDefault();exit();}else if([' ','PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();}};
const stopScroll=e=>{if(phase!=='reading')e.preventDefault();};
const keepScroll=()=>{if(phase!=='reading'&&!restoring&&Math.abs(scrollY-savedScroll)>.5){restoring=true;scrollTo({top:savedScroll,behavior:'instant'});restoring=false;}};
const visibility=()=>{cancelAnimationFrame(frame);frame=0;last=null;if(!document.hidden&&phase!=='reading'&&phase!=='exploring'){last=performance.now();frame=requestAnimationFrame(tick);}};
document.addEventListener('keydown',keydown);window.addEventListener('wheel',stopScroll,{passive:false});window.addEventListener('touchmove',stopScroll,{passive:false});window.addEventListener('scroll',keepScroll,{passive:true});document.addEventListener('visibilitychange',visibility);
const unsubscribe=host.subscribe(s=>{
  if(s.action==='module-sceneExplore')return;
  enterButton.disabled=phase==='reading'&&!canEnter();
  if(phase!=='reading'&&(s.scene?.failed||s.content?.phase!=='preview'||s.chat?.phase!=='closed'||s.menu?.open||s.menu?.modal))exit();
});
const api={enter,exit,getState};window.personalOSSceneExplore=api;host.registerModule('sceneExplore',api);enterButton.disabled=!canEnter();paint();
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;cancelAnimationFrame(frame);unsubscribe();document.removeEventListener('keydown',keydown);window.removeEventListener('wheel',stopScroll);window.removeEventListener('touchmove',stopScroll);window.removeEventListener('scroll',keepScroll);document.removeEventListener('visibilitychange',visibility);});
