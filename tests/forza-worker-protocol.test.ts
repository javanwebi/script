import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForzaWorkerMessages, stripForzaAudioDataUrl } from '../src/utils/forzaWorkerProtocol.ts';

test('opening FORZA greeting is not sent as the first model turn to Gemini', () => {
  const actual=normalizeForzaWorkerMessages([
    {role:'system',content:'پاسخ کوتاه فارسی'},
    {role:'assistant',content:'سلام من فورزا هستم'},
    {role:'user',content:'سلام'},
  ]);
  assert.deepEqual(actual, [
    {role:'system',content:'پاسخ کوتاه فارسی'},
    {role:'user',content:'سلام'},
  ]);
});

test('consecutive user text merges into one Google turn and alternates roles',()=>{
  const actual=normalizeForzaWorkerMessages([
    {role:'model',content:'Greeting'},
    {role:'user',content:'یک تسمه'},
    {role:'user',content:'تایمینگ می‌خواهم'},
    {role:'assistant',content:'چه گامی؟'},
    {role:'model',content:'مشخصات را بفرمایید'},
    {role:'user',content:'۸ میلیمتر'}
  ]);
  assert.deepEqual(actual.map(v=>v.role),['user','assistant','user']);
  assert.match(String(actual[0].content),/تایمینگ/);
  assert.match(String(actual[1].content),/مشخصات/);
});

test('trailing assistant response cannot become a Gemini request without a user',()=>{
  assert.deepEqual(normalizeForzaWorkerMessages([
    {role:'assistant',content:'سلام'},
    {role:'user',content:'سایز'},
    {role:'assistant',content:'بفرمایید'},
  ]),[{role:'user',content:'سایز'}]);
});

test('WebM Opus, WAV, ordinary base64 data URL prefixes are removed',()=>{
  assert.equal(stripForzaAudioDataUrl('data:audio/webm;codecs=opus;base64,QUJD'),'QUJD');
  assert.equal(stripForzaAudioDataUrl('data:audio/wav;base64,QUJD'),'QUJD');
  assert.equal(stripForzaAudioDataUrl('QUJD'),'QUJD');
});
