import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const liveUi = readFileSync(new URL('../src/components/forza/AiForzaLiveExperience.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/components/forza/forzaRealtimeClient.ts', import.meta.url), 'utf8');
const gateway = readFileSync(new URL('../server/ai/forzaLiveGateway.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/AiForzaPage.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/search/AiForzaFaceToFaceModal.tsx', import.meta.url), 'utf8');

test('customer-facing FORZA entry points render the native live experience', () => {
  assert.match(page, /AiForzaLiveExperience/);
  assert.match(modal, /AiForzaLiveExperience/);
  assert.doesNotMatch(page, /AiForzaCallExperience/);
  assert.doesNotMatch(modal, /AiForzaCallExperience/);
});

test('live experience exposes microphone, speaker, hangup and same-session text controls', () => {
  assert.match(liveUi, /new ForzaRealtimeClient/);
  assert.match(liveUi, /setMicMuted/);
  assert.match(liveUi, /setSpeakerMuted/);
  assert.match(liveUi, /client\.sendText\(text\)/);
  assert.match(liveUi, /onTurnComplete/);
  assert.match(liveUi, /PhoneOff/);
  assert.match(liveUi, /aria-live="polite"/);
  assert.match(liveUi, /Google Gemini/);
  assert.match(liveUi, /صدا یا متن مکالمه را در سرور خود ذخیره نمی‌کند/);
  assert.match(liveUi, /طرح Free/);
  assert.match(liveUi, /Paid/);
});

test('live client preserves completed turns and handles barge-in callbacks', () => {
  assert.match(client, /onTurnComplete\?:/);
  assert.match(client, /onInterrupted\?:/);
  assert.match(client, /this\.callback\.onTurnComplete\?\.\(this\.userTranscript, this\.aiTranscript\)/);
  assert.match(client, /this\.callback\.onInterrupted\?\./);
});

test('gateway greets once per session and uses provider VAD interruption', () => {
  assert.match(gateway, /مکالمه تازه آغاز شده است/);
  assert.match(gateway, /START_OF_ACTIVITY_INTERRUPTS/);
  assert.match(gateway, /type: 'interrupted'/);
  assert.match(gateway, /type: 'turn_complete'/);
});
