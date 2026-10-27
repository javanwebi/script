import { RecognitionServiceError } from './recognitionErrors';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ScanProgress } from './exhaustiveImageScan';

type Status='queued'|'running'|'complete'|'failed';
type ProgressHandler=(progress:ScanProgress)=>void;
type Run<T>=(progress:ProgressHandler)=>Promise<T>;
type Job<T>={status:Status;progress?:ScanProgress;result?:T;error?:string;expires:number;run?:Run<T>;payload?:unknown};
type PersistedJob<T>=Omit<Job<T>,'run'>;
type Handler<T>=(payload:unknown)=>Run<T>;

/** Persistent queue for the offline image path; no database writes or background AI calls.
 * After restart, unfinished jobs with persisted task input are requeued under their original IDs.
 */
export class RecognitionJobs<T> {
 private jobs=new Map<string,Job<T>>();
 private active=0;
 private lastPersist=0;
 private persistTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(private concurrency=2,private capacity=8,private ttl=30*60*1000,
             private stateFile?:string,private recover?:Handler<T>){
  if(this.stateFile)this.restore();
 }
 private restore(){
  try{
   const parsed=JSON.parse(fs.readFileSync(this.stateFile!,'utf8'));
   if(parsed?.version!==1||!Array.isArray(parsed.jobs))return;
   for(const [id,data] of parsed.jobs as [string,PersistedJob<T>][]) {
    if(!/^[0-9a-f-]{36}$/i.test(id)||!data||typeof data.expires!=='number'||data.expires<Date.now())continue;
    if(!['queued','running','complete','failed'].includes(data.status))continue;
    const job:Job<T>={...data};
    if(job.status==='running'||job.status==='queued'){
     if(this.recover && job.payload && typeof job.payload==='object'){
      job.status='queued';job.run=this.recover(job.payload);
     }else {
      job.status='failed';job.error='بررسی تصویر پس از راه‌اندازی دوباره قابل بازیابی نیست؛ دوباره امتحان کنید.';
     }
    }
    this.jobs.set(id,job);
   }
  }catch{/* Nothing to restore on first deploy or corrupt cache. */}
 }
 /** Called after database and image catalogue bootstrapping has completed. */
 resumePending(){this.pump();}
 private persist(force=false){
  if(!this.stateFile)return;
  if(!force && Date.now()-this.lastPersist<750){
   if(!this.persistTimer){
    this.persistTimer=setTimeout(()=>{this.persistTimer=undefined;this.persist(true);},800);
    this.persistTimer.unref?.();
   }
   return;
  }
  try {
   fs.mkdirSync(path.dirname(this.stateFile),{recursive:true});
   const temp=this.stateFile+'.'+randomUUID()+'.tmp';
   const jobs=[...this.jobs].map(([id,{run:_,...job}])=>[id,job]);
   fs.writeFileSync(temp,JSON.stringify({version:1,jobs}),{mode:0o600});
   fs.renameSync(temp,this.stateFile);
   this.lastPersist=Date.now();
  }catch{/* Queue survives in process when volume is unwritable; production must monitor cache errors. */}
 }
 private enqueue(job:Job<T>) {
  this.clean();
  if([...this.jobs.values()].filter(j=>j.status==='queued'||j.status==='running').length>=this.capacity)
   throw new Error('صف بررسی تصاویر پر است؛ کمی بعد دوباره تلاش کنید.');
  const id=randomUUID();
  this.jobs.set(id,job);
  this.persist(true);this.pump();return id;
 }
 start(run:Run<T>){
  return this.enqueue({status:'queued',expires:Date.now()+this.ttl,run});
 }
 startTask(payload:unknown){
  if(!this.recover)throw new Error('No recovery function configured');
  if(!payload || typeof payload!=='object')throw new Error('Invalid image task');
  return this.enqueue({status:'queued',expires:Date.now()+this.ttl,payload,run:this.recover(payload)});
 }
 get(id:string){
  this.clean();
  const job=this.jobs.get(id);
  if(!job)return;
  return {status:job.status,progress:job.progress,result:job.result,error:job.error};
 }
 private clean(){
  let changed=false;
  for(const [id,job] of this.jobs)if(job.expires<Date.now()&&job.status!=='running'){this.jobs.delete(id);changed=true;}
  if(this.jobs.size>80)for(const [id,job] of this.jobs){
   if(this.jobs.size<=80)break;
   if(job.status==='complete'||job.status==='failed'){this.jobs.delete(id);changed=true;}
  }
  if(changed)this.persist();
 }
 private pump(){
  for(const [,job] of this.jobs) {
   if(this.active>=this.concurrency)break;
   if(job.status!=='queued'||!job.run)continue;
   job.status='running';job.expires=Date.now()+this.ttl;
   this.active++;this.persist(true);
   const run=job.run;
   Promise.resolve().then(()=>run(progress=>{job.progress=progress;this.persist();}))
    .then(result=>{job.result=result;job.status='complete';},error=>{
      console.warn('[Recognition job failed]',error instanceof RecognitionServiceError?error.code:error?.name||'UnknownError');
      job.error=error instanceof RecognitionServiceError?error.message:'بررسی کامل تصاویر انجام نشد؛ لطفاً دوباره تلاش کنید.';
      job.status='failed';
    }).finally(()=>{
      delete job.run;delete job.payload;
      job.expires=Date.now()+this.ttl;
      this.active--;this.persist(true);this.pump();
    });
  }
 }
}
