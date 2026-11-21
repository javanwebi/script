// Foreground-only microphone gate for FORZA.
// Runs before STT. Only bounded acoustic features cross the worklet port;
// raw PCM stays inside the browser audio graph and is emitted only when the
// foreground gate opens. A single mono microphone cannot guarantee physical
// distance or separate overlapping speakers, so ambiguous/low-SNR frames fail closed.
class ForzaForegroundGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = Math.max(160, Math.round(sampleRate * 0.02));
    this.frame = new Float32Array(this.frameSize);
    this.frameAt = 0;
    this.writeIndex = 0;
    this.delaySamples = this.frameSize * 4; // 80ms look-ahead preserves word onsets.
    this.ringSize = this.frameSize * 6 + 512;
    this.audioRing = new Float32Array(this.ringSize);
    this.maskRing = new Uint8Array(this.ringSize);
    this.frameRanges = [];
    this.pitchHistory = new Float32Array(this.frameSize * 2);
    this.pitchWrite = 0;
    this.pitchCount = 0;
    this.frames = [];
    this.inFlight = false;

    this.lp180 = 0;
    this.lp2200 = 0;
    this.lp3800 = 0;
    this.lp6500 = 0;
    this.a180 = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
    this.a2200 = 1 - Math.exp(-2 * Math.PI * 2200 / sampleRate);
    this.a3800 = 1 - Math.exp(-2 * Math.PI * Math.min(3800, sampleRate * 0.42) / sampleRate);
    this.a6500 = 1 - Math.exp(-2 * Math.PI * Math.min(6500, sampleRate * 0.44) / sampleRate);

    this.noiseSpeech = 0.00035;
    this.noiseHigh = 0.00012;
    this.noiseSpeechHistory = [];
    this.noiseHighHistory = [];
    this.attackFrames = 0;
    this.releaseFrames = 0;
    this.gateOpen = false;
    this.outputGain = 0;
    this.frameCounter = 0;
    this.port.onmessage = () => { this.inFlight = false; };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  percentile(values, p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * p)];
  }

  periodicity(samples) {
    const step = Math.max(1, Math.floor(sampleRate / 8000));
    const rate = sampleRate / step;
    const down = [];
    for (let i = 0; i < samples.length; i += step) down.push(samples[i]);
    const minLag = Math.max(2, Math.floor(rate / 360));
    const maxLag = Math.min(Math.floor(rate / 75), Math.floor(down.length * 0.45));
    const correlations = [];
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let cross = 0, left = 0, right = 0;
      for (let i = lag; i < down.length; i += 2) {
        const a = down[i], b = down[i - lag];
        cross += a * b;
        left += a * a;
        right += b * b;
      }
      const score = this.clamp(cross / Math.sqrt(Math.max(1e-12, left * right)), 0, 1);
      correlations.push({ lag, score });
    }
    // Keep local maxima only; adjacent lags around one broad pitch peak are
    // not evidence of a second speaker.
    const peaks = correlations.filter((peak, index) =>
      peak.score >= (correlations[index - 1]?.score ?? -1) &&
      peak.score >= (correlations[index + 1]?.score ?? -1)
    ).sort((a, b) => b.score - a.score);
    const primary = peaks[0] || { lag: 0, score: 0 };
    const secondary = peaks.find(peak => {
      if (peak === primary ||
          Math.abs(peak.lag - primary.lag) < Math.max(4, primary.lag * 0.16) ||
          peak.score < Math.max(0.18, primary.score * 0.55)) return false;
      const ratio = peak.lag / Math.max(1, primary.lag);
      const inverse = 1 / Math.max(0.001, ratio);
      const harmonic = [2, 3, 4].some(value =>
        Math.abs(ratio - value) < 0.12 || Math.abs(inverse - value) < 0.12
      );
      return !harmonic;
    });
    // Two strong non-harmonic pitch periods usually indicate overlapping voices.
    // A mono microphone cannot separate them safely, so ambiguous mixtures fail closed.
    return { score: primary.score, overlap: Boolean(secondary) };
  }

  analyzeFrame() {
    let rawEnergy = 0, speechEnergy = 0, highEnergy = 0;
    let peak = 0, crossings = 0, previous = 0;
    const speechSamples = new Float32Array(this.frameSize);
    for (let i = 0; i < this.frameSize; i += 1) {
      const x = this.frame[i];
      rawEnergy += x * x;
      peak = Math.max(peak, Math.abs(x));
      this.lp180 += this.a180 * (x - this.lp180);
      const highPassed = x - this.lp180;
      this.lp2200 += this.a2200 * (highPassed - this.lp2200);
      this.lp3800 += this.a3800 * (highPassed - this.lp3800);
      this.lp6500 += this.a6500 * (highPassed - this.lp6500);
      const speech = this.lp3800;
      const high = this.lp6500 - this.lp2200;
      speechSamples[i] = speech;
      speechEnergy += speech * speech;
      highEnergy += high * high;
      if (i > 0 && ((speech >= 0 && previous < 0) || (speech < 0 && previous >= 0))) crossings += 1;
      previous = speech;
    }
    const rms = Math.sqrt(rawEnergy / this.frameSize);
    const speechRms = Math.sqrt(speechEnergy / this.frameSize);
    const highRms = Math.sqrt(highEnergy / this.frameSize);
    const zcr = crossings / Math.max(1, this.frameSize - 1);
    for (let i = 0; i < speechSamples.length; i += 1) {
      this.pitchHistory[this.pitchWrite] = speechSamples[i];
      this.pitchWrite = (this.pitchWrite + 1) % this.pitchHistory.length;
      this.pitchCount = Math.min(this.pitchHistory.length, this.pitchCount + 1);
    }
    const pitchSamples = new Float32Array(this.pitchCount);
    const pitchStart = (this.pitchWrite - this.pitchCount + this.pitchHistory.length) % this.pitchHistory.length;
    for (let i = 0; i < this.pitchCount; i += 1) {
      pitchSamples[i] = this.pitchHistory[(pitchStart + i) % this.pitchHistory.length];
    }
    const voice = this.periodicity(pitchSamples);
    const voicePeriodicity = voice.score;
    const speechSnrDb = 20 * Math.log10((speechRms + 1e-7) / Math.max(0.00025, this.noiseSpeech));
    const highSnrDb = 20 * Math.log10((highRms + 1e-7) / Math.max(0.00010, this.noiseHigh));
    const highRatio = highRms / Math.max(1e-6, speechRms);
    const snrScore = this.clamp((speechSnrDb - 7) / 18, 0, 1);
    const detailScore = this.clamp((highSnrDb - 1) / 14, 0, 1);
    const voiceScore = this.clamp((voicePeriodicity - 0.04) / 0.50, 0, 1);
    const score = 0.58 * snrScore + 0.25 * detailScore + 0.17 * voiceScore;
    const voiceLike = zcr >= 0.006 && zcr <= 0.34 &&
      (voicePeriodicity >= 0.10 || highRatio >= 0.13);
    const candidate = speechSnrDb >= 11 && highSnrDb >= 2 &&
      score >= 0.42 && voiceLike && !voice.overlap && speechRms >= 0.00055;
    const preRollEligible = speechSnrDb >= 10 && highSnrDb >= 2 &&
      speechRms >= 0.00035 && (voicePeriodicity >= 0.06 || highRatio >= 0.12) && !voice.overlap;

    if (!candidate && !this.gateOpen) {
      this.noiseSpeechHistory.push(speechRms);
      this.noiseHighHistory.push(highRms);
      if (this.noiseSpeechHistory.length > 70) this.noiseSpeechHistory.shift();
      if (this.noiseHighHistory.length > 70) this.noiseHighHistory.shift();
      if (this.noiseSpeechHistory.length >= 8) {
        this.noiseSpeech = this.clamp(this.percentile(this.noiseSpeechHistory, 0.2), 0.00025, 0.04);
        this.noiseHigh = this.clamp(this.percentile(this.noiseHighHistory, 0.2), 0.00010, 0.03);
      }
    }

    return { rms, speechRms, highRms, speechSnrDb, highSnrDb, voicePeriodicity, zcr, score, candidate, preRollEligible, overlap: voice.overlap };
  }

  markRange(range) {
    for (let index = range.start; index <= range.end; index += 1) {
      this.maskRing[index % this.ringSize] = 1;
    }
  }

  clearRange(range) {
    for (let index = range.start; index <= range.end; index += 1) {
      this.maskRing[index % this.ringSize] = 0;
    }
  }

  finishFrame(timestamp) {
    const features = this.analyzeFrame();
    const start = this.writeIndex - this.frameSize;
    const range = { start, end: this.writeIndex - 1, eligible: features.preRollEligible };

    if (features.overlap) {
      // A mono mix with two independent pitch tracks is ambiguous. Fail closed
      // immediately and clear buffered overlap so it cannot leak through the delay.
      this.attackFrames = 0;
      this.releaseFrames = 0;
      this.gateOpen = false;
      this.outputGain = 0;
      for (const previous of this.frameRanges) this.clearRange(previous);
      this.frameRanges = [];
    } else {
      this.frameRanges.push(range);
      if (this.frameRanges.length > 4) this.frameRanges.shift();

      if (features.candidate) {
        this.attackFrames += 1;
        if (this.attackFrames >= 2) {
          this.gateOpen = true;
          this.releaseFrames = 10; // Keep unvoiced consonants and short word gaps.
        }
      } else {
        this.attackFrames = 0;
        if (this.gateOpen && this.releaseFrames > 0) this.releaseFrames -= 1;
        else if (this.releaseFrames <= 0) this.gateOpen = false;
      }

      if (this.gateOpen) {
        // The fixed 80ms output delay lets a confirmed onset release its pre-roll.
        for (const previous of this.frameRanges.slice(-3)) {
          if (previous.eligible) this.markRange(previous);
        }
        // Retain short unvoiced consonants and natural word gaps only while the
        // foreground lock is latched. This release window cannot open the gate.
        if (!features.candidate && this.releaseFrames > 0 &&
            (features.speechRms >= this.noiseSpeech * 1.15 ||
             features.highRms >= this.noiseHigh * 1.3)) {
          this.markRange(range);
        }
      }
    }

    const acceptedRms = this.gateOpen ? features.rms : 0;
    this.frames.push([timestamp, acceptedRms, features.score, this.gateOpen ? 1 : 0]);
    if (this.frames.length > 32) this.frames.shift();
    this.frameCounter += 1;
    this.frameAt = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    if (!input) {
      output.fill(0);
      return true;
    }

    for (let i = 0; i < output.length; i += 1) {
      const x = Number.isFinite(input[i]) ? input[i] : 0;
      const ringIndex = this.writeIndex % this.ringSize;
      this.audioRing[ringIndex] = x;
      this.maskRing[ringIndex] = 0;
      this.frame[this.frameAt] = x;
      this.frameAt += 1;
      this.writeIndex += 1;

      if (this.frameAt >= this.frameSize) {
        this.finishFrame(currentTime + (i + 1) / sampleRate);
      }

      const readIndex = this.writeIndex - this.delaySamples - 1;
      if (readIndex < 0) {
        output[i] = 0;
      } else {
        const readSlot = readIndex % this.ringSize;
        const target = this.maskRing[readSlot] ? 1 : 0;
        const coefficient = target > this.outputGain ? 0.35 : 0.12;
        this.outputGain += (target - this.outputGain) * coefficient;
        output[i] = this.audioRing[readSlot] * this.outputGain;
      }
    }

    if (!this.inFlight && this.frames.length >= 4) {
      this.port.postMessage(this.frames);
      this.frames = [];
      this.inFlight = true;
    }
    return true;
  }
}

registerProcessor('forza-foreground-gate', ForzaForegroundGate);
