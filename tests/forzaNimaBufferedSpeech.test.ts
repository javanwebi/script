import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaNimaBufferedSpeech, forzaPcmWavDurationSeconds } from '../src/utils/forzaNimaBufferedSpeech';

function pcm(seconds:number):Uint8Array {
  const rate=22050, bytes=Math.round(seconds*rate)*2;
  const wav=new Uint8Array(44+bytes);
  const view=new DataView(wav.buffer);
  const str=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)wav[offset+i]=value.charCodeAt(i)};
  str(0,'RIFF');view.setUint32(4,bytes+36,true);str(8,'WAVE');
  str(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);
  view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,bytes,true);
  return wav;
}
function flush(){return new Promise<void>(resolve=>setTimeout(resolve,0));}

test('lookahead starts two synth requests concurrently but schedules WAVs in original SSE order',async()=>{
  const started:string[]=[];
  const resolvers=new Map<string,(audio:Uint8Array)=>void>();
  const scheduled:number[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:text=>{
      started.push(text);
      return new Promise<Uint8Array>(resolve=>{resolvers.set(text,resolve)});
    },
    player:{enqueueWav(wav){scheduled.push(wav.byteLength);return Promise.resolve()}},
    maxConcurrent:2,initialBufferSeconds:2,maximumInitialWaitMs:300,
  });
  engine.add('FIRST');engine.add('SECOND');engine.add('THIRD');
  await flush();
  assert.deepEqual(started,['FIRST','SECOND']);
  // Second WAV arrives first; it cannot jump ahead of the first sentence.
  resolvers.get('SECOND')!(pcm(2.5));
  await flush();
  assert.deepEqual(scheduled,[]);
  // The third phrase may begin while the first is still synthesizing.
  assert.deepEqual(started,['FIRST','SECOND','THIRD']);
  resolvers.get('FIRST')!(pcm(1.5));
  await flush();
  assert.equal(scheduled.length,2);
  assert.equal(scheduled[0],pcm(1.5).byteLength);
  assert.equal(scheduled[1],pcm(2.5).byteLength);
  resolvers.get('THIRD')!(pcm(1));
  await engine.finish();
  assert.equal(scheduled.length,3);
  assert.equal(engine.statistics.scheduled,3);
  assert.equal(engine.statistics.queued,3);
});

test('start after 2 seconds of ready audio without waiting for the whole AI reply',async()=>{
  const scheduled:number[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>pcm(3),
    player:{enqueueWav(w){scheduled.push(w.length);return Promise.resolve()}},
    maximumInitialWaitMs:200,
  });
  engine.add('Ready completed clause');
  await flush();
  assert.equal(scheduled.length,1);
  await engine.finish();
});

test('short Nima first clause has bounded warm buffer window, not a 10s silence',async()=>{
  const scheduled:number[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>pcm(0.5),
    player:{enqueueWav(w){scheduled.push(w.length);return Promise.resolve()}},
    maximumInitialWaitMs:15,
  });
  engine.add('درود');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(scheduled.length,1);
  await engine.finish();
});

test('do not count arbitrary bytes as valid speech, or persist generated WAVs',async()=>{
  assert.ok(Math.abs(forzaPcmWavDurationSeconds(pcm(2.3))-2.3)<0.001);
  assert.throws(()=>forzaPcmWavDurationSeconds(new Uint8Array(44)),/invalid_wav|missing_wav_data/);
  const wav=pcm(0.5);
  wav[0]=0;
  assert.throws(()=>forzaPcmWavDurationSeconds(wav),/invalid_wav/);
});

test('a failed synthesis does not make a partial incomplete spoken answer appear successful',async()=>{
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>{throw new Error('tts_failed')},
    player:{enqueueWav(){throw new Error('unexpected_schedule')}},
    maximumInitialWaitMs:1,
  });
  engine.add('A complete but failed phrase');
  await assert.rejects(engine.finish(),/tts_failed/);
});

