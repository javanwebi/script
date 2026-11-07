/** Lazy browser-local Persian STT fallback for FORZA.
 * Chrome SpeechRecognition remains primary. Diba/Vosk is downloaded only when
 * the browser recognizer is unsupported or repeatedly loses its network link.
 * TTS remains the selected private server voice (Piper Nima).
 */
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
let dibaPromise:Promise<LocalSttModel>|undefined;
let voskPromise:Promise<void>|undefined;
let dibaGeneration=0;

/** Release the model at call exit and invalidate any still-loading model.
 * Vosk's createModel has no AbortSignal; a late model is terminated as soon
 * as it resolves instead of being attached to a later call session.
 */
export function disposeDibaSttModel(model?:LocalSttModel):void{
  dibaGeneration++;
  try{model?.terminate?.();}catch{}
  dibaPromise=undefined;
}

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
    const generation=dibaGeneration;
    const task=(async()=>{
      await within(loadVoskScript(),15000,'vosk_runtime_timeout');
      const raw=((window as any).Vosk as BrowserVosk).createModel(FORZA_DIBA_MODEL_URL);
      const guarded=raw.then(model=>{
        if(generation!==dibaGeneration){
          try{model.terminate?.();}catch{}
          throw new Error('diba_model_cancelled');
        }
        return model;
      });
      try{
        return await within(guarded,90000,'diba_model_timeout');
      }catch(error){
        if(error instanceof Error&&error.message==='diba_model_timeout'&&generation===dibaGeneration)
          dibaGeneration++;
        throw error;
      }
    })();
    const wrapped=task.catch(error=>{
      if(dibaPromise===wrapped)dibaPromise=undefined;
      throw error;
    });
    dibaPromise=wrapped;
  }
  return dibaPromise;
}
