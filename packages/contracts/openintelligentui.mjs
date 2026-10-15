/** Native completed OpenIntelligentUI open-generative-ui activity, pinned upstream. */
export const RENDERER_DESCRIPTOR=Object.freeze({rendererId:'copilotkit-openintelligentui',protocolVersion:'open-generative-ui-activity-v1',catalogVersion:'none',upstreamCommit:'8391a94c1c3939c679e40ddd7bfc08a9ef690e70',runtimeVersion:'@jetbrains/websandbox@1.2.1',sandboxPolicyVersion:'personalos-opaque-no-network-v1'});
export const RENDERER_VERSION='open-generative-ui-activity-v1@8391a94c1c3939c679e40ddd7bfc08a9ef690e70';
export const GENERATOR=Object.freeze({kind:'controlled-mock',name:'oiui-synthetic-artifact-v1',modelCalls:0});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
/** Structural and size checks only. Arbitrary native JavaScript is NOT proved safe here. */
export function validateCompletedArtifact(spec){
  const errors=[],warnings=['Native HTML/CSS/JavaScript remains untrusted; schema validation is not a code-safety proof','Rendering requires the pinned opaque-origin, network-denied sandbox and explicit human review'],checks=['native-activity-shape','completed-flags','bounded-native-payload','sandbox-required-not-safety-certified'];
  const required=['initialHeight','generating','css','cssComplete','html','htmlComplete','jsFunctions','jsFunctionsComplete','jsExpressions','jsExpressionsComplete'];
  if(!plain(spec)||required.some(k=>!Object.hasOwn(spec,k))||Object.keys(spec).some(k=>!required.includes(k)))return {valid:false,errors:['Expected the native completed activity fields only'],warnings,checks};
  if(!Number.isInteger(spec.initialHeight)||spec.initialHeight<120||spec.initialHeight>2400)errors.push('initialHeight must be an integer in [120,2400]');
  if(spec.generating!==false||['cssComplete','htmlComplete','jsFunctionsComplete','jsExpressionsComplete'].some(k=>spec[k]!==true))errors.push('Only complete immutable artifacts can be stored');
  if(typeof spec.css!=='string'||spec.css.length>24000)errors.push('CSS exceeds the supported string bound');
  if(!Array.isArray(spec.html)||spec.html.length<1||spec.html.length>64||spec.html.some(value=>typeof value!=='string'||value.length>32000)||!spec.html.some(value=>value.trim()))errors.push('HTML must be a bounded nonempty native string array');
  if(typeof spec.jsFunctions!=='string'||spec.jsFunctions.length>32000)errors.push('jsFunctions exceeds the supported string bound');
  if(!Array.isArray(spec.jsExpressions)||spec.jsExpressions.length>64||spec.jsExpressions.some(value=>typeof value!=='string'||value.length>4000))errors.push('jsExpressions must be a bounded native string array');
  if(JSON.stringify(spec).length>96000)errors.push('Combined activity exceeds the supported payload bound');
  return {valid:errors.length===0,errors,warnings,checks};
}
