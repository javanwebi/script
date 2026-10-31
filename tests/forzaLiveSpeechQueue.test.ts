import assert from 'node:assert/strict';
import test from 'node:test';
import { ForzaLiveSpeechQueue } from '../src/utils/forzaLiveSpeechQueue.ts';
import { consumeForzaTextStream } from '../src/utils/forzaStreamClient.ts';

const first='برای انتخاب تسمه مناسب، کد روی قطعه را بفرمایید.';
const second=' سپس مشخصات فنی دستگاه را بررسی می‌کنم.';

test('first Pocket request starts before Gemini SSE sends done',async()=>{
  const textSent:string[]=[];
  let unblock!:()=>void;
  const blocked=new Promise<void>(r=>{unblock=r;});
  const queue=new ForzaLiveSpeechQueue(async phrase=>{
    textSent.push(phrase);
    await blocked;
  });
  let push!: (text:string)=>void;
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      push=text=>controller.enqueue(new TextEncoder().encode(
        'data: '+JSON.stringify(JSON.parse(text))+'\n\n'
      ));
    },
  });
  // Use a synthetic streamed SSE request: first sentence is spoken before
  // the provider delivers the remaining sentence/final completion event.
  let controller!:ReadableStreamDefaultController<Uint8Array>;
  const response=new Response(new ReadableStream<Uint8Array>({
    start(c){controller=c;},
  }),{status:200});
  const answer=consumeForzaTextStream(response,(_,soFar)=>queue.receive(soFar));
  const frame=(data:object)=>controller.enqueue(new TextEncoder().encode(
    'data: '+JSON.stringify(data)+'\n\n'));
  frame({type:'text_chunk',chunk:first+' '});
  for(let i=0;i<30&&!textSent.length;i++)
    await new Promise<void>(r=>setTimeout(r,0));
  assert.equal(textSent[0],first,'must start TTS before SSE done');
  assert.equal(queue.hasStarted,true);
  frame({type:'text_chunk',chunk:second.trim()});
  frame({type:'done',fullText:first+' '+second.trim()});
  controller.close();
  const full=await answer;
  unblock();
  await queue.finish(full);
  assert.equal(textSent.join(' '),full);
  assert.equal(queue.phraseCount,2);
});

test('does not send one network token or half word to Pocket',async()=>{
  const sent:string[]=[];
  const queue=new ForzaLiveSpeechQueue(async phrase=>{sent.push(phrase);});
  queue.receive('برای');
  queue.receive('برای انتخ');
  queue.receive('برای انتخاب تسمه');
  assert.deepEqual(sent,[]);
  await queue.finish('برای انتخاب تسمه');
  assert.deepEqual(sent,['برای انتخاب تسمه']);
});

test('handles streaming Persian industrial decimals without cutting 12.7',async()=>{
  const pieces:string[]=[];
  const queue=new ForzaLiveSpeechQueue(async phrase=>{pieces.push(phrase);});
  const full='برای انتخاب تسمه SPA-1250 با عرض 12.7 میلی‌متر ابتدا مشخصات دستگاه را بفرمایید. سپس پیشنهاد مناسب را بررسی می‌کنم.';
  for(let i=8;i<full.length;i+=7)queue.receive(full.slice(0,i));
  queue.receive(full);
  await queue.finish(full);
  assert.equal(pieces.join(' '),full);
  assert.ok(pieces.every(p=>!p.endsWith('12.')));
});

test('fail closed if provider revises an SSE prefix before completion',async()=>{
  const queue=new ForzaLiveSpeechQueue(async()=>{});
  queue.receive(first+' ');
  assert.throws(()=>queue.receive('برای انتخاب بلبرینگ مناسب، کد را بفرمایید.'),/forza_sse_prefix_revised/);
  queue.cancel();
});

test('fail closed on changed final authoritative SSE answer',async()=>{
  const queue=new ForzaLiveSpeechQueue(async()=>{});
  queue.receive(first+' ');
  await assert.rejects(queue.finish('برای انتخاب بلبرینگ، کد را بفرمایید.'),/forza_sse_final_answer_changed/);
});

test('abort blocks later requests after first inference failed',async()=>{
  const sent:string[]=[];
  const queue=new ForzaLiveSpeechQueue(async phrase=>{
    sent.push(phrase);
    throw new Error('private_voice_unavailable');
  });
  queue.receive(first+' '+second);
  await assert.rejects(queue.finish(first+' '+second),/private_voice_unavailable/);
  assert.equal(sent.length,1);
});

test('failed SSE without done does not flush a partial sentence',async()=>{
  const queue=new ForzaLiveSpeechQueue(async()=>{throw new Error('unexpected_tts');});
  const response=new Response(new ReadableStream<Uint8Array>({
    start(c){
      c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:'text_chunk',chunk:'برای انتخ'})+'\n\n'));
      c.close();
    },
  }));
  await assert.rejects(consumeForzaTextStream(response,(_,full)=>queue.receive(full)),/forza_stream_incomplete/);
  assert.equal(queue.phraseCount,0);
  queue.cancel();
});
