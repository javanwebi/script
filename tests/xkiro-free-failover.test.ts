import test from 'node:test';
import assert from 'node:assert/strict';
import {BaiConsultError} from '../server/ai/baiConsult';
import {listVerifiedXkiroFreeChatModels,streamXkiroFreePool} from '../server/ai/xkiroFreeFailover';

function catalog(models:Array<Record<string,unknown>>){
  return new Response(JSON.stringify({object:'list',data:models}),{
    status:200,headers:{'content-type':'application/json'},
  });
}
function free(id:string,pricing:Record<string,number>={input:0,output:0}){
  return {id,modality:'chat',access_tier:'free',pricing};
}
function sse(text:string){
  return new Response(
    'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n'+
    'data: [DONE]\n\n',
    {status:200,headers:{'Content-Type':'text/event-stream'}},
  );
}
function completion(text:string,finishReason='stop'){
  return new Response(JSON.stringify({
    choices:[{message:{content:text},finish_reason:finishReason}],
  }),{status:200,headers:{'Content-Type':'application/json'}});
}
const first='qwen/qwen3.5-flash:free';

test('public xKiro catalog supplies only verified chat free models; never paid or speech',async()=>{
  const fetchImpl=(async(url:string|URL|Request)=>{
    assert.equal(String(url),'https://api.xkiro.com/v1/models');
    return catalog([free(first),free('deepseek/deepseek-v3.2'),
      {...free('vendor/paid'),access_tier:'paid'},
      {...free('vendor/tts'),modality:'tts'},
      free('vendor/not-really-free',{input:0.2,output:0.5})]);
  }) as typeof fetch;
  const result=await listVerifiedXkiroFreeChatModels(fetchImpl);
  assert.deepEqual(result,[first,'deepseek/deepseek-v3.2']);
  await listVerifiedXkiroFreeChatModels(fetchImpl);
});

test('normal xKiro stream completes from finish_reason stop without waiting for socket close',async()=>{
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({
    start(c){
      c.enqueue(new TextEncoder().encode(
        'data: '+JSON.stringify({choices:[{delta:{content:'سلام فورزا'}}]})+'\n\n'+
        'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\n'
      ));
    },
    cancel(){cancelled=true;},
  });
  const fetchImpl=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free(first)]);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.stream,true);
    return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
  }) as typeof fetch;
  const chunks:string[]=[];
  const result=await streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:first,query:'سلام',
    voice:true,fetchImpl,onDelta:chunk=>chunks.push(chunk),
  });
  assert.equal(result.text,'سلام فورزا');
  assert.equal(result.completionMode,'stream');
  assert.deepEqual(chunks,['سلام فورزا']);
  assert.equal(cancelled,true);
});

test('xKiro idle stream is verified by one non-stream request and only the missing suffix is emitted',async()=>{
  const model='vendor/idle-verified';
  let streamCalls=0,nonstreamCalls=0,cancelled=false;
  const partial='کد نهایی: 6203 ZZ\n';
  const final='کد نهایی: 6203 ZZ\nتعداد: 10 عدد';
  const fetchImpl=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free(model)]);
    const body=JSON.parse(String(init?.body));
    if(body.stream){
      streamCalls++;
      const stream=new ReadableStream<Uint8Array>({
        start(c){
          c.enqueue(new TextEncoder().encode(
            'data: '+JSON.stringify({choices:[{delta:{content:partial}}]})+'\n\n'
          ));
          // Deliberately withhold finish_reason and [DONE], matching the VPS symptom.
        },
        cancel(){cancelled=true;},
      });
      return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
    }
    nonstreamCalls++;
    assert.equal(body.model,model);
    assert.equal(body.stream,false);
    return completion(final);
  }) as typeof fetch;
  const chunks:string[]=[];
  const result=await streamXkiroFreePool({
    apiKey:'not-a-real-secret',model,query:'کد بلبرینگ و تعداد',
    voice:true,fetchImpl,onDelta:chunk=>chunks.push(chunk),
  });
  assert.equal(result.text,final);
  assert.equal(result.completionMode,'nonstream_verified');
  assert.deepEqual(chunks,[partial,'تعداد: 10 عدد']);
  assert.equal(streamCalls,1);
  assert.equal(nonstreamCalls,1);
  assert.equal(cancelled,true);
});

