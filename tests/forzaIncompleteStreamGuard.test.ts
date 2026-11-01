import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeForzaTextStream} from '../src/utils/forzaStreamClient';

function sseReply(frames:string[], bytesPerChunk=13):Response {
  const text=frames.map(raw=>'data: '+raw+'\n\n').join('');
  const data=new TextEncoder().encode(text);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller){
      for(let i=0;i<data.length;i+=bytesPerChunk) controller.enqueue(data.slice(i,i+bytesPerChunk));
      controller.close();
    },
  }),{status:200,headers:{'Content-Type':'text/event-stream'}});
}

test('an interrupted stream is not permitted to finish or trigger final TTS',async()=>{
  const visible:string[]=[];
  const frames=[
    JSON.stringify({type:'start'}),
    JSON.stringify({type:'text_chunk',chunk:'تسمه، نواری از جنس لاست',textSoFar:'تسمه، نواری از جنس لاست'}),
    JSON.stringify({type:'error',errorCode:'provider_output_truncated',message:'پاسخ ناتمام است'}),
  ];
  await assert.rejects(consumeForzaTextStream(sseReply(frames),
    (_chunk,full)=>visible.push(full)),/پاسخ ناتمام است/);
  assert.deepEqual(visible,['تسمه، نواری از جنس لاست']);
});

test('network EOF after partial delta without authoritative done cannot be spoken',async()=>{
  const frames=[JSON.stringify({type:'text_chunk',chunk:'تسمه، نواری از جنس لاست'})];
  await assert.rejects(consumeForzaTextStream(sseReply(frames),()=>{}),/forza_stream_incomplete/);
});

test('authoritative final response reconciles missing deltas before one complete utterance',async()=>{
  const visible:string[]=[];
  const full='تسمه قطعه‌ای انعطاف‌پذیر برای انتقال نیرو میان پولی‌ها است.';
  const frames=[
    JSON.stringify({type:'text_chunk',chunk:'تسمه قطعه‌ای انعطاف‌پذیر'}),
    JSON.stringify({type:'done',fullText:full}),
  ];
  const result=await consumeForzaTextStream(sseReply(frames),(_chunk,fullSoFar)=>visible.push(fullSoFar));
  assert.equal(result,full);
  assert.equal(visible.at(-1),full);
});
