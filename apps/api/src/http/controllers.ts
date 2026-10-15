import {All,Body,Controller,Get,HttpCode,Inject,Param,Post,Put,Req,Res,UseGuards} from '@nestjs/common';
import {SERVICE} from './config.js';
import {AdminGuard,HumanReviewGuard} from './guards.js';
import {ContentService,BACKEND_DEMO_VERSION} from '../content/service.js';
import {ContentError} from '../content/errors.js';
import {RENDERER_DESCRIPTOR} from '../content/generator.js';
import {healthResponse,serviceStatus} from '../../../../packages/contracts/index.mjs';
@Controller()
export class StatusController {
  constructor(@Inject(SERVICE)private readonly service:ContentService){}
  @All('healthz') health(@Req()request:any,@Res({passthrough:true})reply:any){if(request.method!=='GET'){reply.header('Allow','GET');throw new ContentError(405,'method_not_allowed','This endpoint only supports GET');}return healthResponse();}
  @All('api/v1/status') status(@Req()request:any,@Res({passthrough:true})reply:any){if(request.method!=='GET'){reply.header('Allow','GET');throw new ContentError(405,'method_not_allowed','This endpoint only supports GET');}return {...serviceStatus(),backendDemoVersion:BACKEND_DEMO_VERSION,storageAdapter:this.service.store.kind,transport:'nestjs-fastify',generator:{kind:'controlled-mock',modelCalls:0},rendering:{productChoice:'pending-verification',checkpoint:RENDERER_DESCRIPTOR}};}
}
@Controller('api/v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(SERVICE)private readonly service:ContentService){}
  @Get('snapshot') snapshot(){return this.service.snapshot();}
  @Post('conversations') @HttpCode(200) createConversation(@Body()body:unknown){return this.service.createConversation(body);}
  @Get('conversations/:id') conversation(@Param('id')id:string){return this.service.conversationDetail(id);}
  @Post('conversations/:id/messages') @HttpCode(202) message(@Param('id')id:string,@Body()body:unknown){return this.service.sendConversationMessage(id,body);}
  @Post('conversations/:id/artifacts/:revisionId/save') @HttpCode(200) saveArtifact(@Param('id')id:string,@Param('revisionId')revisionId:string,@Body()body:unknown){return this.service.saveConversationArtifact(id,revisionId,body);}
  @Post('fixtures') @HttpCode(200) fixtures(@Body()body:unknown){return this.service.seed(body);}
  @Post('captures') @HttpCode(200) capture(@Body()body:unknown){return this.service.capture(body);}
  @Post('group') @HttpCode(200) group(@Body()body:unknown){return this.service.group(body);}
  @Post('jobs') @HttpCode(202) jobs(@Body()body:unknown){return this.service.enqueue(body);}
  @Get('jobs/:id') job(@Param('id')id:string){return this.service.getJob(id);}
  @Post('jobs/:id/retry') @HttpCode(202) retry(@Param('id')id:string,@Body()body:unknown){return this.service.retry(id,body);}
  @Get('articles/:id') article(@Param('id')id:string){return this.service.articleDetail(id);}
  @Post('articles/:id/revisions') @HttpCode(200) edit(@Param('id')id:string,@Body()body:unknown){return this.service.edit(id,body);}
  @Post('articles/:id/approve') @HttpCode(200) @UseGuards(HumanReviewGuard) approve(@Param('id')id:string,@Body()body:unknown){return this.service.approve(id,body);}
  @Post('articles/:id/publish') @HttpCode(200) @UseGuards(HumanReviewGuard) publish(@Param('id')id:string,@Body()body:unknown){return this.service.publish(id,body);}
  @Post('articles/:id/rollback') @HttpCode(200) @UseGuards(HumanReviewGuard) rollback(@Param('id')id:string,@Body()body:unknown){return this.service.rollback(id,body);}
}
@Controller('api/v1/public')
export class PublicController {
  constructor(@Inject(SERVICE)private readonly service:ContentService){}
  @Get('articles') articles(){return this.service.publicArticles();}
  @Get('articles/:slug') article(@Param('slug')slug:string){return this.service.publicArticle(slug);}
  @Post('readers') createReader(){return this.service.createReader();}
  @Get('readers/:readerId/articles/:slug/state') state(@Param('readerId')readerId:string,@Param('slug')slug:string,@Req()request:any){return this.service.readProgress(readerId,slug,capability(request));}
  @Put('readers/:readerId/articles/:slug/state') @HttpCode(200) progress(@Param('readerId')readerId:string,@Param('slug')slug:string,@Req()request:any,@Body()body:unknown){return this.service.writeProgress(readerId,slug,capability(request),body);}
}
function capability(request:any){const value=request.headers['x-reader-capability'];if(typeof value!=='string'||value.length>200)throw new ContentError(403,'reader_forbidden','Reader capability is required');return value;}
