/** Render short speech fragments using the SAME self-hosted Piper Amir model.
 * This is an offline first-visit fast path while the browser downloads its
 * 63 MB model. Not a third-party TTS provider and not a replacement voice.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareAmirSpeechText } from '../utils/forzaPersianVoiceQuality';

const AMIR_BASE=resolve('public/forza-models/amir/fa_IR-amir-medium.onnx');
const PIPER_BINARY='/tmp/forza-piper-build/bin/piper';
const SPEECH_TIMEOUT_MS=11000;
let activeRenders=0;
const inflight=new Map<string,Promise<Buffer>>();
const cache=new Map<string,Buffer>();

async function render(text:string):Promise<Buffer>{
  if(activeRenders>=2)throw new Error('amir_server_busy');
  activeRenders++;
  const dir=await mkdtemp(join(tmpdir(),'forza-amir-'));
  const output=join(dir,'voice.wav');
  try{
    await new Promise<void>((resolvePromise,reject)=>{
      const child=spawn(PIPER_BINARY,[
        '--model',AMIR_BASE,'--config',AMIR_BASE+'.json','--output_file',output,
      ],{stdio:['pipe','ignore','pipe'],windowsHide:true});
      let completed=false;
      let stderr='';
      const finish=(error?:Error)=>{
        if(completed)return;
        completed=true;
        clearTimeout(timer);
        if(error)reject(error);
        else resolvePromise();
      };
      const timer=setTimeout(()=>{
        child.kill('SIGKILL');
        finish(new Error('amir_server_timeout'));
      },SPEECH_TIMEOUT_MS);
      child.stderr?.on('data',(buf:Buffer)=>{
        if(stderr.length<1200)stderr+=buf.toString('utf8').slice(0,1200-stderr.length);
      });
      child.on('error',()=>finish(new Error('amir_server_unavailable')));
      child.on('close',code=>finish(code===0?undefined:new Error('amir_server_exit_'+code+':'+stderr.slice(0,100))));
      child.stdin?.on('error',()=>{});
      child.stdin?.end(text+'\n');
    });
    const audio=await readFile(output);
    if(audio.length<44 || audio.toString('ascii',0,4)!=='RIFF' || audio.toString('ascii',8,12)!=='WAVE' || audio.length>5_000_000){
      throw new Error('amir_server_invalid_wav');
    }
    return audio;
  } finally {
    activeRenders--;
    await rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}
export function synthesizeServerAmir(text:string):Promise<Buffer>{
  const cleaned=prepareAmirSpeechText(text).trim();
  if(!cleaned || cleaned.length>240)return Promise.reject(new Error('amir_server_invalid_text'));
  const hit=cache.get(cleaned);
  if(hit)return Promise.resolve(hit);
  const pending=inflight.get(cleaned);
  if(pending)return pending;
  const job=render(cleaned).then(audio=>{
    cache.set(cleaned,audio);
    if(cache.size>24)cache.delete(cache.keys().next().value!);
    return audio;
  }).finally(()=>inflight.delete(cleaned));
  inflight.set(cleaned,job);
  return job;
}
