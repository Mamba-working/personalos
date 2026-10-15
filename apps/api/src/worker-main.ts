import {serviceFromEnvironment} from './bootstrap.js';
import {GenerationWorker} from './content/worker.js';
const service=await serviceFromEnvironment(),worker=new GenerationWorker(service);worker.start();
// A distinct process owns generation. Keep the event loop alive without attaching work to an HTTP request.
const keepAlive=setInterval(()=>{},60000);
console.log(`PersonalOS durable generation worker (${service.store.kind}); controlled mock, zero model calls`);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void worker.stop().then(async()=>{clearInterval(keepAlive);await service.store.close();process.exit(0);});});