test('xKiro does not replace already delivered speech when verified completion changes the prefix',async()=>{
  const model='vendor/prefix-mismatch';
  const partial='کد نهایی: 6202';
  const fetchImpl=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free(model)]);
    const body=JSON.parse(String(init?.body));
    if(body.stream)return new Response(
      'data: '+JSON.stringify({choices:[{delta:{content:partial}}]})+'\n\n',
      {headers:{'Content-Type':'text/event-stream'}},
    );
    return completion('کد نهایی: 6203 ZZ');
  }) as typeof fetch;
  const delivered:string[]=[];
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model,query:'کد را اصلاح کن',
    voice:true,fetchImpl,onDelta:chunk=>delivered.push(chunk),
  }),(error:unknown)=>error instanceof BaiConsultError&&
    error.code==='xkiro_stream_verification_mismatch');
  assert.deepEqual(delivered,[partial]);
});

test('xKiro never rotates to an untested free model after the configured model fails',async()=>{
  const attempted:string[]=[];
  const fetchImpl=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free(first),free('vendor/untested')]);
    if(String(url).endsWith('/v1/usage'))
      return new Response(JSON.stringify({free_tokens:{remaining:10000}}));
    const body=JSON.parse(String(init?.body));
    attempted.push(body.model);
    return new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429});
  }) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:first,query:'سلام',
    voice:true,fetchImpl,onDelta:()=>{},
  }),(error:unknown)=>error instanceof BaiConsultError&&error.code==='http_429');
  assert.deepEqual(attempted,[first]);
});

test('depleted xKiro free allowance stops immediately and never calls a paid model',async()=>{
  const attempted:string[]=[];
  const fetchImpl=(async(url:string|URL|Request,init?:RequestInit)=>{
    if(String(url).endsWith('/v1/models'))
      return catalog([free(first),{...free('vendor/paid'),access_tier:'paid'}]);
    if(String(url).endsWith('/v1/usage'))
      return new Response(JSON.stringify({free_tokens:{remaining:0}}));
    attempted.push(JSON.parse(String(init?.body)).model);
    return new Response('{"error":{"code":"rate_limit_exceeded"}}',{status:429});
  }) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:first,query:'سلام',
    voice:true,fetchImpl,onDelta:()=>{},
  }),(error:unknown)=>error instanceof BaiConsultError&&
    error.code==='xkiro_account_free_quota_exhausted');
  assert.deepEqual(attempted,[first]);
});

test('no verified free catalog is fail-closed; never sends a generation request',async()=>{
  let calls=0;
  const fetchImpl=(async()=>{
    calls++;
    return catalog([{...free('vendor/paid'),access_tier:'paid'}]);
  }) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:'vendor/paid',query:'سلام',
    fetchImpl,onDelta:()=>{},
  }),(error:unknown)=>error instanceof BaiConsultError&&
    error.code==='xkiro_no_verified_free_models');
  assert.equal(calls,1);
});

test('xKiro Retry-After prevents repeated calls during an account-wide rate limit',async()=>{
  let generations=0;
  const fetchImpl=(async(url:string|URL|Request)=>{
    if(String(url).endsWith('/v1/models'))return catalog([free(first)]);
    if(String(url).endsWith('/v1/usage'))
      return new Response(JSON.stringify({free_tokens:{remaining:5000}}));
    generations++;
    return new Response('{"error":{"code":"rate_limit_exceeded"}}',{
      status:429,headers:{'Retry-After':'1'},
    });
  }) as typeof fetch;
  await assert.rejects(streamXkiroFreePool({
    apiKey:'not-a-real-secret',model:first,query:'سلام',
    voice:true,fetchImpl,onDelta:()=>{},
  }),(error:unknown)=>error instanceof BaiConsultError&&
    error.code==='xkiro_rate_limited_retry_later');
  assert.equal(generations,1);
});
