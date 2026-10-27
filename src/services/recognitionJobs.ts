import { RecognitionServiceError } from './recognitionErrors';
import { randomUUID } from 'node:crypto';
import type { ScanProgress } from './exhaustiveImageScan';
export class RecognitionJobs<T> {
 private jobs=new Map<string,{status:'queued'|'running'|'complete'|'failed';progress?:ScanProgress;result?:T;error?:string;expires:number;run?:(progress:(value:ScanProgress)=>void)=>Promise<T>}>();
 private active=0;
 constructor(private concurrency=2,private capacity=8,private ttl=30*60*1000){}
 start(run:(progress:(value:ScanProgress)=>void)=>Promise<T>) {
  this.clean();if([...this.jobs.values()].filter(job=>job.status==='queued' || job.status==='running').length>=this.capacity)throw new Error('صف بررسی تصاویر پر است؛ کمی بعد دوباره تلاش کنید.');
  const id=randomUUID();this.jobs.set(id,{status:'queued',expires:Date.now()+this.ttl,run});this.pump();return id;
 }
 get(id:string){this.clean();const job=this.jobs.get(id);if(!job)return;return {status:job.status,progress:job.progress,result:job.result,error:job.error};}
 private clean(){for(const [id,job] of this.jobs)if(job.expires<Date.now() && job.status!=='running')this.jobs.delete(id);
  if(this.jobs.size>20)for(const [id,job] of this.jobs){if(this.jobs.size<=20)break;if(job.status==='complete'||job.status==='failed')this.jobs.delete(id);}}
 private pump(){for(const [id,job] of this.jobs){if(this.active>=this.concurrency)break;if(job.status!=='queued')continue;
  job.status='running';this.active++;
  const run=job.run!;
  Promise.resolve().then(()=>run(value=>{job.progress=value;})).then(result=>{job.result=result;job.status='complete';},(error)=>{console.warn('[Recognition job failed]',error instanceof RecognitionServiceError ? error.code : error?.name || 'UnknownError',error instanceof Error ? error.stack?.split('\n').slice(1,3).join('\n') : '');job.error=error instanceof RecognitionServiceError ? error.message : 'بررسی کامل تصاویر انجام نشد؛ لطفاً دوباره تلاش کنید.';job.status='failed';}).finally(()=>{delete job.run;job.expires=Date.now()+this.ttl;this.active--;this.pump();});
 }}
}
