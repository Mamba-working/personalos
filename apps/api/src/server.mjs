// Compatibility entrypoint; compiled NestJS application is the sole HTTP implementation.
export {startApi,createApiApplication} from '../../../.build/api/apps/api/src/main.js';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const child=spawn(process.execPath,['.build/api/apps/api/src/main.js'],{stdio:'inherit'});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
  child.once('exit',code=>{process.exitCode=code??1;});
}
