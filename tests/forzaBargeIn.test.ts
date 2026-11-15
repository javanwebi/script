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
  assert.equal(shouldIgnoreForzaSpeakerEcho('توان موتور',speaking,true),true);
  assert.equal(shouldIgnoreForzaSpeakerEcho('برای',speaking,true),true);
  assert.equal(shouldIgnoreForzaSpeakerEcho('برای انتخاب',speaking,true),true);
  assert.equal(shouldIgnoreForzaSpeakerEcho('دستگاه',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('صبر کن',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('بس کن',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('نه',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('ادامه بده',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('نه، برای دستگاه بسته بندی میخوام',speaking,true),false);
  assert.equal(shouldIgnoreForzaSpeakerEcho('6203ZZ C3 SPA',speaking,true),false);
});

test('repeated colloquial Persian stop words cancel locally without a new model turn',()=>{
  for(const command of [
    'وایسا','وایسا وایسا','وایستا','وایستا، وایستا',
    'صبر کن صبر کن','یه لحظه','یک لحظه','بس کن بس کن',
    'توقف!','ساکت شو','وایسا صبر کن',
  ]) {
    assert.equal(forzaTurnIntent(command),'stop',command);
    assert.equal(shouldIgnoreForzaSpeakerEcho(command,command,true),false,
      'explicit stop must never be mistaken for an echo');
  }
  for(const correction of [
    'صبر کن، منظورم تسمه بسته بندی بود',
    'وایسا، نه منظورم 6203ZZ است',
    'یه لحظه بگو SPA 1250 موجوده؟',
    'وایسا توضیح بدم',
  ]) {
    assert.notEqual(forzaTurnIntent(correction),'stop',correction);
  }
});


test('late echo of preceding audible phrase is rejected without suppressing correction or retaining stale phrases',async()=>{
 const {ForzaPlaybackEchoHistory}=await import('../src/utils/forzaBargeIn');
 const history=new ForzaPlaybackEchoHistory();
 history.record('برای انتخاب تسمه توان موتور را بگویید',1000);
 history.record('قطر پولی هم مهم است',1400);
 assert.equal(history.matches('برای انتخاب تسمه توان موتور',1800),true);
 assert.equal(history.matches('نه منظورم بلبرینگ است',1800),false);
 assert.equal(history.matches('صبر کن',1800),false);
 assert.equal(history.matches('بله بفرما',1800),false,'unplayed text is never echo reference');
 assert.equal(history.matches('برای انتخاب تسمه توان موتور',4000),false);
 history.record('قطر پولی هم مهم است',4100);history.clear();
 assert.equal(history.matches('قطر پولی هم مهم است',4200),false);
});
