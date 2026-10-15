import {pathToFileURL} from 'node:url';
import {createApiApplication} from './http/application.js';
import {authFromEnvironment,localDemoAuth,type ApiAuth} from './http/config.js';
import {ContentService} from './content/service.js';
import {SqliteDemoStore} from './content/store.js';
import {GenerationWorker} from './content/worker.js';
import {serviceFromEnvironment} from './bootstrap.js';
export {createApiApplication};
export async function startApi({host='127.0.0.1',port=3001,service=new ContentService(new SqliteDemoStore()),auth=localDemoAuth,embeddedWorker=false}:{host?:string;port?:number;service?:ContentService;auth?:ApiAuth;embeddedWorker?:boolean}={}){
  if(auth.mode==='local-demo'&&!['127.0.0.1','::1','localhost'].includes(host))throw new Error('Local-demo mode cannot bind a non-loopback host');
  const app=await createApiApplication({service,auth});
  const worker=embeddedWorker?new GenerationWorker(service):null;if(worker)worker.start();
  await app.listen(port,host);
  return {app,server:app.getHttpServer(),service,worker,close:async()=>{await worker?.stop();await app.close();await service.store.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.API_PORT??3001);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('API_PORT must be an integer from 1 to 65535');
  const service=await serviceFromEnvironment(),auth=authFromEnvironment();
  const runtime=await startApi({host:process.env.API_HOST??'127.0.0.1',port,service,auth,embeddedWorker:process.env.PERSONALOS_EMBEDDED_WORKER==='true'});
  console.log(`PersonalOS content API (${service.store.kind}, ${auth.mode}) listening on loopback port ${port}; controlled mock, zero model calls`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void runtime.close().then(()=>process.exit(0));});
}
