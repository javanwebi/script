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
    assert.equal(speaking.length,2);
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

test('FORZA WAV with ten seconds of truly silent tail stops at audible speech end',()=>{
  const rate=24000;
  const pcm=new Float32Array(rate*12);
  // Real Persian phrase is 1.5 seconds, the rest is synthesizer zero-padding.
  pcm.fill(0.035,0,Math.floor(rate*1.5));
  const decoded={
    length:pcm.length,sampleRate:rate,duration:12,
    getChannelData:()=>pcm,
  } as unknown as AudioBuffer;
  const window=pocketWavWindow(decoded);
  assert.equal(window.offset,0);
  assert.ok(window.duration>1.5 && window.duration<1.65,
    'silent 10s WAV tail must not keep speaking UI active: '+JSON.stringify(window));
});

test('FORZA speaking ends when final audio source really ends, not when SSE closes',async()=>{
  const sources:Array<{
    onended:(()=>void)|null;start:(when:number,offset?:number,duration?:number)=>void;
  }>=[];
  const ctx={
    state:'running',currentTime:2,destination:{},
    createBufferSource(){
      const s={
        buffer:null as unknown,
        onended:null as null|(()=>void),
        connect(){},disconnect(){},start(_when:number,_offset?:number,_duration?:number){},
        stop(){this.onended?.()},
      };
      sources.push(s);
      return s;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){
      return {duration:0.5};
    },
    async resume(){},
  };
  let status='thinking';
  const queue=new ForzaContinuousWav(
    ()=>ctx as unknown as AudioContext,
    ()=>{status='speaking';},
    undefined,
    ()=>{status='thinking';},
  );
  const a=queue.enqueueWav(new Uint8Array([1]));
  const b=queue.enqueueWav(new Uint8Array([2]));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(sources.length,2);
  assert.equal(status,'speaking');
  sources[0].onended?.();
  assert.equal(status,'speaking','one still-scheduled audio segment must retain speaking state');
  sources[1].onended?.();
  assert.equal(status,'thinking','mark speech finished immediately, even when SSE is still open');
  await Promise.all([a,b]);
  const c=queue.enqueueWav(new Uint8Array([3]));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(status,'speaking','new audio after a network gap must restore speaking');
  sources[2].onended?.();
  await c;
  assert.equal(status,'thinking');
  queue.cancel();
});

test('interrupting FORZA does not emit a misleading playback-complete event',async()=>{
  let idleEvents=0;
  const sources:Array<{onended:(()=>void)|null}>=[];
  const ctx={
    state:'running',currentTime:5,destination:{},
    createBufferSource(){
      const source={
        buffer:null as unknown,onended:null as null|(()=>void),
        connect(){},disconnect(){},start(){},stop(){this.onended?.()},
      };
      sources.push(source);return source;
    },
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};},
    async decodeAudioData(){return {duration:1};},
    async resume(){},
  };
  const queue=new ForzaContinuousWav(
    ()=>ctx as unknown as AudioContext,
    ()=>{},undefined,()=>{idleEvents++},
  );
  const done=queue.enqueueWav(new Uint8Array([1]));
  await new Promise(resolve=>setTimeout(resolve,0));
  queue.cancel();
  await done;
  assert.equal(idleEvents,0);
  assert.equal(sources.length,1);
});
