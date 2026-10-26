import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(
  new URL('../src/components/forza/AiForzaCallExperience.tsx', import.meta.url),
  'utf8',
);

test('FORZA welcome uses direct speech synthesis on a real sound-unlock click', () => {
  assert.match(component, /void speakBrowserFallback\(GREETING_TEXT\)/);
  assert.match(component, /setGreetingPhase\('needs-permission'\)/);
  assert.match(component, /setAutoplayBlocked\(true\)/);
});

test('TTS quota/browser fallback is reused without a second server request', () => {
  assert.match(component, /ready\?\.audioBase64 \|\| ready\?\.useClientSpeech/);
  assert.match(component, /data\.audioBase64 \|\| data\.useClientSpeech/);
});

test('unavailable progressive playback is not invoked for FORZA replies', () => {
  assert.doesNotMatch(component, /chooseForzaVoiceStart\(/);
  assert.doesNotMatch(component, /playStreamingText\(/);
  assert.match(component, /await speakBrowserFallback\(chunk\)/);
});

test('failed voice welcome has a visible retry and explicit text-only opt-out', () => {
  assert.match(component, /ادامه مکالمه بدون صدا/);
  assert.match(component, /فعال‌کردن صدا و شنیدن خوشامدگویی فورزا/);
});
