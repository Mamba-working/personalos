import test from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from '../src/server.mjs';
import {healthResponse,serviceStatus} from '../../../packages/contracts/index.mjs';
async function withApi(run){const runtime=await startApi({port:0});try{await run(`http://127.0.0.1:${runtime.server.address().port}`);}finally{await runtime.close();}}
test('health is a real Nest/Fastify HTTP endpoint with bounded public response',()=>withApi(async origin=>{
  const res=await fetch(origin+'/healthz');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/^application\/json/);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),healthResponse());
}));
test('status reports the implemented demo and the still-missing real chat/auth capabilities honestly',()=>withApi(async origin=>{
  const res=await fetch(origin+'/api/v1/status');assert.equal(res.status,200);const status=await res.json();assert.deepEqual(status.capabilities,serviceStatus().capabilities);assert.equal(status.transport,'nestjs-fastify');assert.equal(status.storageAdapter,'sqlite-demo');assert.equal(status.generator.modelCalls,0);assert.equal(status.capabilities.chatApi,false);assert.equal(status.capabilities.authentication,false);
}));
test('unrelated routes remain unimplemented',()=>withApi(async origin=>{
  for(const route of ['/api/v1/chat','/api/v1/content','/api/v1/auth','/private']){const res=await fetch(origin+route);assert.equal(res.status,404);assert.deepEqual(await res.json(),{error:'not_found'});}
}));
test('health mutation methods are rejected and no CORS allowance is added',()=>withApi(async origin=>{
  for(const method of ['POST','DELETE','OPTIONS']){const res=await fetch(origin+'/healthz',{method});assert.equal(res.status,405);assert.equal(res.headers.get('allow'),'GET');assert.equal(res.headers.get('access-control-allow-origin'),null);}
}));
