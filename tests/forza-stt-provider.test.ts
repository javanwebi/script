import test from 'node:test';
import assert from 'node:assert/strict';
import {selectForzaSttProvider} from '../server/ai/forzaSttProvider';

test('xKiro chat and TTS keys are never interpreted as Gemini STT keys',()=>{
  const selection=selectForzaSttProvider({
    FORZA_VOICE_PROVIDER:'xkiro',
    FORZA_DESK_PROVIDER:'xkiro',
    XKIRO_API_KEY:'test-xkiro-key',
    AI_FORZA_API_KEY:'legacy-non-gemini-key',
    'ai-forza':'legacy-alias-value',
    GEMINI_API_KEY:'old-unrelated-setting',
  });
  assert.deepEqual(selection,{provider:'none',reason:'not_configured'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'xkiro',XKIRO_API_KEY:'test-key'}),
    {provider:'none',reason:'unsupported_provider'});
});

test('Gemini STT requires explicit opt-in and a dedicated Gemini credential',()=>{
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',XKIRO_API_KEY:'test'}),
    {provider:'none',reason:'missing_gemini_key'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',GEMINI_API_KEY:'MY_GEMINI_API_KEY'}),
    {provider:'none',reason:'missing_gemini_key'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'browser',GEMINI_API_KEY:'old-key'}),
    {provider:'none',reason:'disabled'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',FORZA_STT_GEMINI_API_KEY:'dedicated-key'}),
    {provider:'gemini',key:'dedicated-key',reason:'configured'});
});

test('legacy AI_FORZA_API_KEY and ai-forza cannot silently enable Gemini STT',()=>{
  assert.deepEqual(selectForzaSttProvider({
    FORZA_STT_PROVIDER:'gemini',
    AI_FORZA_API_KEY:'unrelated-key',
    'ai-forza':'other-key',
  }),{provider:'none',reason:'missing_gemini_key'});
});
