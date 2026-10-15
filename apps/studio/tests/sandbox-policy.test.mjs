import test from 'node:test';
import assert from 'node:assert/strict';
import {FRAME_CSP,HOST_FRAME_CSP,clampReportedHeight,parsePromptProposal,validHostRpcMessage} from '../src/components/openintelligentui/policy.mjs';
const known=new Set(['own-1']);
test('opaque frame policy denies network, forms, children and eval by default',()=>{for(const clause of ["default-src 'none'","connect-src 'none'","form-action 'none'","frame-src 'none'","object-src 'none'"])assert.ok(FRAME_CSP.includes(clause));assert.doesNotMatch(FRAME_CSP,/https?:|unsafe-eval/);assert.match(HOST_FRAME_CSP,/frame-src about:/);assert.doesNotMatch(HOST_FRAME_CSP,/data:|blob:|https?:/);});
test('reported height accepts finite values only and clamps the owned frame',()=>{for(const value of [NaN,Infinity,-Infinity,'400',null,{}])assert.equal(clampReportedHeight(value),null);assert.equal(clampReportedHeight(12),50);assert.equal(clampReportedHeight(5000),4000);assert.equal(clampReportedHeight(222.2),223);});
test('follow-up bridge accepts a bounded strict text-only proposal',()=>{assert.deepEqual(parsePromptProposal({text:'  explain this  '}),{text:'explain this'});for(const value of [{text:''},{text:'x'.repeat(4001)},{text:'valid',admin:true},[],null])assert.equal(parsePromptProposal(value),null);});
test('host RPC rejects interface mutation, prototype paths, unknown methods and forged responses',()=>{
  assert.equal(validHostRpcMessage({type:'service-message',callId:'frame-1',methodName:'iframeInitialized',arguments:[]},known,false),true);
  assert.equal(validHostRpcMessage({type:'service-message',callId:'frame-1',methodName:'iframeInitialized',arguments:[]},known,true),false);
  assert.equal(validHostRpcMessage({type:'message',callId:'frame-2',methodName:'sendPrompt',arguments:[{text:'What changes?'}]},known,true),true);
  for(const methodName of ['openLink','fetch','approve','publish','constructor.constructor','__proto__.polluted','sendPrompt.constructor'])assert.equal(validHostRpcMessage({type:'message',callId:'attack',methodName,arguments:[{text:'value'}]},known,true),false);
  assert.equal(validHostRpcMessage({type:'set-interface',callId:'attack',apiMethods:['__proto__.polluted']},known,true),false);
  assert.equal(validHostRpcMessage({type:'response',callId:'unknown',success:true},known,true),false);
  assert.equal(validHostRpcMessage({type:'response',callId:'own-1',success:true},known,true),true);
  assert.equal(validHostRpcMessage({type:'response',callId:'own-1',success:true,result:'x'.repeat(17000)},known,true),false);
});
