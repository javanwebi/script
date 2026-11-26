class ForzaMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = Math.max(1, Math.round(sampleRate * 0.02));
    this.frame = new Float32Array(this.frameSize);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (let i=0;i<input.length;i++) {
      this.frame[this.offset++] = input[i];
      if (this.offset === this.frameSize) {
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.frame = new Float32Array(this.frameSize);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('forza-qwen-mic', ForzaMicProcessor);
