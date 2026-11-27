class ForzaMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = Math.max(1, Math.round(sampleRate * 0.02));
    this.frame = new Float32Array(this.frameSize);
    this.offset = 0;
  }
  encodeFrame(input) {
    const targetRate = 16000;
    const ratio = sampleRate / targetRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const pcm = new Int16Array(outputLength);
    const radius = 12;
    const cutoff = Math.min(1, targetRate / sampleRate) * 0.94;
    for (let outIndex = 0; outIndex < outputLength; outIndex++) {
      const center = outIndex * ratio;
      const centerIndex = Math.floor(center);
      let weighted = 0;
      let weightSum = 0;
      for (let inputIndex = Math.max(0, centerIndex - radius + 1);
           inputIndex <= Math.min(input.length - 1, centerIndex + radius);
           inputIndex++) {
        const distance = center - inputIndex;
        if (Math.abs(distance) >= radius) continue;
        const phase = Math.PI * cutoff * distance;
        const sinc = Math.abs(phase) < 1e-8 ? 1 : Math.sin(phase) / phase;
        const window = 0.5 + 0.5 * Math.cos(Math.PI * distance / radius);
        const weight = cutoff * sinc * window;
        weighted += input[inputIndex] * weight;
        weightSum += weight;
      }
      const sample = Math.max(-1, Math.min(1, weightSum ? weighted / weightSum : input[Math.min(input.length - 1, Math.round(center))] || 0));
      pcm[outIndex] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
    }
    return pcm;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (let i = 0; i < input.length; i++) {
      this.frame[this.offset++] = input[i];
      if (this.offset === this.frameSize) {
        const pcm = this.encodeFrame(this.frame);
        this.port.postMessage(pcm, [pcm.buffer]);
        this.frame = new Float32Array(this.frameSize);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('forza-qwen-mic', ForzaMicProcessor);
