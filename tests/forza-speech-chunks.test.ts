import test from 'node:test';
import assert from 'node:assert/strict';
import {forzaSpeechChunks, forzaFastStartSpeechChunks} from '../src/utils/forzaSpeechChunks';
import {takeSpeakablePhrase} from '../src/utils/forzaStreamingSpeech';
import { FORZA_GREETING_TEXT } from '../src/utils/forzaGreeting';

test('long Persian replies preserve all words and technical codes within request bounds',()=>{
 const text=('برای تسمه 8M و بلبرینگ 6205-2RS ابعاد و شرایط نصب را بررسی کنید. ').repeat(80).trim();
 const chunks=forzaSpeechChunks(text);
 assert.ok(chunks.length>1); assert.ok(chunks.every(c=>c.length<=220));
 assert.equal(chunks.join(' '),text);
});
test('empty text and pathological unbroken tokens are bounded',()=>{
 assert.deepEqual(forzaSpeechChunks('  '),[]);
 const chunks=forzaSpeechChunks('x'.repeat(2000));
 assert.equal(chunks.join(''),'x'.repeat(2000));assert.ok(chunks.every(c=>c.length<=220));
 assert.throws(()=>forzaSpeechChunks('text',0));
});

test('short opening speech is prioritized while preserving longer reply wording', () => {
 const answer = ('برای بررسی دقیق تسمه و پولی نیاز به کد فنی و اندازه دارید. ').repeat(12).trim();
 const chunks = forzaFastStartSpeechChunks(answer);
 assert.ok(chunks.length > 1);
 assert.ok(chunks[0].length <= 96, 'first TTS payload should be short');
 assert.ok(chunks.slice(1).every(chunk => chunk.length <= 220));
 assert.equal(chunks.join(' '), answer);
 assert.deepEqual(forzaFastStartSpeechChunks('   '), []);
});

test('first speakable phrase is released before a 40-character buffer when a safe boundary exists',()=>{
 const ready=takeSpeakablePhrase('سلام، قطعه شما پیدا شد. برای بررسی کد فنی را بفرمایید.',true);
 assert.equal(ready?.phrase,'سلام، قطعه شما پیدا شد.');
 assert.equal(ready?.rest,'برای بررسی کد فنی را بفرمایید.');
});

test('first speakable phrase can start at a shorter complete word boundary',()=>{
 const ready=takeSpeakablePhrase('این قطعه در کاتالوگ ثبت شده و آماده بررسی است',true);
 assert.ok(ready);
 assert.ok((ready?.phrase.length||0)<40);
 assert.ok(ready?.rest.length);
});

test('FORZA greeting is solely a welcome and has no spoken voice instructions', () => {
 assert.match(FORZA_GREETING_TEXT, /خوش آمدید/);
 assert.doesNotMatch(FORZA_GREETING_TEXT, /با صدای|مرد ایرانی|لحن|دستورالعمل|گوینده/);
});
