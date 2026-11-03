/**
 * Privacy-safe FORZA timing markers. Only monotonic timestamps, event names,
 * numeric durations and random turn IDs are logged; never transcripts or PCM.
 * One session's samples live in RAM and are discarded on navigation.
 */
export type ForzaMilestone =
  | 'speech_start' | 'speech_end' | 'endpoint_detected' | 'stt_final' | 'server_request'
  | 'sse_headers' | 'first_text' | 'first_tts_phrase'
  | 'tts_request' | 'tts_headers' | 'wav_received' | 'audio_decoded'
  | 'audio_started' | 'audio_gap' | 'audio_finished' | 'turn_interrupted';
const durations = new Map<string,number[]>();
export function forzaLatencyDistribution(values:readonly number[]) {
  const ordered=values.filter(x=>Number.isFinite(x) && x>=0).slice().sort((a,b)=>a-b);
  if(!ordered.length)return {count:0,meanMs:null,medianMs:null,p95Ms:null};
  const median=ordered.length%2
    ? ordered[(ordered.length-1)/2]
    : (ordered[ordered.length/2-1]+ordered[ordered.length/2])/2;
  return {count:ordered.length,
    meanMs:Math.round(ordered.reduce((a,b)=>a+b,0)/ordered.length),
    medianMs:Math.round(median),
    p95Ms:Math.round(ordered[Math.max(0,Math.ceil(0.95*ordered.length)-1)])};
}
export function forzaSessionLatencySummary(){
  return Object.fromEntries([...durations].map(([k,v])=>[k,forzaLatencyDistribution(v)]));
}
export class ForzaTurnTelemetry {
  private readonly stamps=new Map<ForzaMilestone,number>();
  constructor(readonly turnId:string,private readonly clock:()=>number=()=>performance.now()){}
  mark(phase:ForzaMilestone,extra:Record<string,number>={}):number {
    return this.markAt(phase,this.clock(),extra);
  }
  markAt(phase:ForzaMilestone,now:number,extra:Record<string,number>={}):number {
    if(!this.stamps.has(phase))this.stamps.set(phase,now);
    console.info('[FORZA_TIMING]',JSON.stringify({turnId:this.turnId,phase,
      sinceStartMs:Math.round(now-(this.stamps.get('speech_start')??this.stamps.get('server_request')??now)),
      ...Object.fromEntries(Object.entries(extra).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>[k,Math.round(v)]))}));
    return now;
  }
  duration(metric:string,start:ForzaMilestone,end:ForzaMilestone):number|null {
    const a=this.stamps.get(start),b=this.stamps.get(end);
    if(a===undefined||b===undefined||b<a)return null;
    const d=b-a;
    const series=durations.get(metric)||[];
    series.push(d);
    if(series.length>100)series.shift();
    durations.set(metric,series);
    console.info('[FORZA_TIMING_SUMMARY]',JSON.stringify({turnId:this.turnId,metric,ms:Math.round(d),
      session:forzaLatencyDistribution(series)}));
    return d;
  }
}
