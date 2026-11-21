import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {attachForzaAudioEvidence} from '../src/utils/forzaAudioEvidence';

test('foreground worklet passes a close, clear voice and blocks a low-SNR distant voice before STT',()=>{
 let Processor:any;
 const messages:any[]=[];
 const scope:any={
  sampleRate:16000,currentTime:0,Math,Float32Array,Uint8Array,
  AudioWorkletProcessor:class{port={postMessage:(value:any)=>messages.push(value),onmessage:null as any};},
  registerProcessor:(_name:string,processor:any)=>{Processor=processor;},
 };
 vm.runInNewContext(readFileSync(new URL('../public/worklets/forza-foreground-gate.js',import.meta.url),'utf8'),scope);
 const processor=new Processor();
 let sampleIndex=0;
 const feed=(seconds:number,amplitude:number)=>{
  const blocks=Math.ceil(seconds*16000/128);
  let outputEnergy=0,inputEnergy=0;
  for(let block=0;block<blocks;block++){
   const input=new Float32Array(128),output=new Float32Array(128);
   for(let i=0;i<128;i++){
    const t=sampleIndex/16000;
    const voice=amplitude*(
      0.65*Math.sin(2*Math.PI*140*t)+
      0.25*Math.sin(2*Math.PI*280*t)+
      0.10*Math.sin(2*Math.PI*2500*t)
    );
    const room=0.00008*Math.sin(2*Math.PI*910*t);
    input[i]=voice+room;
    inputEnergy+=input[i]*input[i];
    sampleIndex++;
   }
   processor.process([[input]],[[output]]);
   for(const value of output)outputEnergy+=value*value;
   scope.currentTime+=128/16000;
  }
  return {inputRms:Math.sqrt(inputEnergy/(blocks*128)),outputRms:Math.sqrt(outputEnergy/(blocks*128))};
 };
 const ambient=feed(0.5,0);
 assert.ok(ambient.outputRms<0.00001,'ambient room noise must not be forwarded');
 const distant=feed(0.6,0.001);
 assert.ok(distant.inputRms>0,'the distant test signal exists at the physical mic input');
 assert.ok(distant.outputRms<0.00002,'low-SNR background voice must be suppressed before STT');
 const near=feed(0.8,0.025);
 assert.ok(near.inputRms>distant.inputRms*10);
 assert.ok(near.outputRms>0.003,'a clear near-field voice must pass the gate');
 assert.ok(messages.length>0,'bounded acoustic diagnostics are emitted');
 assert.ok(messages.flat().every((frame:any)=>Array.isArray(frame)&&frame.length===4),
  'only timestamp, gated RMS, score and gate state leave the audio thread');
});

test('overlapping independent voices fail closed instead of being mixed into STT',()=>{
 let Processor:any;
 const scope:any={
  sampleRate:16000,currentTime:0,Math,Float32Array,Uint8Array,
  AudioWorkletProcessor:class{port={postMessage:()=>{},onmessage:null as any};},
  registerProcessor:(_name:string,processor:any)=>{Processor=processor;},
 };
 vm.runInNewContext(readFileSync(new URL('../public/worklets/forza-foreground-gate.js',import.meta.url),'utf8'),scope);
 const processor=new Processor();
 let index=0,energy=0,count=0;
 const feed=(seconds:number,first:number,second:number)=>{
  const blocks=Math.ceil(seconds*16000/128);
  for(let block=0;block<blocks;block++){
   const input=new Float32Array(128),output=new Float32Array(128);
   for(let i=0;i<128;i++){
    const t=index++/16000;
    input[i]=first*(0.6*Math.sin(2*Math.PI*140*t)+0.25*Math.sin(2*Math.PI*280*t)+0.1*Math.sin(2*Math.PI*2500*t))+
      second*(0.6*Math.sin(2*Math.PI*190*t)+0.25*Math.sin(2*Math.PI*380*t)+0.1*Math.sin(2*Math.PI*3100*t));
   }
   processor.process([[input]],[[output]]);
   for(const value of output){energy+=value*value;count++;}
   scope.currentTime+=128/16000;
  }
 };
 feed(0.5,0,0);
 feed(0.8,0.025,0.025);
 const rms=Math.sqrt(energy/Math.max(1,count));
 assert.ok(rms<0.00003,'overlapping non-harmonic voices must not be forwarded as one transcript');
});

test('foreground bridge routes the gated stream to consumers and owns its cleanup',async t=>{
 const original=(globalThis as any).AudioWorkletNode;
 let worklet:any,listener:any,removed=false,sourceTarget:any;
 const stopped:{value:boolean}={value:false};
 const stream:any={getTracks:()=>[{stop:()=>{stopped.value=true;}}]};
 const destination:any={stream,disconnect(){this.disconnected=true;}};
 const sink:any={gain:{value:1},connect(){},disconnect(){this.disconnected=true;}};
 class Node{
  port={onmessage:null as any,postMessage:()=>{},close:()=>{}};
  onprocessorerror:any;connections:any[]=[];
  constructor(){worklet=this;}
  connect(target:any){this.connections.push(target);}
  disconnect(){this.disconnected=true;}
 }
 (globalThis as any).AudioWorkletNode=Node;
 t.after(()=>{(globalThis as any).AudioWorkletNode=original;});
 const ctx:any={
  state:'running',currentTime:1,
  audioWorklet:{addModule:async(url:string)=>{assert.equal(url,'/worklets/forza-foreground-gate.js');}},
  createMediaStreamDestination:()=>destination,
  createGain:()=>sink,destination:{},
  addEventListener:(_name:string,fn:any)=>{listener=fn;},
  removeEventListener:()=>{removed=true;},
 };
 const source:any={connect(target:any){sourceTarget=target;},disconnect(target:any){if(target===worklet)this.disconnected=true;}};
 const received:any[]=[];
 const route=await attachForzaAudioEvidence(ctx,source,(rms,at,score,open)=>received.push({rms,at,score,open}));
 assert.equal(route.node,worklet);
 assert.equal(route.stream,stream);
 assert.equal(sourceTarget,worklet);
 assert.ok(worklet.connections.includes(destination),'gated PCM must reach the MediaRecorder stream');
 assert.ok(worklet.connections.includes(sink),'AudioWorklet must remain alive on the silent sink');
 ctx.currentTime=1.1;
 worklet.port.onmessage({data:[[1.02,0.03,0.8,1],[0.5,0,0.1,0]]});
 assert.equal(received.length,1,'stale worklet frames are discarded');
 ctx.state='suspended';listener();
 worklet.port.onmessage({data:[[1.1,0.7,0.9,1]]});
 assert.equal(received.length,1,'suspended audio context cannot authorize speech');
 ctx.state='running';listener();ctx.currentTime=1.2;
 worklet.port.onmessage({data:[[1.18,0.02,0.7,1]]});
 assert.equal(received.length,2);
 assert.equal(received[1].open,true);
 route.dispose();route.dispose();
 assert.equal(removed,true);
 assert.equal(worklet.port.onmessage,null);
 assert.equal(stopped.value,true,'processed stream tracks are stopped on teardown');
});
