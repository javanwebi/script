import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaSpeechAdmission} from '../src/utils/forzaSpeechAdmission';

test('quiet but valid desktop microphone speech is admitted after a short ambient calibration',()=>{
  const gate=new ForzaSpeechAdmission();
  const start=1_000;
  for(let i=0;i<8;i++)gate.sample(0.0004,start+i*55,false);
  for(let i=0;i<4;i++)gate.sample(0.002,start+500+i*55,false);
  assert.equal(gate.decide('سلام',true,false,start+665),'accept');
});

test('ambient-only noise does not create a transcript admission',()=>{
  const gate=new ForzaSpeechAdmission();
  const start=2_000;
  for(let i=0;i<10;i++)gate.sample(0.0004,start+i*55,false);
  assert.equal(gate.decide('صدای دور',true,false,start+550),'reject');
});

test('barge-in keeps the stricter near-field duration while FORZA is speaking',()=>{
  const gate=new ForzaSpeechAdmission();
  const start=3_000;
  for(let i=0;i<8;i++)gate.sample(0.0004,start+i*55,false);
  for(let i=0;i<3;i++)gate.sample(0.006,start+500+i*55,true);
  assert.notEqual(gate.decide('سوال جدید دارم',true,true,start+610),'accept');
  for(let i=3;i<7;i++)gate.sample(0.006,start+500+i*55,true);
  assert.equal(gate.decide('سوال جدید دارم',true,true,start+830),'accept');
});
