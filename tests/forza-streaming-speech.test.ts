import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSpeakablePhrase } from '../src/utils/forzaStreamingSpeech';
import { consumeForzaTextStream } from '../src/utils/forzaStreamClient';

test('waits for a natural first clause instead of sending a two-word Pocket request',()=>{
  const answer='سلام، بله تسمه صنعتی موردنظر شما موجود است و کد فنی آن را می‌توانم بررسی کنم. برای ادامه شماره دستگاه را بفرمایید.';
  const first=takeSpeakablePhrase(answer,true);
  assert.ok(first);
  assert.ok(first.phrase.startsWith('سلام،'));
  assert.ok(first.phrase.length>=28);
  assert.ok(first.phrase.length<=120);
  assert.ok(first.phrase.endsWith('.'));
  assert.equal(first.phrase+' '+first.rest,answer);
});

test('never cuts a word mid-token and waits for a useful first phrase',()=>{
  assert.equal(takeSpeakablePhrase('سلام',true),null);
  const input='قطعه اصلی شما مطابق سفارش آماده دریافت خواهد بود و پس از بررسی ارسال می‌شود. اطلاعات تکمیلی در ادامه ارائه می‌شود.';
  const candidate=takeSpeakablePhrase(input,true);
  assert.ok(candidate);
  assert.ok(!candidate.phrase.endsWith('آما'));
  assert.ok(candidate.phrase.length>=28);
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

test('long replies retain every word while bounding every synthesis phrase',()=>{
  const text='برای انتخاب تسمه مناسب لطفاً طول و عرض تسمه و نوع دستگاه و کد نوشته شده روی قطعه را اعلام کنید تا بتوانم مشخصات محصول را بررسی کنم.';
  let rest=text;
  const phrases:string[]=[];
  while(true){
    const next=takeSpeakablePhrase(rest,phrases.length===0);
    if(!next)break;
    assert.ok(next.phrase.length<=180);
    phrases.push(next.phrase);rest=next.rest;
  }
  if(rest)phrases.push(rest);
  assert.equal(phrases.join(' '),text);
});

test('first Pocket phrase starts on a complete natural sentence',()=>{
  assert.equal(takeSpeakablePhrase('من فور',true),null);
  const ready=takeSpeakablePhrase('من فورزا هستم و در خدمت شما هستم. حالا کد فنی قطعه را بفرمایید.',true);
  assert.ok(ready);
  assert.equal(ready?.phrase+' '+ready?.rest,'من فورزا هستم و در خدمت شما هستم. حالا کد فنی قطعه را بفرمایید.');
  assert.ok(ready!.phrase.length>=28);
});

test('instrumented SSE records provider and first real delta without buffering or fake completion',async()=>{
  const frames=[
    'data: {"type":"start","timestamp":1740000000}\\n\\n',
    'data: {"type":"provider","provider":"xkiro"}\\n\\n',
    'data: {"type":"text_chunk","chunk":"بلبرینگ 6202ZZ"}\\n\\n',
    'data: {"type":"done","fullText":"بلبرینگ 6202ZZ"}\\n\\n',
  ];
  const stages:string[]=[];const visible:string[]=[];
  const stream=new ReadableStream<Uint8Array>({start(c){
    for(const frame of frames)c.enqueue(new TextEncoder().encode(frame));
    c.close();
  }});
  const text=await consumeForzaTextStream(
    new Response(stream,{status:200}),
    chunk=>visible.push(chunk),
    (stage,info)=>stages.push(stage+(info?.provider?':'+info.provider:'')),
  );
  assert.equal(text,'بلبرینگ 6202ZZ');
  assert.deepEqual(visible,['بلبرینگ 6202ZZ']);
  assert.deepEqual(stages,['start','provider:xkiro','first_delta','done']);
});

test('a network EOF after partial words is tracked as incomplete, never a successful done',async()=>{
  const stages:string[]=[];
  const stream=new ReadableStream<Uint8Array>({start(c){
    c.enqueue(new TextEncoder().encode(
      'data: {"type":"start"}\\n\\ndata: {"type":"text_chunk","chunk":"SPA 1250"}\\n\\n'
    ));
    c.close();
  }});
  await assert.rejects(
    consumeForzaTextStream(new Response(stream),()=>{},stage=>stages.push(stage)),
    /forza_stream_incomplete/,
  );
  assert.deepEqual(stages,['start','first_delta','incomplete']);
});
