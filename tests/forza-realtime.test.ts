import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StreamingPcmResampler,
  encodePcm16Base64,
  decodePcm16Base64,
  audioSampleRate,
  mayQueueMicrophoneFrame,
  FORZA_MAX_SOCKET_BUFFER,
} from '../src/utils/forzaRealtimeAudio.ts';
import { ForzaRealtimeClient } from '../src/components/forza/forzaRealtimeClient.ts';

test('48 kHz mic input streams as 16 kHz mono audio with correct pitch', () => {
  const sampler = new StreamingPcmResampler(48000);
  const input = Float32Array.from({length: 48000}, (_,i)=>Math.sin(2*Math.PI*440*i/48000)*0.55);
  const parts: Int16Array[] = [];
  for(let offset=0;offset<input.length;offset+=2048)
    parts.push(sampler.convert(input.subarray(offset,offset+2048)));
  const pcm=Int16Array.from(parts.flatMap(p=>Array.from(p)));
  assert.ok(Math.abs(pcm.length-16000)<=2, 'one second should produce ~16000 samples');
  const decoded=decodePcm16Base64(encodePcm16Base64(pcm));
  assert.equal(decoded.length, pcm.length);
  let maxError=0;
  for(let i=10;i<decoded.length-10;i++){
    const expected=Math.sin(2*Math.PI*440*i/16000)*0.55;
    maxError=Math.max(maxError,Math.abs(decoded[i]-expected));
  }
  assert.ok(maxError < 0.04, \`Streaming audio drift/distortion too large: \${maxError}\`);
});

test('44.1 kHz mic and chunk boundaries keep approximately 16k samples/second', () => {
  const sampler=new StreamingPcmResampler(44100);
  const parts=[];
  for(let i=0;i<44;i++) parts.push(sampler.convert(new Float32Array(1000).fill(0.1)));
  parts.push(sampler.convert(new Float32Array(100).fill(0.1)));
  const count=parts.reduce((sum,p)=>sum+p.length,0);
  assert.ok(Math.abs(count-16000)<=2, \`Resampled size wrong: \${count}\`);
});

test('PCM codec decodes little endian signed values and rejects odd byte lengths', () => {
  const source=Int16Array.from([-32768,-16384,-1,0,1,16384,32767]);
  const decoded=decodePcm16Base64(encodePcm16Base64(source));
  assert.ok(Math.abs(decoded[0]+1)<1e-5);
  assert.ok(Math.abs(decoded[6]-(32767/32768))<1e-5);
  assert.throws(()=>decodePcm16Base64(btoa('a')),/Invalid PCM/);
  assert.equal(audioSampleRate('audio/pcm;rate=24000'),24000);
  assert.equal(audioSampleRate('audio/pcm;rate=not-a-number'),24000);
});

test('microphone backpressure drops audio frames when stream is not ready or congested', () => {
  assert.equal(mayQueueMicrophoneFrame(0,0),false);
  assert.equal(mayQueueMicrophoneFrame(3,0),false);
  assert.equal(mayQueueMicrophoneFrame(1,FORZA_MAX_SOCKET_BUFFER+1),false);
  assert.equal(mayQueueMicrophoneFrame(1,1024),true);
});

test('Live turn state preserves one response ID and cancels pending playback on interruption', () => {
  const states:string[]=[];
  const aiTexts:string[]=[];
  const userTexts:string[]=[];
  const client:any=new ForzaRealtimeClient({
    onMode:()=>{},onStatus:s=>states.push(s),
    onUserText:s=>userTexts.push(s),
    onAiText:s=>aiTexts.push(s),
    onLevel:()=>{},onError:()=>{},
  });
  client.disposed=false;
  client.sources=new Set();
  client.playbackGeneration=0;
  client.responseId='';
  client.context=null;
  client.output=null;
  client.acceptMessage({type:'user_transcript',text:'چه تسمه‌ای مناسب است؟',final:true});
  assert.deepEqual(userTexts,['چه تسمه‌ای مناسب است؟']);
  client.acceptMessage({type:'ai_text_chunk',responseId:'resp1',text:'تسمه '});
  client.acceptMessage({type:'ai_text_chunk',responseId:'resp1',text:'تایمینگ مناسب است.'});
  assert.equal(aiTexts.at(-1),'تسمه تایمینگ مناسب است.');
  client.acceptMessage({type:'interrupted',responseId:'resp1'});
  assert.equal(client.playbackGeneration,1,'playback queue must be invalidated');
  assert.equal(states.at(-1),'listening');
  client.acceptMessage({type:'ai_text_chunk',responseId:'resp2',text:'در مورد کاربرد بگویید.'});
  assert.equal(aiTexts.at(-1),'در مورد کاربرد بگویید.');
  client.acceptMessage({type:'turn_complete'});
  assert.equal(states.at(-1),'listening');
});

test('Native voice never sends a typed message unless connected', () => {
  const client:any=new ForzaRealtimeClient({
    onMode:()=>{},onStatus:()=>{},onUserText:()=>{},onAiText:()=>{},onLevel:()=>{},onError:()=>{},
  });
  assert.equal(client.sendText('سلام'),false);
  assert.equal(client.sendText('   '),false);
});
