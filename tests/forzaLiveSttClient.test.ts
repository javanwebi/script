import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ForzaLiveSttClient, attachForzaLivePcmTap } from '../src/utils/forzaLiveSttClient';

class FakeWebSocket {
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  static instances:FakeWebSocket[]=[];
  readyState=FakeWebSocket.CONNECTING;
  bufferedAmount=0;
  sent:any[]=[];
  onopen:any=null;onmessage:any=null;onerror:any=null;onclose:any=null;
  constructor(public url:string){FakeWebSocket.instances.push(this);}
  send(data:any){this.sent.push(data);}
  open(){this.readyState=FakeWebSocket.OPEN;this.onopen?.();}
  receive(data:string){this.onmessage?.({data});}
  close(){this.readyState=FakeWebSocket.CLOSED;this.onclose?.();}
}

test('live Diba client starts one 16 kHz session and preserves PCM order while the server warms',async()=>{
 const original=(globalThis as any).WebSocket;
 FakeWebSocket.instances=[];
 (globalThis as any).WebSocket=FakeWebSocket;
 const hypotheses:Array<[string,boolean]>=[];
 const states:string[]=[];
 const client=new ForzaLiveSttClient({
  url:'ws://localhost/api/forza-stt-stream',
  onHypothesis:(text,isFinal)=>hypotheses.push([text,isFinal]),
  onState:state=>states.push(state),
 });
 try{
  const started=client.start();
  const socket=FakeWebSocket.instances[0];
  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]),{type:'start',sampleRate:16000});
  const first=new Uint8Array([1,0,2,0]).buffer;
  const second=new Uint8Array([3,0,4,0]).buffer;
  client.sendPcm(first);
  client.sendPcm(second);
  socket.receive(JSON.stringify({type:'warming'}));
  socket.receive(JSON.stringify({type:'ready',sampleRate:16000,streamId:'test'}));
  await started;
  assert.equal(socket.sent.length,3);
  assert.deepEqual(Array.from(new Uint8Array(socket.sent[1])),[1,0,2,0]);
  assert.deepEqual(Array.from(new Uint8Array(socket.sent[2])),[3,0,4,0]);
  socket.receive(JSON.stringify({type:'partial',text:'سلام'}));
  socket.receive(JSON.stringify({type:'final',text:'سلام وقت بخیر'}));
  assert.deepEqual(hypotheses,[['سلام',false],['سلام وقت بخیر',true]]);
  assert.ok(states.includes('warming'));
  assert.ok(states.includes('ready'));
  client.stop();
  assert.equal(socket.readyState,FakeWebSocket.CLOSED);
 }finally{
  (globalThis as any).WebSocket=original;
 }
});

test('live PCM tap connects only to the supplied gated source and forwards bounded PCM buffers',async()=>{
 const original=(globalThis as any).AudioWorkletNode;
 const nodes:any[]=[];
 class FakeAudioWorkletNode{
  port={onmessage:null as any,close:()=>{this.closed=true;}};
  connected:any[]=[];closed=false;
  constructor(public context:any,public name:string,public options:any){nodes.push(this);}
  connect(node:any){this.connected.push(node);}
  disconnect(){}
 }
 (globalThis as any).AudioWorkletNode=FakeAudioWorkletNode;
 const source={connected:[] as any[],connect(node:any){this.connected.push(node);},disconnect(){}};
 const context:any={
  state:'running',
  audioWorklet:{addModule:async(url:string)=>assert.equal(url,'/worklets/forza-stt-pcm.js')},
  createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),
  destination:{},
 };
 const received:ArrayBuffer[]=[];
 try{
  const cleanup=await attachForzaLivePcmTap(context,source as any,pcm=>received.push(pcm));
  const node=nodes.at(-1);
  assert.equal(node.name,'forza-stt-pcm-tap');
  assert.equal(node.options.numberOfInputs,1);
  assert.equal(source.connected[0],node);
  const pcm=new Uint8Array(6400).buffer;
  node.port.onmessage({data:{type:'pcm',pcm}});
  assert.equal(received[0],pcm);
  cleanup();
  assert.equal(node.closed,true);
 }finally{
  (globalThis as any).AudioWorkletNode=original;
 }
});

test('PCM tap emits 200 ms 16 kHz frames from the gated audio thread and endpoint silence only',()=>{
 let Processor:any;const posted:ArrayBuffer[]=[];
 class BaseProcessor{port={postMessage:(message:any)=>posted.push(message.pcm),onmessage:null as any};}
 const scope:any={AudioWorkletProcessor:BaseProcessor,sampleRate:48000,Math,Float32Array,Int16Array,
  registerProcessor:(_name:string,processor:any)=>{Processor=processor;}};
 vm.runInNewContext(readFileSync('public/worklets/forza-stt-pcm.js','utf8'),scope);
 const processor=new Processor();
 let index=0;
 const feed=(amplitude:number,blocks:number,frequency=1000)=>{
  for(let block=0;block<blocks;block++){
   const input=new Float32Array(128),output=new Float32Array(128);
   for(let i=0;i<input.length;i++){
    input[i]=amplitude*Math.sin(2*Math.PI*frequency*(index++)/48000);
   }
   processor.process([[input]],[[output]]);
  }
 };
 feed(0.25,75); // 9600 samples at 48 kHz -> 3200 at 16 kHz
 assert.equal(posted.length,1);
 assert.equal(posted[0].byteLength,6400);
 const pcm=new Int16Array(posted[0]);
 const rms=Math.sqrt(pcm.reduce((sum,value)=>sum+(value/32768)**2,0)/pcm.length);
 assert.ok(rms>0.15&&rms<0.22);
 feed(0,75);
 assert.equal(posted.length,2,'the endpoint receives silence after a real gated speech frame');
 const silence=new Int16Array(posted[1]);
 assert.ok(silence.every(value=>value===0));
 feed(0.25,75,12000); // high-frequency energy must not alias into the speech band
 const high=new Int16Array(posted[2]);
 const highRms=Math.sqrt(high.reduce((sum,value)=>sum+(value/32768)**2,0)/high.length);
 assert.ok(highRms<0.04,'anti-alias filtering must suppress high-frequency microphone noise');
});
