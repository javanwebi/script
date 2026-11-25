import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePersianSentenceCompletion } from '../src/utils/silenceDetector.ts';
import { appendForzaSpeechSegment, forzaEndOfTurnPauseMs, forzaTurnRemainingWaitMs } from '../src/utils/forzaSpeechPipeline.ts';

test('unfinished Persian intent remains open long enough for a natural continuation', () => {
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
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) >= 1500, phrase);
  }
});

test('complete Persian questions dispatch after a short acoustic confirmation', () => {
  for (const phrase of [
    'قیمتش چنده',
    'تسمه SPA 1250 موجود دارید؟',
    'بلبرینگ 6202ZZ موجوده',
    'آیا بلبرینگ 6203 موجود است؟',
    'مدل چند است؟',
  ]) {
    const analysis = analyzePersianSentenceCompletion(phrase);
    assert.equal(analysis.isComplete, true, phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) <= 900, phrase);
    assert.equal(forzaTurnRemainingWaitMs(phrase, false, 1000, 1000), 0, phrase);
  }
});

test('a fixed word count or an unclosed question is NOT proof of completion', () => {
  const fragment = analyzePersianSentenceCompletion('من برای خط بسته بندی');
  assert.equal(fragment.isComplete, false);
  assert.ok(fragment.confidence < 0.8);
  assert.equal(analyzePersianSentenceCompletion('آیا این تسمه مناسب').isComplete, false);
});

test('only explicit control commands bypass the adaptive endpoint', () => {
  for (const phrase of ['وایسا', 'صبر کن', 'بس کن', 'توقف', 'ساکت شو', 'ادامه بده']) {
    assert.ok(forzaEndOfTurnPauseMs(phrase, false) <= 850, phrase);
  }
  assert.equal(forzaTurnRemainingWaitMs('صبر کن',false,700,null),0,
    'explicit stop commands must not inherit the long no-VAD fallback');
  for (const phrase of ['سلام', 'درود', 'ممنون']) {
    assert.equal(forzaEndOfTurnPauseMs(phrase, false), 650);
    assert.equal(forzaTurnRemainingWaitMs(phrase, false, 1000, 1000), 0);
  }
  assert.equal(forzaEndOfTurnPauseMs('اوکی',false),650);
  for(const phrase of ['مدل چند است؟','آیا بلبرینگ 6203 موجود است؟']){
    assert.ok(forzaEndOfTurnPauseMs(phrase,false)<=900,phrase);
  }
  for(const phrase of ['بله','آره','نه','همونه','همون قبلی','دومی','باشه','اوکی','درسته']){
    assert.equal(analyzePersianSentenceCompletion(phrase).isComplete,true,phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase,false)<=900,phrase);
  }
  assert.equal(analyzePersianSentenceCompletion('صبر کن تا').isComplete, false);
});

test('standalone reactions such as the screenshot phrase dispatch as complete turns',()=>{
  for(const phrase of ['چه خبر خوبی','چه خبر','چه خوب','عالیه','خیلی خوبه']){
    assert.equal(analyzePersianSentenceCompletion(phrase).isComplete,true,phrase);
    assert.ok(forzaEndOfTurnPauseMs(phrase,true)<=900,phrase);
  }
});

test('provisional WebSpeech requires more time than a stable finalized hypothesis', () => {
  const phrase='تسمه SPA 1250 موجود دارید';
  assert.ok(forzaEndOfTurnPauseMs(phrase, true)>forzaEndOfTurnPauseMs(phrase, false));
  assert.ok(forzaEndOfTurnPauseMs('مدل 6205', true)>=2000);
});

test('stable complete turns dispatch quickly while unfinished clauses survive a two-second pause', () => {
  const phrase='قیمتش چنده';
  const required=forzaEndOfTurnPauseMs(phrase,false);
  assert.equal(required,750);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,500,500)>0);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,1000,1000),0);
  const unfinished='این تسمه را می‌خواهم چون';
  assert.equal(forzaEndOfTurnPauseMs(unfinished,false),2250);
  assert.equal(forzaEndOfTurnPauseMs(unfinished,true),2250);
  assert.equal(forzaTurnRemainingWaitMs(unfinished,false,2000,2000),250,
    'a clause ending in چون must remain open after a two-second pause');
});

test('recognition restarts append the next partial segment without losing or duplicating words', () => {
  assert.equal(appendForzaSpeechSegment('من دنبال تسمه','تایمینگ هستم'),'من دنبال تسمه تایمینگ هستم');
  assert.equal(appendForzaSpeechSegment('من دنبال تسمه تایمینگ','تسمه تایمینگ هستم'),'من دنبال تسمه تایمینگ هستم');
  assert.equal(appendForzaSpeechSegment('تسمه تایم','تایمینگ SPA'),'تسمه تایمینگ SPA');
  assert.equal(appendForzaSpeechSegment('بلبرینگ 6202','نه، 6203 می‌خواهم'),'بلبرینگ 6202 نه، 6203 می‌خواهم');
});

test('late final STT revision has a short stability guard after acoustic silence, not a second full pause', () => {
  const phrase='تسمه SPA 1250 موجود دارید';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,100,pause+300),80);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,250,pause+300),0);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,250,null)>0);
  assert.ok(forzaTurnRemainingWaitMs('بلبرینگ 6202 نه',false,250,3000)>0);
  assert.ok(forzaTurnRemainingWaitMs(phrase,true,250,3000)>0);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,pause+50,pause+50),0);
});

test('fresh speech postpones dispatch even if text has stopped changing', () => {
  const phrase='قیمتش چنده';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,pause+200,100)>0);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,pause+200,pause+200),0);
});

test('missing VAD analyser uses a longer text-only guard without blocking forever', () => {
  const phrase='قیمتش چنده';
  const pause=forzaEndOfTurnPauseMs(phrase,false);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,pause+50,null)>0,
    'a browser interim stall must not be mistaken for acoustic silence');
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,2199,null),1);
  assert.equal(forzaTurnRemainingWaitMs(phrase,false,2200,null),0);
  assert.ok(forzaTurnRemainingWaitMs(phrase,false,0,null)>0);
});

test('code correction after a mid-turn pause extends the decision window', () => {
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
