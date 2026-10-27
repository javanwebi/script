import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeMossRealtimeWav} from '../src/services/forzaMossRealtimeClient.ts';

const env = {
  FORZA_TTS_BASE_URL: 'https://gpu-tts.example.org',
  FORZA_TTS_TOKEN: 'private-token',
  FORZA_TTS_PROTOCOL: 'moss-realtime',
  MOSS_TTS_PROMPT_AUDIO: '/app/voices/forza_male_fa.wav',
} as NodeJS.ProcessEnv;

function pcmFixture(): Buffer {
  const pcm = Buffer.alloc(24000);
  for(let i=0;i<pcm.length;i+=2) pcm.writeInt16LE(Math.round(2000*Math.sin(i/70)),i);
  return pcm;
}

test('MOSS native session start/push/stream/close yields playable WAV without another TTS provider', async () => {
  const calls:string[]=[];
  let sessionId='';
  let started = false;
  let closed = false;
  const chunks:number[] = [];
  const net = (async (input:RequestInfo|URL, init?:RequestInit):Promise<Response>=>{
    const url = new URL(String(input));
    const p=url.pathname;
    calls.push(p);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-token');
    if(p.endsWith('/start')) {
      const body=JSON.parse(String(init?.body));
      sessionId=body.session_id;
      assert.ok(sessionId.length>=20);
      assert.equal(body.prompt_audio, '/app/voices/forza_male_fa.wav');
      assert.equal(body.new_turn, true);
      started=true;
      return Response.json({ok:true,session_id:sessionId});
    }
    if(p.endsWith('/push')) {
      const body=JSON.parse(String(init?.body));
      assert.equal(body.session_id,sessionId);
      assert.equal(body.text,'سلام به صنعت پیش خوش آمدید');
      assert.equal(body.is_final,true);
      return Response.json({ok:true});
    }
    if(p.endsWith('/audio')) {
      assert.equal(p, '/tts/session/'+sessionId+'/audio');
      return new Response(new Uint8Array(pcmFixture()),{headers:{
        'X-Audio-Codec':'pcm_s16le','X-Audio-Sample-Rate':'24000','X-Audio-Channels':'1',
      }});
    }
    if(p.endsWith('/close')) {
      assert.equal(JSON.parse(String(init?.body)).session_id,sessionId);
      closed=true;
      return Response.json({ok:true});
    }
    throw Error('Unexpected endpoint '+p);
  }) as typeof fetch;
  const out = await synthesizeMossRealtimeWav('سلام به صنعت پیش خوش آمدید',{
    env,fetchImpl:net,onPcmChunk:(c,r)=>{assert.equal(r,24000);chunks.push(c.length)},
  });
  assert.ok(started&&closed);
  assert.deepEqual(calls.slice(0,1),['/tts/session/start']);
  assert.ok(calls.includes('/tts/session/push'));
  assert.ok(calls.includes('/tts/session/'+sessionId+'/audio'));
  assert.equal(calls.at(-1),'/tts/session/close');
  assert.equal(out?.toString('ascii',0,4),'RIFF');
  assert.equal(out?.toString('ascii',8,12),'WAVE');
  assert.equal(out?.readUInt32LE(24),24000);
  assert.equal(out?.readUInt32LE(40),pcmFixture().length);
  assert.equal(out?.length,44+pcmFixture().length);
  assert.deepEqual(chunks,[pcmFixture().length]);
});

test('reject insecure publicly exposed HTTP, missing token or empty text',async()=>{
  let calls=0;
  const net=(async()=>{calls++;throw Error('unexpected network');}) as typeof fetch;
  const bad=await synthesizeMossRealtimeWav('سلام',{env:{...env,FORZA_TTS_BASE_URL:'http://gpu-tts.example.org'},fetchImpl:net});
  assert.equal(bad,null);
  assert.equal(await synthesizeMossRealtimeWav('سلام',{env:{...env,FORZA_TTS_TOKEN:''},fetchImpl:net}),null);
  assert.equal(await synthesizeMossRealtimeWav('  ',{env,fetchImpl:net}),null);
  assert.equal(calls,0);
});

test('no PCM audio and malformed sample rate never produce a false successful greeting',async()=>{
  let closed=0;
  const net=(async (url:RequestInfo|URL)=>{
    const p=new URL(String(url)).pathname;
    if(p.endsWith('/close')){closed++;return Response.json({ok:true})}
    if(p.endsWith('/audio'))return new Response(new Uint8Array(pcmFixture()),{headers:{
      'X-Audio-Codec':'mp3','X-Audio-Sample-Rate':'24000','X-Audio-Channels':'1',
    }});
    return Response.json({ok:true});
  }) as typeof fetch;
  assert.equal(await synthesizeMossRealtimeWav('سلام',{env,fetchImpl:net}),null);
  assert.equal(closed,1);
});
