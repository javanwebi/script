import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaVoiceActivity } from '../src/utils/forzaVoiceActivity';

test('near-field VAD ignores low-level background voices and steady room noise', () => {
  const vad = new ForzaVoiceActivity();
  for (let i = 0; i < 40; i += 1) {
    const result = vad.sample(0.008, i * 20);
    assert.equal(result.speaking, false);
    assert.equal(result.speechStarted, false);
  }
  assert.equal(vad.heardSpeech, false);
});

test('near-field VAD requires sustained close speech rather than a short transient', () => {
  const vad = new ForzaVoiceActivity();
  for (let i = 0; i < 3; i += 1) {
    const result = vad.sample(0.035, i * 20);
    assert.equal(result.speechStarted, false);
  }
  assert.equal(vad.heardSpeech, false);
  let started = false;
  for (let i = 3; i < 7; i += 1) {
    const result = vad.sample(0.035, i * 20);
    started = started || result.speechStarted;
  }
  assert.equal(started, true);
  assert.equal(vad.heardSpeech, true);
});

test('near-field VAD closes a turn after sustained silence', () => {
  const vad = new ForzaVoiceActivity();
  for (let i = 0; i < 8; i += 1) vad.sample(0.04, i * 20);
  const silence = vad.sample(0.002, 900);
  assert.equal(silence.speaking, false);
  assert.ok(silence.silenceMs >= 700);
});

test('55ms production sampling detects a short admitted word and quiet speech',()=>{
 const vad=new ForzaVoiceActivity();
 for(let t=0;t<1000;t+=55)vad.sample(0,t);
 let started=false;
 for(let t=1000;t<=1220;t+=55)started=vad.sample(0.011,t).speechStarted||started;
 assert.equal(started,true);
 assert.ok(vad.sample(0,1600).silenceMs>=300);
});

test('admitted quiet speech starts the turn without a second loudness or onset gate',()=>{
 const vad=new ForzaVoiceActivity();
 assert.equal(vad.sample(0.003,1000,true).speechStarted,true);
 assert.equal(vad.sample(0.002,1100,true).speaking,true);
 assert.equal(vad.sample(0.2,1200,false).speaking,false,'unadmitted noise must not extend a turn');
 assert.equal(vad.silenceDuration(1800),700);
});

test('float PCM preserves quiet microphone energy',async()=>{
 const {rootMeanSquareFromFloatTimeDomain:rms}=await import('../src/utils/forzaVoiceActivity');
 assert.ok(Math.abs(rms(new Float32Array([0.003,-0.003]))-0.003)<1e-8);
 assert.equal(rms(new Float32Array([0,0])),0);
 assert.equal(rms(new Float32Array([NaN])),0);
});
