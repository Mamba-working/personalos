/** PersonalOS hardening around the actual Websandbox host RPC protocol. */
export const SANDBOX_POLICY_VERSION='personalos-opaque-no-network-v1';
export const UPSTREAM_COMMIT='8391a94c1c3939c679e40ddd7bfc08a9ef690e70';
export const RESIZE_MESSAGE_TYPE='__ogui_resize';
export const ERROR_MESSAGE_TYPE='__personalos_artifact_error';
export const FRAME_CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';";
export const HOST_FRAME_CSP="frame-src about:; child-src about:; object-src 'none'; base-uri 'self';";
export function clampReportedHeight(height){return typeof height==='number'&&Number.isFinite(height)?Math.max(50,Math.min(Math.ceil(height),4000)):null;}
export function parsePromptProposal(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='text')||typeof value.text!=='string')return null;const text=value.text.trim();return text.length>0&&text.length<=4000?{text}:null;}
export function validHostRpcMessage(data,callbackIds,initialized){
  if(!data||typeof data!=='object'||Array.isArray(data))return false;
  try{if(JSON.stringify(data).length>16384)return false;}catch{return false;}
  if(typeof data.callId!=='string'||data.callId.length>40)return false;
  if(data.type==='response')return callbackIds.has(data.callId)&&typeof data.success==='boolean';
  if(data.type==='service-message')return !initialized&&data.methodName==='iframeInitialized'&&Array.isArray(data.arguments)&&data.arguments.length===0;
  if(data.type==='message')return data.methodName==='sendPrompt'&&Array.isArray(data.arguments)&&data.arguments.length===1&&!!parsePromptProposal(data.arguments[0]);
  // Reject incoming set-interface, dotted/prototype paths, generic APIs and unknown message kinds.
  return false;
}
