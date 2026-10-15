import {createInterface} from 'node:readline';
import {serviceFromEnvironment} from '../bootstrap.js';
import {ContentMcpAdapter} from './adapter.js';
import {ContentError} from '../content/errors.js';
const service=await serviceFromEnvironment(),adapter=new ContentMcpAdapter(service,process.env.PERSONALOS_STUDIO_ORIGIN??'http://127.0.0.1:3002');
let initialized=false,ready=false;
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of lines){
  if(line.length>150000){process.stderr.write('MCP message exceeds limit\n');continue;}
  let message:any;try{message=JSON.parse(line);}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})+'\n');continue;}
  if(message.method==='notifications/initialized'&&initialized){ready=true;continue;}
  if(message.id===undefined)continue;
  const response:any={jsonrpc:'2.0',id:message.id};
  try{
    if(message.jsonrpc!=='2.0'||!['string','number'].includes(typeof message.id))throw new Error('Invalid JSON-RPC request');
    if(!initialized&&message.method!=='initialize')throw new ContentError(400,'not_initialized','Initialize must be the first MCP request');
    if(initialized&&!ready&&!['initialize','ping'].includes(message.method))throw new ContentError(400,'not_ready','Client must send notifications/initialized before tools');
    switch(message.method){
      case 'initialize':if(initialized)throw new Error('Already initialized');initialized=true;response.result={protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'personalos-content-demo',version:'0.1.0-demo.1'},instructions:'Only capture explicitly selected authorized snippets. Generation is a controlled mock. Human review happens in the independent studio. This server has no publish tool.'};break;
      case 'ping':response.result={};break;
      case 'tools/list':response.result={tools:adapter.listTools()};break;
      case 'tools/call':try{response.result=await adapter.callTool(message.params?.name,message.params?.arguments??{});}catch(error){response.result={content:[{type:'text',text:JSON.stringify({error:{code:error instanceof ContentError?error.code:'invalid_tool_input',message:error instanceof ContentError?error.message:'Tool call rejected'}})}],isError:true};}break;
      default:response.error={code:-32601,message:'Method not found'};
    }
  }catch{response.error={code:-32603,message:'Operation failed'};}
  process.stdout.write(JSON.stringify(response)+'\n');
}
await service.store.close();
