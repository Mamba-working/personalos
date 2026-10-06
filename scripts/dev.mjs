import {spawn} from 'node:child_process';
const children=['apps/web/dev-server.mjs','apps/api/src/server.mjs'].map(script=>spawn(process.execPath,[script],{stdio:'inherit'}));
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const child of children){child.once('error',error=>{console.error(error.message);stop(1);});child.once('exit',code=>{if(!stopping)stop(code||0);});}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>stop());
