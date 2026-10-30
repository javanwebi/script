import test from 'node:test';
import assert from 'node:assert/strict';
import {readForzaWavFrames} from '../src/utils/forzaWavFrames';

function wav(length=120):Uint8Array{
  const out=new Uint8Array(length);
  out.set([82,73,70,70],0);
  out.set([87,65,86,69],8);
  return out;
}
function packet(data:Uint8Array):Uint8Array{
  const out=new Uint8Array(data.length+4);
  new DataView(out.buffer).setUint32(0,data.length,true);
  out.set(data,4);
  return out;
}
function stream(bytes:Uint8Array,steps:number[]):ReadableStream<Uint8Array>{
  return new ReadableStream({
    start(controller){
      let pos=0;
      for(const n of steps){
        if(pos>=bytes.length)break;
        controller.enqueue(bytes.slice(pos,pos+n));
        pos+=n;
      }
      if(pos<bytes.length)controller.enqueue(bytes.slice(pos));
      controller.close();
    },
  });
}
test('progressive WAV decoder plays frame one before HTTP stream ends',async()=>{
  const first=packet(wav(120)),second=packet(wav(80));
  const bytes=new Uint8Array(first.length+second.length);
  bytes.set(first);bytes.set(second,first.length);
  const seen:number[]=[];
  const count=await readForzaWavFrames(stream(bytes,[1,2,1,8,24,19,69,1,1,2,3]),w=>{
    seen.push(w.byteLength);
  });
  assert.equal(count,2);
  assert.deepEqual(seen,[120,80]);
});
test('truncated final WAV fails instead of silently dropping words',async()=>{
  const data=packet(wav(120));
  await assert.rejects(
    readForzaWavFrames(stream(data.slice(0,-7),[1,2,10]),()=>{}),
    /truncated/,
  );
});
test('invalid WAV signature is rejected',async()=>{
  const data=packet(new Uint8Array(80));
  await assert.rejects(
    readForzaWavFrames(stream(data,[4,5,40]),()=>{}),
    /invalid_header/,
  );
});
test('empty stream fails rather than reporting completed speech',async()=>{
  await assert.rejects(
    readForzaWavFrames(stream(new Uint8Array(0),[]),()=>{}),
    /truncated/,
  );
});
