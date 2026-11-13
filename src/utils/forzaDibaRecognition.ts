import {StreamingPcmResampler} from './forzaRealtimeAudio';

/** SpeechRecognition-shaped adapter: Diba owns interim/final words, while
 * existing UI turn cursors, cancellation, echo guards and history stay intact. */
export class ForzaDibaRecognition {
  continuous=true; interimResults=true; lang='fa-IR';
  onstart:(()=>void)|null=null;
  onend:(()=>void)|null=null;
  onerror:((event:{error:string})=>void)|null=null;
  onresult:((event:any)=>void)|null=null;
  private socket:WebSocket|null=null;
  private preflight:AbortController|null=null;
  private worklet:AudioWorkletNode|null=null;
  private sink:GainNode|null=null;
  private legacy:any=null;
  private generation=0;
  private failures=0;
  private results:any[]=[];
  private timer:ReturnType<typeof setTimeout>|null=null;
  private heartbeat:ReturnType<typeof setInterval>|null=null;
  private flushTimer:ReturnType<typeof setTimeout>|null=null;
  private lastMessageAt=0;
  private lastPartial='';
  private ready=false;
  private mode=false;
  private pendingFinal=false;
  get hasPendingServerFinal(){return this.pendingFinal;}
  get isServerStream(){return this.mode;}
  constructor(private context:AudioContext,private source:MediaStreamAudioSourceNode,
    private onProvider:(provider:'diba'|'browser')=>void,
    private BrowserRecognition?:new()=>any){}
  start(){
    if(this.socket||this.legacy||this.preflight)throw new DOMException('Already started','InvalidStateError');
    const generation=++this.generation;
    if(this.failures>=2&&this.BrowserRecognition){
      const rec=new this.BrowserRecognition();this.legacy=rec;this.mode=false;
      rec.continuous=true;rec.interimResults=true;rec.lang=this.lang;
      rec.onstart=()=>{if(this.generation===generation){this.onProvider('browser');this.onstart?.();}};
      rec.onresult=(e:any)=>this.onresult?.(e);
      rec.onerror=(e:any)=>this.onerror?.(e);
      rec.onend=()=>{if(this.legacy===rec){this.legacy=null;this.onend?.();}};
      rec.start();return;
    }
    const controller=new AbortController();this.preflight=controller;
    const timeout=setTimeout(()=>controller.abort(),2000);
    void fetch('/api/ai/forza-stt-stream-info',{signal:controller.signal,cache:'no-store'})
      .then(async response=>response.ok && (await response.json()).available===true)
      .catch(()=>false).then(available=>{
        clearTimeout(timeout);
        if(this.generation!==generation)return;
        this.preflight=null;
        if(available)this.connect(generation);
        else if(this.BrowserRecognition){this.failures=2;this.start();}
        else {this.abort();this.onerror?.({error:'network'});}
      });
  }
  private connect(generation:number){
    this.mode=true;this.pendingFinal=false;this.results=[];this.lastPartial='';this.ready=false;
    const url=new URL('/api/live?stt=diba',window.location.href);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const socket=new WebSocket(url);this.socket=socket;
    const fail=()=>{
      if(this.generation!==generation)return;
      this.failures++;
      this.abort();this.onerror?.({error:'network'});
    };
    this.timer=setTimeout(fail,22000);
    socket.onerror=fail;socket.onclose=fail;
    socket.onmessage=event=>{
      if(this.generation!==generation)return;
      this.lastMessageAt=Date.now();
      let msg:any;try{msg=JSON.parse(event.data);}catch{fail();return;}
      if(msg.type==='error'){fail();return;}
      if(msg.type==='ready'){
        if(this.ready)return;
        this.ready=true;
        if(this.timer)clearTimeout(this.timer);this.timer=null;
        this.onProvider('diba');this.onstart?.();
        this.heartbeat=setInterval(()=>{
          if(Date.now()-this.lastMessageAt>15000){fail();return;}
          if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping'}));
        },5000);
        void this.attach(generation,fail);return;
      }
      if(msg.type!=='result')return;
      if(msg.flushed && this.flushTimer){clearTimeout(this.flushTimer);this.flushTimer=null;}
      const text=String(msg.text||'').trim();const final=msg.final===true;
      this.pendingFinal=!final&&Boolean(text);
      if(final&&text)this.failures=0;
      if(!final && text===this.lastPartial)return;
      this.lastPartial=final?'':text;
      const last=this.results.at(-1);
      const result=Object.assign([{transcript:text}],{isFinal:final});
      if(last&&!last.isFinal)this.results[this.results.length-1]=result;
      else if(text||!final)this.results.push(result);
      this.onresult?.({results:this.results,resultIndex:Math.max(0,this.results.length-1)});
      // Bound long-lived result arrays, restarting only at a final boundary.
      if(final&&this.results.length>=128){this.abort();this.onend?.();}
    };
  }
  private async attach(generation:number,fail:()=>void){
    try{
      await this.context.audioWorklet.addModule('/worklets/forza-microphone.js');
      if(this.generation!==generation)return;
      const resampler=new StreamingPcmResampler(this.context.sampleRate);
      const worklet=new AudioWorkletNode(this.context,'forza-microphone');
      const sink=this.context.createGain();sink.gain.value=0;
      this.worklet=worklet;this.sink=sink;
      worklet.port.onmessage=e=>{
        if(this.generation!==generation||!this.ready)return;
        const pcm=resampler.convert(e.data as Float32Array);
        if(!pcm.length)return;
        const ws=this.socket;
        if(!ws||ws.readyState!==WebSocket.OPEN||ws.bufferedAmount>64000){fail();return;}
        // Explicit little endian, independent of host typed-array byte order.
        const bytes=new ArrayBuffer(pcm.length*2);const view=new DataView(bytes);
        for(let i=0;i<pcm.length;i++)view.setInt16(i*2,pcm[i],true);
        ws.send(bytes);
      };
      this.source.connect(worklet);worklet.connect(sink);sink.connect(this.context.destination);
    }catch{fail();}
  }
  requestFinal(){
    if(!this.isServerStream||!this.ready)return false;
    if(this.flushTimer)return true;
    this.socket?.send(JSON.stringify({type:'flush'}));
    this.flushTimer=setTimeout(()=>{
      this.failures++;this.abort();this.onerror?.({error:'network'});
    },3000);
    return true;
  }
  stop(){this.abort();this.onend?.();}
  abort(){
    ++this.generation;this.preflight?.abort();this.preflight=null;this.ready=false;this.mode=false;
    if(this.timer)clearTimeout(this.timer);this.timer=null;
    if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=null;
    if(this.flushTimer)clearTimeout(this.flushTimer);this.flushTimer=null;
    const rec=this.legacy;this.legacy=null;
    if(rec){rec.onstart=null;rec.onend=null;rec.onerror=null;rec.onresult=null;rec.abort();}
    if(this.worklet){
      try{this.source.disconnect(this.worklet);}catch{}
      this.worklet.port.close();this.worklet.disconnect();this.worklet=null;
    }
    this.sink?.disconnect();this.sink=null;
    if(this.socket){this.socket.onclose=null;this.socket.onerror=null;this.socket.onmessage=null;this.socket.close();this.socket=null;}
  }
}
