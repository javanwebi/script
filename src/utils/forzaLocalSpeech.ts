/** Client-side Persian STT & TTS. Piper Amir weights, config and WASM are all
 * served by Sanat Pish. Hugging Face is used by the Docker build only.
 * The customer's browser reuses its origin-private file cache on later visits.
 */
import { prepareAmirSpeechText, balanceAmirWavVolume } from './forzaPersianVoiceQuality';

export const FORZA_AMIR_VOICE_ID='fa_IR-amir-medium';
const LOCAL_AMIR_DIR='/forza-models/amir';
let stagedAmirModel:Promise<void>|undefined;

/** Piper's upstream library looks in OPFS under /piper/<filename> before it
 * attempts a HuggingFace download. Fill exactly these two files from our own
 * domain FIRST, so the production client never needs HuggingFace for TTS.
 */
async function stageAmirModelFromOrigin():Promise<void>{
  if(!navigator.storage?.getDirectory)throw new Error('amir_browser_opfs_unavailable');
  const root=await navigator.storage.getDirectory();
  const directory=await root.getDirectoryHandle('piper',{create:true});
  const assets=[
    {name:'fa_IR-amir-medium.onnx.json',min:1000},
    {name:'fa_IR-amir-medium.onnx',min:60_000_000},
  ];
  for(const asset of assets){
    const file=await directory.getFileHandle(asset.name,{create:true});
    const existing=await file.getFile();
    if(existing.size>=asset.min)continue;
    const response=await fetch(LOCAL_AMIR_DIR+'/'+asset.name,{cache:'force-cache'});
    if(!response.ok || !response.body || response.redirected ||
       response.url && new URL(response.url).origin!==location.origin){
      throw new Error('amir_local_model_http_'+response.status);
    }
    const size=Number(response.headers.get('Content-Length')||0);
    if(size>0 && size<asset.min)throw new Error('amir_local_model_truncated');
    const writer=await file.createWritable();
    try {
      await response.body.pipeTo(writer);
    }catch(error){
      try {await writer.abort();}catch{}
      throw error;
    }
    const received=await file.getFile();
    if(received.size<asset.min)throw new Error('amir_local_model_incomplete');
    console.info('[FORZA Amir] same-origin model prepared',asset.name,received.size);
  }
}

function prepareOriginAmirModel():Promise<void>{
  if(!stagedAmirModel){
    stagedAmirModel=stageAmirModelFromOrigin().catch(error=>{
      stagedAmirModel=undefined;
      throw error;
    });
  }
  return stagedAmirModel;
}
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
// Piper's phonemizer is not reentrant. Serialize ALL inference requests.
let synthesisTail:Promise<void>=Promise.resolve();
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
      // Never create TtsSession before our same-origin OPFS files are ready.
      // This also prevents the library's otherwise implicit external model fetch.
      await within(prepareOriginAmirModel(),150000,'amir_local_model_timeout');
      const lib=await import('@mintplex-labs/piper-tts-web') as unknown as PiperLibrary;
      const runtime=new lib.TtsSession({
        voiceId:FORZA_AMIR_VOICE_ID,
        wasmPaths:{
          onnxWasm:'/forza-runtime/ort/',
          piperData:'/forza-runtime/piper/piper_phonemize.data',
          piperWasm:'/forza-runtime/piper/piper_phonemize.wasm',
        },
      });
      await within(Promise.resolve(runtime.waitReady),120000,'amir_model_download_timeout');
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
  const phrase=prepareAmirSpeechText(text);
  if(!phrase||phrase.length>750)return Promise.reject(new Error('invalid_amir_text'));
  const cached=speechCache.get(phrase);
  if(cached)return cached;
  const run=async()=>{
    const started=performance.now();
    try{
      const runtime=await loadAmir();
      // Avoid concurrent WASM phonemizer runs: its callbacks are global.
      const raw=await within(runtime.predict(phrase),45000,'amir_inference_timeout');
      if(!(raw instanceof Blob)||raw.size<44)throw new Error('amir_empty_audio');
      const audio=await balanceAmirWavVolume(raw);
      setStage('ready'); // Model loaded is not proof synthesis works.
      console.info('[FORZA Amir] WAV generated', {bytes:audio.size,ms:Math.round(performance.now()-started)});
      return audio;
    }catch(error){
      setStage('failed');
      console.error('[FORZA Amir] Inference error',error);
      throw error;
    }
  };
  const promise=synthesisTail.catch(()=>undefined).then(run).catch(error=>{
    speechCache.delete(phrase);
    throw error;
  });
  synthesisTail=promise.then(()=>undefined,()=>undefined);
  speechCache.set(phrase,promise);
  if(speechCache.size>12){
    const first=speechCache.keys().next().value;
    if(first)speechCache.delete(first);
  }
  return promise;
}
