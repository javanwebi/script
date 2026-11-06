/**
 * Abort an actual upstream speech-to-text request when its final-audio
 * deadline is reached or the browser disconnects.
 *
 * Promise.race(timeout, provider) alone returns quickly but leaves the
 * upstream client connection open, consuming local resources. Google GenAI
 * documents abortSignal as client-only: the service may keep processing and
 * billable usage can still apply. Cancellation is NOT a quota guarantee.
 * This helper both signals cancellation to the provider and releases the
 * HTTP turn promptly. It never records audio or transcript contents.
 */
export async function withForzaSttDeadline<T>(
  run:(signal:AbortSignal)=>Promise<T>,
  disconnected?:AbortSignal,
  timeoutMs=9_000,
):Promise<T>{
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>60_000)
    throw new Error('FORZA_STT_INVALID_DEADLINE');
  const controller=new AbortController();
  const signal=controller.signal;
  const abort=(code:string)=>{
    if(!signal.aborted)controller.abort(new Error(code));
  };
  const onDisconnected=()=>abort('FORZA_STT_DISCONNECTED');
  if(disconnected?.aborted)onDisconnected();
  else disconnected?.addEventListener('abort',onDisconnected,{once:true});
  const timer=setTimeout(()=>abort('FORZA_STT_TIMEOUT'),timeoutMs);
  let onAbort!:()=>void;
  const stopped=new Promise<never>((_,reject)=>{
    onAbort=()=>reject(signal.reason instanceof Error ? signal.reason
      : new Error('FORZA_STT_ABORTED'));
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted)onAbort();
  });
  try{
    const running=Promise.resolve().then(()=>{
      if(signal.aborted)throw signal.reason;
      return run(signal);
    });
    return await Promise.race([running,stopped]);
  }finally{
    clearTimeout(timer);
    signal.removeEventListener('abort',onAbort);
    disconnected?.removeEventListener('abort',onDisconnected);
  }
}
