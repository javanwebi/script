import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPrivateForzaConfig } from '../server/ai/privateForzaConfig';

test('private VPS config overrides inherited FORZA and AvalAI settings only', () => {
  const env: Record<string, string | undefined> = {
    FORZA_DESK_PROVIDER: 'xkiro',
    FORZA_VOICE_PROVIDER: 'xkiro',
    AVALAI_API_KEY: '',
    DATABASE_URL: 'postgres://unchanged',
    XKIRO_API_KEY: 'keep-for-rollback',
    PORT: '3000',
  };
  applyPrivateForzaConfig(env, {
    FORZA_DESK_PROVIDER: 'avalai',
    FORZA_VOICE_PROVIDER: 'avalai',
    AVALAI_API_KEY: 'secret-placeholder',
    AVALAI_MODEL_DESK: 'glm-5.3-flash',
    AVALAI_MODEL_VOICE: 'glm-5.3-flash',
    DATABASE_URL: 'must-not-override',
    XKIRO_API_KEY: 'must-not-override',
    PORT: '9999',
  });
  assert.equal(env.FORZA_DESK_PROVIDER, 'avalai');
  assert.equal(env.FORZA_VOICE_PROVIDER, 'avalai');
  assert.equal(env.AVALAI_API_KEY, 'secret-placeholder');
  assert.equal(env.AVALAI_MODEL_DESK, 'glm-5.3-flash');
  assert.equal(env.AVALAI_MODEL_VOICE, 'glm-5.3-flash');
  assert.equal(env.DATABASE_URL, 'postgres://unchanged');
  assert.equal(env.XKIRO_API_KEY, 'keep-for-rollback');
  assert.equal(env.PORT, '3000');
});
