import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaRealtimeClient } from '../src/components/forza/forzaRealtimeClient.ts';
import { encodePcm16Base64, decodePcm16Base64 } from '../src/utils/forzaRealtimeAudio.ts';

test('mocked live browser session streams microphone PCM and handles live playback, mute and interruption', async () => {
  const before = new Map<string, PropertyDescriptor | undefined>();
  for(const property of ['window','navigator','WebSocket','AudioWorkletNode']) {
    before.set(property, Object.getOwnPropertyDescriptor(globalThis, property));
  }
  const sockets: any[] = [];
  const playback: any[] = [];
  let stoppedMic = false;
  let closedContext = false;
  let micWorklet: any;
  class MockWebSocket {
    static OPEN=1;
    readyState=1;
    bufferedAmount=0;
    sent: any[]=[];
    onmessage: any;
    onerror: any;
    onclose: any;
    constructor(public url: string) { sockets.push(this); }
    send(data: string) { this.sent.push(JSON.parse(data)); }
    receive(message: object) { this.onmessage?.({data: JSON.stringify(message)}); }
    close() { this.readyState=3; this.onclose?.(); }
  }
  class MockNode {
    connect() { return this; }
    disconnect() {}
  }
  class MockBufferSource extends MockNode {
    buffer: any;
    onended: any;
    when = 0;
    stopped = false;
    start(when: number) { this.when=when; playback.push(this); }
    stop() { this.stopped=true; }
    finish() { this.onended?.(); }
  }
  class MockAudioContext {
    sampleRate=48000;
    currentTime=1;
    state='running';
    destination={};
    audioWorklet={addModule:async (url: string) => {
      assert.equal(url,'/worklets/forza-microphone.js');
    }};
    async resume() {}
    async close() { closedContext=true; }
    createGain() {return Object.assign(new MockNode(),{gain:{value:1}});}
    createMediaStreamSource() {return new MockNode();}
    createBuffer(channels:number,length:number,rate:number) {
      assert.equal(channels,1);
      return {duration:length/rate,copyToChannel(samples:Float32Array) {
        assert.equal(samples.length,length);
      }};
    }
    createBufferSource() {return new MockBufferSource();}
  }
  class MockAudioWorkletNode extends MockNode {
    port={onmessage: (_event:any)=>{},close:()=>{}};
    constructor(_context: any, name: string) {
      super(); assert.equal(name,'forza-microphone'); micWorklet=this;
    }
  }
  const define=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{
    value,configurable:true,writable:true,
  });
  define('window',{
    AudioContext:MockAudioContext,
    location:{href:'https://sanatpish.example/ai/forza'},
    setTimeout,clearTimeout,setInterval,clearInterval,
  });
  define('WebSocket',MockWebSocket);
  define('AudioWorkletNode',MockAudioWorkletNode);
  define('navigator',{mediaDevices:{getUserMedia:async()=>{
    return {getTracks:()=>[{stop:()=>{stoppedMic=true;}}]};
  }}});
  const statuses:string[]=[];
  const modes:string[]=[];
  const users:string[]=[];
  const errors:string[]=[];
  const client=new ForzaRealtimeClient({
    onMode:mode=>modes.push(mode),
    onStatus:status=>statuses.push(status),
    onUserText:value=>users.push(value),
    onAiText:()=>{},
    onLevel:()=>{},
    onError:error=>errors.push(error),
  });
  try {
    await client.start();
    assert.equal(sockets.length,1);
    const ws=sockets[0];
    assert.equal(ws.url,'wss://sanatpish.example/api/live');
    ws.receive({type:'connected',model:'gemini-3.8-live',sampleRate:24000,inputSampleRate:16000});
    for(let step=0;step<8 && !micWorklet;step++) await new Promise(resolve=>setImmediate(resolve));
    assert.ok(micWorklet,'Microphone audio worklet must be initialized');
    assert.ok(modes.includes('native'));
    micWorklet.port.onmessage({data:new Float32Array(2048).fill(0.25)});
    const frame=ws.sent.find((data:any)=>data.type==='realtime_audio');
    assert.ok(frame,'Raw microphone audio must be sent over live WebSocket');
    assert.ok(decodePcm16Base64(frame.audio).length>=600);
    const beforeMute=ws.sent.filter((data:any)=>data.type==='realtime_audio').length;
    client.setMicMuted(true);
    micWorklet.port.onmessage({data:new Float32Array(2048).fill(0.3)});
    assert.equal(ws.sent.filter((data:any)=>data.type==='realtime_audio').length,beforeMute,
      'Muted microphone must not send more PCM');

    ws.receive({type:'user_transcript',text:'تسمه تایمینگ',final:true});
    assert.equal(users.at(-1),'تسمه تایمینگ');
    const sound=encodePcm16Base64(Int16Array.from([0,100,300,-300,100]));
    ws.receive({type:'audio_chunk',responseId:'reply-1',data:sound,mimeType:'audio/pcm;rate=24000'});
    assert.equal(playback.length,1);
    assert.equal(statuses.at(-1),'speaking');
    ws.receive({type:'turn_complete',responseId:'reply-1'});
    playback[0].finish();
    assert.equal(statuses.at(-1),'listening','Playback drains before next listening turn');

    ws.receive({type:'audio_chunk',responseId:'reply-2',data:sound,mimeType:'audio/pcm;rate=24000'});
    assert.equal(playback.length,2);
    ws.receive({type:'interrupted',responseId:'reply-2'});
    assert.equal(playback[1].stopped,true,'User interruption stops buffered AI playback');
    assert.equal(statuses.at(-1),'listening');
    assert.deepEqual(errors,[]);
  } finally {
    client.stop();
    assert.equal(stoppedMic,true,'Closing a call releases microphone tracks');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(closedContext,true,'Closing a call releases AudioContext');
    for(const [property,descriptor] of before) {
      if(descriptor) Object.defineProperty(globalThis,property,descriptor);
      else Reflect.deleteProperty(globalThis,property);
    }
  }
});
