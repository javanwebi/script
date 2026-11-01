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
