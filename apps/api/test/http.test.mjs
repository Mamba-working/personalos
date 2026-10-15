import test from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from '../src/server.mjs';
const admin={'Authorization':'Bearer personalos-local-demo','Content-Type':'application/json'};
const human={...admin,'X-PersonalOS-Review-Token':'personalos-local-review'};
async function withApi(run){const runtime=await startApi({port:0,embeddedWorker:true});try{await run(`http://127.0.0.1:${runtime.server.address().port}`);}finally{await runtime.close();}}
async function request(origin,path,body,headers=admin,method='POST'){const res=await fetch(origin+path,{method,headers,body:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
test('anonymous clients cannot inspect private admin sources, jobs or drafts; cross-site calls rejected',()=>withApi(async origin=>{
  for(const path of ['/api/v1/admin/snapshot','/api/v1/admin/jobs/job_unknown','/api/v1/admin/articles/article_unknown']){const res=await fetch(origin+path);assert.equal(res.status,401);assert.equal((await res.json()).error.code,'unauthorized');}
  const rejected=await request(origin,'/api/v1/admin/fixtures',{idempotencyKey:'fixtures'},{...admin,Origin:'https://evil.example.invalid'});assert.equal(rejected.status,403);assert.equal(rejected.body.error.code,'origin_forbidden');assert.deepEqual(await(await fetch(origin+'/api/v1/public/articles')).json(),{articles:[]});
}));
test('strict request bounds reject malformed JSON, oversized payload, missing permission and extra fields',()=>withApi(async origin=>{
  let res=await fetch(origin+'/api/v1/admin/captures',{method:'POST',headers:admin,body:'{'});assert.equal(res.status,400);
  res=await fetch(origin+'/api/v1/admin/captures',{method:'POST',headers:admin,body:JSON.stringify({content:'x'.repeat(140000)})});assert.equal(res.status,413);
  const missing=await request(origin,'/api/v1/admin/captures',{idempotencyKey:'invalid'});assert.equal(missing.status,422);assert.equal(missing.body.error.code,'invalid_input');
  const extra=await request(origin,'/api/v1/admin/jobs',{idempotencyKey:'invalid',topicId:'topic_x',approve:true});assert.equal(extra.status,422);
}));
test('actual HTTP runs capture/group/generate/validate/human-review/publish while generation has no publish authority',()=>withApi(async origin=>{
  let result=await request(origin,'/api/v1/admin/fixtures',{idempotencyKey:'fixtures'});assert.equal(result.status,200);assert.equal(result.body.synthetic,true);
  result=await request(origin,'/api/v1/admin/group',{idempotencyKey:'group'});assert.equal(result.status,200);const topic=result.body.topics[0];
  result=await request(origin,'/api/v1/admin/jobs',{idempotencyKey:'generate',topicId:topic.id});assert.equal(result.status,202);let job=result.body.job;
  for(let i=0;i<30&&job.state!=='succeeded';i++){await new Promise(r=>setTimeout(r,50));job=(await(await fetch(origin+`/api/v1/admin/jobs/${job.id}`,{headers:admin})).json()).job;}
  assert.equal(job.state,'succeeded');const detail=await(await fetch(origin+`/api/v1/admin/articles/${job.articleId}`,{headers:admin})).json(),revision=detail.latestRevision;
  assert.equal(revision.validation.valid,true);assert.deepEqual((await(await fetch(origin+'/api/v1/public/articles')).json()).articles,[]);
  const publishInput={idempotencyKey:'publish',revisionId:revision.id,contentHash:revision.contentHash};
  result=await request(origin,`/api/v1/admin/articles/${job.articleId}/publish`,publishInput);assert.equal(result.status,403);assert.equal(result.body.error.code,'human_review_required');
  result=await request(origin,`/api/v1/admin/articles/${job.articleId}/publish`,publishInput,human);assert.equal(result.status,409);assert.equal(result.body.error.code,'approval_required');
  result=await request(origin,`/api/v1/admin/articles/${job.articleId}/approve`,{idempotencyKey:'approve',revisionId:revision.id,contentHash:revision.contentHash,reviewer:'Local synthetic reviewer',reviewIntent:'human-reviewed-exact-revision'},human);assert.equal(result.status,200);
  result=await request(origin,`/api/v1/admin/articles/${job.articleId}/publish`,publishInput,human);assert.equal(result.status,200);
  const publicResult=await(await fetch(origin+`/api/v1/public/articles/${detail.article.slug}`)).json();assert.equal(publicResult.article.revisionId,revision.id);assert.ok(!JSON.stringify(publicResult).includes('sourceRefs'));assert.ok(!JSON.stringify(publicResult).includes('Synthetic architecture workshop'));
}));
test('local-demo API refuses a network interface bind',async()=>{await assert.rejects(startApi({host:'0.0.0.0',port:0}),/non-loopback/);});
test('actual HTTP conversation returns native draft references and never an approval',()=>withApi(async origin=>{
  let result=await request(origin,'/api/v1/admin/conversations',{idempotencyKey:'http-chat',title:'A random topic outside the source fixture categories'});assert.equal(result.status,200);const id=result.body.conversation.id;
  result=await request(origin,`/api/v1/admin/conversations/${id}/messages`,{idempotencyKey:'http-chat-turn',content:'Make a native interactive explanation; mock generation is explicit.'});assert.equal(result.status,202);let job=result.body.job;
  for(let i=0;i<40&&job.state!=='succeeded';i++){await new Promise(r=>setTimeout(r,50));job=(await(await fetch(origin+`/api/v1/admin/jobs/${job.id}`,{headers:admin})).json()).job;}assert.equal(job.state,'succeeded');
  const detail=await(await fetch(origin+`/api/v1/admin/conversations/${id}`,{headers:admin})).json();assert.equal(detail.messages.length,2);assert.equal(detail.artifacts.length,1);const artifact=detail.artifacts[0];assert.equal(artifact.presentation.rendererId,'copilotkit-openintelligentui');assert.ok(Array.isArray(artifact.presentation.spec.html));assert.equal(typeof artifact.presentation.spec.jsFunctions,'string');
  result=await request(origin,`/api/v1/admin/conversations/${id}/artifacts/${artifact.revisionId}/save`,{idempotencyKey:'http-chat-save'});assert.equal(result.status,200);assert.equal(result.body.revisionId,artifact.revisionId);const article=await(await fetch(origin+`/api/v1/admin/articles/${artifact.articleId}`,{headers:admin})).json();assert.equal(article.approval,null);assert.deepEqual((await(await fetch(origin+'/api/v1/public/articles')).json()).articles,[]);
}));
