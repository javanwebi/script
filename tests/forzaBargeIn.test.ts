import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldInterruptForzaSpeech,forzaInterruptionIntent} from '../src/utils/forzaBargeIn';
const opts={microphoneVoiced:true,isFinal:false};
test('real correction or stop can interrupt but its text is not prematurely submitted',()=>{
  assert.equal(shouldInterruptForzaSpeech('نه، برای دستگاه بسته‌بندی می‌خوام','برای انتخاب تسمه باید توان موتور',opts),true);
  assert.equal(shouldInterruptForzaSpeech('صبر کن','توان موتور را بفرمایید',opts),true);
  assert.equal(forzaInterruptionIntent('نه، منظورم SPA 1250 بود'),'correction');
  assert.equal(forzaInterruptionIntent('ادامه بده'),'continue');
  assert.equal(forzaInterruptionIntent('صبر کن'),'stop');
});
test('no RMS evidence, single ambient noise or echo transcript does not interrupt',()=>{
  assert.equal(shouldInterruptForzaSpeech('برای انتخاب تسمه باید توان موتور','برای انتخاب تسمه باید توان موتور',opts),false);
  assert.equal(shouldInterruptForzaSpeech('تسمه','تسمه مناسب',opts),false);
  assert.equal(shouldInterruptForzaSpeech('تسمه SPA 1250','توان موتور را بفرمایید',{microphoneVoiced:false,isFinal:true}),false);
});
test('technical identifiers are never re-written during interruption detection',()=>{
  assert.equal(shouldInterruptForzaSpeech('نه، ۶۲۰۲ را حذف کن، ۶۲۰۳ ZZ می‌خوام','یاتاقان 6202ZZ موجوده',opts),true);
  assert.equal(forzaInterruptionIntent('SPA 1250 مناسب است؟'),'new_question');
});
