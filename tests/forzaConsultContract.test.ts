import test from 'node:test';
import assert from 'node:assert/strict';
import {streamXkiroConsult,completeXkiroConsult} from '../server/ai/baiConsult';

test('stream and JSON verification use identical consultation context and keep user correction as latest turn',async()=>{
 const payloads:any[]=[];
 const fetchImpl=(async(_url:any,init:any)=>{
  const body=JSON.parse(init.body);payloads.push(body);
  return body.stream
   ? new Response('data: '+JSON.stringify({choices:[{delta:{content:'6203ZZ، ده عدد'},finish_reason:'stop'}]})+'\n\n',{headers:{'content-type':'text/event-stream'}})
   : Response.json({choices:[{message:{content:'6203ZZ، ده عدد'},finish_reason:'stop'}]});
 }) as typeof fetch;
 for(const voice of [false,true]){
  const options={apiKey:'test',model:'qwen/qwen3.5-flash:free',voice,
   query:'نه، 6203ZZ ده عدد',history:[{role:'user',text:'6202 میخواهم'}],
   catalogContext:'\n6203ZZ: مشخصات تأییدشده',fetchImpl,onDelta:()=>{}};
  await streamXkiroConsult(options);
  await completeXkiroConsult(options);
 }
 for(const offset of [0,2]){
  assert.deepEqual(payloads[offset].messages,payloads[offset+1].messages);
  assert.equal(payloads[offset].messages.at(-1).content,'نه، 6203ZZ ده عدد');
  assert.ok(payloads[offset].messages[0].content.includes('6203ZZ: مشخصات تأییدشده'));
 }
 assert.notEqual(payloads[0].messages[0].content,payloads[2].messages[0].content);
});
