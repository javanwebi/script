import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeForzaNimaWavFrames, splitForzaNimaSentenceText } from '../src/utils/forzaNimaWavFrames';

function wav(dataBytes:number):Uint8Array {
  const value=new Uint8Array(44+dataBytes);
  const view=new DataView(value.buffer);
  value.set([82,73,70,70],0);
  view.setUint32(4,36+dataBytes,true);
  value.set([87,65,86,69],8);
  value.set([102,109,116,32],12);
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,1,true);
  view.setUint32(24,22050,true);
  view.setUint32(28,44100,true);
  view.setUint16(32,2,true);
  view.setUint16(34,16,true);
  value.set([100,97,116,97],36);
  view.setUint32(40,dataBytes,true);
  return value;
}

function framed(value:Uint8Array):Uint8Array {
  const output=new Uint8Array(4+value.length);
  new DataView(output.buffer).setUint32(0,value.length,true);
  output.set(value,4);
  return output;
}

function stream(chunks:Uint8Array[]):ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller){
      for(const chunk of chunks)controller.enqueue(chunk);
      controller.close();
    },
  });
}

test('plays each complete Nima WAV frame as soon as its bytes arrive',async()=>{
  const first=wav(160),second=wav(240);
  const joined=new Uint8Array(framed(first).length+framed(second).length);
  joined.set(framed(first),0);
  joined.set(framed(second),framed(first).length);
  const frames:Uint8Array[]=[];
  const result=await consumeForzaNimaWavFrames(
    stream([joined.slice(0,2),joined.slice(2,51),joined.slice(51,joined.length-3),joined.slice(-3)]),
    frame=>frames.push(frame),
  );
  assert.equal(frames.length,2);
  assert.deepEqual(frames,[first,second]);
  assert.equal(result.frames,2);
  assert.equal(result.bytes,first.length+second.length);
  assert.ok(result.firstFrameMs>=0);
  assert.ok(result.totalMs>=0);
});

test('rejects a truncated final frame instead of silently dropping audio',async()=>{
  const frame=framed(wav(80));
  await assert.rejects(
    consumeForzaNimaWavFrames(stream([frame.slice(0,frame.length-2)]),()=>{}),
    /truncated_frame/,
  );
});

test('rejects non-WAV frames and unbounded frame lengths',async()=>{
  const badWav=framed(new Uint8Array(44));
  await assert.rejects(consumeForzaNimaWavFrames(stream([badWav]),()=>{}),/invalid_wav/);
  const invalidLength=new Uint8Array([0xff,0xff,0xff,0x7f]);
  await assert.rejects(
    consumeForzaNimaWavFrames(stream([invalidLength]),()=>{}),
    /invalid_frame_length/,
  );
});

test('rejects an empty stream',async()=>{
  await assert.rejects(consumeForzaNimaWavFrames(stream([]),()=>{}),/stream_empty/);
});


test('sentence mapping matches Piper boundaries without splitting decimals or part codes',()=>{
  assert.deepEqual(
    splitForzaNimaSentenceText('قطر 3.25 و کد SWR.A19. سپس نصب شود.'),
    ['قطر 3.25 و کد SWR.A19.','سپس نصب شود.'],
  );
  assert.deepEqual(
    splitForzaNimaSentenceText('Dr. Smith بررسی کرد. نتیجه آماده است.'),
    ['Dr. Smith بررسی کرد.','نتیجه آماده است.'],
  );
});
