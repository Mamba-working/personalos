// Playback timing only. All lighting and rendering remain official Three r180.
export const PLAYBACK_SECONDS=12;
export const ENVIRONMENT_INTERVAL_SECONDS=.5;
export const SUN_STATES=Object.freeze({
 A:Object.freeze({azimuth:-60,elevation:12,label:'A · 左侧低太阳'}),
 B:Object.freeze({azimuth:60,elevation:18,label:'B · 右侧低太阳'})
});
export function sampleSun(elapsedSeconds){
 const elapsed=Math.min(PLAYBACK_SECONDS,Math.max(0,elapsedSeconds));
 const progress=elapsed/PLAYBACK_SECONDS;
 const azimuth=SUN_STATES.A.azimuth+(SUN_STATES.B.azimuth-SUN_STATES.A.azimuth)*progress;
 // A higher midpoint makes the changing shadow direction and length inspectable.
 // This is an accelerated diagnostic path, not an astronomical ephemeris.
 const elevation=SUN_STATES.A.elevation+(SUN_STATES.B.elevation-SUN_STATES.A.elevation)*progress+(progress===0||progress===1?0:30*Math.sin(Math.PI*progress));
 return {elapsed,progress,azimuth,elevation,endpoint:progress===0?'A':progress===1?'B':null};
}
export function environmentCaptureDue(elapsed,lastCaptureElapsed,force=false){
 const state=sampleSun(elapsed);
 return !state.endpoint&&(force||lastCaptureElapsed===null||elapsed-lastCaptureElapsed>=ENVIRONMENT_INTERVAL_SECONDS-1e-9);
}
export class SunPlaybackClock {
 constructor(){this.elapsed=0;this.running=false;this.lastTimestamp=null;}
 play(nowSeconds){if(this.elapsed>=PLAYBACK_SECONDS)this.elapsed=0;this.running=true;this.lastTimestamp=nowSeconds;return this.state();}
 tick(nowSeconds){if(this.running){this.elapsed=Math.min(PLAYBACK_SECONDS,this.elapsed+Math.max(0,nowSeconds-this.lastTimestamp));this.lastTimestamp=nowSeconds;if(this.elapsed>=PLAYBACK_SECONDS){this.running=false;this.lastTimestamp=null;}}return this.state();}
 pause(nowSeconds){this.tick(nowSeconds);this.running=false;this.lastTimestamp=null;return this.state();}
 selectEndpoint(key){if(!SUN_STATES[key])throw new Error('Unknown solar endpoint');this.running=false;this.lastTimestamp=null;this.elapsed=key==='A'?0:PLAYBACK_SECONDS;return this.state();}
 state(){return {...sampleSun(this.elapsed),running:this.running};}
}
