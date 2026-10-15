import {z} from 'zod';
import type {ContentService} from '../content/service.js';
import {captureSchema,groupSchema,jobSchema} from '../content/inputs.js';
import {ContentError} from '../content/errors.js';
/** Tool surface intentionally has no approve/publish/rollback, file access, shell, fetch, or all-chat read. */
export class ContentMcpAdapter {
  constructor(private readonly service:ContentService,private readonly studioOrigin='http://127.0.0.1:3002'){}
  listTools(){return [
    {name:'personalos_capture',description:'Capture only a user-selected, explicitly authorized snippet; stores private provenance and immutable source versions.',inputSchema:z.toJSONSchema(captureSchema),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    {name:'personalos_group',description:'Group captured authorized sources into reviewable topics with deterministic extracted facts, decisions and uncertainties.',inputSchema:z.toJSONSchema(groupSchema),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    {name:'personalos_generate',description:'Enqueue a durable controlled-mock article generation job. Does not approve or publish.',inputSchema:z.toJSONSchema(jobSchema.omit({simulateFailureOnce:true})),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    {name:'personalos_status',description:'Read one generation job and its immutable generated revision, if complete.',inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false}},
    {name:'personalos_review',description:'Get a review URL and exact revision identity for human review. This cannot grant approval or publish.',inputSchema:{type:'object',properties:{articleId:{type:'string'}},required:['articleId'],additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false}},
  ];}
  async callTool(name:string,args:unknown){
    let result:unknown;
    switch(name){
      case 'personalos_capture':result=await this.service.capture(args);break;
      case 'personalos_group':result=await this.service.group(args);break;
      case 'personalos_generate':{const safe=jobSchema.omit({simulateFailureOnce:true}).strict().parse(args);result=await this.service.enqueue(safe);break;}
      case 'personalos_status':{const safe=z.object({jobId:z.string()}).strict().parse(args);result=await this.service.getJob(safe.jobId);break;}
      case 'personalos_review':{const safe=z.object({articleId:z.string()}).strict().parse(args),detail=await this.service.articleDetail(safe.articleId);result={reviewUrl:`${this.studioOrigin}/?article=${detail.article.id}`,articleId:detail.article.id,revisionId:detail.latestRevision?.id??null,contentHash:detail.latestRevision?.contentHash??null,approvalRequired:true,publishAuthority:false};break;}
      default:throw new ContentError(404,'tool_not_found','This tool is unavailable; human approval and publishing are not MCP tools');
    }
    return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false};
  }
}
