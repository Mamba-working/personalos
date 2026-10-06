import test from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from '../src/server.mjs';
import {healthResponse,serviceStatus} from '../../../packages/contracts/index.mjs';
async function withApi(run){const server=await startApi({port:0});try{await run(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('health is a real HTTP endpoint with bounded public response',()=>withApi(async origin=>{
  const res=await fetch(origin+'/healthz');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/^application\/json/);
  assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),healthResponse());
}));
test('status reports missing product backend capabilities honestly',()=>withApi(async origin=>{
  const res=await fetch(origin+'/api/v1/status');assert.equal(res.status,200);assert.deepEqual(await res.json(),serviceStatus());
}));
test('unknown routes stay unimplemented',()=>withApi(async origin=>{
  for(const route of ['/api/v1/chat','/api/v1/content','/api/v1/auth','/private']){const res=await fetch(origin+route);assert.equal(res.status,404);assert.deepEqual(await res.json(),{error:'not_found'});}
}));
test('mutation methods are rejected and no CORS allowance is added',()=>withApi(async origin=>{
  for(const method of ['POST','DELETE','OPTIONS']){const res=await fetch(origin+'/healthz',{method});assert.equal(res.status,405);assert.equal(res.headers.get('allow'),'GET');assert.equal(res.headers.get('access-control-allow-origin'),null);}
}));
