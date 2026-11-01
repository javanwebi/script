import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaForegroundVoice} from '../src/utils/forzaForegroundVoice';

test('steady distant background voices must not count as the foreground user',()=>{
  const gate=new ForzaForegroundVoice();
  let start=0;
  for(let i=0;i<50;i++){
    const reading=gate.sample(i%3===0?0.007:0.005,i*55);
    if(reading.started)start++;
  }
  assert.equal(start,0);
  assert.equal(gate.confirmed,false);
  assert.equal(gate.silenceDuration(3000),0);
});

test('nearby foreground voice in a noisy room is detected after sustained energy, not one spike',()=>{
  const gate=new ForzaForegroundVoice();
  for(let i=0;i<25;i++)gate.sample(0.006,i*55);
  assert.equal(gate.sample(0.055,1500).confirmed,false);
  gate.sample(0.006,1555);
  let detected=0;
  for(let i=0;i<6;i++) {
    const sample=gate.sample(0.048,1800+i*55);
    if(sample.started)detected++;
  }
  assert.equal(detected,1);
  assert.equal(gate.confirmed,true);
  assert.ok(gate.silenceDuration(2200)>0);
});

test('do not label a brief loud bang or machinery click as a near speaker',()=>{
  const gate=new ForzaForegroundVoice();
  for(let i=0;i<20;i++)gate.sample(0.005,i*55);
  gate.sample(0.09,1200);
  gate.sample(0.004,1255);
  gate.sample(0.08,1310);
  assert.equal(gate.confirmed,false);
});

test('ambient noise calibration persists across turns but a different microphone resets',()=>{
  const gate=new ForzaForegroundVoice();
  for(let i=0;i<20;i++)gate.sample(0.009,i*55);
  for(let i=0;i<4;i++)gate.sample(0.064,1300+i*55);
  assert.equal(gate.confirmed,true);
  gate.resetTurn();
  assert.equal(gate.confirmed,false);
  const near=gate.sample(0.066,2000);
  assert.ok(near.threshold>=0.013);
  gate.resetDevice();
  assert.equal(gate.confirmed,false);
});

test('invalid RMS cannot confirm a foreground speaker',()=>{
  const gate=new ForzaForegroundVoice();
  for(let i=0;i<10;i++)gate.sample(Number.NaN,i*55);
  assert.equal(gate.confirmed,false);
});
