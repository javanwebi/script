import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeServerAmir } from '../src/services/forzaAmirServerSpeech';

test('same-origin server Piper produces genuine Amir WAV',async()=>{
 const started=performance.now();
 const wav=await synthesizeServerAmir('سَلام، بِه صَنعَتِ پیش خُوش آمَدید.');
 assert.ok(wav.length>44);
 assert.equal(wav.toString('ascii',0,4),'RIFF');
 assert.equal(wav.toString('ascii',8,12),'WAVE');
 assert.ok(performance.now()-started<11000);
 const cache=await synthesizeServerAmir('سَلام، بِه صَنعَتِ پیش خُوش آمَدید.');
 assert.strictEqual(cache,wav,'Repeated phrase must reuse server PCM without spawning Piper again');
});
test('Reject blank or giant incoming TTS text',async()=>{
 await assert.rejects(()=>synthesizeServerAmir(' '),/amir_server_invalid_text/);
 await assert.rejects(()=>synthesizeServerAmir('x'.repeat(241)),/amir_server_invalid_text/);
});

test('Warm Amir worker reads all distinct phrases without reloading the neural model',async()=>{
 const phrases=[
  'سلام، درخواست شما دریافت شد.',
  'مشخصات فنی تسمه را اعلام کنید.',
  'قطعه انتخاب شده باید با کد کالا مطابقت داشته باشد.',
 ];
 const started=performance.now();
 const audio=await Promise.all(phrases.map(p=>synthesizeServerAmir(p)));
 assert.equal(audio.length,phrases.length);
 for(const wav of audio){
  assert.ok(wav.length>44);
  assert.equal(wav.toString('ascii',0,4),'RIFF');
 }
 assert.ok(performance.now()-started<16000,'warm voice worker must not respawn a new model for each phrase');
});
