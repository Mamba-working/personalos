import {z} from 'zod';
import {ContentError} from './errors.js';
const short = z.string().trim().min(1).max(160);
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/);
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/);
const url = z.string().url().max(2000).refine(value=>{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;},'Only credential-free HTTP(S) URLs are allowed');
const citation = z.object({label:short,url:url.optional()}).strict();
export const captureSchema=z.object({idempotencyKey,externalId:short,title:short,content:z.string().min(1).max(32000).refine(value=>value.trim().length>0,'Source cannot be whitespace only'),origin:z.enum(['authorized-snippet','uploaded-note','synthetic-fixture']),permission:z.object({confirmed:z.literal(true),scope:z.literal('selected-snippet')}).strict(),provenance:citation,publicCitation:citation.optional()}).strict();
export const groupSchema=z.object({idempotencyKey,sourceIds:z.array(id).min(1).max(100).optional()}).strict();
export const jobSchema=z.object({idempotencyKey,topicId:id,simulateFailureOnce:z.boolean().optional()}).strict();
export const keySchema=z.object({idempotencyKey}).strict();
export const revisionSchema=z.object({idempotencyKey,baseRevisionId:id,title:short.optional(),summary:z.string().trim().min(1).max(600).optional(),spec:z.unknown().optional()}).strict().refine(v=>v.title||v.summary||v.spec,'At least one editorial change is required');
export const approveSchema=z.object({idempotencyKey,revisionId:id,contentHash:z.string().regex(/^[a-f0-9]{64}$/),reviewer:short,reviewIntent:z.literal('human-reviewed-exact-revision')}).strict();
export const publishSchema=z.object({idempotencyKey,revisionId:id,contentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const rollbackSchema=z.object({idempotencyKey,publicationId:id}).strict();
export const readerWriteSchema=z.object({progress:z.number().min(0).max(1),revisionId:id}).strict();
export function parse<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new ContentError(422,'invalid_input','Input does not meet the content contract',result.error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message})));return result.data;}
export function validId(value:string){return parse(id,value);}

export const conversationSchema=z.object({idempotencyKey,title:short.optional()}).strict();
export const conversationMessageSchema=z.object({idempotencyKey,content:z.string().min(1).max(8000).refine(value=>value.trim().length>0,'Message cannot be whitespace only'),baseRevisionId:id.optional()}).strict();
