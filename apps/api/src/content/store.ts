import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import type {Job, Topic} from '../../../../packages/contracts/content.js';
export type InternalJob = Job & {topicSnapshot: Topic; fence: number; leaseUntil: number|null; availableAt: number; failureMode?: 'once'; workerId?: string; conversationContext?:{conversationId:string;userMessageId:string;baseRevisionId:string|null;prompt:string}};
export type Transaction = {
  get<T>(collection: string, key: string): Promise<T|null>;
  list<T>(collection: string): Promise<T[]>;
  put<T>(collection: string, key: string, value: T): Promise<void>;
  insert<T>(collection: string, key: string, value: T): Promise<void>;
};
export interface ContentStore {
  readonly kind: 'postgresql'|'sqlite-demo';
  transaction<T>(run: (tx: Transaction)=>Promise<T>): Promise<T>;
  claimJob(workerId: string, now: number, leaseMs: number): Promise<InternalJob|null>;
  close(): Promise<void>;
}
const immutableCollections = ['sourceVersions','revisions','assets','publications','conversationMessages'];
const sqliteSchema = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS content_records (collection TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection,id));
CREATE TABLE IF NOT EXISTS content_jobs (id TEXT PRIMARY KEY, state TEXT NOT NULL, available_at INTEGER NOT NULL, lease_until INTEGER, fence INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS content_jobs_claim ON content_jobs(state,available_at,lease_until);
CREATE TRIGGER IF NOT EXISTS content_immutable_update BEFORE UPDATE ON content_records WHEN OLD.collection IN ('sourceVersions','revisions','assets','publications','conversationMessages') BEGIN SELECT RAISE(ABORT,'immutable content record'); END;
CREATE TRIGGER IF NOT EXISTS content_immutable_delete BEFORE DELETE ON content_records WHEN OLD.collection IN ('sourceVersions','revisions','assets','publications','conversationMessages') BEGIN SELECT RAISE(ABORT,'immutable content record'); END;
`;
export class SqliteDemoStore implements ContentStore {
  readonly kind='sqlite-demo' as const;
  private readonly db: DatabaseSync;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(file=':memory:') { if(file!==':memory:')mkdirSync(dirname(file),{recursive:true,mode:0o700}); this.db=new DatabaseSync(file);this.db.exec(sqliteSchema); }
  transaction<T>(run:(tx:Transaction)=>Promise<T>):Promise<T> {
    const operation=this.tail.then(async()=>{
      this.db.exec('BEGIN IMMEDIATE');
      const tx:Transaction={
        get:async<T>(collection:string,key:string)=>{
          const row=this.db.prepare(collection==='jobs'?'SELECT payload FROM content_jobs WHERE id=?':'SELECT payload FROM content_records WHERE collection=? AND id=?').get(...(collection==='jobs'?[key]:[collection,key])) as {payload:string}|undefined;
          return row?JSON.parse(row.payload) as T:null;
        },
        list:async<T>(collection:string)=>{
          const rows=this.db.prepare(collection==='jobs'?'SELECT payload FROM content_jobs ORDER BY id':'SELECT payload FROM content_records WHERE collection=? ORDER BY id').all(...(collection==='jobs'?[]:[collection])) as {payload:string}[];
          return rows.map(row=>JSON.parse(row.payload) as T);
        },
        put:async<T>(collection:string,key:string,value:T)=>{await this.write(collection,key,value,false);},
        insert:async<T>(collection:string,key:string,value:T)=>{await this.write(collection,key,value,true);},
      };
      try{const result=await run(tx);this.db.exec('COMMIT');return structuredClone(result);}catch(error){this.db.exec('ROLLBACK');throw error;}
    });
    this.tail=operation.catch(()=>undefined);return operation;
  }
  private async write<T>(collection:string,key:string,value:T,insert:boolean) {
    if(collection==='jobs'){
      const job=value as InternalJob;
      const sql=insert?'INSERT INTO content_jobs(id,state,available_at,lease_until,fence,payload) VALUES(?,?,?,?,?,?)':'INSERT INTO content_jobs(id,state,available_at,lease_until,fence,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,available_at=excluded.available_at,lease_until=excluded.lease_until,fence=excluded.fence,payload=excluded.payload';
      this.db.prepare(sql).run(key,job.state,job.availableAt,job.leaseUntil,job.fence,JSON.stringify(value));
    }else{
      if(!insert&&immutableCollections.includes(collection))throw new Error('Immutable collection requires insert');
      this.db.prepare(insert?'INSERT INTO content_records(collection,id,payload) VALUES(?,?,?)':'INSERT INTO content_records(collection,id,payload) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload').run(collection,key,JSON.stringify(value));
    }
  }
  async claimJob(workerId:string,now:number,leaseMs:number) {return this.transaction(async tx=>{
    const jobs=await tx.list<InternalJob>('jobs');
    const job=jobs.filter(j=>(j.state==='queued'&&j.availableAt<=now)||(['running','validating'].includes(j.state)&&(j.leaseUntil??Infinity)<=now)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0];
    if(!job)return null;
    claim(job,workerId,now,leaseMs);await tx.put('jobs',job.id,job);return job;
  });}
  async close(){await this.tail;this.db.close();}
}
export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS content_records (
  collection text NOT NULL, id text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(collection,id)
);
CREATE TABLE IF NOT EXISTS content_jobs (
  id text PRIMARY KEY, state text NOT NULL CHECK(state IN ('queued','running','validating','succeeded','failed')),
  available_at bigint NOT NULL, lease_until bigint, fence integer NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS content_jobs_claim ON content_jobs(state,available_at,lease_until);
CREATE OR REPLACE FUNCTION reject_immutable_content_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.collection IN ('sourceVersions','revisions','assets','publications','conversationMessages') THEN
    RAISE EXCEPTION 'immutable content record';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS content_immutable_records ON content_records;
CREATE TRIGGER content_immutable_records BEFORE UPDATE OR DELETE ON content_records FOR EACH ROW EXECUTE FUNCTION reject_immutable_content_mutation();
`;
export class PostgresStore implements ContentStore {
  readonly kind='postgresql' as const;
  private readonly pool: pg.Pool;
  constructor(connectionString:string){this.pool=new pg.Pool({connectionString,max:6,connectionTimeoutMillis:5000,statement_timeout:10000,application_name:'personalos-content-demo'});}
  async migrate(){const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(731084120)');await client.query(POSTGRES_SCHEMA);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async transaction<T>(run:(tx:Transaction)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      // Demo aggregate lock keeps cross-aggregate invariants simple. Normalize/split by tenant before production scale.
      await client.query('SELECT pg_advisory_xact_lock(731084121)');
      const tx:Transaction={
        get:async<T>(collection:string,key:string)=>{
          const result=await client.query(collection==='jobs'?'SELECT payload FROM content_jobs WHERE id=$1 FOR UPDATE':'SELECT payload FROM content_records WHERE collection=$1 AND id=$2 FOR UPDATE',collection==='jobs'?[key]:[collection,key]);
          return result.rows[0]?.payload as T??null;
        },
        list:async<T>(collection:string)=>{const result=await client.query(collection==='jobs'?'SELECT payload FROM content_jobs ORDER BY id':'SELECT payload FROM content_records WHERE collection=$1 ORDER BY id',collection==='jobs'?[]:[collection]);return result.rows.map(row=>row.payload as T);},
        put:async<T>(collection:string,key:string,value:T)=>{await this.write(client,collection,key,value,false);},
        insert:async<T>(collection:string,key:string,value:T)=>{await this.write(client,collection,key,value,true);},
      };
      const result=await run(tx);await client.query('COMMIT');return structuredClone(result);
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async write<T>(client:pg.PoolClient,collection:string,key:string,value:T,insert:boolean){
    if(collection==='jobs'){
      const j=value as InternalJob;
      await client.query('INSERT INTO content_jobs(id,state,available_at,lease_until,fence,payload) VALUES($1,$2,$3,$4,$5,$6)'+(insert?'':' ON CONFLICT(id) DO UPDATE SET state=excluded.state,available_at=excluded.available_at,lease_until=excluded.lease_until,fence=excluded.fence,payload=excluded.payload'),[key,j.state,j.availableAt,j.leaseUntil,j.fence,JSON.stringify(value)]);
    }else{
      if(!insert&&immutableCollections.includes(collection))throw new Error('Immutable collection requires insert');
      await client.query('INSERT INTO content_records(collection,id,payload) VALUES($1,$2,$3)'+(insert?'':' ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload'),[collection,key,JSON.stringify(value)]);
    }
  }
  async claimJob(workerId:string,now:number,leaseMs:number){
    const client=await this.pool.connect();try{
      await client.query('BEGIN');
      const result=await client.query("SELECT payload FROM content_jobs WHERE (state='queued' AND available_at<=$1) OR (state IN ('running','validating') AND lease_until<=$1) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1",[now]);
      const job=result.rows[0]?.payload as InternalJob|undefined;
      if(!job){await client.query('COMMIT');return null;}
      claim(job,workerId,now,leaseMs);await this.write(client,'jobs',job.id,job,false);await client.query('COMMIT');return job;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async close(){await this.pool.end();}
}
function claim(job:InternalJob,workerId:string,now:number,leaseMs:number){
  if(job.attempt>=job.maxAttempts){job.state='failed';job.fence+=1;job.leaseUntil=null;job.updatedAt=new Date(now).toISOString();job.error={code:'attempts_exhausted',message:'Crashed job reached its attempt limit'};job.events.push({state:'failed',at:job.updatedAt,note:'attempts_exhausted'});return;}
  job.state='running';job.attempt+=1;job.fence+=1;job.workerId=workerId;job.leaseUntil=now+leaseMs;job.updatedAt=new Date(now).toISOString();
  job.events.push({state:'running',at:job.updatedAt,note:job.attempt>1?'Lease recovered or retry claimed':'Worker claimed job'});
}
