import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeForzaTextStream} from '../src/utils/forzaStreamClient';

const encoder=new TextEncoder();
const event=(value:unknown,delimiter='\n\n')=>
  encoder.encode('data: '+JSON.stringify(value)+delimiter);

test('FORZA returns at SSE done even if the proxy keeps the connection open',async()=>{
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      controller.enqueue(event({type:'start'}));
      controller.enqueue(event({type:'text_chunk',chunk:'سلام',textSoFar:'سلام'}));
      controller.enqueue(event({type:'done',fullText:'سلام، پاسخ آماده است.'}));
      // Intentionally never close this stream.
    },
    cancel(){cancelled=true;},
  });
  const chunks:string[]=[];
  const started=performance.now();
  const text=await Promise.race([
    consumeForzaTextStream(new Response(stream,{headers:{'Content-Type':'text/event-stream'}}),
      (chunk)=>chunks.push(chunk)),
    new Promise<string>((_,reject)=>setTimeout(()=>reject(new Error('client_waited_for_socket_close')),650)),
  ]);
  assert.equal(text,'سلام، پاسخ آماده است.');
  assert.equal(chunks.join(''),'سلام، پاسخ آماده است.');
  assert.ok(performance.now()-started<650);
  assert.equal(cancelled,true);
});

test('FORZA accepts split CRLF SSE events before the stream closes',async()=>{
  const message='مشخصات فنی قطعه را بفرمایید.';
  const bytes=event({type:'text_chunk',chunk:message,textSoFar:message},'\r\n\r\n');
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      controller.enqueue(bytes.slice(0,17));
      controller.enqueue(bytes.slice(17));
      controller.enqueue(event({type:'done',fullText:message},'\r\n\r\n'));
    },
    cancel(){cancelled=true;},
  });
  const chunks:string[]=[];
  const result=await consumeForzaTextStream(new Response(stream),(chunk)=>chunks.push(chunk));
  assert.equal(result,message);
  assert.deepEqual(chunks,[message]);
  assert.equal(cancelled,true);
});
