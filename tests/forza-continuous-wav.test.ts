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
    assert.equal(speaking.length,1,'second WAV is only scheduled in the future; do not advertise speaking yet');
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

test('speaking banner drains at the actual final PCM onended, not future buffer scheduling',async()=>{
  const scheduled:number[]=[];
  const sources:Array<{onended:(()=>void)|null}>=[];
  const ctx={
    state:'running',currentTime:10,destination:{},
    createBufferSource(){
      const source={buffer:null,onended:null as (()=>void)|null,
        connect(){},disconnect(){},start(when:number){scheduled.push(when);},
        stop(){this.onended?.()}};
      sources.push(source);return source;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){return {duration:0.5};},
    async resume(){},
  };
  let drained=0;
  const player=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,
    ()=>{},undefined,()=>{drained++});
  const first=player.enqueueWav(new Uint8Array([1,2,3]));
  const second=player.enqueueWav(new Uint8Array([4,5,6]));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(scheduled.length,2);
  assert.equal(drained,0,'scheduling a future WAV cannot mark end of audio');
  sources[0].onended?.();
  assert.equal(drained,0,'first of multiple active buffers is not end of turn');
  sources[1].onended?.();
  await Promise.all([first,second]);
  assert.equal(drained,1,'last PCM frame completion must release speaking status');
  player.cancel();
  assert.equal(drained,1,'cancellation does not fire playback-ended callback');
});

test('Nima last audible word is not held hostage by five seconds of silent PCM padding',()=>{
  const sampleRate=24000,seconds=6.2;
  const pcm=new Float32Array(Math.round(sampleRate*seconds));
  // Nearly one second of clear voice, then five seconds of zero amplitude.
  pcm.fill(0.035,sampleRate*0.12,Math.round(sampleRate*1.12));
  const wav={duration:seconds,sampleRate,length:pcm.length,getChannelData:()=>pcm} as unknown as AudioBuffer;
  const window=pocketWavWindow(wav);
  assert.ok(window.offset>=0.05&&window.offset<=0.12,JSON.stringify(window));
  assert.ok(window.duration>1&&window.duration<1.3,JSON.stringify(window));
  assert.ok(seconds-window.offset-window.duration>4.7,'5s of silence must not count as speaking time');
});

test('Nima end-trimmer retains the soft final consonant before trailing silence',()=>{
  const rate=24000,pcm=new Float32Array(rate*3);
  pcm.fill(0.04,rate*0.2,rate);
  pcm.fill(0.0012,rate,Math.round(rate*1.24));
  const window=pocketWavWindow({sampleRate:rate,length:pcm.length,duration:3,getChannelData:()=>pcm} as unknown as AudioBuffer);
  assert.ok(window.offset+window.duration>1.26,'keep 70ms guard after weak consonant');
  assert.ok(window.offset+window.duration<1.5,'still trim obvious dead air');
});

test('future scheduled audio never sets speaking prematurely or after cancellation',async()=>{
  const sources:Array<{onended:(()=>void)|null}>=[];
  const ctx={
    state:'running',currentTime:10,destination:{},
    createBufferSource(){
      const s={buffer:null,onended:null as (()=>void)|null,
        connect(){},disconnect(){},start(){},stop(){this.onended?.()}};
      sources.push(s);return s;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){return {duration:4};},async resume(){},
  };
  let speaking=0;
  const player=new ForzaContinuousWav(()=>ctx as unknown as AudioContext,()=>{speaking++});
  const one=player.enqueueWav(new Uint8Array([1]));
  const two=player.enqueueWav(new Uint8Array([2]));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(sources.length,2);
  assert.equal(speaking,1,'second audio was only scheduled for future playback');
  player.cancel();
  await Promise.all([one,two]);
  assert.equal(speaking,1,'cancelled future WAV must not report speech');
});
