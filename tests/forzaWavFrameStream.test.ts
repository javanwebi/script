import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeForzaWavFrameStream} from '../src/utils/forzaWavFrameStream';

function wav(seed:number):Uint8Array{
  const out=new Uint8Array(48);
  const view=new DataView(out.buffer);
  const str=(at:number,value:string)=>{for(let i=0;i<value.length;i++)out[at+i]=value.charCodeAt(i)};
  str(0,'RIFF');view.setUint32(4,40,true);str(8,'WAVE');
  str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,1,true);view.setUint32(24,22050,true);view.setUint32(28,44100,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,4,true);
  view.setInt16(44,seed,true);view.setInt16(46,seed+1,true);
  return out;
}
function frame(audio:Uint8Array):Uint8Array{
  const out=new Uint8Array(4+audio.length);
  new DataView(out.buffer).setUint32(0,audio.length,true);
  out.set(audio,4);return out;
}
function stream(parts:Uint8Array[]):ReadableStream<Uint8Array>{
  return new ReadableStream({start(controller){parts.forEach(part=>controller.enqueue(part));controller.close();}});
}
test('parses multiple length-prefixed WAVs split across arbitrary network reads',async()=>{
  const a=frame(wav(10)),b=frame(wav(20)),joined=new Uint8Array(a.length+b.length);
  joined.set(a);joined.set(b,a.length);
  const received:number[]=[];
  const stats=await consumeForzaWavFrameStream(stream([
    joined.slice(0,2),joined.slice(2,17),joined.slice(17,joined.length-3),joined.slice(joined.length-3)
  ]),audio=>received.push(new DataView(audio.buffer,audio.byteOffset).getInt16(44,true)));
  assert.deepEqual(received,[10,20]);
  assert.equal(stats.frames,2);
  assert.equal(stats.totalBytes,joined.length);
});
test('rejects truncated frame bodies rather than silently playing partial audio',async()=>{
  const full=frame(wav(3));
  await assert.rejects(consumeForzaWavFrameStream(stream([full.slice(0,full.length-2)]),()=>{}),/truncated_frame/);
});
test('rejects malformed frame lengths and invalid WAV signatures',async()=>{
  const badLength=new Uint8Array(4);new DataView(badLength.buffer).setUint32(0,9,true);
  await assert.rejects(consumeForzaWavFrameStream(stream([badLength]),()=>{}),/invalid_frame_length/);
  const bad=frame(new Uint8Array(48));
  await assert.rejects(consumeForzaWavFrameStream(stream([bad]),()=>{}),/invalid_wav_frame/);
});
test('rejects empty streams and honours cancellation',async()=>{
  await assert.rejects(consumeForzaWavFrameStream(stream([]),()=>{}),/empty_stream/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(consumeForzaWavFrameStream(stream([frame(wav(1))]),()=>{},controller.signal),/aborted/);
});