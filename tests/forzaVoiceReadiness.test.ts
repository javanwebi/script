import test from 'node:test';
import assert from 'node:assert/strict';
import { forzaAvalaiReadinessMessage } from '../src/utils/forzaVoiceReadiness';

test('only a configured AvalAI voice provider is ready for customer calls',()=>{
  assert.equal(forzaAvalaiReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:true,
    model:'glm-5.3-flash',reason:null,
  }),null);
});

test('Gemini fallback is not accepted for the customer voice call',()=>{
  assert.match(forzaAvalaiReadinessMessage({
    provider:'gemini',requestedProvider:'gemini',configured:true,
  })||'',/روی AvalAI تنظیم نشده/);
});

test('an explicitly selected but unconfigured AvalAI provider fails closed',()=>{
  assert.match(forzaAvalaiReadinessMessage({
    provider:'avalai',requestedProvider:'avalai',configured:false,
    reason:'missing_api_key',
  })||'',/کلید خصوصی و مدل متنی/);
});

test('a stale server without provider diagnostics is not treated as ready',()=>{
  assert.match(forzaAvalaiReadinessMessage(null)||'',/وضعیت اتصال مدل متنی AvalAI/);
});
