import {resolve} from 'node:path';
import {PostgresStore,SqliteDemoStore,type ContentStore} from './content/store.js';
import {ContentService} from './content/service.js';
export async function serviceFromEnvironment():Promise<ContentService>{
  const mode=process.env.PERSONALOS_MODE??'local-demo';if(!['local-demo','token'].includes(mode))throw new Error('PERSONALOS_MODE must be local-demo or token');
  let store:ContentStore;
  if(process.env.DATABASE_URL){const pg=new PostgresStore(process.env.DATABASE_URL);await pg.migrate();store=pg;}
  else {if(process.env.PERSONALOS_STORAGE!=='sqlite-demo')throw new Error('DATABASE_URL is required. For synthetic offline demo only, explicitly set PERSONALOS_STORAGE=sqlite-demo');store=new SqliteDemoStore(resolve(process.env.PERSONALOS_DATA_DIR??'.build/content-demo','content.sqlite'));}
  return new ContentService(store,{allowFailureFixtures:mode==='local-demo'});
}
