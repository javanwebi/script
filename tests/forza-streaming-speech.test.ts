import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSpeakablePhrase } from '../src/utils/forzaStreamingSpeech';
import { consumeForzaTextStream } from '../src/utils/forzaStreamClient';

test('starts on whole word before Gemini completes the second sentence',()=>{
  const first = takeSpeakablePhrase('سلام، بله تسمه صنعتی موردنظر شما موجود است و',true);
  assert.ok(first);
  assert.equal(first.phrase,'سلام،');
  const next = takeSpeakablePhrase(first.rest + ' در انبار موجود است.',false);
  assert.ok(next);
  assert.ok(!next.phrase.endsWith(' و'));
});

test('never cuts a word mid-token',()=>{
  assert.equal(takeSpeakablePhrase('سلام',true),null);
  const candidate=takeSpeakablePhrase('قطعه اصلی شما مطابق سفارش آماده دریافت خواهد بود',true);
  assert.ok(candidate);
  assert.ok(!candidate.phrase.endsWith('آما'));
  assert.ok(candidate.rest.length>0);
});

test('consumes arbitrary network chunks of SSE progressively',async()=>{
  const encoder=new TextEncoder();
  const frames=[
    'data: {"type":"start"}\n\n',
    'data: {"type":"text_chunk","chunk":"سلام، "}',
    '\n\n',
    'data: {"type":"text_chunk","chunk":"قطعه موجود است."}\n\n',
    'data: {"type":"done","fullText":"سلام، قطعه موجود است."}\n\n',
  ];
  const chunks:string[]=[];
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      for(const frame of frames)controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  const text=await consumeForzaTextStream(new Response(stream,{status:200}),(part)=>chunks.push(part));
  assert.equal(text,'سلام، قطعه موجود است.');
  assert.deepEqual(chunks,['سلام، ','قطعه موجود است.']);
});

test('fails closed when an SSE stream reports an error',async()=>{
  const stream=new ReadableStream<Uint8Array>({
    start(c){c.enqueue(new TextEncoder().encode('data: {"type":"error","message":"down"}\n\n'));c.close();}
  });
  await assert.rejects(consumeForzaTextStream(new Response(stream),()=>{}),/down/);
});
