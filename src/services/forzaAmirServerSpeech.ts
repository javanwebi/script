/** Self-hosted, long-lived Piper Amir voice renderer.
 * The neural model loads exactly once into a persistent local Python process.
 * Each user phrase is queued in arrival order; no paid/cloud TTS calls.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { prepareAmirSpeechText } from '../utils/forzaPersianVoiceQuality';

type Task={resolve:(audio:Buffer)=>void;reject:(err:Error)=>void;timer:NodeJS.Timeout};
const MAX_AUDIO_BYTES=5_000_000;
const WORKER_STARTUP_MS=15000;
const PHRASE_TIMEOUT_MS=16000;
const MAX_QUEUED=32;
const inflight=new Map<string,Promise<Buffer>>();
const cache=new Map<string,Buffer>();
const pending=new Map<number,Task>();
let child:ChildProcessWithoutNullStreams|null=null;
let boot:Promise<void>|null=null;
let nextId=0;

const errorOf=(message:string)=>new Error(message);

function destroyWorker(reason:string){
  const instance=child;
  child=null;
  boot=null;
  for(const task of pending.values()){
    clearTimeout(task.timer);
    task.reject(errorOf(reason));
  }
  pending.clear();
  if(instance){ try{instance.kill('SIGKILL');}catch{} }
}

function ensureWorker():Promise<void>{
  if(boot)return boot;
  boot=new Promise<void>((resolveBoot,rejectBoot)=>{
    const binary=process.env.FORZA_PIPER_PYTHON||'/tmp/forza-piper-build/bin/python';
    const instance=spawn(binary,['-u',resolve('scripts/forza_amir_worker.py')],{
      stdio:['pipe','pipe','pipe'],windowsHide:true,cwd:process.cwd(),
      env:{...process.env,PYTHONUNBUFFERED:'1',ONNXRUNTIME_LOG_SEVERITY_LEVEL:'3'},
    });
    child=instance;
    // Keep the model resident while the HTTP server is alive, but do not
    // prevent a standalone CLI/test process from exiting after its last job.
    instance.unref();
    for (const pipe of [instance.stdin, instance.stdout, instance.stderr]) {
      (pipe as unknown as { unref?: () => void }).unref?.();
    }
    let ready=false;
    let output='';
    let errorOutput='';
    const startupTimer=setTimeout(()=>{
      if(!ready){rejectBoot(errorOf('amir_worker_start_timeout'));destroyWorker('amir_worker_start_timeout');}
    },WORKER_STARTUP_MS);
    const onExit=(code:number|null)=>{
      clearTimeout(startupTimer);
      if(child!==instance)return;
      if(!ready)rejectBoot(errorOf('amir_worker_failed_to_start'));
      console.warn('[FORZA Amir] worker stopped',code,errorOutput.slice(-120));
      destroyWorker('amir_worker_stopped');
    };
    instance.on('error',()=>onExit(null));
    instance.on('exit',onExit);
    instance.stderr.on('data',(buf:Buffer)=>{
      errorOutput=(errorOutput+buf.toString('utf8')).slice(-500);
    });
    instance.stdout.on('data',(chunk:Buffer)=>{
      output+=chunk.toString('utf8');
      if(output.length>10_000_000){
        destroyWorker('amir_worker_frame_too_large');
        return;
      }
      let end:number;
      while((end=output.indexOf('\n'))>=0){
        const frame=output.slice(0,end);
        output=output.slice(end+1);
        let msg:any;
        try{msg=JSON.parse(frame);}catch{continue;}
        if(msg?.type==='ready'){
          ready=true;
          clearTimeout(startupTimer);
          console.info('[FORZA Amir] persistent neural model loaded once');
          resolveBoot();
          continue;
        }
        const task=pending.get(Number(msg?.id));
        if(!task)continue;
        pending.delete(Number(msg.id));
        clearTimeout(task.timer);
        if(msg?.error){
          task.reject(errorOf('amir_'+String(msg.error)));
          continue;
        }
        if(typeof msg?.audio!=='string' || msg.audio.length>MAX_AUDIO_BYTES*2){
          task.reject(errorOf('amir_invalid_response'));
          continue;
        }
        const audio=Buffer.from(msg.audio,'base64');
        if(audio.length<44 || audio.length>MAX_AUDIO_BYTES ||
          audio.toString('ascii',0,4)!=='RIFF' ||
          audio.toString('ascii',8,12)!=='WAVE'){
          task.reject(errorOf('amir_invalid_wav'));
        }else task.resolve(audio);
      }
    });
  });
  return boot;
}

export function warmServerAmir():Promise<void>{
  return ensureWorker();
}

async function render(text:string):Promise<Buffer>{
  await ensureWorker();
  if(!child||!child.stdin.writable)throw errorOf('amir_worker_unavailable');
  if(pending.size>=MAX_QUEUED)throw errorOf('amir_worker_busy');
  const id=++nextId;
  return new Promise<Buffer>((resolveTask,rejectTask)=>{
    const timer=setTimeout(()=>{
      if(!pending.has(id))return;
      // Restart a wedged worker; never leave a voice turn pending indefinitely.
      destroyWorker('amir_worker_timeout');
    },PHRASE_TIMEOUT_MS);
    pending.set(id,{resolve:resolveTask,reject:rejectTask,timer});
    try{
      child!.stdin.write(JSON.stringify({id,text})+'\n',(error)=>{
        if(error && pending.has(id))destroyWorker('amir_worker_write_failed');
      });
    }catch{
      destroyWorker('amir_worker_write_failed');
    }
  });
}

export function synthesizeServerAmir(text:string):Promise<Buffer>{
  const cleaned=prepareAmirSpeechText(text).trim();
  if(!cleaned || cleaned.length>240)return Promise.reject(errorOf('amir_server_invalid_text'));
  const cached=cache.get(cleaned);
  if(cached)return Promise.resolve(cached);
  const active=inflight.get(cleaned);
  if(active)return active;
  const task=render(cleaned).then(audio=>{
    cache.set(cleaned,audio);
    if(cache.size>48)cache.delete(cache.keys().next().value!);
    return audio;
  }).finally(()=>inflight.delete(cleaned));
  inflight.set(cleaned,task);
  return task;
}
