import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,utimes} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {createVisionImagePublisher,cleanVisionImageLinks} from '../src/services/visionImageLinks';
import {workerVision} from '../src/services/partRecognitionGateway';

test('temporary image publisher writes real bytes and reuses an opaque HTTPS link',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'vision-links-'));
 try{
  const publish=createVisionImagePublisher(directory,'https://images.example');
  const bytes=await sharp({create:{width:20,height:20,channels:3,background:'#eee'}}).png().toBuffer();
  const first=await publish(bytes,'image/png'),second=await publish(bytes,'image/png');
  assert.equal(first,second);assert.ok(first.startsWith('https://images.example/imageai/vision-'));assert.ok(!first.includes('base64'));
  const file=path.join(directory,path.basename(new URL(first).pathname));assert.deepEqual(await readFile(file),bytes);
  await utimes(file,new Date(0),new Date(0));await cleanVisionImageLinks(directory);await assert.rejects(()=>readFile(file));
  await assert.rejects(()=>createVisionImagePublisher(directory,'http://localhost')(bytes,'image/png'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('Worker transport contains HTTPS image links, never customer base64, when publishing is configured',async()=>{
 let body:any;
 const result=await workerVision([{role:'user',parts:[{text:'inspect'},{inlineData:{mimeType:'image/png',data:'YWJj'}}]}],{
  env:{PART_RECOGNITION_WORKER_URL:'https://worker.example'},publishImage:async bytes=>{assert.equal(bytes.toString(),'abc');return 'https://images.example/imageai/vision-test.png';},
  fetch:(async(_url,options)=>{body=JSON.parse(options!.body as string);return new Response('{"choices":[{"message":{"content":"{\\"ok\\":true}"}}]}',{status:200});}) as typeof fetch,
 });
 assert.ok(result.text.includes('true'));assert.equal(body.messages[0].content[1].image_url.url,'https://images.example/imageai/vision-test.png');assert.ok(!JSON.stringify(body).includes('YWJj'));assert.ok(!JSON.stringify(body).includes('data:image'));
});
test('both Worker entrypoints download every supplied image link before model comparison',async()=>{
 for(const file of ['../worker.js','../cloudflare-worker/worker.js']){
  const worker=(await import(file)).default;const original=globalThis.fetch;const downloads:string[]=[];let modelBody:any;
  globalThis.fetch=(async(url,options)=>{
   if(String(url).startsWith('https://images.example/')){assert.equal(options?.redirect,'manual');downloads.push(String(url));return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});}
   modelBody=JSON.parse(options!.body as string);return new Response('{"candidates":[{"content":{"parts":[{"text":"{\\"picks\\":[]}"}]}}]}',{status:200});
  }) as typeof fetch;
  try{
   const request=new Request('https://worker.example/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-access'},body:JSON.stringify({task:'catalog-image-scan',response_schema:{type:'OBJECT',properties:{picks:{type:'ARRAY',items:{type:'INTEGER'}}}},messages:[{role:'user',content:[{type:'image_url',image_url:{url:'https://images.example/customer.png'}},{type:'image_url',image_url:{url:'https://images.example/catalogue.jpg'}}]}]})});
   const response=await worker.fetch(request,{APP_WORKER_TOKEN:'test-access',GEMINI_API_KEY:'fixture-key'});
   assert.equal(response.status,200);assert.equal(modelBody.generationConfig.responseSchema.type,'OBJECT');assert.equal(downloads.length,2);assert.equal(modelBody.contents[0].parts.filter((part:any)=>part.inlineData).length,2);
  }finally{globalThis.fetch=original;}
 }
});
