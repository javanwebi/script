import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaContinuousWav,pocketWavWindow} from '../src/utils/forzaContinuousWav';

test('Pocket WAVs use a single sample-clock timeline, not an HTML audio restart',async()=>{
  const originalFetch=globalThis.fetch;
  const scheduled:number[]=[];
  const nodes:Array<{start:(when:number)=>void;onended:(()=>void)|null;disconnect:()=>void;stop:()=>void}> = [];
  const gain={gain:{value:1},connect(){},disconnect(){}};
  const ctx={
    state:'running',currentTime:10,
    createBufferSource(){
      const source={
        buffer:null as unknown,onended:null as null|(()=>void),
        connect(_target:unknown){},disconnect(){},
        start(when:number){scheduled.push(when);},
        stop(){this.onended?.()},
      };
      nodes.push(source);return source;
    },
    createGain(){return gain;},
    async decodeAudioData(){return {duration:0.4};},
    async resume(){},
  };
  globalThis.fetch=(async()=>new Response(new Uint8Array(44),{status:200})) as typeof fetch;
  try{
    const speaking:number[]=[];
    const queue=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,
      ()=>speaking.push(1));
    const a=queue.enqueue('blob:phrase-a');
    const b=queue.enqueue('blob:phrase-b');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(scheduled.length,2);
    assert.ok(Math.abs((scheduled[1]-scheduled[0])-0.4)<0.00001);
    assert.equal(queue.underrunCount,0);
    // enqueue schedules future sound; it cannot claim the audio has
    // started immediately after decode. Status changes at scheduled time.
    assert.equal(speaking.length,0);
    await new Promise(resolve=>setTimeout(resolve,40));
    assert.equal(speaking.length,1);
    queue.setMuted(true);
    assert.equal(gain.gain.value,0);
    nodes.forEach(s=>s.onended?.());
    await Promise.all([a,b]);
  } finally {globalThis.fetch=originalFetch;}
});

test('interruption clears already queued speech without leaving a blocked promise',async()=>{
  const originalFetch=globalThis.fetch;
  const sources:Array<{stop:()=>void;onended:(()=>void)|null}>=[];
  const ctx={
    state:'running',currentTime:2,
    createBufferSource(){
      const s={buffer:null,onended:null as null|(()=>void),connect(){},disconnect(){},
        start(){},stop(){this.onended?.()}};
      sources.push(s);return s;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){return {duration:2};},
    async resume(){},
  };
  globalThis.fetch=(async()=>new Response(new Uint8Array(44),{status:200})) as typeof fetch;
  try{
    const queue=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,()=>{});
    const pending=queue.enqueue('blob:interrupt');
    await new Promise(resolve=>setTimeout(resolve,0));
    queue.cancel();
    await pending;
    assert.equal(sources.length,1);
    await queue.enqueue('blob:after-cancel');
  } finally{globalThis.fetch=originalFetch;}
});

test('streamed WAV frames decode immediately without Blob URL fetches and schedule in order',async()=>{
  const originalFetch=globalThis.fetch;
  const scheduled:number[]=[];
  let decodes=0;
  const sources:Array<{onended:(()=>void)|null}>=[];
  const ctx={
    state:'running',currentTime:4,destination:{},
    createBufferSource(){
      const source={buffer:null as unknown,onended:null as null|(()=>void),connect(){},disconnect(){},
        start(when:number){scheduled.push(when);},stop(){this.onended?.()}};
      sources.push(source);return source;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(_bytes:ArrayBuffer){decodes++;return {duration:0.5};},
    async resume(){},
  };
  globalThis.fetch=(async()=>{throw new Error('blob_url_fetch_must_not_run')}) as typeof fetch;
  try{
    const queue=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,()=>{});
    const first=queue.enqueueWav(new Uint8Array([1,2,3]));
    const second=queue.enqueueWav(new Uint8Array([4,5,6]));
    assert.equal(decodes,2,'both incoming frames should begin decoding immediately');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(scheduled.length,2);
    assert.ok(Math.abs((scheduled[1]-scheduled[0])-0.5)<0.00001);
    sources.forEach(source=>source.onended?.());
    await Promise.all([first,second]);
  }finally{globalThis.fetch=originalFetch;}
});

test('trims isolated WAV leading/trailing silence but keeps breath margins',()=>{
  const pcm=new Float32Array(24000);
  pcm.fill(0.035,4800,19200);
  const decoded={length:24000,sampleRate:24000,duration:1,
    getChannelData:()=>pcm};
  const window=pocketWavWindow(decoded as unknown as AudioBuffer);
  assert.ok(window.offset>0.15&&window.offset<0.21,JSON.stringify(window));
  assert.ok(window.duration>0.58&&window.duration<0.72,JSON.stringify(window));
  const silent={...decoded,getChannelData:()=>new Float32Array(24000)};
  assert.deepEqual(pocketWavWindow(silent as unknown as AudioBuffer),{offset:0,duration:1});
});


test('interrupting mid-WAV records only audio actually scheduled as played',async()=>{
  const stages:Array<{phase:string;playedMs:number;durationMs:number}>=[];
  let startAt=0;
  const ctx={
    state:'running',currentTime:7,destination:{},
    createBufferSource(){
      return {buffer:null,onended:null as null|(()=>void),connect(){},disconnect(){},
        start(when:number){startAt=when;},stop(){this.onended?.()}};
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){return {duration:1.5};},
    async resume(){},
  };
  const player=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,()=>{});
  const played=player.enqueueWav(new Uint8Array([1,2,3]),event=>stages.push(event));
  await new Promise(resolve=>setTimeout(resolve,65));
  assert.ok(startAt>0);
  ctx.currentTime=startAt+0.65;
  player.cancel();
  await played;
  assert.equal(stages.filter(x=>x.phase==='finished').length,0);
  const interrupted=stages.find(x=>x.phase==='interrupted');
  assert.ok(interrupted,'partial playback must have an interruption record');
  assert.ok(interrupted.playedMs>=640&&interrupted.playedMs<=660);
  assert.equal(interrupted.durationMs,1500);
});


test('avatar meter follows the decoded TTS output, not microphone input',async()=>{
  const originalFetch=globalThis.fetch;
  const levels:number[]=[];
  let ended:(()=>void)|null=null;
  const analyser={
    fftSize:128,
    connect(){},disconnect(){},
    getFloatTimeDomainData(samples:Float32Array){
      samples.fill(0.12);
    },
  };
  const ctx={
    state:'running',currentTime:1,destination:{},
    createBufferSource(){
      return {buffer:null as unknown,onended:null as null|(()=>void),
        connect(){},disconnect(){},start(){},stop(){this.onended?.()}};
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    createAnalyser(){return analyser;},
    async decodeAudioData(){return {duration:0.25};},
    async resume(){},
  };
  globalThis.fetch=(async()=>new Response(new Uint8Array(44),{status:200})) as typeof fetch;
  try{
    const player=new ForzaContinuousWav(
      ()=>ctx as unknown as AudioContext,()=>{},undefined,undefined,undefined,
      level=>levels.push(level));
    const pending=player.enqueue('blob:meter');
    await new Promise(resolve=>setTimeout(resolve,55));
    assert.ok(levels.some(level=>level>0.5),'output RMS should animate the avatar hair');
    // Simulate the last scheduled audio source ending.
    player.cancel();
    await pending;
    assert.equal(levels.at(-1),0,'the hair meter must settle when playback stops');
  }finally{globalThis.fetch=originalFetch;}
});
