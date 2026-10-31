'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { FramedWavMeter, wavAudioMs } = require('../scripts/tests/forza-pocket-vps-ttfb.cjs');

function wav(samples = 12000) {
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(24000, 24);
  buf.writeUInt32LE(48000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}
function frame(w) {
  const buffer = Buffer.alloc(4 + w.length);
  buffer.writeUInt32LE(w.length, 0);
  w.copy(buffer, 4);
  return buffer;
}

test('measure exact PCM WAV duration without looking at HTTP transfer bytes', () => {
  assert.equal(wavAudioMs(wav()), 500);
  assert.equal(wavAudioMs(wav(24000)), 1000);
});
test('parse two frames split arbitrarily across network chunks', () => {
  const all = Buffer.concat([frame(wav()), frame(wav(24000))]);
  const meter = new FramedWavMeter();
  let i = 0;
  for (const step of [1, 2, 3, 5, 8, 13, 21, 7, 170, 500, 1, 20000, 40000]) {
    if (i >= all.length) break;
    meter.push(all.subarray(i, Math.min(all.length, i + step)), 150 + i / 100);
    i += step;
  }
  if (i < all.length) meter.push(all.subarray(i), 900);
  const result = meter.finish();
  assert.equal(result.frames, 2);
  assert.equal(result.audioMs, 1500);
  assert.equal(result.bytes, all.length);
  assert.ok(result.firstFrameMs >= 150);
});
test('reject non-24kHz, non-original voice formats and truncation', () => {
  const wrong = wav();
  wrong.writeUInt32LE(16000, 24);
  assert.throws(() => wavAudioMs(wrong), /not_original_pocket/);
  const meter = new FramedWavMeter();
  const f = frame(wav());
  meter.push(f.subarray(0, f.length - 2), 123);
  assert.throws(() => meter.finish(), /truncated_or_empty/);
});
test('reject suspiciously large WAV lengths before allocating', () => {
  const bad = Buffer.alloc(4);
  bad.writeUInt32LE(100000000, 0);
  assert.throws(() => new FramedWavMeter().push(bad, 20), /invalid_framed_wav_size/);
});
test('live VPS wrapper must never replace or restart selected voice', () => {
  const shell = readFileSync(new URL('../ops/forza-pocket-live-ttfb-vps.sh', 'file://' + __filename), 'utf8');
  assert.match(shell, /31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833/);
  assert.match(shell, /forza-pocket-vps-ttfb\.cjs/);
  assert.match(shell, /WAV_disk_writes=0/);
  for (const forbidden of [
    'docker restart', 'docker stop', 'docker rm', 'docker build',
    'docker volume rm', 'docker system prune', 'docker image rm',
    'npm install', 'pip install', 'curl -o', 'writeFileSync',
  ]) assert.ok(!shell.includes(forbidden), 'unsafe shell operation: ' + forbidden);
});
