// Converts the already foreground-gated mono stream to 16 kHz PCM16.
// This node never receives the physical microphone directly. It is connected
// only to the output of forza-foreground-gate and emits bounded 200 ms frames.
class ForzaSttPcmTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = 16000 / sampleRate;
    this.phase = 0;
    this.lowPass = 0;
    this.lowPassAlpha = 1 - Math.exp(-2 * Math.PI * 7200 / sampleRate);
    this.chunk = new Int16Array(3200); // 200 ms at 16 kHz
    this.chunkAt = 0;
    this.silenceChunks = 0;
  }

  emitChunk() {
    let energy = 0;
    for (let i = 0; i < this.chunk.length; i += 1) {
      const value = this.chunk[i] / 32768;
      energy += value * value;
    }
    const rms = Math.sqrt(energy / this.chunk.length);
    if (rms >= 0.00008) this.silenceChunks = 8; // 1.6 s of endpointing silence
    if (this.silenceChunks > 0) {
      const transferable = this.chunk.buffer;
      this.port.postMessage({ type: 'pcm', pcm: transferable }, [transferable]);
      this.silenceChunks -= 1;
    }
    this.chunk = new Int16Array(3200);
    this.chunkAt = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (output) output.fill(0);
    if (!input) return true;

    for (let i = 0; i < input.length; i += 1) {
      const raw = Number.isFinite(input[i]) ? input[i] : 0;
      this.lowPass += this.lowPassAlpha * (raw - this.lowPass);
      this.phase += this.ratio;
      if (this.phase >= 1) {
        this.phase -= 1;
        const sample = Math.max(-1, Math.min(1, this.lowPass));
        this.chunk[this.chunkAt++] = sample < 0
          ? Math.round(sample * 32768)
          : Math.round(sample * 32767);
        if (this.chunkAt >= this.chunk.length) this.emitChunk();
      }
    }
    return true;
  }
}

registerProcessor('forza-stt-pcm-tap', ForzaSttPcmTap);
