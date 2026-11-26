import { WebSocket } from 'ws';
import type { RawData } from 'ws';

const GISOO_REALTIME_URL =
  process.env.FORZA_QWEN_REALTIME_URL?.trim() ||
  'wss://ir.gisoo.pro/api/v1/realtime?model=qwen3.8-omni-flash-realtime';
const GISOO_QWEN_MODEL = 'qwen3.8-omni-flash-realtime';
const GISOO_QWEN_VOICE = 'Andre';
const MAX_CLIENT_FRAME_BYTES = 100_000;
const MAX_CLIENT_BUFFERED_BYTES = 2_000_000;
const MAX_UPSTREAM_BUFFERED_BYTES = 1_000_000;

type JsonRecord = Record<string, any>;

let activeSessions = 0;

function toUtf8(raw: RawData): string {
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw as ArrayBuffer).toString('utf8');
}

function validBase64(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 65_000 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function buildGisooQwenSessionUpdate(instructions: string, silenceDurationMs = 1100) {
  const silence = Math.max(500, Math.min(2500, Math.round(silenceDurationMs)));
  return {
    type: 'session.update',
    session: {
      output_modalities: ['audio'],
      instructions,
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 16000 },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 250,
            silence_duration_ms: silence,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: GISOO_QWEN_VOICE,
        },
      },
      reasoning: { effort: 'none' },
      max_output_tokens: 1024,
    },
  };
}

export function mapGisooQwenEvent(
  event: JsonRecord,
  responseId = '',
): Array<Record<string, unknown>> {
  const type = String(event?.type || '');
  const id = responseId || String(event?.response_id || event?.response?.id || '');

  if (type === 'response.output_audio.delta' && typeof event.delta === 'string') {
    return [{
      type: 'audio_chunk',
      responseId: id,
      data: event.delta,
      mimeType: 'audio/pcm;rate=24000',
    }];
  }

  if (type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') {
    return [{ type: 'ai_text_chunk', responseId: id, text: event.delta }];
  }

  if (type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
    return [{ type: 'ai_transcript', responseId: id, text: event.transcript }];
  }

  if (
    (type === 'conversation.item.input_audio_transcription.delta' ||
      type === 'input_audio_transcription.delta') &&
    (typeof event.text === 'string' || typeof event.stash === 'string')
  ) {
    return [{
      type: 'user_transcript',
      text: String(event.text || '') + String(event.stash || ''),
      final: false,
    }];
  }

  if (
    type === 'conversation.item.input_audio_transcription.completed' ||
    type === 'input_audio_transcription.completed'
  ) {
    const transcript = String(event.transcript || event.text || '');
    return transcript ? [{ type: 'user_transcript', text: transcript, final: true }] : [];
  }

  if (type === 'input_audio_buffer.speech_started' && id) {
    return [{ type: 'interrupted', responseId: id }];
  }

  if (type === 'response.done' && id) {
    return [{ type: 'turn_complete', responseId: id }];
  }

  return [];
}

/**
 * Bridges the existing FORZA browser protocol to Gisoo's OpenAI-compatible
 * Realtime WebSocket. Gemini remains the default provider and is not modified.
 */
