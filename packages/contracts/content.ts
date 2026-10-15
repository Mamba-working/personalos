/** PersonalOS content demo contract v1. Type-only; native activity guards live in openintelligentui.mjs. */
export type CaptureOrigin = 'authorized-snippet' | 'uploaded-note' | 'synthetic-fixture';
export type CaptureInput = {
  idempotencyKey: string;
  externalId: string;
  title: string;
  content: string;
  origin: CaptureOrigin;
  permission: { confirmed: true; scope: 'selected-snippet' };
  provenance: { label: string; url?: string };
  publicCitation?: { label: string; url?: string };
};
export type SourceRef = {sourceId: string; versionId: string; contentHash: string};
export type ExtractedItem = {kind: 'fact' | 'decision' | 'uncertainty'; text: string; sourceRef: SourceRef};
export type SourceVersion = {id: string; sourceId: string; number: number; contentHash: string; title: string; content: string; origin: CaptureOrigin; provenance: {label: string; url?: string}; publicCitation?: {label: string; url?: string}; extracted: ExtractedItem[]; createdAt: string};
export type Source = {id: string; externalId: string; latestVersionId: string; versions: SourceVersion[]; createdAt: string};
export type Topic = {id: string; slug: string; title: string; sourceRefs: SourceRef[]; items: ExtractedItem[]; inputHash: string; updatedAt: string};
export type ValidationReport = {valid: boolean; errors: string[]; warnings: string[]; checks: string[]};
export type GeneratorIdentity = {kind: 'controlled-mock'; name: 'oiui-synthetic-artifact-v1'; modelCalls: 0};
export type NativeArtifact = {initialHeight:number;generating:false;css:string;cssComplete:true;html:string[];htmlComplete:true;jsFunctions:string;jsFunctionsComplete:true;jsExpressions:string[];jsExpressionsComplete:true};
export type PresentationEnvelope = {rendererId: string; protocolVersion: string; catalogVersion: string; upstreamCommit?:string; runtimeVersion?:string; sandboxPolicyVersion?:string; spec: unknown};
/** rendererVersion is a derived diagnostic view; presentation is the sole native-payload authority. */
export type Revision = {id: string; articleId: string; number: number; title: string; summary: string; contentHash: string; presentation: PresentationEnvelope; validation: ValidationReport; generator: GeneratorIdentity; sourceRefs: SourceRef[]; inputHash: string; rendererVersion: string; calculatorVersion: 'concurrency-v1'; createdAt: string};
export type Article = {id: string; topicId: string; slug: string; latestRevisionId: string | null; createdAt: string};
export type JobState = 'queued'|'running'|'validating'|'succeeded'|'failed';
export type Job = {id: string; topicId: string; articleId: string; inputHash: string; state: JobState; attempt: number; maxAttempts: number; revisionId: string | null; error: {code: string; message: string}|null; events: {state: JobState; at: string; note?: string}[]; createdAt: string; updatedAt: string};
export type Approval = {id: string; articleId: string; revisionId: string; contentHash: string; reviewer: string; reviewIntent: 'human-reviewed-exact-revision'; invalidatedAt: string|null; createdAt: string};
export type Publication = {id: string; articleId: string; revisionId: string; contentHash: string; approvalId: string; previousPublicationId: string|null; kind: 'publish'|'rollback'; createdAt: string};
export type PublicArticle = {id: string; slug: string; revisionId: string; title: string; summary: string; contentHash: string; presentation: PresentationEnvelope; generator: GeneratorIdentity; publishedAt: string};
export type Snapshot = {sources: Source[]; topics: Topic[]; articles: (Article & {latestRevision: Revision|null; approval: Approval|null; publication: Publication|null})[]; jobs: Job[]; publications: Publication[]; conversations?:Conversation[]};
export type ArticleDetail = {article: Article; revisions: Revision[]; latestRevision: Revision|null; approval: Approval|null; publication: Publication|null};
export type Conversation = {id:string;title:string;articleId:string|null;createdAt:string;updatedAt:string};
export type ConversationArtifactRef = {articleId:string;revisionId:string;contentHash:string};
export type ConversationMessage = {id:string;conversationId:string;sequence:number;role:'user'|'assistant';content:string;artifactRef?:ConversationArtifactRef;createdAt:string};
export type ConversationArtifact = ConversationArtifactRef & {title:string;summary:string;presentation:PresentationEnvelope;validation:ValidationReport;savedToDraft:boolean};
export type ConversationDetail = {conversation:Conversation;messages:ConversationMessage[];jobs:Job[];artifacts:ConversationArtifact[]};
