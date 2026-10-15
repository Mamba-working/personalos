"use client";
/** Completed-artifact adaptation of the pinned CopilotKit/OpenIntelligentUI renderer lifecycle. */
import { useEffect,useMemo,useRef,useState } from "react";
import { OpenGenUIContentSchema,type OpenGenUIContent } from "@/vendor/openintelligentui/schema";
import { loadWebsandbox,type SandboxInstance } from "@/vendor/openintelligentui/websandbox-loader";
import { buildFinalFrameContent,MEASUREMENT_JS } from "./frame-content";
import { clampReportedHeight,ERROR_MESSAGE_TYPE,parsePromptProposal,RESIZE_MESSAGE_TYPE,validHostRpcMessage } from "./policy.mjs";

type HostConnection={onMessageListener:(event:MessageEvent)=>void;callbacks:Record<string,unknown>};
type HardenedSandbox=SandboxInstance&{connection?:HostConnection};
export default function OpenIntelligentArtifact({content,onFollowUp}:{content:OpenGenUIContent;onFollowUp?:(text:string)=>void}){
  const containerRef=useRef<HTMLDivElement>(null);
  const callbackRef=useRef(onFollowUp);callbackRef.current=onFollowUp;
  const [height,setHeight]=useState(clampReportedHeight(content.initialHeight)||700);
  const [failure,setFailure]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  const [stopped,setStopped]=useState(false);
  const [reload,setReload]=useState(0);
  const [proposal,setProposal]=useState<string|null>(null);
  const fingerprint=JSON.stringify(content);
  const validation=useMemo(()=>OpenGenUIContentSchema.safeParse(content),[fingerprint]);
  const complete=validation.success&&content.generating===false&&content.cssComplete===true&&content.htmlComplete===true&&content.jsFunctionsComplete===true&&content.jsExpressionsComplete===true&&Array.isArray(content.html)&&content.html.length>0;
  useEffect(()=>{
    if(!complete||stopped||!containerRef.current)return;
    let cancelled=false;let failed=false;let sandbox:HardenedSandbox|null=null;let initialized=false;
    setFailure(null);setReady(false);setProposal(null);setHeight(clampReportedHeight(content.initialHeight)||700);
    const fail=()=>{if(cancelled||failed)return;failed=true;setFailure("沙箱执行失败，内容已停止。请检查这个修订版后重试。");setReady(false);sandbox?.destroy();sandbox=null;};
    const timer=setTimeout(fail,8000);
    const onMessage=(event:MessageEvent)=>{if(!sandbox||event.source!==sandbox.iframe.contentWindow||event.origin!=="null")return;if(event.data?.type===RESIZE_MESSAGE_TYPE){const value=clampReportedHeight(event.data.height);if(value!==null)setHeight(value);}if(event.data?.type===ERROR_MESSAGE_TYPE)fail();};
    window.addEventListener("message",onMessage);
    void loadWebsandbox().then(async Websandbox=>{
      if(cancelled||!containerRef.current)return;
      const localApi=Object.create(null) as Record<string,(args:unknown)=>unknown>;
      // Keep the one named interface stable while a queued chat job becomes available.
      // A reader without a current callback receives a rejection, never a host action.
      localApi.sendPrompt=(args:unknown)=>{const parsed=parsePromptProposal(args);if(!parsed)return Promise.reject(new Error("Invalid follow-up proposal"));if(!callbackRef.current)return Promise.reject(new Error("This reader does not expose a chat bridge"));setProposal(parsed.text);return {queuedForHostConfirmation:true};};
      sandbox=Websandbox.create(localApi,{frameContainer:containerRef.current,frameContent:buildFinalFrameContent(content.html!.join(""),content.css||""),allowAdditionalAttributes:""}) as HardenedSandbox;
      const frame=sandbox.iframe;let initialLoad=true;frame.addEventListener("load",()=>{if(initialLoad){initialLoad=false;return;}fail();});frame.title="OpenIntelligentUI 交互内容";frame.referrerPolicy="no-referrer";frame.setAttribute("allow","camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'");
      if(frame.getAttribute("sandbox")?.trim()!=="allow-scripts")throw new Error("Unexpected sandbox permissions");
      frame.style.cssText="display:block;width:100%;height:100%;border:0;background:transparent";
      // Actual Websandbox source checks event.source and null origin. Narrow its host protocol too.
      const connection=sandbox.connection;if(!connection)throw new Error("Missing sandbox RPC connection");
      const dispatch=connection.onMessageListener.bind(connection);
      connection.onMessageListener=(event:MessageEvent)=>{if(event.source!==frame.contentWindow||event.origin!=="null")return;const callbacks=new Set(Object.keys(connection.callbacks||{}));if(!validHostRpcMessage(event.data,callbacks,initialized))return;if(event.data.type==="message"&&!Object.hasOwn(localApi,event.data.methodName))return;if(event.data.type==="service-message")initialized=true;dispatch(event);};
      await sandbox.promise;if(cancelled||failed)return;
      await sandbox.run(MEASUREMENT_JS);
      // Match upstream ordering: functions once, then each expression, sequentially inside the sandbox.
      if(content.jsFunctions)await sandbox.run(content.jsFunctions);
      for(const expression of content.jsExpressions||[]){if(cancelled||failed)return;await sandbox.run(expression);}
      if(cancelled||failed)return;clearTimeout(timer);setReady(true);
    }).catch(fail);
    return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener("message",onMessage);sandbox?.destroy();sandbox=null;};
  },[fingerprint,complete,stopped,reload]);
  if(!complete)return <div role="alert" className="error-panel">此内容不是完整的 OpenIntelligentUI 产物，未执行任何代码。</div>;
  return <div className="openintelligent-artifact" data-runtime="copilotkit-openintelligentui" data-ready={ready?"true":"false"}>
    <div className="artifact-host-controls"><span>OpenIntelligentUI · 隔离交互</span><div><button className="text-button" disabled={stopped} onClick={()=>{setStopped(true);setProposal(null);setReady(false);}}>停止交互</button><button className="text-button" onClick={()=>{setStopped(false);setFailure(null);setReload(value=>value+1);}}>重新载入 ↻</button></div></div>
    {stopped?<div className="artifact-stopped" role="status">这份交互已停止。重新载入会重置本页控件，不改变保存的产物。</div>:failure?<div role="alert" className="error-panel">{failure}</div>:<><div className="artifact-frame" ref={containerRef} style={{position:"relative",height,overflow:"hidden",width:"100%"}}/>{!ready&&<p className="artifact-loading" role="status">正在启动隔离交互环境…</p>}</>}
    <p className="sandbox-limit">隔离不等于 CPU / 内存限额。停止按钮依赖浏览器仍有响应，无法保证中断死循环。</p>
    {proposal&&!stopped&&<aside className="artifact-proposal"><strong>这段交互内容提出了一个后续问题</strong><p>{proposal}</p><span>只有你点击确认，才会作为新一轮演示对话发送</span><div><button className="button secondary" onClick={()=>setProposal(null)}>取消</button><button className="button primary" onClick={()=>{const value=proposal;setProposal(null);callbackRef.current?.(value);}}>确认发送这个问题 →</button></div></aside>}
  </div>;
}
