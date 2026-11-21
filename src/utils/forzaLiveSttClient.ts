export type ForzaLiveSttState = 'connecting' | 'warming' | 'ready' | 'reconnecting' | 'failed' | 'closed';

export interface ForzaLiveSttClientOptions {
  onHypothesis: (text: string, isFinal: boolean) => void;
  onState?: (state: ForzaLiveSttState, code?: string) => void;
  url?: string;
  maxBufferedAmount?: number;
}

function defaultUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/forza-stt-stream`;
}

/** A single live Diba session. Audio frames are already filtered and 16 kHz PCM16. */
export class ForzaLiveSttClient {
  private socket: WebSocket | null = null;
  private running = false;
  private ready = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFrames: ArrayBuffer[] = [];
  private fatal = false;
  private readonly maxBufferedAmount: number;

  constructor(private readonly options: ForzaLiveSttClientOptions) {
    this.maxBufferedAmount = Math.max(32_000, options.maxBufferedAmount ?? 256_000);
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    if (typeof WebSocket === 'undefined') return Promise.reject(new Error('websocket_unavailable'));
    this.running = true;
    this.options.onState?.('connecting');
    return this.connect(true);
  }

  sendPcm(pcm: ArrayBuffer): void {
    if (!this.running || !(pcm instanceof ArrayBuffer) || pcm.byteLength === 0 || pcm.byteLength > 48_000) return;
    const socket = this.socket;
    if (this.ready && socket?.readyState === WebSocket.OPEN &&
        socket.bufferedAmount <= this.maxBufferedAmount) {
      try { socket.send(pcm); return; } catch {}
    }
    // A bounded 1.6-second replay buffer recovers brief network/worker reconnects.
    this.pendingFrames.push(pcm.slice(0));
    if (this.pendingFrames.length > 8) this.pendingFrames.shift();
  }

  private connect(initial: boolean): Promise<void> {
    if (!this.running) return Promise.reject(new Error('diba_stream_stopped'));
    const url = this.options.url || defaultUrl();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let opened = false;
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (this.connectTimer !== null) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        if (error) reject(error);
        else resolve();
      };

      this.connectTimer = setTimeout(() => {
        finish(new Error('diba_stream_connect_timeout'));
        try { socket.close(); } catch {}
      }, 25_000);

      socket.onopen = () => {
        opened = true;
        try { socket.send(JSON.stringify({ type: 'start', sampleRate: 16000 })); }
        catch {
          finish(new Error('diba_stream_start_failed'));
          try { socket.close(); } catch {}
        }
      };

      socket.onmessage = event => {
        if (typeof event.data !== 'string') return;
        let message: any;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'warming') {
          this.options.onState?.('warming');
          return;
        }
        if (message.type === 'ready') {
          this.ready = true;
          this.retryCount = 0;
          this.options.onState?.('ready');
          const buffered = this.pendingFrames;
          this.pendingFrames = [];
          for (const frame of buffered) {
            if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > this.maxBufferedAmount) {
              this.pendingFrames.push(frame);
              continue;
            }
            try { socket.send(frame); } catch { this.pendingFrames.push(frame); }
          }
          finish();
          return;
        }
        if (message.type === 'partial' || message.type === 'final') {
          const text = String(message.text || '').trim();
          if (text) this.options.onHypothesis(text, message.type === 'final');
          return;
        }
        if (message.type === 'error') {
          const code = String(message.code || 'diba_stream_error').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
          this.options.onState?.('failed', code);
          if (/capacity_reached|live_unavailable|model_missing/.test(code)) this.fatal = true;
          finish(new Error(code));
          try { socket.close(1011, code); } catch {}
        }
      };

      socket.onerror = () => {
        if (!settled) finish(new Error('diba_stream_socket_error'));
      };

      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.ready = false;
        if (!settled && opened) finish(new Error('diba_stream_closed_before_ready'));
        if (!this.running) return;
        if (this.fatal) {
          this.options.onState?.('failed', 'diba_stream_unavailable');
          return;
        }
        this.options.onState?.('reconnecting');
        this.scheduleReconnect();
      };

      if (!initial) this.options.onState?.('reconnecting');
    });
  }

  private scheduleReconnect(): void {
    if (!this.running || this.fatal || this.retryTimer !== null) return;
    this.retryCount += 1;
    const delay = Math.min(5000, 250 * Math.pow(1.7, Math.min(8, this.retryCount - 1)));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.running || this.fatal) return;
      void this.connect(false).catch(() => {
        this.options.onState?.('reconnecting');
        this.scheduleReconnect();
      });
    }, delay);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.ready = false;
    this.options.onState?.('closed');
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    this.retryTimer = null;
    this.connectTimer = null;
    this.pendingFrames = [];
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'stop' }));
          socket.close(1000, 'Call ended');
        } else socket.close();
      } catch {}
    }
  }
}

/** Tap only the output of the foreground gate and forward PCM to a live Diba client. */
export async function attachForzaLivePcmTap(
  context: AudioContext,
  gatedSource: AudioNode,
  onPcm: (pcm: ArrayBuffer) => void,
): Promise<() => void> {
  if (!context.audioWorklet) throw new Error('audio_worklet_unavailable');
  await context.audioWorklet.addModule('/worklets/forza-stt-pcm.js');
  if (context.state === 'closed') throw new Error('audio_context_closed');

  const node = new AudioWorkletNode(context, 'forza-stt-pcm-tap', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
  });
  const sink = context.createGain();
  sink.gain.value = 0;
  let disposed = false;
  node.port.onmessage = event => {
    if (disposed || event.data?.type !== 'pcm' || !(event.data.pcm instanceof ArrayBuffer)) return;
    onPcm(event.data.pcm);
  };
  gatedSource.connect(node);
  node.connect(sink);
  sink.connect(context.destination);

  return () => {
    if (disposed) return;
    disposed = true;
    node.port.onmessage = null;
    node.port.close();
    try { gatedSource.disconnect(node); } catch {}
    try { node.disconnect(); } catch {}
    try { sink.disconnect(); } catch {}
  };
}
