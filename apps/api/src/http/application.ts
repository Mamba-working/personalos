import 'reflect-metadata';
import {Module,Catch,HttpException,type DynamicModule,type ExceptionFilter,type ArgumentsHost} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,type NestFastifyApplication} from '@nestjs/platform-fastify';
import {AdminController,PublicController,StatusController} from './controllers.js';
import {AdminGuard,HumanReviewGuard} from './guards.js';
import {AUTH,SERVICE,localDemoAuth,type ApiAuth} from './config.js';
import {ContentError} from '../content/errors.js';
import type {ContentService} from '../content/service.js';
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost){
    const reply=host.switchToHttp().getResponse();
    if(error instanceof ContentError)return reply.status(error.status).send({error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}});
    if(error instanceof HttpException){const status=error.getStatus();if(status===404)return reply.status(404).send({error:'not_found'});return reply.status(status).send({error:{code:`http_${status}`,message:status===413?'Request body exceeds the limit':'Request rejected'}});}
    const e=error as {statusCode?:number;code?:string};
    if(e.statusCode&&e.statusCode>=400&&e.statusCode<500)return reply.status(e.statusCode).send({error:{code:e.code??'invalid_request',message:'Request rejected'}});
    return reply.status(500).send({error:{code:'internal_error',message:'Operation failed; no private payload is included in this response'}});
  }
}
@Module({})
class ContentModule {
  static register(service:ContentService,auth:ApiAuth):DynamicModule{return {module:ContentModule,controllers:[StatusController,AdminController,PublicController],providers:[{provide:SERVICE,useValue:service},{provide:AUTH,useValue:auth},AdminGuard,HumanReviewGuard]};}
}
export async function createApiApplication({service,auth=localDemoAuth}:{service:ContentService;auth?:ApiAuth}):Promise<NestFastifyApplication>{
  const adapter=new FastifyAdapter({logger:false,bodyLimit:128*1024,requestTimeout:10000,connectionTimeout:5000,trustProxy:false});
  const app=await NestFactory.create<NestFastifyApplication>(ContentModule.register(service,auth),adapter,{logger:false,abortOnError:false});
  app.useGlobalFilters(new SafeErrors());
  adapter.getInstance().addHook('onSend',async(_request:any,reply:any,payload:any)=>{reply.header('Cache-Control','no-store');reply.header('X-Content-Type-Options','nosniff');reply.header('Referrer-Policy','no-referrer');return payload;});
  await app.init();await adapter.getInstance().ready();const server=app.getHttpServer();server.maxHeadersCount=32;server.headersTimeout=5000;server.requestTimeout=10000;return app;
}