export function connectGisooQwenRealtime(clientWs: WebSocket, instructions: string): void {
  const apiKey = String(process.env.FORZA_QWEN_API_KEY || '').trim();
  if (!apiKey) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'fallback_required',
        reasonCode: 'missing_key',
        reason: 'کلید موقت Qwen روی سرور تنظیم نشده است.',
      }));
      clientWs.close(1000, 'Qwen API key missing');
    }
    return;
  }

  const configuredLimit = Number(process.env.FORZA_QWEN_MAX_SESSIONS || 8);
  const sessionLimit = Number.isFinite(configuredLimit)
    ? Math.max(1, Math.min(8, Math.floor(configuredLimit)))
    : 8;
  if (activeSessions >= sessionLimit) {
    clientWs.send(JSON.stringify({
      type: 'fallback_required',
      reasonCode: 'qwen_session_limit',
      reason: 'ظرفیت اتصال هم‌زمان Qwen تکمیل شده است؛ لطفاً دوباره تلاش کنید.',
    }));
    clientWs.close(1013, 'Qwen session limit');
    return;
  }

  activeSessions += 1;
  let released = false;
  let clientClosed = false;
  let sessionReady = false;
  let updateSent = false;
  let responseCounter = 0;
  let activeResponseId = '';
  let responseActive = false;
  let upstream: WebSocket | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;

  const release = () => {
    if (released) return;
    released = true;
    activeSessions = Math.max(0, activeSessions - 1);
    if (readyTimer) clearTimeout(readyTimer);
    readyTimer = null;
  };

  const sendClient = (message: Record<string, unknown>) => {
    if (clientClosed || clientWs.readyState !== WebSocket.OPEN) return false;
    if (clientWs.bufferedAmount > MAX_CLIENT_BUFFERED_BYTES) {
      clientWs.close(1013, 'FORZA client backpressure');
      return false;
    }
    clientWs.send(JSON.stringify(message));
    return true;
  };

  const sendUpstream = (message: Record<string, unknown>) => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return false;
    if (upstream.bufferedAmount > MAX_UPSTREAM_BUFFERED_BYTES) {
      sendClient({
        type: 'fallback_required',
        reason: 'ارتباط صوتی Qwen بیش از حد شلوغ شد؛ تماس را دوباره آغاز کنید.',
      });
      clientWs.close(1013, 'Qwen upstream backpressure');
      return false;
    }
    upstream.send(JSON.stringify(message));
    return true;
  };

  const fail = (reason: string, closeCode = 1011) => {
    if (!clientClosed) {
      sendClient({ type: 'fallback_required', reason });
      clientWs.close(closeCode, 'Qwen realtime unavailable');
    }
    try {
      if (upstream && upstream.readyState !== WebSocket.CLOSED) upstream.close();
    } catch {}
    release();
  };

  try {
    upstream = new WebSocket(GISOO_REALTIME_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      handshakeTimeout: 15_000,
      maxPayload: 2 * 1024 * 1024,
    });
  } catch (error: any) {
    fail('ساخت اتصال Qwen ناموفق بود: ' + String(error?.message || 'خطای اتصال'));
    return;
  }

  readyTimer = setTimeout(() => {
    if (!sessionReady) fail('پاسخ اولیه Qwen در زمان مناسب دریافت نشد.', 1013);
  }, 20_000);

  upstream.on('open', () => {
    console.info('[FORZA QWEN] upstream websocket opened');
  });

  upstream.on('message', (raw) => {
    if (clientClosed) return;

    let event: JsonRecord;
    try {
      event = JSON.parse(toUtf8(raw)) as JsonRecord;
    } catch {
      console.warn('[FORZA QWEN] ignored invalid upstream event');
      return;
    }

    const type = String(event?.type || '');

    if (type === 'session.created' && !updateSent) {
      updateSent = true;
      const silenceMs = Number(process.env.FORZA_QWEN_SILENCE_MS || 1100);
      sendUpstream(buildGisooQwenSessionUpdate(instructions, silenceMs));
      return;
    }

    if (type === 'session.updated') {
      if (!sessionReady) {
        const reportedVoice = event.session?.audio?.output?.voice;
        if (typeof reportedVoice === 'string' && reportedVoice.trim() &&
            reportedVoice.trim().toLowerCase() !== GISOO_QWEN_VOICE.toLowerCase()) {
          console.warn('[FORZA QWEN] requested voice not accepted; reported=' + reportedVoice.slice(0, 80));
          fail('گیسو صدای مردانه Andre را تأیید نکرد.');
          return;
        }
        console.info('[FORZA QWEN] requested voice=' + GISOO_QWEN_VOICE +
          '; provider confirmation=' + (reportedVoice ? 'reported' : 'not reported'));
        sessionReady = true;
        if (readyTimer) clearTimeout(readyTimer);
        readyTimer = null;
        sendClient({
          type: 'connected',
          model: GISOO_QWEN_MODEL,
          provider: 'qwen',
          sampleRate: 24000,
          inputSampleRate: 16000,
        });
        console.info('[FORZA QWEN] session ready; model=' + GISOO_QWEN_MODEL);
      }
      return;
    }

    if (type === 'response.created') {
      activeResponseId = String(event.response?.id || event.response_id ||
        `qwen-live-${Date.now()}-${++responseCounter}`);
      responseActive = true;
      return;
    }

    if (type === 'input_audio_buffer.speech_started') {
      // Gisoo's server_vad with interrupt_response=true cancels generation
      // upstream; stop already-buffered browser audio immediately.
      if (responseActive && activeResponseId) {
        sendClient({ type: 'interrupted', responseId: activeResponseId });
        responseActive = false;
      }
      return;
    }

    if (type === 'response.done') {
      const responseId = activeResponseId ||
        String(event.response?.id || event.response_id || '');
      for (const message of mapGisooQwenEvent(event, responseId)) sendClient(message);
      const usage = event.response?.usage;
      if (usage) {
        console.info('[FORZA QWEN] response usage=' + JSON.stringify(usage).slice(0, 700));
      }
      activeResponseId = '';
      responseActive = false;
      return;
    }

    if (type === 'error') {
      const code = String(event.error?.code || 'realtime_error');
      const safeMessage = String(event.error?.message || 'خطای سرویس Realtime').slice(0, 240);
      console.warn('[FORZA QWEN] provider error code=' + code + ' message=' + safeMessage);
      fail(code === 'insufficient_credit'
        ? 'اعتبار حساب گیسو برای ادامه مکالمه کافی نیست.'
        : 'سرویس Qwen خطا داد: ' + safeMessage);
      return;
    }

    for (const message of mapGisooQwenEvent(event, activeResponseId)) sendClient(message);
  });

  upstream.on('unexpected-response', (_request, response) => {
    const status = response.statusCode || 0;
    let body = '';
    response.on('data', (chunk) => {
      body = (body + String(chunk)).slice(-1200);
    });
    response.on('end', () => {
      console.warn('[FORZA QWEN] handshake rejected status=' + status);
      const reason = status === 402
        ? 'اعتبار حساب گیسو کافی نیست.'
        : status === 401
          ? 'کلید API گیسو معتبر نیست یا دسترسی آن غیرفعال شده است.'
          : status === 403
            ? 'دسترسی IP یا مدل برای کلید گیسو مجاز نیست.'
            : status === 429
              ? 'محدودیت اتصال گیسو فعال شده است؛ کمی بعد دوباره تلاش کنید.'
              : 'اتصال Qwen توسط گیسو پذیرفته نشد (HTTP ' + status + ').';
      void body;
      fail(reason, 1011);
    });
  });

  upstream.on('error', (error: Error) => {
    console.warn('[FORZA QWEN] upstream socket error=' + String(error?.message || '').slice(0, 180));
    if (!clientClosed) fail('ارتباط WebSocket با گیسو برقرار نماند.');
  });

  upstream.on('close', (code, reason) => {
    release();
    if (!clientClosed && clientWs.readyState === WebSocket.OPEN) {
      sendClient({
        type: 'fallback_required',
        reason: 'نشست Qwen بسته شد. برای ادامه، تماس را دوباره آغاز کنید.',
      });
      clientWs.close(1011, 'Qwen session closed');
    }
    console.info('[FORZA QWEN] upstream closed code=' + code + ' reason=' + reason.toString().slice(0, 100));
  });

  clientWs.on('message', (raw) => {
    if (clientClosed) return;
    const frame = Buffer.isBuffer(raw)
      ? raw
      : Array.isArray(raw)
        ? Buffer.concat(raw)
        : Buffer.from(raw as ArrayBuffer);
    if (frame.length > MAX_CLIENT_FRAME_BYTES) {
      clientWs.close(1009, 'Audio frame too large');
      return;
    }

    let message: JsonRecord;
    try {
      message = JSON.parse(frame.toString('utf8')) as JsonRecord;
    } catch {
      return;
    }

    if (message.type === 'ping') {
      sendClient({ type: 'pong' });
      return;
    }

    if (!sessionReady) return;

    if (message.type === 'realtime_audio') {
      if (validBase64(message.audio)) {
        sendUpstream({
          type: 'input_audio_buffer.append',
          audio: message.audio,
        });
      }
      return;
    }

    if (message.type === 'audio_stream_end') {
      // server_vad commits turns automatically after the configured silence.
      return;
    }

    if (message.type === 'text' && typeof message.text === 'string' && message.text.trim()) {
      if (responseActive) {
        sendUpstream({ type: 'response.cancel' });
        if (activeResponseId) sendClient({ type: 'interrupted', responseId: activeResponseId });
        responseActive = false;
        activeResponseId = '';
      }
      sendUpstream({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: message.text.trim().slice(0, 3000) }],
        },
      });
      sendUpstream({ type: 'response.create' });
    }
  });

  clientWs.on('close', () => {
    clientClosed = true;
    release();
    try {
      if (upstream && upstream.readyState === WebSocket.OPEN) upstream.close(1000, 'Browser call ended');
      else if (upstream && upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
    } catch {}
  });

  clientWs.on('error', () => {
    clientClosed = true;
    release();
    try { upstream?.terminate(); } catch {}
  });
}
