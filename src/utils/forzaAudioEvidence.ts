/** Keep microphone evidence on the audio thread when rendering is slow.
 * The node emits bounded RMS/timestamp batches, never records audio. */
export async function attachForzaAudioEvidence(
  context:AudioContext,source:MediaStreamAudioSourceNode,
  onSample:(rms:number,at:number)=>void,
  onFailure:()=>void=()=>{},
):Promise<()=>void>{
  if(!context.audioWorklet)throw new Error('audio_worklet_unavailable');
  await context.audioWorklet.addModule('/worklets/forza-speech-evidence.js');
  if(context.state==='closed')throw new Error('audio_context_closed');
  const node=new AudioWorkletNode(context,'forza-speech-evidence');
  const sink=context.createGain();sink.gain.value=0;
  let closed=false,minAudioTime=context.currentTime;
  const stateChanged=()=>{minAudioTime=context.currentTime;};
  context.addEventListener('statechange',stateChanged);
  node.port.onmessage=event=>{
    if(closed)return;
    const audioNow=context.currentTime,wallNow=Date.now();
    if(context.state==='running'&&Array.isArray(event.data)){
      for(const frame of event.data.slice(-32)){
        if(!Array.isArray(frame)||frame.length!==2)continue;
        const [at,rms]=frame;
        if(!Number.isFinite(at)||!Number.isFinite(rms)||at<minAudioTime||at>audioNow+0.05)continue;
        onSample(rms,wallNow-Math.max(0,audioNow-at)*1000);
      }
    }
    node.port.postMessage('ack');
  };
  source.connect(node);node.connect(sink);sink.connect(context.destination);
  const dispose=()=>{
    if(closed)return;closed=true;
    context.removeEventListener('statechange',stateChanged);
    node.onprocessorerror=null;node.port.onmessage=null;node.port.close();
    try{source.disconnect(node);}catch{}
    node.disconnect();sink.disconnect();
  };
  node.onprocessorerror=()=>{dispose();onFailure();};
  return dispose;
}
