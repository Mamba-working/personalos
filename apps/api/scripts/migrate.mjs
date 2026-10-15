import {PostgresStore} from '../../../.build/api/apps/api/src/content/store.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const store=new PostgresStore(process.env.DATABASE_URL);try{await store.migrate();console.log('PostgreSQL content demo migration applied');}finally{await store.close();}