test('cancelled queued phrases never schedule extra speaker audio',async()=>{
  let release!:(wav:Uint8Array)=>void;
  const scheduled:number[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:()=>new Promise(resolve=>{release=resolve}),
    player:{enqueueWav(w){scheduled.push(w.length);return Promise.resolve()}},
    maximumInitialWaitMs:1,maxConcurrent:1,
  });
  engine.add('First');engine.add('Second');
  await flush();
  engine.cancel();
  release(pcm(1));
  await flush();
  assert.deepEqual(scheduled,[]);
  await assert.rejects(engine.finish(),/aborted/);
});

test('conversation history accepts only fully completed audio, never queued WAVs',async()=>{
  let finishPlaying!:()=>void;
  const played:string[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>pcm(2.1),
    player:{enqueueWav:()=>new Promise<void>(resolve=>{finishPlaying=resolve})},
    onPhrasePlayed:phrase=>played.push(phrase),
  });
  engine.add('برای تسمه مدل دستگاه لازم است');
  await flush();
  assert.deepEqual(played,[],'a synthesized WAV is not heard speech');
  finishPlaying();
  await engine.finish();
  assert.deepEqual(played,['برای تسمه مدل دستگاه لازم است']);
});

test('interruption does not mark a cancelled queued WAV as heard',async()=>{
  let stop!:()=>void;
  const played:string[]=[];
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>pcm(2.2),
    player:{enqueueWav:()=>new Promise<void>(resolve=>{stop=resolve})},
    onPhrasePlayed:phrase=>played.push(phrase),
  });
  engine.add('این جمله هنوز شنیده نشده');
  await flush();
  engine.cancel();
  stop();
  await flush();
  assert.deepEqual(played,[]);
});

test('lookahead is bounded by unplayed phrases, so one fast LLM cannot monopolize voice workers',async()=>{
 let calls=0;const ends:(()=>void)[]=[];
 const engine=new ForzaNimaBufferedSpeech({synthesize:async()=>{calls++;return pcm(3)},player:{enqueueWav:()=>new Promise<void>(r=>ends.push(r))},maxAheadPhrases:4});
 for(let i=0;i<12;i++)engine.add('phrase '+i);
 for(let i=0;i<6;i++)await flush();
 assert.equal(calls,4);assert.equal(ends.length,4);
 ends[0]();for(let i=0;i<3;i++)await flush();assert.equal(calls,5);
 engine.cancel();ends.forEach(end=>end());await flush();assert.equal(calls,5);
});

test('barge-in aborts in-flight synthesis and finish promptly even when a transport ignores cancellation',async()=>{
 let signal:AbortSignal|undefined;
 const engine=new ForzaNimaBufferedSpeech({synthesize:(_text,s)=>{signal=s;return new Promise(()=>{})},player:{enqueueWav:async()=>{}}});
 engine.add('pending');await flush();const finished=engine.finish();void finished.catch(()=>{});
 engine.cancel();assert.equal(signal?.aborted,true);
 await assert.rejects(Promise.race([finished,new Promise((_,reject)=>setTimeout(()=>reject(new Error('hung')),100))]),/aborted/);
});

test('one failed synthesis cancels sibling requests and never starts further queued work',async()=>{
 let fail!:(error:Error)=>void;let secondSignal:AbortSignal|undefined;let count=0;
 const engine=new ForzaNimaBufferedSpeech({synthesize:(_text,signal)=>{
  count++;if(count===1)return new Promise((_,reject)=>{fail=reject;});
  secondSignal=signal;return new Promise((_,reject)=>signal!.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));
 },player:{enqueueWav:async()=>{}}});
 for(let i=0;i<5;i++)engine.add('phrase '+i);
 await flush();fail(new Error('failed-first'));await assert.rejects(engine.finish(),/failed-first/);
 assert.equal(secondSignal?.aborted,true);assert.equal(count,2);
});


test('short first Nima audio starts after a 40ms bounded warm window',async()=>{
  let scheduled=0;
  const engine=new ForzaNimaBufferedSpeech({
    synthesize:async()=>pcm(0.5),
    player:{enqueueWav(){scheduled++;return Promise.resolve()}},
    initialBufferSeconds:0.35,
    maximumInitialWaitMs:40,
  });
  engine.add('پاسخ کوتاه نیما');
  await new Promise(resolve=>setTimeout(resolve,70));
  assert.equal(scheduled,1);
  await engine.finish();
});
