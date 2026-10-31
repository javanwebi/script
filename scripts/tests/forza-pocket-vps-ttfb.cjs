#!/usr/bin/env node
'use strict';
/**
 * Built-in Node.js only. Measure original Pocket Farsi first WAV frame through
 * (a) private HTTP service and (b) real Express proxy on live Ubuntu VPS.
 * Neither customer text nor WAV is ever saved to disk. Test uses fixed
 * non-customer text; does not change any process, model, voice or env.
 */
const { performance } = require('node:perf_hooks');

const EXPECTED_VOICE = 'pocket-farsi-v2';
const SHORT = 'لطفاً کد فنی قطعه را بفرمایید.';
const MEDIUM = 'برای بررسی تسمه صنعتی، کد و مشخصات روی قطعه را بفرمایید تا بتوانم محصول مناسب را پیشنهاد کنم.';

function wavAudioMs(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' ||
      buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not_riff_wav');
  }
  let cursor = 12, rate = 0, channels = 0, bits = 0, dataSize = -1;
  while (cursor + 8 <= buf.length) {
    const id = buf.toString('ascii', cursor, cursor + 4);
    const size = buf.readUInt32LE(cursor + 4);
    if (size > buf.length - cursor - 8) throw new Error('wav_truncated_chunk');
    if (id === 'fmt ') {
      if (size < 16 || buf.readUInt16LE(cursor + 8) !== 1)
        throw new Error('wav_not_pcm');
      channels = buf.readUInt16LE(cursor + 10);
      rate = buf.readUInt32LE(cursor + 12);
      bits = buf.readUInt16LE(cursor + 22);
    } else if (id === 'data') {
      dataSize = size;
    }
    cursor += 8 + size + (size % 2);
  }
  if (rate !== 24000 || channels !== 1 || bits !== 16 || dataSize < 100)
    throw new Error('not_original_pocket_24khz_mono_pcm16');
  return dataSize / 48;
}

class FramedWavMeter {
  constructor() {
    this.pending = Buffer.alloc(0);
    this.frameLength = -1;
    this.frames = 0;
    this.audioMs = 0;
    this.firstFrameMs = null;
    this.bytes = 0;
  }
  push(data, elapsedMs) {
    const part = Buffer.from(data);
    this.bytes += part.length;
    if (this.bytes > 32000000) throw new Error('stream_exceeds_32mb');
    this.pending = Buffer.concat([this.pending, part]);
    for (;;) {
      if (this.frameLength < 0) {
        if (this.pending.length < 4) break;
        this.frameLength = this.pending.readUInt32LE(0);
        this.pending = this.pending.subarray(4);
        if (this.frameLength < 44 || this.frameLength > 8000000)
          throw new Error('invalid_framed_wav_size');
      }
      if (this.pending.length < this.frameLength) break;
      const wav = this.pending.subarray(0, this.frameLength);
      this.audioMs += wavAudioMs(wav);
      if (this.firstFrameMs === null) this.firstFrameMs = elapsedMs;
      this.frames++;
      if (this.frames > 256) throw new Error('too_many_wav_frames');
      this.pending = this.pending.subarray(this.frameLength);
      this.frameLength = -1;
    }
  }
  finish() {
    if (this.frameLength !== -1 || this.pending.length !== 0 || this.frames === 0)
      throw new Error('truncated_or_empty_framed_stream');
    return this;
  }
}

async function bench(label, url, text, extraHeaders = {}) {
  const start = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(150000),
  });
  const headersMs = performance.now() - start;
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = typeof data.error === 'string' ? data.error.slice(0, 80) : 'unknown';
    throw new Error('http_' + response.status + '_' + reason);
  }
  if (response.headers.get('x-forza-voice') !== EXPECTED_VOICE)
    throw new Error('unexpected_voice');
  if (!(response.headers.get('content-type') || '').includes('application/x-forza-wav-frames'))
    throw new Error('wrong_stream_media_type');
  if (!response.body) throw new Error('missing_audio_body');
  const meter = new FramedWavMeter();
  let firstBytesMs = null;
  for await (const chunk of response.body) {
    const now = performance.now() - start;
    if (firstBytesMs === null) firstBytesMs = now;
    meter.push(chunk, now);
  }
  meter.finish();
  const totalMs = performance.now() - start;
  const result = {
    label,
    first_ms: Math.round(meter.firstFrameMs),
    headers_ms: Math.round(headersMs),
    first_bytes_ms: Math.round(firstBytesMs ?? totalMs),
    total_ms: Math.round(totalMs),
    audio_seconds: +(meter.audioMs / 1000).toFixed(3),
    rtf: +(totalMs / meter.audioMs).toFixed(3),
    frames: meter.frames,
    bytes: meter.bytes,
  };
  console.log(
    'FORZA_POCKET_VPS_RESULT route=' + label +
    ' first_ms=' + result.first_ms +
    ' headers_ms=' + result.headers_ms +
    ' total_ms=' + result.total_ms +
    ' audio_seconds=' + result.audio_seconds +
    ' rtf=' + result.rtf +
    ' frames=' + result.frames +
    ' bytes=' + result.bytes +
    ' pass_1000ms=' + (result.first_ms < 1000 ? 1 : 0),
  );
  return result;
}

