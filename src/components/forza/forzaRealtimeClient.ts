import {
  StreamingPcmResampler,
  encodePcm16Base64,
  decodePcm16Base64,
  audioSampleRate,
  mayQueueMicrophoneFrame,
  appendLiveTranscript,
} from '../../utils/forzaRealtimeAudio';

export type ForzaVoicePhase = 'connecting' | 'native' | 'legacy' | 'unavailable';
export type ForzaVoiceStatus = 'listening' | 'thinking' | 'speaking';

export interface ForzaRealtimeCallbacks {
  onMode: (mode: ForzaVoicePhase) => void;
  onStatus: (state: ForzaVoiceStatus) => void;
  onUserText: (text: string) => void;
  onAiText: (text: string) => void;
  onLevel: (level: number) => void;
  onError: (error: string) => void;
}

/**
 * Real bidirectional voice connection. The API key never reaches the browser.
 * The browser sends continuous 16-bit PCM to its own Express WebSocket gateway.
 * Gemini Live controls turn-taking (not the old Web Speech/HTTP silence timers).
 */
export class ForzaRealtimeClient {
  private socket: WebSocket | null = null;
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micWorklet: AudioWorkletNode | null = null;
  private micScript: ScriptProcessorNode | null = null;
  private silentSink: GainNode | null = null;
  private resampler: StreamingPcmResampler | null = null;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private playbackEndAt = 0;
  private playbackGeneration = 0;
  private responseId = '';
  private aiTranscript = '';
  private userTranscript = '';
  private turnCompleted = false;
  private lastLevelAt = 0;
  private lastPongAt = 0;
  private heartbeat: number | null = null;
  private connectTimeout: number | null = null;
  private disposed = false;
  private started = false;
  private muted = false;
  private speakerMuted = false;
  private nativeConnected = false;
  private callback: ForzaRealtimeCallbacks;

  constructor(callbacks: ForzaRealtimeCallbacks) {
    this.callback = callbacks;
  }

  setCallbacks(callbacks: ForzaRealtimeCallbacks) {
    this.callback = callbacks;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.disposed = false;
    this.callback.onMode('connecting');

    try {
      const Context = window.AudioContext || (window as any).webkitAudioContext;
      if (!Context) throw new Error('این مرورگر از پخش صوت زنده پشتیبانی نمی‌کند.');
      this.context = new Context();
      // Create/resume on the explicit user click, before the WebSocket handshake.
      await this.context!.resume();
      this.output = this.context!.createGain();
      this.output.gain.value = this.speakerMuted ? 0 : 1;
      this.output.connect(this.context!.destination);
      const address = new URL('/api/live', window.location.href);
      address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(address.href);
      this.socket = ws;
      this.lastPongAt = Date.now();
      this.connectTimeout = window.setTimeout(() => this.fallback('اتصال زنده FORZA به‌موقع برقرار نشد.'), 12000);

      ws.onmessage = (event: MessageEvent) => {
        if (this.disposed) return;
        let message: any;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        this.acceptMessage(message);
      };
      ws.onerror = () => {
        if (!this.disposed) this.fallback('اتصال صوت زنده با اختلال مواجه شد.');
      };
      ws.onclose = () => {
        if (!this.disposed) this.fallback('ارتباط تماس زنده قطع شد؛ حالت جایگزین فعال شد.');
      };
    } catch (e: any) {
      this.fallback(e?.message || 'مرورگر نتوانست تماس زنده را آغاز کند.');
    }
  }

  private acceptMessage(message: any) {
    switch (message?.type) {
      case 'connected':
        this.nativeConnected = true;
        if (this.connectTimeout !== null) clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
        this.callback.onMode('native');
        this.callback.onStatus('listening');
        this.heartbeat = window.setInterval(() => {
          if (this.disposed) return;
          if (Date.now() - this.lastPongAt > 45000) {
            this.fallback('ارتباط صوتی پاسخ نمی‌دهد؛ حالت جایگزین فعال شد.');
            return;
          }
          this.send({ type: 'ping' });
        }, 15000);
        void this.startMic().catch((err: any) => {
          this.callback.onError(err?.name === 'NotAllowedError'
            ? 'دسترسی میکروفون مجاز نیست. مجوز میکروفون را فعال کنید.'
            : 'میکروفون آماده نشد؛ می‌توانید سؤال را تایپ کنید.');
        });
        return;
      case 'pong':
        this.lastPongAt = Date.now();
        return;
      case 'fallback_required':
        this.fallback(message.reason || message.error || 'حالت صوت زنده در دسترس نیست.', message.reasonCode !== 'missing_key');
        return;
      case 'session_closed':
        this.fallback('نشست صوتی پایان یافته است.');
        return;
      case 'user_transcript':
        if (message.text) {
          this.userTranscript = appendLiveTranscript(this.userTranscript, String(message.text));
          this.callback.onUserText(this.userTranscript);
        }
        return;
      case 'audio_chunk':
        if (typeof message.data === 'string') {
          if (this.responseId !== message.responseId) this.newResponse(message.responseId);
          this.enqueueAudio(message.data, audioSampleRate(message.mimeType));
        }
        return;
      case 'ai_text_chunk':
      case 'ai_transcript':
        if (typeof message.text === 'string') {
          if (this.responseId !== message.responseId) this.newResponse(message.responseId);
          this.aiTranscript = appendLiveTranscript(this.aiTranscript, message.text);
          this.callback.onAiText(this.aiTranscript);
        }
        return;
      case 'interrupted':
        this.stopPlayback();
        this.callback.onStatus('listening');
        return;
      case 'turn_complete':
        this.turnCompleted = true;
        this.userTranscript = '';
        if (this.sources.size === 0) this.callback.onStatus('listening');
        return;
      default:
        return;
    }
  }

