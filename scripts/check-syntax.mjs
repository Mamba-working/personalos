import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const excluded=new Set(['node_modules','.next','.git','evidence','.npm-cache']);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>excluded.has(entry.name)?[]:entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const source=files('.').filter(file=>/\.(?:js|mjs)$/.test(file));
for(const file of source){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}}
console.log(`Syntax checked ${source.length} JavaScript files`);
