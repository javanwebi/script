import test from 'node:test';
import assert from 'node:assert/strict';
import {readForzaWavFrames} from '../src/utils/forzaWavFrames';

function wav():Uint8Array{
  const bytes=new Uint8Array(48);
  const view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'),0);
  view.setUint32(4,40,true);
  bytes.set(new TextEncoder().encode('WAVE'),8);
  bytes.set(new TextEncoder().encode('fmt '),12);
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,1,true);
  view.setUint32(24,24000,true);
  view.setUint32(28,48000,true);
  view.setUint16(32,2,true);
  view.setUint16(34,16,true);
  bytes.set(new TextEncoder().encode('data'),36);
  view.setUint32(40,4,true);
  return bytes;
}
function frame(bytes:Uint8Array):Uint8Array{
  const out=new Uint8Array(4+bytes.length);
  new DataView(out.buffer).setUint32(0,bytes.length,true);
  out.set(bytes,4);
  return out;
}

test('decodes multiple Pocket WAV frames across arbitrary HTTP chunk boundaries',async()=>{
  const a=frame(wav()),b=frame(wav());
  const wire=new Uint8Array(a.length+b.length);
  wire.set(a);wire.set(b,a.length);
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      controller.enqueue(wire.slice(0,2));
      controller.enqueue(wire.slice(2,19));
      controller.enqueue(wire.slice(19,wire.length-3));
      controller.enqueue(wire.slice(wire.length-3));
      controller.close();
    },
  });
  const sizes:number[]=[];
  const count=await readForzaWavFrames(stream,part=>sizes.push(part.length));
  assert.equal(count,2);
  assert.deepEqual(sizes,[48,48]);
});

test('rejects truncated or invalid Pocket WAV frame streams',async()=>{
  const broken=new Uint8Array([48,0,0,0,1,2,3]);
  await assert.rejects(readForzaWavFrames(
    new ReadableStream<Uint8Array>({start(c){c.enqueue(broken);c.close();}}),
    ()=>{},
  ),/forza_wav_stream_truncated/);
  const invalid=new Uint8Array(52);
  new DataView(invalid.buffer).setUint32(0,48,true);
  await assert.rejects(readForzaWavFrames(
    new ReadableStream<Uint8Array>({start(c){c.enqueue(invalid);c.close();}}),
    ()=>{},
  ),/forza_wav_frame_invalid_header/);
});
