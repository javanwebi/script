import test from 'node:test';
import assert from 'node:assert/strict';
import {BaiConsultError} from '../server/ai/baiConsult';
import {listVerifiedXkiroFreeChatModels, streamXkiroFreePool} from '../server/ai/xkiroFreeFailover';

function catalog(models: Array<Record<string,unknown>>) {
  return new Response(JSON.stringify({object:'list',data:models}),{
    status:200, headers:{'content-type':'application/json'},
  });
}
function free(id:string, pricing: Record<string, number> = {input:0,output:0}) {
  return {id,modality:'chat',access_tier:'free',pricing};
}
function sse(text:string) {
  return new Response('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n'+'data: [DONE]\n\n',
    {status:200,headers:{'Content-Type':'text/event-stream'}});
}
const first = 'qwen/qwen3.5-flash:free';
const second = 'deepseek/deepseek-v3.2';

test('public xKiro catalog supplies only verified chat free models; never paid or speech', async()=>{
  const fetchImpl = (async (url:string | URL | Request) => {
    assert.equal(String(url),'https://api.xkiro.com/v1/models');
    return catalog([free(first),free(second),{...free('vendor/paid'),access_tier:'paid'},
      {...free('vendor/tts'),modality:'tts'},free('vendor/not-really-free',{input:0.2,output:0.5})]);
  }) as typeof fetch;
  const result=await listVerifiedXkiroFreeChatModels(fetchImpl);
  assert.deepEqual(result,[first,second]);
  await listVerifiedXkiroFreeChatModels(fetchImpl);
});

test('when preferred free model hits 429, rotate to another verified free model',async()=>{
  const attempted:string[]=[];
  let catalogCalls=0;
  const fetchImpl=(async(url:string | URL | Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models')){catalogCalls++;return catalog([free(first),free(second)]);}
    if(String(url).endsWith('/v1/usage'))return new Response(JSON.stringify({free_tokens:{remaining:100000}}));
    const body=JSON.parse(String(init?.body));
    attempted.push(body.model);
    if(body.model===first)return new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429});
    return sse('بله، موجود است.');
  }) as typeof fetch;
  const chunks:string[]=[];
  const result=await streamXkiroFreePool({apiKey:'not-a-real-secret',model:first,query:'سلام',voice:true,
    fetchImpl,onDelta:c=>chunks.push(c)});
  assert.deepEqual(attempted,[first,second]);
  assert.equal(result.model,second);
  assert.equal(result.text,'بله، موجود است.');
  assert.deepEqual(chunks,['بله، موجود است.']);
  assert.equal(catalogCalls,1);
});

test('shared account-wide depleted free tokens stop retries, with zero paid-model calls',async()=>{
  const attempted:string[]=[];
  const fetchImpl=(async(url:string | URL | Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free('vendor/test-a'),free('vendor/test-b'),
      {...free('vendor/test-paid'),access_tier:'paid'}]);
    if(String(url).endsWith('/v1/usage'))return new Response(JSON.stringify({free_tokens:{remaining:0}}));
    attempted.push(JSON.parse(String(init?.body)).model);
    return new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429});
  }) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:'vendor/test-a',query:'سلام',voice:true,fetchImpl,onDelta:()=>{},
  }),(e:unknown)=>e instanceof BaiConsultError&&e.code==='xkiro_account_free_quota_exhausted');
  assert.deepEqual(attempted,['vendor/test-a']);
});

test('no verified free catalog is fail-closed; never sends a generation request',async()=>{
  let calls=0;
  const fetchImpl=(async()=>{calls++;return catalog([{...free('vendor/paid'),access_tier:'paid'}]);}) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:'vendor/paid',query:'سلام',fetchImpl,onDelta:()=>{},
  }),(e:unknown)=>e instanceof BaiConsultError&&e.code==='xkiro_no_verified_free_models');
  assert.equal(calls,1);
});

test('partial text from first free model is not duplicated in a retry',async()=>{
  const attempts:string[]=[];
  const fetchImpl=(async(url:string | URL | Request, init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free('vendor/partial'),free('vendor/fallback')]);
    const model=JSON.parse(String(init?.body)).model;
    attempts.push(model);
    if(model==='vendor/partial')
      return new Response('data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n'+
        'data: {"error":{"code":"overloaded"}}\n\n',
        {headers:{'Content-Type':'text/event-stream'}});
    return sse('دوباره');
  }) as typeof fetch;
  const chunks:string[]=[];
  const result=await streamXkiroFreePool({apiKey:'not-a-real-secret',model:'vendor/partial',
    query:'سلام',voice:true,fetchImpl,onDelta:c=>chunks.push(c)});
  assert.equal(result.text,'سلام');
  assert.deepEqual(attempts,['vendor/partial']);
  assert.deepEqual(chunks,['سلام']);
});
