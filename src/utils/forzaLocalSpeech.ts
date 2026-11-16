/** On-device Persian streaming STT for FORZA, with Web Speech fallback.
 * Text-to-speech is exclusively Pocket Farsi v2 on /api/ai/forza-speech.
 * The former unused Piper/Amir browser TTS was removed because the VPS
 * build cannot resolve its optional, intentionally uninstalled dependency.
 * Keeping it here silently bundled a second, unwanted voice engine.
 */
export const FORZA_DIBA_MODEL_URL='/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz';
export const FORZA_DIBA_SAMPLE_RATE=16000;

/** Resample microphone PCM to the 16 kHz rate used by the Persian Vosk model.
 * A short windowed-sinc low-pass prevents frequencies above the new Nyquist
 * limit from aliasing into speech when browsers capture at 44.1/48 kHz.
 */
export function resampleDibaPcm(input:Float32Array,inputRate:number):Float32Array{
  if(!Number.isFinite(inputRate)||inputRate<8000||!input.length)return new Float32Array(0);
  if(inputRate===FORZA_DIBA_SAMPLE_RATE)return input.slice();
  const ratio=inputRate/FORZA_DIBA_SAMPLE_RATE;
  const outputLength=Math.max(1,Math.round(input.length/ratio));
  const output=new Float32Array(outputLength);
  const radius=12;
  const cutoff=Math.min(1,FORZA_DIBA_SAMPLE_RATE/inputRate)*0.94;
  for(let outIndex=0;outIndex<outputLength;outIndex++){
    const center=outIndex*ratio;
    const centerIndex=Math.floor(center);
    let weighted=0,weightSum=0;
    for(let inputIndex=Math.max(0,centerIndex-radius+1);
        inputIndex<=Math.min(input.length-1,centerIndex+radius);inputIndex++){
      const distance=center-inputIndex;
      if(Math.abs(distance)>=radius)continue;
      const phase=Math.PI*cutoff*distance;
      const sinc=Math.abs(phase)<1e-8?1:Math.sin(phase)/phase;
      const window=0.5+0.5*Math.cos(Math.PI*distance/radius);
      const weight=cutoff*sinc*window;
      weighted+=input[inputIndex]*weight;
      weightSum+=weight;
    }
    output[outIndex]=weightSum!==0?weighted/weightSum:input[Math.min(input.length-1,Math.round(center))]||0;
  }
  return output;
}
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
