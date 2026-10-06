/* Debug presentation only. Never drives, pauses or retimes a send animation. */
export function installComparisonStatus({ticker,read,write,document,now=()=>performance.now()}){
 let subscribed=false,disposed=false,lastAt=-Infinity,lastText='';
 function unsubscribe(){if(subscribed){ticker.remove(tick);subscribed=false;}}
 function refresh(force=false){
  if(disposed||document.hidden){unsubscribe();return;}
  const time=now();if(!force&&time-lastAt<100)return;lastAt=time;
  const state=read();if(state.text!==lastText){lastText=state.text;write(state.text);}
  if(state.active){if(!subscribed){ticker.add(tick);subscribed=true;}}else unsubscribe();
 }
 function tick(){refresh();}
 function wake(){refresh(!subscribed);}
 function visibility(){if(document.hidden)unsubscribe();else wake();}
 document.addEventListener('visibilitychange',visibility);
 return{wake,destroy(){if(disposed)return;disposed=true;unsubscribe();document.removeEventListener('visibilitychange',visibility);}};
}
