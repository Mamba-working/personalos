import assert from 'node:assert/strict';
import {serviceFromEnvironment} from '../../../.build/api/apps/api/src/bootstrap.js';
import {GenerationWorker} from '../../../.build/api/apps/api/src/content/worker.js';
const service=await serviceFromEnvironment(),worker=new GenerationWorker(service);
try{
  const seed=await service.seed({idempotencyKey:'demo-fixtures-v1'}),grouped=await service.group({idempotencyKey:'demo-group-envelope-v1'});
  for(const topic of grouped.topics)await service.enqueue({idempotencyKey:`demo-generate-envelope-v1:${topic.id}`,topicId:topic.id});
  while(await worker.tick()){}
  const snapshot=await service.snapshot();
  assert.ok(snapshot.articles.every(a=>a.latestRevision?.validation.valid));
  // Do not auto-approve or publish: the independent review UI owns that deliberate human step.
  console.log(JSON.stringify({demo:'capture/group → generate/validate → human review required',storageAdapter:service.store.kind,syntheticSources:seed.sources.length,topics:grouped.topics.length,articles:snapshot.articles.map(a=>({articleId:a.id,revisionId:a.latestRevision.id,contentHash:a.latestRevision.contentHash,reviewPath:`/?article=${a.id}`,validated:a.latestRevision.validation.valid})),generator:'controlled-mock',externalModelCalls:0,humanApprovalGranted:false},null,2));
}finally{await worker.stop();await service.store.close();}