async function inspectPrivate(base) {
  const r = await fetch(base + '/health', { signal: AbortSignal.timeout(5000) });
  const data = await r.json();
  if (!r.ok || data.voice !== EXPECTED_VOICE || !data.ok)
    throw new Error('private_health_not_original_pocket');
  console.log('FORZA_POCKET_VPS_HEALTH private_voice=' + data.voice + ' ready=1');
}

async function main() {
  const mode = process.env.FORZA_PROBE_MODE || 'both';
  if (!['both', 'proxy', 'private'].includes(mode)) throw new Error('invalid_mode');
  const privateBase = (process.env.FORZA_VOICE_INTERNAL_URL || '').trim().replace(/\/$/, '');
  const token = process.env.FORZA_VOICE_TOKEN || '';
  const proxyBase = process.env.FORZA_PROBE_PROXY_URL || 'http://127.0.0.1:3001';
  const samples = [{ name: 'short', text: SHORT }];
  if (process.env.FORZA_PROBE_EXTENDED === '1')
    samples.push({ name: 'medium', text: MEDIUM });
  const results = [];
  let errors = 0;

  console.log('FORZA_POCKET_VPS_START mode=' + mode + ' samples=' + samples.length +
    ' no_disk_audio=1 voice=' + EXPECTED_VOICE);
  if (mode !== 'proxy' && (!privateBase || !token)) {
    console.log('FORZA_POCKET_VPS_NOTICE private_service_env_not_in_app_container=1');
  }
  for (const sample of samples) {
    const runs = [];
    if (mode !== 'proxy' && privateBase && token)
      runs.push({
        label: 'private_' + sample.name,
        url: privateBase + '/speak-stream',
        headers: { 'X-Forza-Voice-Token': token },
      });
    if (mode !== 'private')
      runs.push({
        label: 'proxy_' + sample.name,
        url: proxyBase + '/api/ai/forza-speech-stream',
        headers: {},
      });
    for (const run of runs) {
      try {
        if (run.label.startsWith('private_')) await inspectPrivate(privateBase);
        results.push(await bench(run.label, run.url, sample.text, run.headers));
      } catch (error) {
        errors++;
        const code = String(error?.message || error?.name || 'unknown').slice(0, 90);
        console.log('FORZA_POCKET_VPS_ERROR route=' + run.label + ' code=' + code);
      }
    }
  }

  const direct = results.find(r => r.label === 'private_short');
  const proxy = results.find(r => r.label === 'proxy_short');
  if (direct && proxy)
    console.log('FORZA_POCKET_VPS_COMPARE proxy_minus_private_first_ms=' +
      (proxy.first_ms - direct.first_ms) + ' result=single_sample_not_statistically_conclusive');
  const earliest = results.length ? Math.min(...results.map(r => r.first_ms)) : -1;
  console.log('FORZA_POCKET_VPS_DECISION fastest_first_ms=' + earliest +
    ' goal_under_1000ms=' + (earliest >= 0 && earliest < 1000 ? 1 : 0) +
    ' tests_ok=' + results.length + ' errors=' + errors +
    ' same_original_voice=1 customer_audio_written_to_disk=0');
  if (!results.length || errors) process.exitCode = 1;
}

if (process.argv[1] === '-' || require.main === module) {
  main().catch(error => {
    console.error('FORZA_POCKET_VPS_FATAL code=' + String(error?.message || 'unexpected').slice(0, 90));
    process.exitCode = 1;
  });
}
module.exports = { wavAudioMs, FramedWavMeter };
