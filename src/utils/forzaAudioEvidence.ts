/** Foreground-only microphone route. The AudioWorklet gates PCM before it
 * reaches local/server STT and MediaRecorder. Only timestamps and acoustic
 * scores cross the worklet port; raw audio remains in the browser graph. */
export interface ForzaForegroundAudioRoute {
  node: AudioWorkletNode;
  stream: MediaStream;
  dispose: () => void;
}

export async function attachForzaAudioEvidence(
  context:AudioContext,
  source:MediaStreamAudioSourceNode,
  onSample:(rms:number,at:number,score?:number,gateOpen?:boolean)=>void,
  onFailure:()=>void=()=>{},
):Promise<ForzaForegroundAudioRoute>{
  if(!context.audioWorklet)throw new Error('audio_worklet_unavailable');
  await context.audioWorklet.addModule('/worklets/forza-foreground-gate.js');
  if(context.state==='closed')throw new Error('audio_context_closed');

  const node=new AudioWorkletNode(context,'forza-foreground-gate',{
    numberOfInputs:1,
    numberOfOutputs:1,
    outputChannelCount:[1],
    channelCount:1,
    channelCountMode:'explicit',
  });
  const destination=context.createMediaStreamDestination();
  const sink=context.createGain();
  sink.gain.value=0;
  let closed=false,minAudioTime=context.currentTime;
  const stateChanged=()=>{minAudioTime=context.currentTime;};
  context.addEventListener('statechange',stateChanged);

  node.port.onmessage=event=>{
    if(closed)return;
    const audioNow=context.currentTime,wallNow=Date.now();
    if(context.state==='running'&&Array.isArray(event.data)){
      for(const frame of event.data.slice(-32)){
        if(!Array.isArray(frame)||frame.length<4)continue;
        const [at,rms,score,gateOpen]=frame;
        if(!Number.isFinite(at)||!Number.isFinite(rms)||!Number.isFinite(score)||
           at<minAudioTime||at>audioNow+0.05)continue;
        onSample(rms,wallNow-Math.max(0,audioNow-at)*1000,score,gateOpen===1);
      }
    }
    node.port.postMessage('ack');
  };

  source.connect(node);
  node.connect(destination);
  node.connect(sink);
  sink.connect(context.destination);

  const dispose=()=>{
    if(closed)return;
    closed=true;
    context.removeEventListener('statechange',stateChanged);
    node.onprocessorerror=null;
    node.port.onmessage=null;
    node.port.close();
    try{source.disconnect(node);}catch{}
    try{node.disconnect();}catch{}
    try{destination.disconnect();}catch{}
    try{sink.disconnect();}catch{}
    for(const track of destination.stream.getTracks())track.stop();
  };
  node.onprocessorerror=()=>{
    dispose();
    onFailure();
  };
  return {node,stream:destination.stream,dispose};
}
