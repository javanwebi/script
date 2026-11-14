/**
 * Lightweight microphone voice activity detector.
 * Uses actual PCM RMS from the browser's analyser, not visual animation.
 * Uses a near-field-biased threshold and a short persistence window to reject
 * low-level distant voices and transient exhibition-floor noise. The browser's
 * echo cancellation and noise suppression remain enabled; this is not speaker diarization.
 */
export class ForzaVoiceActivity {
  private floor = 0.004;
  private voicedFrames = 0;
  private detected = false;
  private lastSpeechAt = 0;
  private onsetAt:number|null=null;
  private previousSampleAt:number|null=null;

  sample(rms: number, timestampMs: number, admitted?: boolean): {
    speaking: boolean;
    speechStarted: boolean;
    silenceMs: number;
    level: number;
  } {
    const energy = Number.isFinite(rms) ? Math.max(0, Math.min(1, rms)) : 0;
    const threshold = Math.max(0.008, this.floor * 2.5);
    // Admission already validated duration and signal/noise on the audio thread.
    // Do not reject a quiet admitted utterance with a second absolute threshold.
    const audible = admitted ?? (energy > threshold);
    if (!audible && !this.detected) {
      this.floor = this.floor * 0.97 + energy * 0.03;
    }
    if(this.previousSampleAt!==null&&timestampMs-this.previousSampleAt>150){
      this.voicedFrames=0;this.onsetAt=null;
    }
    this.previousSampleAt=timestampMs;
    let speechStarted = false;
    if (audible) {
      if(this.onsetAt===null)this.onsetAt=timestampMs;
      // Once a turn has started, even a short resumed syllable postpones its end.
      if (this.detected) this.lastSpeechAt = timestampMs;
      this.voicedFrames = Math.min(this.voicedFrames + 1, 12);
      if (admitted === true || (this.voicedFrames >= 3 && timestampMs-this.onsetAt>=100)) {
        speechStarted = !this.detected;
        this.detected = true;
        this.lastSpeechAt = timestampMs;
      }
    } else {
      this.onsetAt=null;
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

  silenceDuration(timestampMs: number) {
    return this.detected ? Math.max(0, timestampMs - this.lastSpeechAt) : 0;
  }

  reset() {
    this.detected = false;
    this.voicedFrames = 0;
    this.lastSpeechAt = 0;
    this.onsetAt=null;this.previousSampleAt=null;
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

/** Float PCM preserves quiet signals below the byte analyser quantization step. */
export function rootMeanSquareFromFloatTimeDomain(samples: Float32Array): number {
  if (!samples.length) return 0;
  let total=0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) return 0;
    total+=sample*sample;
  }
  return Math.sqrt(total/samples.length);
}
