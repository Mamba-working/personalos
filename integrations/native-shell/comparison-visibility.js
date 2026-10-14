/* Standalone comparison visibility only; the approved Ball host is untouched.
 * Retain the native conversation/input. Closing stops local reply work and
 * releases all visual carriers before hiding the panel. */
export function installComparisonVisibility({panel,closeButton,reopenButton,core,flow,commit}){
 let open=true,disposed=false,readingAnchor=null;
 function close(){
  if(disposed||!open)return;
  readingAnchor=flow.scroll.captureReadingAnchor();open=false;
  core.chatWanted=false;core.chatPhase='closed';
  flow.setOpen(false);flow.cancel();flow.sendProjection?.release('comparison-close');
  panel.hidden=true;reopenButton.hidden=false;reopenButton.setAttribute('aria-expanded','false');
  reopenButton.focus({preventScroll:true});
 }
 function reopen({focus=true}={}){
  if(disposed||open)return;
  panel.hidden=false;reopenButton.hidden=true;open=true;
  core.chatWanted=true;core.chatPhase='open';reopenButton.setAttribute('aria-expanded','true');
  flow.setOpen(true);commit(readingAnchor);readingAnchor=null;
  if(focus)closeButton.focus({preventScroll:true});
 }
 const onReopen=()=>reopen();
 closeButton.addEventListener('click',close);reopenButton.addEventListener('click',onReopen);
 return{isOpen:()=>open,close,open:reopen,destroy(){if(disposed)return;disposed=true;closeButton.removeEventListener('click',close);reopenButton.removeEventListener('click',onReopen);}};
}
