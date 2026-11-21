import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaNimaProgressiveSpeech} from '../src/utils/forzaNimaProgressiveSpeech';

function pcm(seconds:number):Uint8Array{
  const rate=22050,bytes=Math.round(seconds*rate)*2;
  const wav=new Uint8Array(44+bytes),view=new DataView(wav.buffer);
  const str=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)wav[offset+i]=value.charCodeAt(i)};
  str(0,'RIFF');view.setUint32(4,bytes+36,true);str(8,'WAVE');
  str(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);
  view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,bytes,true);
  return wav;
}
const flush=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test('first WAV frame is scheduled before the HTTP phrase stream finishes',async()=>{
  let emit!:(wav:Uint8Array)=>void,finish!:()=>void;
  const scheduled:number[]=[];
  const engine=new ForzaNimaProgressiveSpeech({
    synthesizeStream:(_text,_signal,onChunk)=>new Promise<void>(resolve=>{emit=onChunk;finish=resolve}),
    player:{enqueueWav(wav){scheduled.push(wav.byteLength);return Promise.resolve()}},
    initialBufferSeconds:0,
  });
  engine.add('first phrase');
  await flush();
  emit(pcm(0.8));
  await flush();
  assert.deepEqual(scheduled,[pcm(0.8).byteLength]);
  finish();
  await engine.finish();
  assert.equal(engine.statistics.scheduled,1);
});

test('parallel phrase streams cannot play out of order',async()=>{
  const jobs=new Map<string,{emit:(wav:Uint8Array)=>void;finish:()=>void}>();
  const scheduled:number[]=[];
  const first=pcm(0.7),second=pcm(0.9);
  const engine=new ForzaNimaProgressiveSpeech({
    synthesizeStream:(text,_signal,onChunk)=>new Promise<void>(resolve=>{
      jobs.set(text,{emit:onChunk,finish:resolve});
    }),
    player:{enqueueWav(wav){scheduled.push(wav.byteLength);return Promise.resolve()}},
    maxConcurrent:2,maxAheadPhrases:3,initialBufferSeconds:0,
  });
  engine.add('FIRST');engine.add('SECOND');
  await flush();
  jobs.get('SECOND')!.emit(second);
  jobs.get('SECOND')!.finish();
  await flush();
  assert.deepEqual(scheduled,[]);
  jobs.get('FIRST')!.emit(first);
  await flush();
  assert.deepEqual(scheduled,[first.byteLength]);
  jobs.get('FIRST')!.finish();
  await engine.finish();
  assert.deepEqual(scheduled,[first.byteLength,second.byteLength]);
});

test('phrase history is recorded only after every streamed frame actually plays',async()=>{
  const jobs:{emit:(wav:Uint8Array)=>void;finish:()=>void}[]=[];
  const releases:(()=>void)[]=[];
  const played:string[]=[];
  const engine=new ForzaNimaProgressiveSpeech({
    synthesizeStream:(_text,_signal,onChunk)=>new Promise<void>(resolve=>{jobs.push({emit:onChunk,finish:resolve})}),
    player:{enqueueWav:()=>new Promise<void>(resolve=>releases.push(resolve))},
    initialBufferSeconds:0,
    onPhrasePlayed:text=>played.push(text),
  });
  engine.add('two frame phrase');
  await flush();
  jobs[0].emit(pcm(0.5));
  jobs[0].emit(pcm(0.5));
  jobs[0].finish();
  await flush();
  assert.deepEqual(played,[]);
  releases[0]();
  await flush();
  assert.deepEqual(played,[]);
  releases[1]();
  await engine.finish();
  assert.deepEqual(played,['two frame phrase']);
});

test('barge-in aborts the active streaming request and finish does not hang',async()=>{
  let signal:AbortSignal|undefined;
  const engine=new ForzaNimaProgressiveSpeech({
    synthesizeStream:(_text,s)=>{signal=s;return new Promise(()=>{})},
    player:{enqueueWav:async()=>{}},
  });
  engine.add('pending');
  await flush();
  const finished=engine.finish();void finished.catch(()=>{});
  engine.cancel();
  assert.equal(signal?.aborted,true);
  await assert.rejects(Promise.race([
    finished,new Promise((_,reject)=>setTimeout(()=>reject(new Error('hung')),100))
  ]),/aborted/);
});