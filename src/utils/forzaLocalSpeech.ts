/** Browser-based Persian STT fallback for FORZA.
 * Text-to-speech is exclusively Pocket Farsi v2 on /api/ai/forza-speech.
 * The former unused Piper/Amir browser TTS was removed because the VPS
 * build cannot resolve its optional, intentionally uninstalled dependency.
 * Keeping it here silently bundled a second, unwanted voice engine.
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
