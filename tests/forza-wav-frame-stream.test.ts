import test from 'node:test';
import assert from 'node:assert/strict';
import {readForzaWavFrames} from '../src/utils/forzaWavFrameStream';

function wavFrame(): Uint8Array {
  const wav=new Uint8Array(44);
  wav.set([82,73,70,70],0); // RIFF
  wav.set([87,65,86,69],8); // WAVE
  return wav;
}
function framed(wavs:Uint8Array[]):Uint8Array{
  const length=wavs.reduce((total,wav)=>total+4+wav.length,0);
  const result=new Uint8Array(length);
  let pos=0;
  for(const wav of wavs){
    new DataView(result.buffer).setUint32(pos,wav.length,true);
    pos+=4;result.set(wav,pos);pos+=wav.length;
  }
  return result;
}
function responseFromSlices(parts:Uint8Array[]):Response{
  const body=new ReadableStream<Uint8Array>({
    start(controller){for(const part of parts)controller.enqueue(part);controller.close();},
  });
  return new Response(body,{headers:{
    'Content-Type':'application/x-forza-wav-frames',
    'X-Forza-Voice':'pocket-farsi-v2',
  }});
}

test('Pocket frame decoder handles 1-byte transport slices and multiple WAVs',async()=>{
  const body=framed([wavFrame(),wavFrame(),wavFrame()]);
  const outputs:Uint8Array[]=[];
  const count=await readForzaWavFrames(responseFromSlices([...body].map((_,i)=>body.slice(i,i+1))),
    frame=>outputs.push(frame));
  assert.equal(count,3);
  assert.equal(outputs.length,3);
  for(const wav of outputs)assert.deepEqual(wav,wavFrame());
});
test('Pocket stream rejects a truncated frame rather than silently stopping audio',async()=>{
  const body=framed([wavFrame(),wavFrame()]);
  await assert.rejects(
    readForzaWavFrames(responseFromSlices([body.slice(0,-5)]),()=>{}),
    /forza_stream_truncated/,
  );
});
test('Pocket stream rejects malformed RIFF frames',async()=>{
  const bad=wavFrame();bad[0]=0;
  await assert.rejects(
    readForzaWavFrames(responseFromSlices([framed([bad])]),()=>{}),
    /forza_stream_invalid_wav/,
  );
});
test('Pocket stream rejects oversized frame length before allocating WAV',async()=>{
  const header=new Uint8Array(4);
  new DataView(header.buffer).setUint32(0,10_000_000,true);
  await assert.rejects(
    readForzaWavFrames(responseFromSlices([header]),()=>{}),
    /forza_stream_invalid_frame_length/,
  );
});
