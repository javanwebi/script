import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveForzaQuickVoiceReply} from '../server/ai/forzaQuickReply';

test('a first greeting is answered immediately without requiring a remote model request',()=>{
  assert.equal(
    resolveForzaQuickVoiceReply('سلام',[]),
    'سلام، صدات رو دارم. بفرما، چطور می‌تونم کمکت کنم؟',
  );
  assert.equal(resolveForzaQuickVoiceReply('سلام وقت بخیر',[]),
    'سلام، صدات رو دارم. بفرما، چطور می‌تونم کمکت کنم؟');
});

test('a greeting inside an existing call does not restart introductions',()=>{
  assert.equal(
    resolveForzaQuickVoiceReply('درود',[
      {role:'user',text:'برای خط تولید تسمه تایمینگ می‌خواهم'},
      {role:'model',text:'عرض تسمه را بفرمایید.'},
    ]),
    'صدات رو دارم؛ بفرما، ادامه بده.',
  );
});

test('technical questions and greetings embedded in real requests still go to the model',()=>{
  assert.equal(resolveForzaQuickVoiceReply('سلام، تسمه تایمینگ عرض ۲۰ میلی‌متر',[]),null);
  assert.equal(resolveForzaQuickVoiceReply('برای خط تولید بلبرینگ می‌خواهم',[]),null);
  assert.equal(resolveForzaQuickVoiceReply('کد 6203 ZZ را بررسی کن',[]),null);
});
