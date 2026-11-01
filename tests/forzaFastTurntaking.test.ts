import test from 'node:test';
import assert from 'node:assert/strict';
import {
  forzaEndOfTurnPauseMs,
  forzaLiveTurnPauseMs,
  FORZA_INDUSTRIAL_STT_TERMS,
  extractPersianSpeechRecognition,
} from '../src/utils/forzaSpeechPipeline';

test('complete Persian user turn dispatches faster without cutting mid-thought speech',()=>{
  const question='برای خرید تسمه صنعتی قیمت دارید؟';
  assert.ok(forzaLiveTurnPauseMs(question,false) <= 500);
  assert.ok(forzaLiveTurnPauseMs(question,false) < forzaEndOfTurnPauseMs(question,false));
  assert.ok(forzaLiveTurnPauseMs('برای دستگاه جدید اگر',false) >= 1400);
  assert.ok(forzaLiveTurnPauseMs('برای دستگاه جدید اگر',true) >= 1800);
  assert.ok(forzaLiveTurnPauseMs(question,true) >= 850);
  assert.ok(forzaLiveTurnPauseMs('من مدل دستگاه را',false) >= 480);
});

test('Chrome STT never loses a finalized prefix when new provisional text arrives',()=>{
  const results=[
    {isFinal:true,0:{transcript:'تسمه تایمینگ HTD'}},
    {isFinal:false,0:{transcript:' برای دستگاه صنعتی'}},
  ];
  const out=extractPersianSpeechRecognition(results);
  assert.equal(out.text,'تسمه تایمینگ HTD برای دستگاه صنعتی');
  assert.equal(out.finalText,'تسمه تایمینگ HTD');
  assert.equal(out.hasInterim,true);
});

test('industrial recognition hints are short, bounded and preserve technical model codes',()=>{
  assert.ok(FORZA_INDUSTRIAL_STT_TERMS.includes('صنعت پیش'));
  assert.ok(FORZA_INDUSTRIAL_STT_TERMS.includes('HTD'));
  assert.ok(FORZA_INDUSTRIAL_STT_TERMS.includes('6205'));
  assert.ok(FORZA_INDUSTRIAL_STT_TERMS.length<40);
  assert.equal(new Set(FORZA_INDUSTRIAL_STT_TERMS).size,FORZA_INDUSTRIAL_STT_TERMS.length);
});
