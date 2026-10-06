import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {healthResponse,serviceStatus} from '../../../packages/contracts/index.mjs';
function json(res,status,body,headers={}) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(body)+'\n');
}
export function createApiServer() {
  const server=createServer((req,res)=>{
    let pathname;
    try {pathname=new URL(req.url,'http://localhost').pathname;} catch {json(res,400,{error:'bad_request'});return;}
    if (!['/healthz','/api/v1/status'].includes(pathname)) {json(res,404,{error:'not_found'});return;}
    if(req.method!=='GET') {json(res,405,{error:'method_not_allowed'},{Allow:'GET'});return;}
    json(res,200,pathname==='/healthz'?healthResponse():serviceStatus());
  });
  server.requestTimeout=10_000;server.headersTimeout=5_000;server.maxHeadersCount=32;
  return server;
}
export async function startApi({host='127.0.0.1',port=3001}={}) {
  const server=createApiServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
  return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.API_PORT||3001);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('API_PORT must be an integer from 1 to 65535');
  const server=await startApi({host:process.env.API_HOST||'127.0.0.1',port});
  console.log(`PersonalOS API scaffold: http://${server.address().address}:${server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
}
