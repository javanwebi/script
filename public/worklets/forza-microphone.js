// Runs on the real-time audio thread; keep allocations and computation minimal.
class ForzaMicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.used = 0;
  }
  process(inputs) {
    const mono = inputs[0] && inputs[0][0];
    if (!mono) return true;
    let i = 0;
    while (i < mono.length) {
      const count = Math.min(this.buffer.length - this.used, mono.length - i);
      this.buffer.set(mono.subarray(i, i + count), this.used);
      this.used += count;
      i += count;
      if (this.used === this.buffer.length) {
        const completed = this.buffer;
        this.port.postMessage(completed, [completed.buffer]);
        this.buffer = new Float32Array(2048);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('forza-microphone', ForzaMicrophoneProcessor);
