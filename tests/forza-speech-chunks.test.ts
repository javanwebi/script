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
