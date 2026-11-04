/** Bounded private Piper recovery. Never retry auth errors or unidentified 503s.
 * A failed /speak returns no WAV to the browser, so a transient retry cannot
 * duplicate already-audible text. Retrying endlessly would only worsen FIFO.
 */
export function forzaVoiceRetryDelayMs(
  reason:string|undefined,
  attempt:number,
  elapsedMs:number,
):number|null{
  if(attempt<0||attempt>1||!Number.isFinite(elapsedMs)||elapsedMs<0)return null;
  let delay:number|null=null;
  if(reason==='voice_busy')delay=attempt===0?250:500;
  if(reason==='voice_queue_timeout'&&attempt===0)delay=200;
  if(reason==='voice_unavailable'&&attempt===0&&elapsedMs<=2500)delay=250;
  if(delay===null||elapsedMs+delay>5500)return null;
  return delay;
}

export async function waitForForzaVoiceRetry(ms:number,signal?:AbortSignal):Promise<void>{
  if(signal?.aborted)throw new Error('forza_tts_cancelled');
  if(!Number.isFinite(ms)||ms<=0)return;
  await new Promise<void>((resolve,reject)=>{
    const onAbort=()=>{
      clearTimeout(timer);
      signal?.removeEventListener('abort',onAbort);
      reject(new Error('forza_tts_cancelled'));
    };
    const timer=setTimeout(()=>{
      signal?.removeEventListener('abort',onAbort);
      resolve();
    },ms);
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted)onAbort();
  });
}
