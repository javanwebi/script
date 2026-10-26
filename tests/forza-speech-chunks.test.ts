import test from 'node:test';
import assert from 'node:assert/strict';
import {forzaSpeechChunks} from '../src/utils/forzaSpeechChunks';
test('long Persian replies preserve all words and technical codes within request bounds',()=>{
 const text=('برای تسمه 8M و بلبرینگ 6205-2RS ابعاد و شرایط نصب را بررسی کنید. ').repeat(80).trim();
 const chunks=forzaSpeechChunks(text);
 assert.ok(chunks.length>1); assert.ok(chunks.every(c=>c.length<=240));
 assert.equal(chunks.join(' '),text);
});
test('empty text and pathological unbroken tokens are bounded',()=>{
 assert.deepEqual(forzaSpeechChunks('  '),[]);
 const chunks=forzaSpeechChunks('x'.repeat(2000));
 assert.equal(chunks.join(''),'x'.repeat(2000));assert.ok(chunks.every(c=>c.length<=240));
 assert.throws(()=>forzaSpeechChunks('text',0));
});

import { forzaFastStartSpeechChunks } from '../src/utils/forzaSpeechChunks';
import { FORZA_GREETING_TEXT } from '../src/utils/forzaGreeting';

test('short opening speech is prioritized while preserving longer reply wording', () => {
 const answer = ('برای بررسی دقیق تسمه و پولی نیاز به کد فنی و اندازه دارید. ').repeat(12).trim();
 const chunks = forzaFastStartSpeechChunks(answer);
 assert.ok(chunks.length > 1);
 assert.ok(chunks[0].length <= 96, 'first TTS payload should be short');
 assert.ok(chunks.slice(1).every(chunk => chunk.length <= 240));
 assert.equal(chunks.join(' '), answer);
 assert.deepEqual(forzaFastStartSpeechChunks('   '), []);
});

test('FORZA greeting is solely a welcome and has no spoken voice instructions', () => {
 assert.match(FORZA_GREETING_TEXT, /خوش آمدید/);
 assert.doesNotMatch(FORZA_GREETING_TEXT, /با صدای|مرد ایرانی|لحن|دستورالعمل|گوینده/);
});
