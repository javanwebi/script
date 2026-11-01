import test from 'node:test';
import assert from 'node:assert/strict';
import {playForzaWholeAnswer} from '../src/utils/forzaWholeAnswerSpeech';

test('punctuation and multiple sentences cause only ONE Nima TTS request and ONE WAV playback',async()=>{
  const answer='سلام! برای خرید قطعه صنعتی چه مدلی نیاز دارید؟ '+
    'تسمه SPB 1250، بلبرینگ 6205.2RS و مشخصات دیگر را بفرمایید.';
  const submitted:string[]=[];
  const scheduled:Uint8Array[]=[];
  const wav=new Uint8Array([82,73,70,70,99]);
  await playForzaWholeAnswer(answer,
    async text=>{submitted.push(text);return wav;},
    {enqueueWav:async bytes=>{scheduled.push(bytes)}});
  assert.deepEqual(submitted,[answer]);
  assert.equal(scheduled.length,1);
  assert.equal(scheduled[0],wav);
});

test('whole-answer speech waits for ONE real audio onended Promise, not just source scheduling',async()=>{
  let release!:()=>void;
  const finishedAudio=new Promise<void>(r=>{release=r});
  let completed=false;
  const playing=playForzaWholeAnswer('متن کامل',
    async()=>new Uint8Array([1]),
    {enqueueWav:()=>finishedAudio}).then(()=>{completed=true});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(completed,false,'must not reopen mic before PCM actually ends');
  release();
  await playing;
  assert.equal(completed,true);
});

test('a failed TTS request does not create partial audio or falsely mark speech done',async()=>{
  let queued=0;
  await assert.rejects(playForzaWholeAnswer('سلام. وقت بخیر.',
    async()=>{throw new Error('private_voice_busy')},
    {enqueueWav:async()=>{queued++}}),/private_voice_busy/);
  assert.equal(queued,0);
});

test('aborted conversation never schedules late audio or sends an extra TTS request',async()=>{
  const controller=new AbortController();
  let release!:(wav:Uint8Array)=>void;
  let count=0,scheduled=0;
  const work=playForzaWholeAnswer('همین درخواست',
    async()=>{count++;return new Promise(resolve=>{release=resolve})},
    {enqueueWav:async()=>{scheduled++}},controller.signal);
  await new Promise(resolve=>setTimeout(resolve,0));
  controller.abort();
  release(new Uint8Array([1]));
  await assert.rejects(work,/aborted/);
  assert.equal(count,1);
  assert.equal(scheduled,0);
});

test('empty or already cancelled answer never starts the Piper service',async()=>{
  let count=0;
  const synth=async()=>{count++;return new Uint8Array(1)};
  const player={enqueueWav:async()=>{}};
  await assert.rejects(playForzaWholeAnswer('  ',synth,player),/empty_answer/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(playForzaWholeAnswer('جواب',synth,player,controller.signal),/aborted/);
  assert.equal(count,0);
});
