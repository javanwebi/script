import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeForzaTextStream } from '../src/utils/forzaStreamClient';
import { takeSpeakablePhrase } from '../src/utils/forzaStreamingSpeech';

const frame=(payload:unknown)=>'data: '+JSON.stringify(payload)+'\n\n';

test('SSE done missing suffix is still read aloud and displayed',async()=>{
 const chunks:string[]=[];
 const final='قطعه صنعتی در انبار موجود است و مشخصات فنی آن قابل بررسی است.';
 const partial='قطعه صنعتی در انبار موجود است';
 const response=new Response(frame({type:'start'})+
   frame({type:'text_chunk',chunk:partial,textSoFar:partial})+
   frame({type:'done',fullText:final}),{
     headers:{'Content-Type':'text/event-stream'},status:200,
   });
 const answer=await consumeForzaTextStream(response,(chunk)=>chunks.push(chunk));
 assert.equal(answer,final);
 assert.equal(chunks.join(''),final);
});

test('All long streamed Persian answer words are sent to Amir exactly once',()=>{
 const answer=('سفارش قطعات خطوط تولید باید با مشخصات فنی، اندازه و کد محصول بررسی شود. ').repeat(25).trim();
 let queued:string[]=[];
 let buffer='';
 let remaining=answer;
 const feed=(part:string)=>{
   buffer+=part;
   while(true){
     const ready=takeSpeakablePhrase(buffer,queued.length===0);
     if(!ready)break;
     queued.push(ready.phrase);
     buffer=ready.rest;
   }
 };
 for(let i=0;i<answer.length;i+=37)feed(answer.slice(i,i+37));
 if(buffer.trim())queued.push(buffer.trim());
 assert.ok(queued.length>5);
 assert.ok(queued.every(s=>s.length<=220));
 assert.equal(queued.join(' '),answer);
});

test('Very long phrase without punctuation is bounded for Piper',()=>{
 const input=('تسمه صنعتی مقاوم با مشخصات دقیق ').repeat(18).trim();
 let remaining=input;const phrases:string[]=[];
 for(let i=0;i<30;i++){
   const next=takeSpeakablePhrase(remaining,phrases.length===0);
   if(!next)break;
   phrases.push(next.phrase);
   remaining=next.rest;
 }
 if(remaining.trim())phrases.push(remaining.trim());
 assert.ok(phrases.every(phrase=>phrase.length<=220));
 assert.equal(phrases.join(' '),input);
});
