import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaStopAcknowledgement} from '../src/utils/forzaStopAcknowledgement';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
test('fixed stop acknowledgement warms once and plays cached Nima without another network request',async()=>{
 let requests=0,plays=0;
 const bytes=new Uint8Array([1,2,3]);
 const ack=new ForzaStopAcknowledgement(async()=>{requests++;return bytes;});
 try{
  await Promise.all([ack.warm(),ack.warm()]);
  assert.equal(requests,1);
  assert.equal(ack.request(async received=>{assert.equal(received,bytes);plays++;},0),true);
  await tick();assert.equal(plays,1);assert.equal(requests,1);
 }finally{ack.dispose();}
});
test('continued user speech cancels queued acknowledgement and cancels active playback',async()=>{
 const ack=new ForzaStopAcknowledgement(async()=>new Uint8Array([1]));
 let plays=0,aborted=false;
 try{
  await ack.warm();
  ack.request(async()=>{plays++;},0);ack.cancel();await tick();assert.equal(plays,0);
  ack.request(async(_bytes,controller)=>{plays++;controller.signal.addEventListener('abort',()=>{aborted=true;});},0);
  // A real player resolves on playback completion, not enqueue. Hold it below.
  await tick();
  ack.request(async(_bytes,controller)=>new Promise<void>(resolve=>{
    controller.signal.addEventListener('abort',()=>{aborted=true;resolve();});
  }),0);
  await tick();ack.cancel();await tick();assert.equal(aborted,true);
 }finally{ack.dispose();}
});
test('failed or unfinished warmup never triggers synthesis after a stop; late result cannot survive disposal',async()=>{
 let resolve!:(bytes:Uint8Array)=>void,signal!:AbortSignal;
 const ack=new ForzaStopAcknowledgement(s=>{signal=s;return new Promise(r=>{resolve=r;});});
 const warming=ack.warm();
 assert.equal(ack.request(async()=>{throw Error('must not play');},0),false);
 ack.dispose();assert.equal(signal.aborted,true);
 resolve(new Uint8Array([1]));await warming;
 assert.equal(ack.request(async()=>{throw Error('must not play');},0),false);
 const failed=new ForzaStopAcknowledgement(async()=>{throw Error('voice unavailable');});
 await failed.warm();assert.equal(failed.request(async()=>{},0),false);failed.dispose();
});
test('repeated stop commands coalesce to one acknowledgement',async()=>{
 const ack=new ForzaStopAcknowledgement(async()=>new Uint8Array([1]));let plays=0;
 try{await ack.warm();for(let i=0;i<4;i++)ack.request(async()=>{plays++;},0);await tick();assert.equal(plays,1);}finally{ack.dispose();}
});
