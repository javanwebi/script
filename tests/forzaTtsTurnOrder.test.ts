import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaTtsTurnOrder} from '../server/ai/forzaTtsTurnOrder';

function sleep(ms:number) {return new Promise<void>(resolve=>setTimeout(resolve,ms));}

test('phrase 1 arrives first but cannot enter private CPU before phrase 0',async()=>{
  const order=new ForzaTtsTurnOrder(1000);
  const controller=new AbortController();
  const started:number[]=[];
  let releaseFirst!:()=>void;
  const firstWork=new Promise<void>(resolve=>{releaseFirst=resolve});
  const second=order.execute('192.0.2.1:call-abc-turn-1',1,controller.signal,
    async()=>{started.push(1);return 'second'});
  await sleep(5);
  assert.deepEqual(started,[]);
  const first=order.execute('192.0.2.1:call-abc-turn-1',0,controller.signal,
    async()=>{started.push(0);await firstWork;return 'first'});
  await sleep(5);
  assert.deepEqual(started,[0],'first phrase must hold the CPU while it synthesizes');
  releaseFirst();
  assert.equal(await first,'first');
  assert.equal(await second,'second');
  assert.deepEqual(started,[0,1]);
  assert.equal(order.counters.pending,0);
});

test('other turns may work while a delayed phrase waits for its own predecessor',async()=>{
  const order=new ForzaTtsTurnOrder(150);
  const ac=new AbortController();
  const late=order.execute('same-ip:turn-A',1,ac.signal,async()=>1);
  assert.equal(await order.execute('same-ip:turn-B',0,ac.signal,async()=>2),2);
  ac.abort();
  await assert.rejects(late,/aborted/);
  assert.equal(order.counters.pending,0);
});

test('an out-of-order phrase never runs if phrase zero is absent',async()=>{
  const order=new ForzaTtsTurnOrder(25);
  let ran=false;
  const request=order.execute('some-ip:turn-A',1,new AbortController().signal,
    async()=>{ran=true});
  await assert.rejects(request,/phrase_order_timeout/);
  assert.equal(ran,false);
});

test('failed first phrase rejects queued later audio and never synthesizes it',async()=>{
  const order=new ForzaTtsTurnOrder(150);
  const abort=new AbortController();
  let secondRan=false;
  const first=order.execute('some-ip:turn-A',0,abort.signal,
    async()=>{await sleep(10);throw new Error('private_voice_unavailable')});
  const second=order.execute('some-ip:turn-A',1,abort.signal,
    async()=>{secondRan=true});
  await assert.rejects(first,/private_voice_unavailable/);
  await assert.rejects(second,/preceding_phrase_failed/);
  assert.equal(secondRan,false);
});

test('duplicate phrase indices, invalid indices and runaway lookahead are rejected',async()=>{
  const order=new ForzaTtsTurnOrder(250,10,2);
  const signal=new AbortController().signal;
  await assert.rejects(order.execute('key',-1,signal,async()=>1),/invalid_phrase_order/);
  const late=order.execute('key',1,signal,async()=>1);
  const latest=order.execute('key',2,signal,async()=>2);
  await assert.rejects(order.execute('key',1,signal,async()=>5),/duplicate_or_full_phrase/);
  await assert.rejects(order.execute('key',3,signal,async()=>5),/duplicate_or_full_phrase/);
  assert.equal(await order.execute('key',0,signal,async()=>0),0);
  assert.deepEqual(await Promise.all([late,latest]),[1,2]);
  await assert.rejects(order.execute('key',0,signal,async()=>1),/duplicate_or_full_phrase/);
});

test('cancelled waiting phrase is removed without affecting independent future turns',async()=>{
  const order=new ForzaTtsTurnOrder(1000);
  const aborted=new AbortController();
  let called=false;
  const promise=order.execute('network:turn-1',2,aborted.signal,
    async()=>{called=true});
  aborted.abort();
  await assert.rejects(promise,/aborted/);
  assert.equal(called,false);
  assert.equal(order.counters.pending,0);
  assert.equal(await order.execute('network:turn-2',0,new AbortController().signal,async()=>9),9);
});
