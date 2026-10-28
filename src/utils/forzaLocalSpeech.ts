/** Client-side Persian STT & TTS. Browser runtimes are served from this site,
 * preventing an esm.sh/CDN runtime failure from stalling the greeting.
 * Voice weights remain model-provider downloads, cached in origin private storage.
 */
export const FORZA_AMIR_VOICE_ID='fa_IR-amir-medium';
export const FORZA_DIBA_MODEL_URL='https://huggingface.co/Dibachain/Diba-STT/resolve/main/browser/diba-stt-fa-small.tar.gz';
const VOSK_SCRIPT_URL='/forza-runtime/stt/vosk.js';

export interface LocalRecognizer {
  acceptWaveform(samples:AudioBuffer):void;
  on(event:'result'|'partialresult'|'error',handler:(event:any)=>void):void;
  remove?():void;
}
export interface LocalSttModel {
  KaldiRecognizer:new(sampleRate?:number)=>LocalRecognizer;
  terminate?():void;
}
type BrowserVosk={createModel(url:string):Promise<LocalSttModel>};
type PiperSession={
  waitReady:Promise<void>|boolean;
  predict(text:string):Promise<Blob>;
};
type PiperLibrary={
  TtsSession:new(options:{
    voiceId:string;
    wasmPaths:{onnxWasm:string;piperData:string;piperWasm:string};
    progress?:(event:{loaded:number;total:number})=>void;
  })=>PiperSession;
};
type VoiceStage='downloading'|'ready'|'failed';
let voiceStage:VoiceStage='downloading';
const subscribers=new Set<(status:VoiceStage)=>void>();
export function subscribeAmirStatus(callback:(status:VoiceStage)=>void):()=>void{
  subscribers.add(callback);callback(voiceStage);
  return ()=>subscribers.delete(callback);
}
function setStage(stage:VoiceStage){
  if(stage===voiceStage)return;
  voiceStage=stage;
  for(const callback of subscribers)callback(stage);
}
let runtimePromise:Promise<PiperSession>|undefined;
let dibaPromise:Promise<LocalSttModel>|undefined;
let voskPromise:Promise<void>|undefined;
const speechCache=new Map<string,Promise<Blob>>();

function within<T>(promise:Promise<T>,ms:number,label:string):Promise<T>{
  return new Promise((resolve,reject)=>{
    const id=window.setTimeout(()=>reject(new Error(label)),ms);
    promise.then(value=>{clearTimeout(id);resolve(value);},
      error=>{clearTimeout(id);reject(error);});
  });
}

function loadVoskScript():Promise<void>{
  if(voskPromise)return voskPromise;
  voskPromise=new Promise<void>((resolve,reject)=>{
    if((window as any).Vosk?.createModel){resolve();return;}
    const tag=document.createElement('script');
    tag.src=VOSK_SCRIPT_URL;tag.async=true;
    tag.onload=()=>((window as any).Vosk?.createModel?resolve():reject(new Error('vosk_runtime_missing')));
    tag.onerror=()=>reject(new Error('vosk_runtime_missing'));
    document.head.appendChild(tag);
  }).catch(error=>{voskPromise=undefined;throw error;});
  return voskPromise;
}

export async function loadDibaSttModel():Promise<LocalSttModel>{
  if(!dibaPromise){
    dibaPromise=(async()=>{
      await within(loadVoskScript(),15000,'vosk_runtime_timeout');
      return await within(
        ((window as any).Vosk as BrowserVosk).createModel(FORZA_DIBA_MODEL_URL),
        90000,'diba_model_timeout');
    })().catch(error=>{dibaPromise=undefined;throw error;});
  }
  return dibaPromise;
}

async function loadAmir():Promise<PiperSession>{
  if(!runtimePromise){
    setStage('downloading');
    runtimePromise=(async()=>{
      const lib=await import('@mintplex-labs/piper-tts-web') as unknown as PiperLibrary;
      const runtime=new lib.TtsSession({
        voiceId:FORZA_AMIR_VOICE_ID,
        wasmPaths:{
          onnxWasm:'/forza-runtime/ort/',
          piperData:'/forza-runtime/piper/piper_phonemize.data',
          piperWasm:'/forza-runtime/piper/piper_phonemize.wasm',
        },
      });
      await runtime.waitReady;
      setStage('ready');
      return runtime;
    })().catch(error=>{
      console.warn('[FORZA Amir] Model initialization failed',error);
      runtimePromise=undefined;
      setStage('failed');
      throw error;
    });
  }
  return runtimePromise;
}

export function prepareAmirVoice():Promise<void>{
  return loadAmir().then(()=>undefined);
}

export function synthesizeAmir(text:string):Promise<Blob>{
  const phrase=text.trim();
  if(!phrase||phrase.length>750)return Promise.reject(new Error('invalid_amir_text'));
  const cached=speechCache.get(phrase);
  if(cached)return cached;
  const promise=(async()=>{
    const runtime=await loadAmir();
    const audio=await within(runtime.predict(phrase),60000,'amir_inference_timeout');
    if(!(audio instanceof Blob)||audio.size<44)throw new Error('amir_empty_audio');
    return audio;
  })().catch(error=>{speechCache.delete(phrase);throw error;});
  speechCache.set(phrase,promise);
  if(speechCache.size>12){
    const first=speechCache.keys().next().value;
    if(first)speechCache.delete(first);
  }
  return promise;
}
