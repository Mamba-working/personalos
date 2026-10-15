import {spawn} from 'node:child_process';
// A real separate worker process, with no review/admin HTTP credential in its environment.
const workerEnv={...process.env};delete workerEnv.PERSONALOS_ADMIN_TOKEN;delete workerEnv.PERSONALOS_REVIEW_TOKEN;
const children=[spawn(process.execPath,['.build/api/apps/api/src/main.js'],{stdio:'inherit',env:process.env}),spawn(process.execPath,['.build/api/apps/api/src/worker-main.js'],{stdio:'inherit',env:workerEnv})];
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const child of children){child.once('error',()=>stop(1));child.once('exit',code=>{if(!stopping)stop(code??1);});}for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop());
