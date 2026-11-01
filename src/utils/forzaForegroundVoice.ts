/**
 * Conservative near-field energy gate for FORZA's single-browser-microphone STT.
 *
 * A single channel cannot identify physical distance or diarize overlapping
 * speakers. This rejects low-energy background conversation relative to the
 * local ambient floor and requires sustained foreground speech before
 * allowing *any* browser STT transcript to be submitted to the LLM.
 * Never represent it as speaker verification or sound source separation.
 */
export class ForzaForegroundVoice {
  private ambient:number[]=[];
  private floor=0.004;
  private consecutive=0;
  private confirmedTurn=false;
  private lastForeground=0;
  private readonly maxSamples=90;

  sample(rms:number, now:number):{
    foreground:boolean;started:boolean;confirmed:boolean;
    silenceMs:number;threshold:number;
  } {
    const energy=Number.isFinite(rms)?Math.max(0,Math.min(1,rms)):0;
    // The 25th-percentile ambience tracks ventilation and room chatter
    // without being dragged upward by short bursts of nearby speech.
    if(!this.confirmedTurn){
      this.ambient.push(energy);
      if(this.ambient.length>this.maxSamples)this.ambient.shift();
      if(this.ambient.length>=8){
        const ordered=[...this.ambient].sort((a,b)=>a-b);
        this.floor=Math.max(0.001,ordered[Math.floor(ordered.length*0.25)]);
      }
    }
    const threshold=Math.max(0.013,this.floor*3.2,this.floor+0.008);
    const foreground=energy>=threshold;
    let started=false;
    if(foreground){
      this.consecutive=Math.min(10,this.consecutive+1);
      if(this.consecutive>=4){
        started=!this.confirmedTurn;
        this.confirmedTurn=true;
        this.lastForeground=now;
      }
    }else{
      this.consecutive=0;
    }
    return {
      foreground:foreground&&this.confirmedTurn,
      started,
      confirmed:this.confirmedTurn,
      silenceMs:this.confirmedTurn?Math.max(0,now-this.lastForeground):0,
      threshold,
    };
  }

  get confirmed(){return this.confirmedTurn}
  silenceDuration(now:number){return this.confirmedTurn?Math.max(0,now-this.lastForeground):0}

  resetTurn(){
    this.confirmedTurn=false;
    this.consecutive=0;
    this.lastForeground=0;
    // Preserve learned ambient noise across subsequent conversational turns.
  }
  resetDevice(){
    this.ambient=[];
    this.floor=0.004;
    this.resetTurn();
  }
}
