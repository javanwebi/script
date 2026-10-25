import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaVoiceActivity, rootMeanSquareFromTimeDomain } from '../src/utils/forzaVoiceActivity.ts';

test('silence, stable fan noise and short spikes do not trigger a customer turn',()=>{
  const vad=new ForzaVoiceActivity();
  for(let i=0;i<100;i++){
    const result=vad.sample(i===50?0.21:0.002,100+i*55);
    assert.equal(result.speechStarted,false);
  }
  assert.equal(vad.heardSpeech,false);
});

test('quiet but real sustained speech is detected, then silence is measured',()=>{
  const vad=new ForzaVoiceActivity();
  for(let i=0;i<10;i++)vad.sample(0.001,100+i*55);
  let activated=false;
  for(let i=0;i<9;i++){
    const state=vad.sample(0.022,650+i*55);
    activated ||=state.speechStarted;
  }
  assert.equal(activated,true);
  assert.equal(vad.heardSpeech,true);
  const after=vad.sample(0.001,2000);
  assert.equal(after.speaking,false);
  assert.ok(after.silenceMs>900);
  vad.reset();
  assert.equal(vad.heardSpeech,false);
});

test('actual time-domain waveform yields sensible mic levels',()=>{
  const centered=new Uint8Array(512).fill(128);
  assert.equal(rootMeanSquareFromTimeDomain(centered),0);
  const voice=new Uint8Array(512).map((_,i)=>i%2?148:108);
  assert.ok(rootMeanSquareFromTimeDomain(voice)>0.1);
  assert.equal(rootMeanSquareFromTimeDomain(new Uint8Array()),0);
});
