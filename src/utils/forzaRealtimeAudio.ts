/**
 * Raw PCM codec for the low-latency FORZA Live WebSocket.
 * Browser microphone audio is resampled to mono 16kHz signed little-endian PCM.
 * Google Live sends raw PCM at 24kHz. Never send MediaRecorder WebM bytes as PCM.
 */
export const FORZA_INPUT_RATE = 16000;
export const FORZA_OUTPUT_RATE = 24000;
export const FORZA_MAX_SOCKET_BUFFER = 512 * 1024;

export class StreamingPcmResampler {
  private phase = 0;
  private previous = 0;
  private readonly ratio: number;

  constructor(inputRate: number, outputRate = FORZA_INPUT_RATE) {
    if (!Number.isFinite(inputRate) || inputRate < 8000 || !Number.isFinite(outputRate) || outputRate <= 0) {
      throw new Error('Invalid microphone sample rate');
    }
    this.ratio = inputRate / outputRate;
  }

  convert(input: Float32Array): Int16Array {
    if (!input.length) return new Int16Array();
    const output: number[] = [];
    let position = this.phase;
    while (position < input.length - 1) {
      const left = Math.floor(position);
      const fraction = position - left;
      const a = left < 0 ? this.previous : input[left];
      const b = input[left + 1];
      const sample = Math.max(-1, Math.min(1, a + (b - a) * fraction));
      output.push(sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767));
      position += this.ratio;
    }
    this.phase = position - input.length;
    this.previous = input[input.length - 1];
    return Int16Array.from(output);
  }
}

export function encodePcm16Base64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decodePcm16Base64(base64: string): Float32Array {
  const binary = atob(base64);
  if (binary.length % 2) throw new Error('Invalid PCM frame size');
  const samples = new Float32Array(binary.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const lo = binary.charCodeAt(2 * i);
    const hi = binary.charCodeAt(2 * i + 1);
    const unsigned = lo | (hi << 8);
    const value = unsigned >= 32768 ? unsigned - 65536 : unsigned;
    samples[i] = value / 32768;
  }
  return samples;
}

export function audioSampleRate(mimeType: string, fallback = FORZA_OUTPUT_RATE): number {
  const matched = /(?:^|;)rate=(\d+)/i.exec(mimeType || '');
  const value = matched ? Number(matched[1]) : fallback;
  return value >= 8000 && value <= 96000 ? value : fallback;
}

/** Do not queue seconds of old audio: a congested connection should fail visibly. */
export function mayQueueMicrophoneFrame(readyState: number, bufferedAmount: number): boolean {
  return readyState === 1 && bufferedAmount <= FORZA_MAX_SOCKET_BUFFER;
}