// Energy only; no PCM, words or identity leave this processor.
class ForzaSpeechEvidence extends AudioWorkletProcessor {
  constructor(){
    super();this.sum=0;this.count=0;this.frames=[];this.inFlight=false;
    this.window=Math.max(128,Math.round(sampleRate*0.02));
    this.port.onmessage=()=>{this.inFlight=false;};
  }
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    for(let i=0;i<input.length;i++){
      this.sum+=input[i]*input[i];this.count++;
      if(this.count>=this.window){
        this.frames.push([currentTime+(i+1)/sampleRate,Math.sqrt(this.sum/this.count)]);
        if(this.frames.length>32)this.frames.shift();
        this.sum=0;this.count=0;
      }
    }
    if(!this.inFlight&&this.frames.length>=4){
      this.port.postMessage(this.frames);this.frames=[];this.inFlight=true;
    }
    return true;
  }
}
registerProcessor('forza-speech-evidence',ForzaSpeechEvidence);
