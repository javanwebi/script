import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePersianSentenceCompletion } from '../src/utils/silenceDetector.ts';
import { forzaEndOfTurnPauseMs, forzaTurnRemainingWaitMs } from '../src/utils/forzaSpeechPipeline.ts';

test('unfinished Persian intent must not be submitted as a complete request', () => {
  for (const phrase of [
    'یه تسمه میخوام',
    'یه تسمه می‌خوام',
    'من یه بلبرینگ نیاز دارم',
    'یه تسمه میخوام برای',
    'برای دستگاه بسته بندی',
    'نه منظورم',
    'بلبرینگ 6202 نه',
    'آیا این تسمه',
    'این تسمه را می‌خواهم چون',
    'یه تسمه میخوام...',
  ]) {
    const result = analyzePersianSentenceCompletion(phrase);
    assert.equal(result.isComplete, false, phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) >= 700, phrase);
  }
});

test('common short questions and completed industrial inquiries respond promptly', () => {
  for (const phrase of [
    'قیمتش چنده',
    'تسمه SPA 1250 موجود دارید؟',
    'بلبرینگ 6202ZZ موجوده',
    'آیا بلبرینگ 6203 موجود است؟',
    'مدل چند است؟',
  ]) {
    const analysis = analyzePersianSentenceCompletion(phrase);
    assert.equal(analysis.isComplete, true, phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) <= 500, phrase);
  }
});

test('a fixed word count or an unclosed question is NOT proof of completion', () => {
  const fragment = analyzePersianSentenceCompletion('من برای خط بسته بندی');
  assert.equal(fragment.isComplete, false);
  assert.ok(fragment.confidence < 0.8);
  assert.equal(analyzePersianSentenceCompletion('آیا این تسمه مناسب').isComplete, false);
});

test('standalone turn control words are recognized without a long timeout', () => {
  for (const phrase of ['صبر کن', 'بس کن', 'ادامه بده', 'سلام', 'ممنون']) {
    const analysis = analyzePersianSentenceCompletion(phrase);
    assert.equal(analysis.isComplete, true, phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) <= 500, phrase);
  }
  assert.equal(analyzePersianSentenceCompletion('صبر کن تا').isComplete, false);
});

test('provisional WebSpeech requires more time than a stable finalized hypothesis', () => {
  const phrase='تسمه SPA 1250 موجود دارید';
  assert.ok(forzaEndOfTurnPauseMs(phrase, true)>forzaEndOfTurnPauseMs(phrase, false));
  assert.ok(forzaEndOfTurnPauseMs('مدل 6205', true)>=900);
});

test('STT transcript revision postpones submission even when acoustic silence is long', () => {
  const phrase='تسمه SPA 1250 موجود دارید';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,100,pause+300)>=pause-100);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,pause+50,pause+50),0);
});

test('fresh speech postpones dispatch even if text has stopped changing', () => {
  const phrase='قیمتش چنده';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,pause+200,100)>0);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,pause+200,pause+200),0);
});

test('missing VAD analyser can use text stabilization, not block transcription forever', () => {
  const phrase='قیمتش چنده';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,pause+50,null),0);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,0,null)>0);
});

test('code correction after a mid-turn pause extends the decision window', () => {
  assert.ok(forzaEndOfTurnPauseMs('بلبرینگ 6202 نه',false)>=1000);
  assert.ok(forzaEndOfTurnPauseMs('بلبرینگ 6202 نه',false)>
    forzaEndOfTurnPauseMs('بلبرینگ 6203 موجوده',false));
  const incomplete='بلبرینگ 6202 نه';
  const pause=forzaEndOfTurnPauseMs(incomplete,false);
  assert.ok(forzaTurnRemainingWaitMs(incomplete,false,700,700)>0);
  assert.equal(forzaTurnRemainingWaitMs(incomplete,false,pause+1,pause+1),0);
});

test('do not dispatch empty recognition hypotheses', () => {
  assert.equal(forzaTurnRemainingWaitMs('',true,0,0),0);
});
