import test from 'node:test';
import assert from 'node:assert/strict';
import {getForzaVoiceFastReply} from '../server/ai/forzaVoiceFastReplies';

test('simple Persian greetings receive a local instant reply',()=>{
  assert.match(getForzaVoiceFastReply('سلام')||'',/سلام/);
  assert.match(getForzaVoiceFastReply('درود، وقت بخیر')||'',/خوش آمدید/);
  assert.match(getForzaVoiceFastReply('سلام، بلبرینگ 6202')||'',/^$/);
});

test('standalone thanks and wellbeing greetings receive an instant reply',()=>{
  assert.equal(getForzaVoiceFastReply('ممنونم'),'خواهش می‌کنم. هر زمان آماده بودید، در خدمتم.');
  assert.match(getForzaVoiceFastReply('خوبی؟')||'',/آماده‌ام کمک کنم/);
  assert.equal(getForzaVoiceFastReply('بله'),null,'yes depends on conversation history');
  assert.equal(getForzaVoiceFastReply('باشه'),null,'okay depends on conversation history');
});

test('industrial requests and corrections always go through the technical model',()=>{
  for(const query of [
    'بلبرینگ 6202ZZ موجود دارید؟',
    'بلبرینگ 6202 نه 6203',
    'سلام، بلبرینگ 6202 می‌خواهم',
    'تسمه SPA 1250 برای دستگاه لازم دارم',
    'خیلی ضعیفه',
  ])assert.equal(getForzaVoiceFastReply(query),null,query);
});
