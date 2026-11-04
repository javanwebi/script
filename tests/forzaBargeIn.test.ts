import test from 'node:test';
import assert from 'node:assert/strict';
import {isForzaProbableEcho,shouldIgnoreForzaSpeakerEcho,forzaTurnIntent} from '../src/utils/forzaBargeIn';

test('does not interrupt for spoken speaker echo',()=>{
  assert.equal(isForzaProbableEcho('برای انتخاب تسمه باید توان موتور',
    'برای انتخاب تسمه باید توان موتور و قطر پولی را بدانم'),true);
});
test('explicit user corrections override an echo candidate',()=>{
  assert.equal(isForzaProbableEcho('نه، برای دستگاه بسته بندی میخوام',
    'برای انتخاب تسمه باید توان موتور را بدانم'),false);
  assert.equal(isForzaProbableEcho('صبر کن','صبر کن تا بررسی کنم'),false);
  assert.equal(isForzaProbableEcho('ادامه بده','بعداً ادامه بده'),false);
});
test('novel technical code remains a new user turn',()=>{
  assert.equal(isForzaProbableEcho('نه ۶۲۰۲ منظورم ۶۲۰۳ هست',
    'یاتاقان ۶۲۰۲ موجود است'),false);
  assert.equal(isForzaProbableEcho('SPA 1250','تسمه HTD 8M'),false);
});

test('stop is silent, continue and corrections preserve a conversational request',()=>{
  assert.equal(forzaTurnIntent('صبر کن'), 'stop');
  assert.equal(forzaTurnIntent('صبر کن!'), 'stop');
  assert.equal(forzaTurnIntent('بس کن'), 'stop');
  assert.equal(forzaTurnIntent('ادامه بده'), 'continue');
  assert.equal(forzaTurnIntent('۶۲۰۲... نه، ۶۲۰۳'), 'correction');
  assert.equal(forzaTurnIntent('نه منظورم دستگاه بسته بندی است'), 'correction');
  assert.equal(forzaTurnIntent('صبر کن توضیح بدم'), 'question');
  assert.equal(forzaTurnIntent('SPA 1250 و C3'), 'question');
});

test('only recent actually played multi-word phrases can suppress loudspeaker echo',()=>{
  const speaking='برای انتخاب تسمه باید توان موتور و اندازه پولی را بدانم';
  assert.equal(shouldIgnoreForzaSpeakerEcho('برای انتخاب تسمه باید توان موتور',speaking,true),true);
  assert.equal(shouldIgnoreForzaSpeakerEcho('برای انتخاب تسمه باید توان موتور',speaking,false),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('توان موتور',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('صبر کن',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('نه، برای دستگاه بسته بندی میخوام',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('6203ZZ C3 SPA',speaking,true),false);
});