  private newResponse(id: string) {
    this.responseId = String(id || '');
    this.aiTranscript = '';
    this.turnCompleted = false;
    this.callback.onAiText('');
  }

  private enqueueAudio(data: string, sampleRate: number) {
    if (!this.context || !this.output || this.disposed) return;
    let pcm: Float32Array;
    try { pcm = decodePcm16Base64(data); } catch { return; }
    if (!pcm.length) return;
    const buffer = this.context.createBuffer(1, pcm.length, sampleRate);
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const generation = this.playbackGeneration;
    const begin = Math.max(this.playbackEndAt, this.context.currentTime + 0.06);
    this.playbackEndAt = begin + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      try { source.disconnect(); } catch {}
      if (this.playbackGeneration === generation && this.turnCompleted && this.sources.size === 0) {
        this.callback.onStatus('listening');
      }
    };
    source.start(begin);
    this.callback.onStatus('speaking');
  }

  private stopPlayback() {
    this.playbackGeneration++;
    for (const source of this.sources) {
      try { source.onended = null; source.stop(); source.disconnect(); } catch {}
    }
    this.sources.clear();
    this.playbackEndAt = 0;
    this.turnCompleted = false;
    this.responseId = '';
  }

  private handleMic(input: Float32Array) {
    if (this.disposed || !input.length) return;
    const now = Date.now();
    if (now - this.lastLevelAt > 120) {
      let sum = 0;
      for (const value of input) sum += value * value;
      const rms = Math.sqrt(sum / input.length);
      this.callback.onLevel(this.muted ? 0 : Math.min(1, rms * 9));
      this.lastLevelAt = now;
    }
    if (this.muted) return;
    const pcm = this.resampler?.convert(input);
    if (!pcm?.length) return;
    const ws = this.socket;
    if (!ws || !mayQueueMicrophoneFrame(ws.readyState, ws.bufferedAmount)) return;
    ws.send(JSON.stringify({ type: 'realtime_audio', audio: encodePcm16Base64(pcm) }));
  }

  private async startMic() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('میکروفون در این مرورگر قابل دسترس نیست.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    if (this.disposed || !this.context) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    this.micStream = stream;
    this.micSource = this.context.createMediaStreamSource(stream);
    this.resampler = new StreamingPcmResampler(this.context.sampleRate);
    this.silentSink = this.context.createGain();
    this.silentSink.gain.value = 0;
    this.silentSink.connect(this.context.destination);
    try {
      if (!this.context.audioWorklet) throw new Error('AudioWorklet unsupported');
      await this.context.audioWorklet.addModule('/worklets/forza-microphone.js');
      if (this.disposed) return;
      this.micWorklet = new AudioWorkletNode(this.context, 'forza-microphone');
      this.micWorklet.port.onmessage = event => this.handleMic(event.data as Float32Array);
      this.micSource.connect(this.micWorklet);
      this.micWorklet.connect(this.silentSink);
    } catch {
      // Older browsers: keep an audio path instead of failing the call.
      const script = this.context.createScriptProcessor(2048, 1, 1);
      script.onaudioprocess = event => this.handleMic(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.micScript = script;
      this.micSource.connect(script);
      script.connect(this.silentSink);
    }
    this.callback.onStatus('listening');
  }

  sendText(text: string) {
    if (!text.trim() || !this.nativeConnected || this.disposed) return false;
    this.stopPlayback();
    this.userTranscript = text.trim();
    this.callback.onUserText(this.userTranscript);
    this.callback.onStatus('thinking');
    return this.send({ type: 'text', text: text.trim() });
  }

  setMicMuted(value: boolean) {
    this.muted = value;
    if (value) this.send({ type: 'audio_stream_end' });
  }

  setSpeakerMuted(value: boolean) {
    this.speakerMuted = value;
    if (this.output) this.output.gain.value = value ? 0 : 1;
  }

  private send(message: object) {
    if (this.disposed || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private fallback(reason: string, allowLegacy = true) {
    if (this.disposed) return;
    this.stop();
    this.callback.onError(reason);
    this.callback.onMode(allowLegacy ? 'legacy' : 'unavailable');
  }

  stop() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.connectTimeout !== null) clearTimeout(this.connectTimeout);
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.stopPlayback();
    this.micWorklet?.port.close();
    try { this.micWorklet?.disconnect(); } catch {}
    try { this.micScript?.disconnect(); } catch {}
    try { this.micSource?.disconnect(); } catch {}
    try { this.silentSink?.disconnect(); } catch {}
    this.micStream?.getTracks().forEach(track => track.stop());
    try { this.socket?.close(1000, 'Call ended'); } catch {}
    this.socket = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.started = false;
  }
}
