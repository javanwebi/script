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

test('near-field VAD can detect a quiet close speaker after the room-noise floor settles', () => {
  const vad = new ForzaVoiceActivity();
  for (let i = 0; i < 100; i += 1) vad.sample(0.002, i * 20);
  let started = false;
  for (let i = 100; i < 108; i += 1) {
    const result = vad.sample(0.012, i * 20);
    started = started || result.speechStarted;
  }
  assert.equal(started, true);
  assert.equal(vad.heardSpeech, true);
});

test('production 55ms polling detects short speech after 110ms rather than 275ms',()=>{
 const vad=new ForzaVoiceActivity();
 assert.equal(vad.sample(0.03,0).speechStarted,false);
 assert.equal(vad.sample(0.03,55).speechStarted,false);
 assert.equal(vad.sample(0.03,110).speechStarted,true);
});
test('a stalled timer cannot turn two isolated noises into sustained speech',()=>{
 const vad=new ForzaVoiceActivity();
 vad.sample(0.03,0);vad.sample(0.03,55);
 assert.equal(vad.sample(0.03,1000).speechStarted,false);
 assert.equal(vad.heardSpeech,false);
});
