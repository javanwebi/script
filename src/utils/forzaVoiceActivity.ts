/**
 * Lightweight microphone voice activity detector.
 * Uses actual PCM RMS from the browser's analyser, not visual animation.
 * Its noise floor adapts ONLY during silence, so quiet microphones work
 * without mistaking steady fan noise for speech.
 */
export class ForzaVoiceActivity {
  private floor = 0.004;
  private voicedFrames = 0;
  private detected = false;
  private lastSpeechAt = 0;

  sample(rms: number, timestampMs: number): {
    speaking: boolean;
    speechStarted: boolean;
    silenceMs: number;
    level: number;
  } {
    const energy = Number.isFinite(rms) ? Math.max(0, Math.min(1, rms)) : 0;
    const threshold = Math.max(0.008, this.floor * 2.8);
    const audible = energy > threshold;
    if (!audible && !this.detected) {
      this.floor = this.floor * 0.97 + energy * 0.03;
    }
    let speechStarted = false;
    if (audible) {
      this.voicedFrames = Math.min(this.voicedFrames + 1, 12);
      if (this.voicedFrames >= 5) {
        speechStarted = !this.detected;
        this.detected = true;
        this.lastSpeechAt = timestampMs;
      }
    } else {
      this.voicedFrames = 0;
    }
    const speaking = this.detected && audible;
    return {
      speaking,
      speechStarted,
      silenceMs: this.detected ? Math.max(0, timestampMs - this.lastSpeechAt) : 0,
      level: Math.min(1, energy * 18),
    };
  }

  reset() {
    this.detected = false;
    this.voicedFrames = 0;
    this.lastSpeechAt = 0;
  }

  get heardSpeech() { return this.detected; }
}

export function rootMeanSquareFromTimeDomain(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let total = 0;
  for (const value of samples) {
    const normalized = (value - 128) / 128;
    total += normalized * normalized;
  }
  return Math.sqrt(total / samples.length);
}
