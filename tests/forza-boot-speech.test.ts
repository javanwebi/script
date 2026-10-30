import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';

const frontend=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');

test('FORZA active session does not remount during catalog hydration',()=>{
  for(const path of ['/ai-forza','/ai-forza/','/ai-forza/session'])
    assert.equal(shouldRemountAfterCatalogHydration(path),false);
  assert.equal(shouldRemountAfterCatalogHydration('/'),true);
});
test('Pocket Farsi v2 response phrases are always produced by Ubuntu private worker',()=>{
  assert.match(frontend,/fetch\s*\(\s*['"]\/api\/ai\/forza-speech/);
  assert.match(frontend,/X-Forza-Voice/);
  assert.match(frontend,/takeSpeakablePhrase\(speechBuffer/);
  assert.match(frontend,/synthesisChain=audioRequest/);
  assert.doesNotMatch(frontend,/speechSynthesis\.speak|synth\.speak|new SpeechSynthesisUtterance/);
  assert.doesNotMatch(frontend,/waitForLocalPersianSpeechVoice/);
});
test('existing prerecorded greeting is preserved and there is no client TTS model download',()=>{
  assert.match(frontend,/\/forza-greeting-bootstrap\.wav/);
  assert.doesNotMatch(frontend,/pocket-tts-farsi-v2-onnx/);
});
test('Express forwards Pocket requests via authenticated private network and never runs in-process inference',()=>{
  assert.match(backend,/FORZA_VOICE_INTERNAL_URL/);
  assert.match(backend,/X-Forza-Voice-Token/);
  assert.match(backend,/private_voice_not_configured/);
  assert.match(backend,/private_voice_token_missing/);
  assert.match(backend,/voice_busy/);
  assert.doesNotMatch(backend,/synthesizeServerPocket\(/);
  assert.doesNotMatch(backend,/warmServerPocket\(/);
});
