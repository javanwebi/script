let sharedForzaAudioContext:AudioContext|null=null;

/** One AudioContext is shared by the route-entry gesture and the live call.
 * Browsers require resume() to be initiated synchronously by a user gesture;
 * creating a fresh context only after the particle animation can miss it.
 */
export function getForzaAudioContext():AudioContext|null{
  if(typeof window==='undefined')return null;
  const AudioContextCtor=window.AudioContext||(window as any).webkitAudioContext;
  if(!AudioContextCtor)return null;
  if(!sharedForzaAudioContext||sharedForzaAudioContext.state==='closed'){
    sharedForzaAudioContext=new AudioContextCtor();
  }
  return sharedForzaAudioContext;
}

export function unlockForzaAudioFromGesture():void{
  const context=getForzaAudioContext();
  if(!context)return;
  try{
    // Both resume() and a silent source are started inside the actual click
    // handler. No audible placeholder is played to the customer.
    const resumed=context.resume();
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    gain.gain.setValueAtTime(0,context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime+0.015);
    void resumed.catch(()=>{});
  }catch{}
}
