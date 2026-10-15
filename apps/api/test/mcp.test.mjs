import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {POSTGRES_SCHEMA} from '../../../.build/api/apps/api/src/content/store.js';
test('committed PostgreSQL migration matches executable adapter schema',async()=>{const sql=await readFile(new URL('../migrations/001_content.sql',import.meta.url),'utf8');assert.equal(sql.split('\n').slice(1).join('\n').trim(),POSTGRES_SCHEMA.trim());});
test('stdio MCP supports initialization/tools and never grants a publish tool',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'personalos-mcp-'));
  try{
    const env={...process.env,PERSONALOS_STORAGE:'sqlite-demo',PERSONALOS_DATA_DIR:dir,PERSONALOS_MODE:'token'};delete env.DATABASE_URL;delete env.PERSONALOS_REVIEW_TOKEN;delete env.PERSONALOS_ADMIN_TOKEN;
    const child=spawn(process.execPath,['.build/api/apps/api/src/mcp/stdio.js'],{cwd:new URL('../../..',import.meta.url),env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',data=>{stdout+=data;});child.stderr.on('data',data=>{stderr+=data;});
    child.stdin.end([
      {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'synthetic-test',version:'1'}}},
      {jsonrpc:'2.0',method:'notifications/initialized'},
      {jsonrpc:'2.0',id:2,method:'tools/list'},
      {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'personalos_publish',arguments:{}}},
    ].map(v=>JSON.stringify(v)).join('\n')+'\n');
    const exit=await new Promise(resolve=>child.once('close',resolve));assert.equal(exit,0,stderr);const messages=stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(messages.length,3);assert.equal(messages[0].result.protocolVersion,'2025-06-18');assert.equal(messages[1].result.tools.length,5);assert.ok(messages[1].result.tools.every(t=>!['approve','publish','rollback'].some(word=>t.name.endsWith(word))));assert.equal(messages[2].result.isError,true);assert.match(messages[2].result.content[0].text,/tool_not_found/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
