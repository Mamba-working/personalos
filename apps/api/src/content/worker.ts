import {randomUUID} from 'node:crypto';
import {ContentError} from './errors.js';
import type {ContentService} from './service.js';
export class GenerationWorker {
  private readonly service:ContentService;
  private readonly workerId:string;
  private readonly leaseMs:number;
  private timer:NodeJS.Timeout|undefined;
  private busy=false;
  constructor(service:ContentService,{workerId=`worker_${randomUUID()}`,leaseMs=30000}:{workerId?:string;leaseMs?:number}={}){this.service=service;this.workerId=workerId;this.leaseMs=leaseMs;}
  async tick(){if(this.busy)return null;this.busy=true;try{
    const job=await this.service.store.claimJob(this.workerId,Date.now(),this.leaseMs);if(!job)return null;if(job.state==='failed')return this.service.getJob(job.id);
    try{
      if(job.attempt>job.maxAttempts)throw new ContentError(409,'attempts_exhausted','Crashed job reached its attempt limit');
      if(job.failureMode==='once'&&job.attempt===1)throw new ContentError(503,'synthetic_transient_failure','Deliberate one-shot synthetic fixture failure');
      await this.service.markValidating(job,this.leaseMs);return await this.service.finishJob(job);
    }catch(error){await this.service.failJob(job,error);return await this.service.getJob(job.id);}
  }finally{this.busy=false;}}
  start(intervalMs=200){if(this.timer)return;this.timer=setInterval(()=>{void this.tick().catch(()=>{console.error('Worker tick failed; queued jobs remain durable');});},intervalMs);this.timer.unref();}
  async stop(){if(this.timer)clearInterval(this.timer);this.timer=undefined;while(this.busy)await new Promise(resolve=>setTimeout(resolve,10));}
}
