import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyForzaAudio, isRiffWaveAudio } from '../src/utils/forzaTtsFormat.ts';

test('Gemini WAV frames are passed through and never double-wrapped', () => {
  const wav = new Uint8Array(48);
  const put = (offset:number, value:string) => {
    [...value].forEach((ch,i) => {wav[offset+i] = ch.charCodeAt(0)});
  };
  put(0,'RIFF'); put(8,'WAVE'); put(12,'fmt '); put(36,'data');
  assert.equal(isRiffWaveAudio(wav),true);
  assert.equal(classifyForzaAudio(wav,'audio/L16;rate=24000'),'wav');
  assert.equal(classifyForzaAudio(wav,'audio/wav'),'wav');
});

test('raw PCM16 only is wrapped into WAV, not MP3 or invalid bytes', () => {
  assert.equal(classifyForzaAudio(Uint8Array.of(0,255,1,255),'audio/L16;rate=24000'),'pcm16');
  assert.equal(classifyForzaAudio(Uint8Array.of(0,255,1,255),'audio/pcm'),'pcm16');
  assert.equal(classifyForzaAudio(Uint8Array.of(0,255,1),'audio/pcm'),'unsupported');
  assert.equal(classifyForzaAudio(Uint8Array.of(73,68,51,0),'audio/mpeg'),'unsupported');
  assert.equal(classifyForzaAudio(Uint8Array.of(),'audio/wav'),'unsupported');
});
