import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {attachForzaAudioEvidence} from '../src/utils/forzaAudioEvidence';
import {ForzaSpeechAdmission} from '../src/utils/forzaSpeechAdmission';

test('audio-thread RMS survives delayed main-thread delivery and bounds queued messages',()=>{
 let Processor:any;const messages:any[]=[];
 const scope:any={sampleRate:48000,currentTime:0,Math,
  AudioWorkletProcessor:class{port={postMessage:(v:any)=>messages.push(v),onmessage:null};},
  registerProcessor:(_name:string,p:any)=>{Processor=p;}};
 vm.runInNewContext(readFileSync(new URL('../public/worklets/forza-speech-evidence.js',import.meta.url),'utf8'),scope);
 const processor=new Processor();
 const audio=(seconds:number,level:number)=>{
  const count=Math.ceil(seconds*48000/128);
  for(let i=0;i<count;i++){processor.process([[new Float32Array(128).fill(level)]]);scope.currentTime+=128/48000;}
 };
 audio(0.5,0.002);assert.equal(messages.length,1,'only one in-flight batch');
 assert.ok(processor.frames.length<=32);
 processor.port.onmessage();audio(0.01,0.002);
 const gate=new ForzaSpeechAdmission();
 for(const batch of messages)for(const [at,rms] of batch)gate.sample(rms,at*1000,true);
 messages.length=0;
 processor.port.onmessage();audio(0.5,0.06);
 assert.equal(messages.length,1);assert.ok(processor.frames.length<=32);
 processor.port.onmessage();audio(0.01,0.06);
 for(const batch of messages)for(const [at,rms] of batch)gate.sample(rms,at*1000,true);
 assert.equal(gate.decide('وایسا',true,true,scope.currentTime*1000),'accept');
 assert.ok(messages.every(batch=>batch.length<=32));
});

test('evidence bridge owns only its nodes and excludes stale audio across resume',async t=>{
 const original=(globalThis as any).AudioWorkletNode;let worklet:any,listener:any,removed=false,disconnected:any;
 class Node{port={onmessage:null as any,postMessage:()=>{},close:()=>{}};onprocessorerror:any;constructor(){worklet=this;}connect(){}disconnect(){}}
 (globalThis as any).AudioWorkletNode=Node;t.after(()=>{(globalThis as any).AudioWorkletNode=original;});
 const ctx:any={state:'running',currentTime:1,audioWorklet:{addModule:async()=>{}},
  createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),destination:{},
  addEventListener:(_name:string,f:any)=>{listener=f;},removeEventListener:()=>{removed=true;}};
 const source:any={connect(){},disconnect(n:any){disconnected=n;}};
 const received:any[]=[];
 const close=await attachForzaAudioEvidence(ctx,source,(rms,at)=>received.push({rms,at}));
 ctx.currentTime=1.1;worklet.port.onmessage({data:[[1.02,0.03],[0.5,0.8]]});
 assert.equal(received.length,1);assert.equal(received[0].rms,0.03);
 ctx.state='suspended';listener();worklet.port.onmessage({data:[[1.1,0.7]]});assert.equal(received.length,1);
 ctx.state='running';listener();ctx.currentTime=1.2;worklet.port.onmessage({data:[[1.04,0.7],[1.18,0.02]]});assert.equal(received.length,2);
 close();close();assert.equal(disconnected,worklet);assert.equal(removed,true);assert.equal(worklet.port.onmessage,null);
});
