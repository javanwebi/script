import test from 'node:test';
import assert from 'node:assert/strict';
import {forzaVoiceRetryDelayMs,waitForForzaVoiceRetry} from '../server/ai/forzaVoiceRetry';

test('Nima 503 recovery is bounded, classified, and never retries arbitrary errors',()=>{
  assert.equal(forzaVoiceRetryDelayMs('voice_busy',0,0),250);
  assert.equal(forzaVoiceRetryDelayMs('voice_busy',1,500),500);
  assert.equal(forzaVoiceRetryDelayMs('voice_busy',2,750),null);
  assert.equal(forzaVoiceRetryDelayMs('voice_queue_timeout',0,2500),200);
  assert.equal(forzaVoiceRetryDelayMs('voice_queue_timeout',1,2900),null);
  assert.equal(forzaVoiceRetryDelayMs('voice_unavailable',0,500),250);
  assert.equal(forzaVoiceRetryDelayMs('voice_unavailable',1,800),null);
  assert.equal(forzaVoiceRetryDelayMs('voice_unavailable',0,3000),null);
  assert.equal(forzaVoiceRetryDelayMs('voice_busy',0,5400),null);
  for(const reason of ['forbidden','missing_voice_token','voice_client_disconnected','unknown',undefined]){
    assert.equal(forzaVoiceRetryDelayMs(reason,0,0),null);
  }
});

test('a customer interruption cancels pending TTS backoff immediately',async()=>{
  const controller=new AbortController();
  const waiting=waitForForzaVoiceRetry(5000,controller.signal);
  controller.abort();
  await assert.rejects(waiting,/forza_tts_cancelled/);
  await assert.rejects(waitForForzaVoiceRetry(200,controller.signal),/forza_tts_cancelled/);
});

test('a completed retry wait does not retain an abort handler',async()=>{
  const controller=new AbortController();
  await waitForForzaVoiceRetry(1,controller.signal);
  controller.abort();
});
