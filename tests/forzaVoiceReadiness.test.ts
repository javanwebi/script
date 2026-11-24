import test from 'node:test';
import assert from 'node:assert/strict';
import { forzaVoiceCallReadinessMessage } from '../src/utils/forzaVoiceReadiness';

test('only a configured AvalAI voice provider is ready for customer calls',()=>{
  assert.equal(forzaVoiceCallReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:true,
    model:'glm-5.3-flash',reason:null,
    voice:'piper-nima-gyro-medium',voiceReady:true,
  }),null);
});

test('Gemini fallback is not accepted for the customer voice call',()=>{
  assert.match(forzaVoiceCallReadinessMessage({
    provider:'gemini',requestedProvider:'gemini',configured:true,
  })||'',/روی AvalAI تنظیم نشده/);
});

test('an explicitly selected but unconfigured AvalAI provider fails closed',()=>{
  assert.match(forzaVoiceCallReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:false,
    reason:'missing_api_key',
  })||'',/کلید خصوصی و مدل متنی/);
});


test('configured AvalAI accepts each existing voice engine only when the private voice service is ready',()=>{
  for (const voice of ['piper-nima-gyro-medium','piper-amir-medium','pocket-farsi-v2']) {
    assert.equal(forzaVoiceCallReadinessMessage({
      provider:'avalai',requestedProvider:'avalai',configured:true,
      voice,voiceReady:true,
    }),null);
  }
  assert.match(forzaVoiceCallReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:true,
    voice:'pocket-farsi-v2',voiceReady:false,
  })||'',/موتور صدای انتخاب‌شده آماده نیست/);
  assert.match(forzaVoiceCallReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:true,
    voice:'unknown-engine',voiceReady:true,
  })||'',/موتور صدای انتخاب‌شده آماده نیست/);
});

test('a stale server without provider diagnostics is not treated as ready',()=>{
  assert.match(forzaVoiceCallReadinessMessage(null)||'',/وضعیت اتصال مدل متنی AvalAI/);
});
