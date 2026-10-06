import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const runtime=fileURLToPath(new URL('./runtime/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export function createStaticServer() {
  return createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    try {
      const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const relative=requested==='/'?'index.html':requested.replace(/^\/+/, '');
      if(relative.includes('\0')||relative.split('/').some(part=>part.startsWith('.')))throw new Error('Denied path');
      const file=path.resolve(runtime,relative);
      if(!file.startsWith(runtime))throw new Error('Denied path');
      const resolved=await realpath(file);
      if(!resolved.startsWith(runtime)||!(await stat(resolved)).isFile())throw new Error('Denied path');
      const data=await readFile(resolved);
      res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'text/plain; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch {res.writeHead(404).end('Not found');}
  });
}
export async function startStatic({host='127.0.0.1',port=4173}={}) {
  const server=createStaticServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.WEB_PORT||4173);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('WEB_PORT must be an integer from 1 to 65535');
  const server=await startStatic({host:process.env.WEB_HOST||'127.0.0.1',port});
  console.log(`PersonalOS web demo: http://${server.address().address}:${server.address().port}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
}
