import {createHash,randomUUID,randomBytes} from 'node:crypto';
import type {Source,SourceVersion,SourceRef,Topic,Article,Revision,Approval,Publication,PublicArticle,Job,ExtractedItem,Snapshot,ArticleDetail,NativeArtifact,Conversation,ConversationMessage,ConversationDetail,ConversationArtifact} from '../../../../packages/contracts/content.js';
import {ContentError,invariant} from './errors.js';
import {captureSchema,groupSchema,jobSchema,keySchema,revisionSchema,approveSchema,publishSchema,rollbackSchema,readerWriteSchema,conversationSchema,conversationMessageSchema,parse,validId} from './inputs.js';
import {GENERATOR,RENDERER_VERSION,RENDERER_DESCRIPTOR,CALCULATOR_VERSION,generateMockArticle,validateArticleSpec,updateArtifactMetadata} from './generator.js';
import {syntheticFixtures} from './fixtures.js';
import type {ContentStore,Transaction,InternalJob} from './store.js';
export const BACKEND_DEMO_VERSION='0.1.0-demo.1';
const now=()=>new Date().toISOString();
const newId=(prefix:string)=>`${prefix}_${randomUUID().replaceAll('-','')}`;
export function canonical(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
}
export const hash=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
export const publicJob=(job:InternalJob):Job=>{const {topicSnapshot,fence,leaseUntil,availableAt,failureMode,workerId,conversationContext,...safe}=job;return safe;};
type StoredSource=Omit<Source,'versions'> & {aliases:string[]};
type IdempotencyRecord={requestHash:string;result:unknown};
type StoredRevision=Omit<Revision,'rendererVersion'>;
// A neutral envelope retains the protocol-native payload; no translation to a new DSL.
function revisionView(value:StoredRevision|Revision):Revision{
  const {spec:legacySpec,rendererVersion:legacyVersion,...stored}=value as StoredRevision & {spec?:unknown;rendererVersion?:string};
  const presentation=value.presentation??{rendererId:'legacy-unbound-json-render',protocolVersion:'0.21.1',catalogVersion:'unbound-checkpoint',spec:legacySpec};
  return {...stored,presentation:structuredClone(presentation),rendererVersion:`${presentation.rendererId}@${presentation.protocolVersion}/${presentation.catalogVersion}`};
}
type Pointer={articleId:string;publicationId:string};
type Reader={id:string;capabilityHash:string;createdAt:string};
export class ContentService {
  readonly store:ContentStore;
  readonly allowFailureFixtures:boolean;
  constructor(store:ContentStore,{allowFailureFixtures=false}:{allowFailureFixtures?:boolean}={}){this.store=store;this.allowFailureFixtures=allowFailureFixtures;}
  private compatible(revision:Revision){invariant(canonical((({spec,...descriptor})=>descriptor)(revision.presentation))===canonical(RENDERER_DESCRIPTOR)&&revision.calculatorVersion===CALCULATOR_VERSION&&canonical(revision.generator)===canonical(GENERATOR),409,'capability_version_changed','This revision needs regeneration and a fresh review under the current generator, renderer, and calculator versions');}
  private async idempotent<T>(tx:Transaction,action:string,key:string,input:unknown,run:()=>Promise<T>):Promise<T>{
    const recordId=hash(`${action}:${key}`),requestHash=hash(input);
    const existing=await tx.get<IdempotencyRecord>('idempotency',recordId);
    if(existing){invariant(existing.requestHash===requestHash,409,'idempotency_conflict','This idempotency key was used with different input');return existing.result as T;}
    const result=await run();await tx.insert('idempotency',recordId,{requestHash,result});return result;
  }
  async capture(raw:unknown){const input=parse(captureSchema,raw);return this.store.transaction(tx=>this.captureTx(tx,input));}
  private async captureTx(tx:Transaction,input:ReturnType<typeof captureSchema.parse>):Promise<{source:Source;duplicate:boolean}>{
    return this.idempotent(tx,'capture',input.idempotencyKey,input,async()=>{
      const sources=await tx.list<StoredSource>('sources');
      const content=input.content,contentHash=hash(content);
      const captureHash=hash({content,title:input.title,origin:input.origin,provenance:input.provenance,publicCitation:input.publicCitation});
      let source=sources.find(s=>s.externalId===input.externalId||s.aliases.includes(input.externalId));
      const versions=await tx.list<SourceVersion & {captureHash:string}>('sourceVersions');
      if(!source){
        const exact=versions.find(v=>v.captureHash===captureHash);
        if(exact){source=sources.find(s=>s.id===exact.sourceId);if(source){source.aliases.push(input.externalId);await tx.put('sources',source.id,source);return {source:await this.hydrateSource(tx,source),duplicate:true};}}
      }
      if(source){const latest=versions.find(v=>v.id===source!.latestVersionId);if(latest?.captureHash===captureHash)return {source:await this.hydrateSource(tx,source),duplicate:true};}
      const sourceId=source?.id??newId('src'),versionId=newId('sv'),createdAt=now();
      const sourceRef:SourceRef={sourceId,versionId,contentHash};
      const version:SourceVersion & {captureHash:string}={id:versionId,sourceId,number:versions.filter(v=>v.sourceId===sourceId).length+1,contentHash,captureHash,title:input.title,content,origin:input.origin,provenance:input.provenance,...(input.publicCitation?{publicCitation:input.publicCitation}:{}),extracted:extract(content,sourceRef),createdAt};
      await tx.insert('sourceVersions',versionId,version);
      source={id:sourceId,externalId:source?.externalId??input.externalId,latestVersionId:versionId,aliases:source?.aliases??[],createdAt:source?.createdAt??createdAt};
      await tx.put('sources',sourceId,source);return {source:await this.hydrateSource(tx,source),duplicate:false};
    });
  }
  private async hydrateSource(tx:Transaction,source:StoredSource):Promise<Source>{const {aliases,...safe}=source;return {...safe,versions:(await tx.list<SourceVersion>('sourceVersions')).filter(v=>v.sourceId===source.id).sort((a,b)=>a.number-b.number)};}
  async seed(raw:unknown){const input=parse(keySchema,raw);return this.store.transaction(tx=>this.idempotent(tx,'fixtures',input.idempotencyKey,input,async()=>{
    const results=[];for(const [index,fixture]of syntheticFixtures.entries())results.push(await this.captureTx(tx,{...fixture,idempotencyKey:`${input.idempotencyKey}.source.${index}`}));
    return {sources:results.map(r=>r.source),synthetic:true,modelCalls:0};
  }));}
  async group(raw:unknown){const input=parse(groupSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,'group',input.idempotencyKey,input,async()=>{
    const sources=await tx.list<StoredSource>('sources');
    if(input.sourceIds)for(const id of input.sourceIds)invariant(sources.some(s=>s.id===id),404,'source_not_found','A selected source does not exist');
    const selected=input.sourceIds?sources.filter(s=>input.sourceIds!.includes(s.id)):sources;
    invariant(selected.length>0,422,'no_sources','Capture at least one authorized source first');
    const groups=new Map<string,SourceVersion[]>(),selectedIds=new Set(selected.map(s=>s.id));
    for(const previous of await tx.list<Topic>('topics')){
      const retained:SourceVersion[]=[];
      if(input.sourceIds)for(const ref of previous.sourceRefs)if(!selectedIds.has(ref.sourceId)){const version=await tx.get<SourceVersion>('sourceVersions',ref.versionId);if(version)retained.push(version);}
      groups.set(previous.slug,retained);
    }
    for(const source of selected){const version=await tx.get<SourceVersion>('sourceVersions',source.latestVersionId);invariant(version,500,'source_version_missing','Source version is missing');const slug=topicSlug(version);groups.set(slug,[...(groups.get(slug)??[]),version]);}
    for(const [slug,versions]of groups){
      const id=`topic_${slug.replaceAll('-','_')}`,sourceRefs=versions.map(v=>({sourceId:v.sourceId,versionId:v.id,contentHash:v.contentHash})).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
      sourceRefs.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
      const topic:Topic={id,slug,title:topicTitle(slug),sourceRefs,items:versions.flatMap(v=>v.extracted),inputHash:hash({sourceRefs,generator:GENERATOR,presentation:RENDERER_DESCRIPTOR,calculatorVersion:CALCULATOR_VERSION}),updatedAt:now()};
      await tx.put('topics',id,topic);
    }
    return {topics:(await tx.list<Topic>('topics')).filter(t=>t.sourceRefs.length>0)};
  }));}
  async enqueue(raw:unknown){const input=parse(jobSchema,raw);invariant(!input.simulateFailureOnce||this.allowFailureFixtures,403,'fixture_disabled','Failure simulation is disabled');return this.store.transaction(tx=>this.idempotent(tx,'enqueue',input.idempotencyKey,input,async()=>{
    const topic=await tx.get<Topic>('topics',input.topicId);invariant(topic,404,'topic_not_found','Topic does not exist');invariant(topic.sourceRefs.length>0,422,'topic_empty','Topic no longer has grouped sources');
    const jobs=await tx.list<InternalJob>('jobs');
    const reusable=jobs.find(j=>j.topicId===topic.id&&j.inputHash===topic.inputHash&&['queued','running','validating','succeeded'].includes(j.state)&&!input.simulateFailureOnce);
    if(reusable)return {job:publicJob(reusable),incrementalReuse:true};
    let article=(await tx.list<Article>('articles')).find(a=>a.topicId===topic.id);
    const createdAt=now();if(!article){article={id:newId('article'),topicId:topic.id,slug:topic.slug,latestRevisionId:null,createdAt};await tx.insert('articles',article.id,article);}
    const job:InternalJob={id:newId('job'),topicId:topic.id,articleId:article.id,inputHash:topic.inputHash,state:'queued',attempt:0,maxAttempts:3,revisionId:null,error:null,events:[{state:'queued',at:createdAt}],createdAt,updatedAt:createdAt,topicSnapshot:topic,fence:0,leaseUntil:null,availableAt:Date.now(),...(input.simulateFailureOnce?{failureMode:'once' as const}:{})};
    await tx.insert('jobs',job.id,job);return {job:publicJob(job),incrementalReuse:false};
  }));}
  async getJob(id:string){validId(id);return this.store.transaction(async tx=>{const job=await tx.get<InternalJob>('jobs',id);invariant(job,404,'job_not_found','Job does not exist');return {job:publicJob(job),...(job.revisionId?{revision:revisionView((await tx.get<StoredRevision>('revisions',job.revisionId))!)}:{})};});}
  async retry(id:string,raw:unknown){validId(id);const input=parse(keySchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`retry:${id}`,input.idempotencyKey,input,async()=>{
    const job=await tx.get<InternalJob>('jobs',id);invariant(job,404,'job_not_found','Job does not exist');invariant(job.state==='failed',409,'job_not_failed','Only failed jobs can be retried');invariant(job.attempt<job.maxAttempts,409,'attempts_exhausted','Job has reached its attempt limit');
    job.state='queued';job.leaseUntil=null;job.availableAt=Date.now()+Math.min(250*2**Math.max(0,job.attempt-1),2000);job.updatedAt=now();job.events.push({state:'queued',at:job.updatedAt,note:'Explicit bounded retry with backoff'});await tx.put('jobs',id,job);return {job:publicJob(job)};
  }));}
  async articleDetail(id:string):Promise<ArticleDetail>{validId(id);return this.store.transaction(tx=>this.detailTx(tx,id));}
  private async detailTx(tx:Transaction,id:string):Promise<ArticleDetail>{
    const article=await tx.get<Article>('articles',id);invariant(article,404,'article_not_found','Article does not exist');
    const revisions=(await tx.list<StoredRevision>('revisions')).filter(r=>r.articleId===id).map(revisionView).sort((a,b)=>b.number-a.number);
    const approvals=(await tx.list<Approval>('approvals')).filter(a=>a.articleId===id&&!a.invalidatedAt&&a.revisionId===article.latestRevisionId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const pointer=await tx.get<Pointer>('pointers',id);
    return {article,revisions,latestRevision:revisions.find(r=>r.id===article.latestRevisionId)??null,approval:approvals[0]??null,publication:pointer?await tx.get<Publication>('publications',pointer.publicationId):null};
  }
  async snapshot():Promise<Snapshot>{return this.store.transaction(async tx=>{
    const stored=await tx.list<StoredSource>('sources'),sources=[];for(const s of stored)sources.push(await this.hydrateSource(tx,s));
    const articles=[];for(const article of await tx.list<Article>('articles')){const detail=await this.detailTx(tx,article.id);articles.push({...article,latestRevision:detail.latestRevision,approval:detail.approval,publication:detail.publication});}
    return {sources,topics:(await tx.list<Topic>('topics')).filter(t=>t.sourceRefs.length>0),articles,jobs:(await tx.list<InternalJob>('jobs')).map(publicJob),publications:await tx.list<Publication>('publications'),conversations:await tx.list<Conversation>('conversations')};
  });}
  async edit(id:string,raw:unknown){validId(id);const input=parse(revisionSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`edit:${id}`,input.idempotencyKey,input,async()=>{
    const detail=await this.detailTx(tx,id),base=detail.latestRevision;
    invariant(base&&base.id===input.baseRevisionId,409,'stale_revision','Edit must be based on the current draft revision');
    const supplied=structuredClone(input.spec??base.presentation.spec) as NativeArtifact;
    invariant(validateArticleSpec(supplied).valid,422,'invalid_spec','Native artifact shape or size is invalid');
    const title=input.title??base.title,summary=input.summary??base.summary;
    const spec=updateArtifactMetadata(supplied,title,summary);
    const validation=validateArticleSpec(spec);invariant(validation.valid,422,'invalid_spec','Edited article spec failed validation');
    const revision=await this.insertRevision(tx,detail.article,{title,summary,spec,sourceRefs:base.sourceRefs,inputHash:base.inputHash});return {revision,validation:revision.validation};
  }));}
  private async insertRevision(tx:Transaction,article:Article,value:{title:string;summary:string;spec:NativeArtifact;sourceRefs:SourceRef[];inputHash:string}):Promise<Revision>{
    const validation=validateArticleSpec(value.spec);invariant(validation.valid,422,'invalid_spec','Article spec failed validation');
    const revisions=(await tx.list<Revision>('revisions')).filter(r=>r.articleId===article.id);
    const {spec,...content}=value;
    const body={...content,presentation:{...RENDERER_DESCRIPTOR,spec:structuredClone(spec)},generator:{...GENERATOR},calculatorVersion:CALCULATOR_VERSION as Revision['calculatorVersion']};
    const contentHash=hash(body),stored:StoredRevision={id:newId('rev'),articleId:article.id,number:revisions.length+1,...body,contentHash,validation,createdAt:now()};
    const revision=revisionView(stored);
    await tx.insert('revisions',revision.id,stored);
    // Asset bytes are immutable DB records, never served by a generic storage path.
    await tx.insert('assets',revision.id,{id:revision.id,contentHash,projection:publicProjection(article,revision,'')});
    article.latestRevisionId=revision.id;await tx.put('articles',article.id,article);
    for(const approval of await tx.list<Approval>('approvals'))if(approval.articleId===article.id&&!approval.invalidatedAt){approval.invalidatedAt=revision.createdAt;await tx.put('approvals',approval.id,approval);}
    return revision;
  }
  async approve(id:string,raw:unknown){validId(id);const input=parse(approveSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`approve:${id}`,input.idempotencyKey,input,async()=>{
    const detail=await this.detailTx(tx,id),revision=detail.latestRevision;
    invariant(revision&&revision.id===input.revisionId&&revision.contentHash===input.contentHash,409,'stale_revision','Review must target the current exact revision and hash');
    this.compatible(revision);
    invariant(revision.validation.valid&&validateArticleSpec(revision.presentation.spec).valid,422,'invalid_revision','Only validated revisions can be approved');
    if(detail.approval)return {approval:detail.approval};
    const approval:Approval={id:newId('approval'),articleId:id,revisionId:revision.id,contentHash:revision.contentHash,reviewer:input.reviewer,reviewIntent:input.reviewIntent,invalidatedAt:null,createdAt:now()};await tx.insert('approvals',approval.id,approval);return {approval};
  }));}
  async publish(id:string,raw:unknown){validId(id);const input=parse(publishSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`publish:${id}`,input.idempotencyKey,input,async()=>{
    const detail=await this.detailTx(tx,id),revision=detail.latestRevision;
    invariant(revision&&revision.id===input.revisionId&&revision.contentHash===input.contentHash,409,'stale_revision','Publish must target the current exact revision and hash');
    this.compatible(revision);
    invariant(detail.approval&&detail.approval.revisionId===revision.id&&detail.approval.contentHash===revision.contentHash,409,'approval_required','Human approval of this exact revision is required');
    const publication:Publication={id:newId('pub'),articleId:id,revisionId:revision.id,contentHash:revision.contentHash,approvalId:detail.approval.id,previousPublicationId:detail.publication?.id??null,kind:'publish',createdAt:now()};
    await tx.insert('publications',publication.id,publication);await tx.put('pointers',id,{articleId:id,publicationId:publication.id});return {publication};
  }));}
  async rollback(id:string,raw:unknown){validId(id);const input=parse(rollbackSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`rollback:${id}`,input.idempotencyKey,input,async()=>{
    const detail=await this.detailTx(tx,id),target=await tx.get<Publication>('publications',input.publicationId);
    invariant(target&&target.articleId===id,404,'publication_not_found','Rollback target is not a historical publication of this article');
    const storedRevision=await tx.get<StoredRevision>('revisions',target.revisionId),revision=storedRevision?revisionView(storedRevision):null,approval=await tx.get<Approval>('approvals',target.approvalId);
    invariant(revision&&approval&&approval.revisionId===revision.id&&approval.contentHash===revision.contentHash,409,'approval_required','Historical publication has no matching approval');
    this.compatible(revision);
    const publication:Publication={id:newId('pub'),articleId:id,revisionId:revision.id,contentHash:revision.contentHash,approvalId:approval.id,previousPublicationId:detail.publication?.id??null,kind:'rollback',createdAt:now()};
    await tx.insert('publications',publication.id,publication);await tx.put('pointers',id,{articleId:id,publicationId:publication.id});return {publication};
  }));}
  async publicArticles():Promise<{articles:PublicArticle[]}>{return this.store.transaction(async tx=>{const articles=[];for(const pointer of await tx.list<Pointer>('pointers'))articles.push(await this.publicTx(tx,pointer));return {articles};});}
  async publicArticle(slug:string):Promise<{article:PublicArticle}>{invariant(/^[a-z0-9-]{1,100}$/.test(slug),404,'article_not_found','Article does not exist');return this.store.transaction(async tx=>{const article=(await tx.list<Article>('articles')).find(a=>a.slug===slug);const pointer=article?await tx.get<Pointer>('pointers',article.id):null;invariant(pointer,404,'article_not_found','No published article exists at this address');return {article:await this.publicTx(tx,pointer)};});}
  private async publicTx(tx:Transaction,pointer:Pointer):Promise<PublicArticle>{const publication=await tx.get<Publication>('publications',pointer.publicationId);invariant(publication,500,'publication_missing','Publication is missing');const article=await tx.get<Article>('articles',pointer.articleId),storedRevision=await tx.get<StoredRevision>('revisions',publication.revisionId),revision=storedRevision?revisionView(storedRevision):null;invariant(article&&revision,500,'published_revision_missing','Published revision is missing');this.compatible(revision);return publicProjection(article,revision,publication.createdAt);}
  async createReader(){const capability=randomBytes(32).toString('base64url'),reader:Reader={id:newId('reader'),capabilityHash:hash(capability),createdAt:now()};await this.store.transaction(tx=>tx.insert('readers',reader.id,reader));return {readerId:reader.id,capability};}
  private async checkReader(tx:Transaction,readerId:string,capability:string){validId(readerId);const reader=await tx.get<Reader>('readers',readerId);invariant(reader&&hash(capability)===reader.capabilityHash,403,'reader_forbidden','Reader capability is invalid');}
  async readProgress(readerId:string,slug:string,capability:string){return this.store.transaction(async tx=>{await this.checkReader(tx,readerId,capability);return {state:await tx.get('readerState',hash(`${readerId}:${slug}`))??null};});}
  async writeProgress(readerId:string,slug:string,capability:string,raw:unknown){const input=parse(readerWriteSchema,raw);return this.store.transaction(async tx=>{await this.checkReader(tx,readerId,capability);const article=(await tx.list<Article>('articles')).find(a=>a.slug===slug),pointer=article?await tx.get<Pointer>('pointers',article.id):null,publication=pointer?await tx.get<Publication>('publications',pointer.publicationId):null;invariant(publication&&publication.revisionId===input.revisionId,409,'stale_publication','Progress must reference the current published revision');const state={readerId,slug,revisionId:input.revisionId,progress:input.progress,updatedAt:now()};await tx.put('readerState',hash(`${readerId}:${slug}`),state);return {state};});}
  async createConversation(raw:unknown){const input=parse(conversationSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,'conversation-create',input.idempotencyKey,input,async()=>{const createdAt=now(),conversation:Conversation={id:newId('conv'),title:input.title??'新对话',articleId:null,createdAt,updatedAt:createdAt};await tx.insert('conversations',conversation.id,conversation);return {conversation,messages:[],jobs:[],artifacts:[]};}));}
  async conversationDetail(id:string):Promise<ConversationDetail>{validId(id);return this.store.transaction(async tx=>{
    const conversation=await tx.get<Conversation>('conversations',id);invariant(conversation,404,'conversation_not_found','Conversation does not exist');
    const messages=(await tx.list<ConversationMessage>('conversationMessages')).filter(m=>m.conversationId===id).sort((a,b)=>a.sequence-b.sequence),artifacts:ConversationArtifact[]=[];
    for(const message of messages){if(!message.artifactRef)continue;const stored=await tx.get<StoredRevision>('revisions',message.artifactRef.revisionId);if(!stored)continue;const revision=revisionView(stored),saved=await tx.get('draftBindings',hash(`${id}:${revision.id}`));artifacts.push({...message.artifactRef,title:revision.title,summary:revision.summary,presentation:revision.presentation,validation:revision.validation,savedToDraft:!!saved});}
    return {conversation,messages,jobs:(await tx.list<InternalJob>('jobs')).filter(j=>j.conversationContext?.conversationId===id).map(publicJob),artifacts};
  });}
  async sendConversationMessage(id:string,raw:unknown){validId(id);const input=parse(conversationMessageSchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`conversation-message:${id}`,input.idempotencyKey,input,async()=>{
    const conversation=await tx.get<Conversation>('conversations',id);invariant(conversation,404,'conversation_not_found','Conversation does not exist');
    const messages=(await tx.list<ConversationMessage>('conversationMessages')).filter(m=>m.conversationId===id),jobs=await tx.list<InternalJob>('jobs');invariant(messages.length<100,422,'conversation_limit','This minimal demo supports at most 100 messages per conversation');
    invariant(!jobs.some(j=>j.conversationContext?.conversationId===id&&['queued','running','validating'].includes(j.state)),409,'conversation_busy','Wait for the current artifact job to finish');
    let article=conversation.articleId?await tx.get<Article>('articles',conversation.articleId):null;
    if(article?.latestRevisionId)invariant(input.baseRevisionId===article.latestRevisionId,409,'stale_revision','Follow-up must reference the current exact artifact revision');else invariant(!input.baseRevisionId,409,'stale_revision','This conversation has no artifact revision yet');
    const createdAt=now(),userMessage:ConversationMessage={id:newId('message'),conversationId:id,sequence:messages.length+1,role:'user',content:input.content,createdAt};await tx.insert('conversationMessages',userMessage.id,userMessage);
    if(conversation.title==='新对话')conversation.title=input.content.trim().replace(/\s+/g,' ').slice(0,120);
    const turn=messages.filter(m=>m.role==='user').length+1,topicId=`topic_chat_${hash(id).slice(0,24)}`;
    const inputHash=hash({conversationId:id,userMessageId:userMessage.id,promptHash:hash(input.content),baseRevisionId:article?.latestRevisionId??null,presentation:RENDERER_DESCRIPTOR,generator:GENERATOR,calculatorVersion:CALCULATOR_VERSION});
    const topic:Topic={id:topicId,slug:`conversation-${hash(id).slice(0,16)}`,title:turn>1?`${conversation.title} · 追问 ${turn}`:conversation.title,sourceRefs:[],items:[],inputHash,updatedAt:createdAt};await tx.put('conversationTopics',topic.id,topic);
    if(!article){article={id:newId('article'),topicId:topic.id,slug:topic.slug,latestRevisionId:null,createdAt};await tx.insert('articles',article.id,article);conversation.articleId=article.id;}
    const job:InternalJob={id:newId('job'),topicId:topic.id,articleId:article.id,inputHash,state:'queued',attempt:0,maxAttempts:3,revisionId:null,error:null,events:[{state:'queued',at:createdAt}],createdAt,updatedAt:createdAt,topicSnapshot:topic,fence:0,leaseUntil:null,availableAt:Date.now(),conversationContext:{conversationId:id,userMessageId:userMessage.id,baseRevisionId:article.latestRevisionId,prompt:input.content}};
    await tx.insert('jobs',job.id,job);conversation.updatedAt=createdAt;await tx.put('conversations',id,conversation);return {conversation,userMessage,job:publicJob(job)};
  }));}
  async saveConversationArtifact(id:string,revisionId:string,raw:unknown){validId(id);validId(revisionId);const input=parse(keySchema,raw);return this.store.transaction(tx=>this.idempotent(tx,`conversation-save:${id}:${revisionId}`,input.idempotencyKey,input,async()=>{
    const conversation=await tx.get<Conversation>('conversations',id);invariant(conversation,404,'conversation_not_found','Conversation does not exist');const message=(await tx.list<ConversationMessage>('conversationMessages')).find(m=>m.conversationId===id&&m.artifactRef?.revisionId===revisionId);invariant(message?.artifactRef,404,'artifact_not_found','Artifact does not belong to this conversation');
    const stored=await tx.get<StoredRevision>('revisions',revisionId);invariant(stored&&stored.articleId===conversation.articleId,404,'artifact_not_found','Artifact does not belong to this conversation');const revision=revisionView(stored);this.compatible(revision);const article=await tx.get<Article>('articles',revision.articleId);invariant(article?.latestRevisionId===revisionId,409,'stale_revision','Only the current artifact can be saved as the active review draft');
    const key=hash(`${id}:${revisionId}`);if(!await tx.get('draftBindings',key))await tx.insert('draftBindings',key,{conversationId:id,...message.artifactRef,savedAt:now()});return {...message.artifactRef,reviewUrl:`http://127.0.0.1:3002/?article=${revision.articleId}`};
  }));}
  async finishJob(job:InternalJob){return this.store.transaction(async tx=>{
    const current=await tx.get<InternalJob>('jobs',job.id);invariant(current&&current.fence===job.fence&&current.workerId===job.workerId&&['running','validating'].includes(current.state),409,'worker_fenced','A stale worker cannot commit this job');
    const citations=[];for(const [index,ref]of current.topicSnapshot.sourceRefs.entries()){const source=await tx.get<SourceVersion>('sourceVersions',ref.versionId);if(source?.publicCitation)citations.push({id:`reference-${index+1}`,title:source.publicCitation.label,...(source.publicCitation.url?{url:source.publicCitation.url}:{})});}
    const article=await tx.get<Article>('articles',current.articleId);invariant(article,500,'article_missing','Article is missing');
    // A later completed input must never be overwritten by an older queued snapshot.
    const topic=await tx.get<Topic>(current.conversationContext?'conversationTopics':'topics',job.topicId);invariant(topic?.inputHash===job.inputHash,409,'stale_job_input','Sources changed after this job was queued; enqueue the current topic');
    if(current.conversationContext)invariant(article.latestRevisionId===current.conversationContext.baseRevisionId,409,'stale_artifact_base','Artifact changed while this follow-up was queued');
    const generated=generateMockArticle(current.topicSnapshot,citations);
    const revision=await this.insertRevision(tx,article,{...generated,sourceRefs:current.topicSnapshot.sourceRefs,inputHash:current.inputHash});
    if(current.conversationContext){const context=current.conversationContext,messages=(await tx.list<ConversationMessage>('conversationMessages')).filter(m=>m.conversationId===context.conversationId);const assistant:ConversationMessage={id:newId('message'),conversationId:context.conversationId,sequence:messages.length+1,role:'assistant',content:'已生成一份 OpenIntelligentUI 原生交互草稿。此为受控 mock，外部模型调用为 0；尚未批准或发布。',artifactRef:{articleId:article.id,revisionId:revision.id,contentHash:revision.contentHash},createdAt:now()};await tx.insert('conversationMessages',assistant.id,assistant);}
    current.state='succeeded';current.revisionId=revision.id;current.error=null;current.leaseUntil=null;current.updatedAt=now();current.events.push({state:'succeeded',at:current.updatedAt});await tx.put('jobs',current.id,current);return {job:publicJob(current),revision};
  });}
  async markValidating(job:InternalJob,leaseMs:number){return this.store.transaction(async tx=>{const current=await tx.get<InternalJob>('jobs',job.id);invariant(current&&current.fence===job.fence&&current.workerId===job.workerId,409,'worker_fenced','A stale worker cannot update this job');current.state='validating';current.updatedAt=now();current.leaseUntil=Date.now()+leaseMs;current.events.push({state:'validating',at:current.updatedAt});await tx.put('jobs',current.id,current);return current;});}
  async failJob(job:InternalJob,error:unknown){return this.store.transaction(async tx=>{const current=await tx.get<InternalJob>('jobs',job.id);if(!current||current.fence!==job.fence||current.workerId!==job.workerId)return;current.state='failed';current.leaseUntil=null;current.updatedAt=now();current.error={code:error instanceof ContentError?error.code:'generation_failed',message:error instanceof ContentError?error.message:'Controlled generator failed; retry from the review studio'};current.events.push({state:'failed',at:current.updatedAt,note:current.error.code});await tx.put('jobs',current.id,current);});}
}
function publicProjection(article:Article,revision:Revision,publishedAt:string):PublicArticle{
  // Explicit DTO. Never spread revisions/sources/approvals or expose generic asset retrieval.
  return {id:article.id,slug:article.slug,revisionId:revision.id,title:revision.title,summary:revision.summary,contentHash:revision.contentHash,presentation:structuredClone(revision.presentation),generator:{...revision.generator},publishedAt};
}
function extract(content:string,sourceRef:SourceRef):ExtractedItem[]{
  const kinds:Record<string,ExtractedItem['kind']>={fact:'fact',decision:'decision',uncertainty:'uncertainty','事实':'fact','决定':'decision','不确定':'uncertainty'};
  const items:ExtractedItem[]=[];
  for(const line of content.split('\n')){const match=line.match(/^\s*\[(fact|decision|uncertainty|事实|决定|不确定)\]\s*(.{1,2000})$/i);if(match)items.push({kind:kinds[match[1]!.toLowerCase()]!,text:match[2]!.trim(),sourceRef});if(items.length>=24)break;}
  return items.length?items:[{kind:'uncertainty',text:'此来源尚未包含可识别的结构化事实、决定或不确定项，等待人工整理。',sourceRef}];
}
function topicSlug(version:SourceVersion){const haystack=`${version.title}\n${version.content}`;return /并发|concurr|latency|吞吐|批次/i.test(haystack)?'concurrency-budget':/发布|审核|publish|approval|rollback/i.test(haystack)?'review-and-publish':'authorized-knowledge';}
function topicTitle(slug:string){return ({'concurrency-budget':'并发预算：让速度与代价一起可见','review-and-publish':'一个精确修订，才是一份可发布内容','authorized-knowledge':'从授权片段到可追溯知识'} as Record<string,string>)[slug]!;}
