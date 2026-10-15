import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import pg from 'pg';
import {PostgresStore} from '../../../.build/api/apps/api/src/content/store.js';
import {ContentService} from '../../../.build/api/apps/api/src/content/service.js';
import {startApi} from '../src/server.mjs';
const headers={'Authorization':'Bearer personalos-local-demo','Content-Type':'application/json'};
test('PostgreSQL-backed Nest HTTP survives separate worker completion and fresh API restart',{skip:!process.env.DATABASE_URL},async()=>{
  const schema=`test_process_${randomUUID().replaceAll('-','')}`,pool=new pg.Pool({connectionString:process.env.DATABASE_URL});await pool.query(`CREATE SCHEMA ${schema}`);const parsed=new URL(process.env.DATABASE_URL);parsed.searchParams.set('options',`-c search_path=${schema}`);const url=parsed.toString();let runtime,worker;
  async function post(origin,path,body){const res=await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.ok(res.ok,await res.clone().text());return res.json();}
  async function stopWorker(){if(worker&&worker.exitCode===null){const closed=once(worker,'close');worker.kill('SIGTERM');await closed;}worker=undefined;}
  try{
    let store=new PostgresStore(url);await store.migrate();runtime=await startApi({port:0,service:new ContentService(store)});let origin=`http://127.0.0.1:${runtime.server.address().port}`;
    await post(origin,'/api/v1/admin/fixtures',{idempotencyKey:'process-fixtures'});const {topics}=await post(origin,'/api/v1/admin/group',{idempotencyKey:'process-group'});const {job}=await post(origin,'/api/v1/admin/jobs',{idempotencyKey:'process-generate',topicId:topics[0].id});assert.equal(job.state,'queued');
    const env={...process.env,DATABASE_URL:url,PERSONALOS_MODE:'token'};delete env.PERSONALOS_ADMIN_TOKEN;delete env.PERSONALOS_REVIEW_TOKEN;let stderr='';worker=spawn(process.execPath,['.build/api/apps/api/src/worker-main.js'],{env,stdio:['ignore','pipe','pipe']});worker.stderr.on('data',chunk=>{stderr+=chunk;});
    let result;for(let i=0;i<100;i++){result=await(await fetch(origin+`/api/v1/admin/jobs/${job.id}`,{headers})).json();if(result.job.state==='succeeded')break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(result.job.state,'succeeded',stderr);const revisionId=result.job.revisionId;await stopWorker();await runtime.close();runtime=undefined;
    store=new PostgresStore(url);await store.migrate();runtime=await startApi({port:0,service:new ContentService(store)});origin=`http://127.0.0.1:${runtime.server.address().port}`;
    const resumed=await(await fetch(origin+`/api/v1/admin/jobs/${job.id}`,{headers})).json();assert.equal(resumed.job.state,'succeeded');assert.equal(resumed.job.revisionId,revisionId);assert.equal(resumed.revision.validation.valid,true);
  }finally{await stopWorker();await runtime?.close();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();}
});
