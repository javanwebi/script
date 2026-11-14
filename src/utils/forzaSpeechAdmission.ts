import {forzaTurnIntent} from './forzaBargeIn';
import {normalizePersianTranscript, type BrowserSpeechResult} from './forzaSpeechPipeline';

export type SpeechAdmission = 'accept' | 'wait' | 'reject';
/** Acoustic prominence, NOT speaker identity or distance estimation.
 * Evidence expires quickly and is separated from the end-of-turn VAD latch.
 * All state is in RAM and is cleared on microphone replacement. */
export class ForzaSpeechAdmission {
  private levels:Array<{at:number;value:number}>=[];
  private floor=0.001;
  private lastSample=-Infinity;
  private onset:number|null=null;
  private lastStrong=-Infinity;
  private duration=0;
  private strongFrames=0;
  private mode=false;
  private calibrated=false;

  sample(rms:number,now:number,playback:boolean){
    if(!Number.isFinite(rms)||!Number.isFinite(now)){this.reset();return;}
    const value=Math.max(0,Math.min(1,rms));
    if((playback&&!this.mode)||now-this.lastSample>250||now<this.lastSample){
      this.onset=null;this.duration=0;this.strongFrames=0;this.lastStrong=-Infinity;
    }
    this.mode=playback;this.lastSample=now;
    this.levels=this.levels.filter(s=>now-s.at<=2400);
    this.levels.push({at:now,value});
    // A low percentile tracks ambient energy without treating every peak as noise.
    // Freeze the floor during an established utterance so long speech is not gated out.
    if(this.onset===null){
      const sorted=this.levels.map(s=>s.value).sort((a,b)=>a-b);
      if(sorted.length>=6){
        const ambient=sorted[Math.floor((sorted.length-1)*0.2)];
        this.floor=this.calibrated?this.floor*0.9+ambient*0.1:ambient;
        this.calibrated=true;
      }
    }
    const threshold=Math.max(playback?0.004:0.002,this.floor*(playback?3.5:2.3));
    if(this.calibrated&&value>threshold){
      // A late main-thread tick is not an observed silent frame. The separate
      // 250ms discontinuity guard above rejects genuinely stale sampling.
      if(this.onset===null){this.onset=now;this.strongFrames=0;}
      this.strongFrames++;
      this.duration=now-this.onset;
      this.lastStrong=now;
    }else if(now-this.lastStrong>100){
      this.onset=null;
    }
  }

  decide(text:string,final:boolean,playback:boolean,now:number):SpeechAdmission{
    if(playback&&!this.mode)return 'reject';
    if(now-this.lastSample>250||!this.calibrated)return playback?'reject':'wait';
    const intent=forzaTurnIntent(text);
    const needed=playback&&intent!=='stop'?280:160;
    // A final may arrive slightly after acoustic silence. Interim words need
    // much fresher evidence; an old loud syllable must not admit a bystander.
    const fresh=now-this.lastStrong<=(final?900:playback?300:450);
    if(!fresh)return 'reject';
    if(this.duration<needed||this.strongFrames<3)return this.onset!==null||!playback?'wait':'reject';
    if(playback&&intent==='question'&&text.trim().split(/\s+/).length<2)return 'wait';
    return 'accept';
  }

  diagnostics(now:number){
    return {sampleAgeMs:now-this.lastSample,speechAgeMs:now-this.lastStrong,
      durationMs:this.duration,frames:this.strongFrames,floor:this.floor,
      calibrated:this.calibrated,playback:this.mode};
  }

  get acousticSpeech(){return this.onset!==null&&this.duration>=160&&this.strongFrames>=3;}
  reset(){
    this.levels=[];this.floor=0.001;this.lastSample=-Infinity;this.onset=null;
    this.lastStrong=-Infinity;this.duration=0;this.strongFrames=0;this.mode=false;this.calibrated=false;
  }
}

/** Browser results are cumulative. Mask rejected slots BEFORE displaying text,
 * checkpointing a turn or invoking barge-in. Never replay a rejected final when
 * a later real customer supplies fresh acoustic evidence. */
export class ForzaRecognitionAdmission {
  private slots:Array<{raw:string;final:boolean;accepted:string;blocked:string;prefix:string;sealed:boolean;pending:boolean}>=[];
  reset(){this.slots=[];}
  filter(results:ArrayLike<BrowserSpeechResult>,decide:(text:string,final:boolean)=>SpeechAdmission){
    if(results.length<this.slots.length)this.reset();
    let changed=false,rejected=false;
    const clean:BrowserSpeechResult[]=[];
    for(let i=0;i<results.length;i++){
      const input=results[i];const raw=normalizePersianTranscript(String((input?.[0] as any)?.transcript||''));
      const final=input?.isFinal===true;
      const old=this.slots[i];
      const slot=old||{raw:'',final:false,accepted:'',blocked:'',prefix:'',sealed:false,pending:false};
      if(!slot.sealed && (raw!==slot.raw||final!==slot.final||!old||slot.pending)){
        const candidate=slot.blocked
          ? raw.startsWith(slot.blocked+' ')?raw.slice(slot.blocked.length).trim():''
          : raw;
        const decision=candidate?decide(candidate,final):'reject';
        slot.pending=decision==='wait';
        if(decision==='accept'){
          const accepted=slot.blocked?[slot.prefix,candidate].filter(Boolean).join(' '):candidate;
          changed=changed||slot.accepted!==accepted||slot.final!==final;
          slot.accepted=accepted;
        }else if(decision==='reject'){
          // Keep already admitted words, but never append untrusted suffixes.
          rejected=rejected||Boolean(raw);
          slot.blocked=raw;slot.prefix=slot.accepted;
          if(final){changed=changed||Boolean(slot.accepted&&!slot.final);slot.sealed=true;}
        }
        slot.raw=raw;slot.final=final;
      }
      this.slots[i]=slot;
      clean.push({0:{transcript:slot.accepted},isFinal:final});
    }
    return {results:clean,changed,rejected,waiting:this.slots.some(slot=>slot.pending)};
  }
}
