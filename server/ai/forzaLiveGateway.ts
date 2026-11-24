import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  ActivityHandling,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
} from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

type LiveInput = {
  audio?: { data: string; mimeType: string };
  audioStreamEnd?: boolean;
};

type LiveTextInput = {
  turns: Array<{ role: 'user'; parts: Array<{ text: string }> }>;
  turnComplete: boolean;
};

type LiveSession = {
  sendRealtimeInput(input: LiveInput): void;
  sendClientContent(input: LiveTextInput): void;
  close(): void;
};

type LiveApiClient = {
  live: {
    connect(options: any): Promise<LiveSession>;
  };
};

export interface ForzaLiveGatewayOptions {
  getApiKey: () => string | undefined;
  enabled?: boolean;
  createClient?: (apiKey: string) => LiveApiClient;
  model?: string;
  voice?: string;
  maxConnections?: number;
  maxConnectionsPerIp?: number;
  maxSessionsPerHourPerIp?: number;
  maxSessionsPerHour?: number;
  maxSessionMs?: number;
  connectTimeoutMs?: number;
}

const SYSTEM_INSTRUCTION = `
شما فورزا، دستیار صوتی هوشمند صنعت پیش هستید.
RESPOND IN PERSIAN. YOU MUST RESPOND UNMISTAKABLY IN PERSIAN.
به‌صورت طبیعی، دوستانه، دقیق و حرفه‌ای با مشتری گفتگو کنید. همیشه فارسی روان و محاوره‌ای محترمانه را به کار ببرید.
پاسخ‌ها را برای مکالمه صوتی کوتاه و روشن نگه دارید و فقط در صورت نیاز توضیح فنی بیشتر بدهید.
در موضوع قطعات صنعتی، ابتدا کاربرد، شرایط کار، ابعاد، سرعت، دما، فشار و کد فنی مرتبط را از مشتری بپرسید؛ فقط مواردی را بپرسید که برای همان مسئله لازم‌اند.
هیچ قیمت، موجودی، برند، استاندارد یا مشخصه فنی را حدس نزنید و به‌عنوان واقعیت اعلام نکنید.
اگر اطلاعات زنده کاتالوگ یا موجودی در دسترس نیست، صریح بگویید که برای تأیید نهایی باید اطلاعات فروش بررسی شود.
اگر پاسخ را نمی‌دانید، شفاف بگویید و مسیر بررسی دقیق‌تر را پیشنهاد کنید.
در ابتدای نشست، یک خوش‌آمدگویی کوتاه بگویید، خودتان را فورزا معرفی کنید و سپس برای صحبت مشتری مکث کنید.
حرف مشتری را قطع نکنید؛ اگر وسط پاسخ شما صحبت کرد، فوراً پاسخ صوتی را متوقف کنید و به صحبت او گوش دهید.
از ادعای انجام سفارش، ثبت درخواست یا بررسی موجودی بدون ابزار واقعی خودداری کنید.
`.trim();

const MAX_CLIENT_BUFFERED_BYTES = 1_500_000;
const MAX_AUDIO_BASE64_CHARS = 70_000;
const MAX_TEXT_CHARS = 3_000;
const MAX_AUDIO_FRAMES_PER_SECOND = 60;
const MAX_CLIENT_MESSAGES_PER_SECOND = 100;
const MAX_TEXT_MESSAGES_PER_MINUTE = 30;

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function isTrustedLocalProxy(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized === '::ffff:7f00:1';
}

function clientIp(request: IncomingMessage): string {
  const peer = String(request.socket.remoteAddress || 'unknown');
  // Forwarded headers are only trusted when the TCP peer is our local Nginx
  // reverse proxy. Direct clients cannot spoof X-Real-IP to evade rate limits.
  if (!isTrustedLocalProxy(peer)) return peer.slice(0, 64);

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim().slice(0, 64);

  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    // Nginx appends the actual peer address to X-Forwarded-For.
    const chain = forwarded.split(',').map(value => value.trim()).filter(Boolean);
    const last = chain.at(-1);
    if (last) return last.slice(0, 64);
  }
  return peer.slice(0, 64);
}

function isSameOrigin(request: IncomingMessage): boolean {
  const originHeader = request.headers.origin;
  const hostHeader = request.headers.host;
  if (typeof originHeader !== 'string' || typeof hostHeader !== 'string') return false;
  try {
    const origin = new URL(originHeader);
    return (origin.protocol === 'https:' || origin.protocol === 'http:') &&
      !origin.username && !origin.password &&
      origin.pathname === '/' && !origin.search && !origin.hash &&
      origin.host.toLowerCase() === hostHeader.toLowerCase();
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Duplex, status: 403 | 429 | 503): void {
  const labels: Record<number, string> = {
    403: 'Forbidden',
    429: 'Too Many Requests',
    503: 'Service Unavailable',
  };
  if (socket.destroyed) return;
  socket.write(`HTTP/1.1 ${status} ${labels[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function rawMessageText(raw: Buffer | ArrayBuffer | Buffer[]): string {
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw).toString('utf8');
}

/**
 * Attaches the production, server-authenticated, bidirectional FORZA Live API.
 * The browser protocol intentionally remains compatible with ForzaRealtimeClient.
 * No provider key, audio file, transcript, or customer message is persisted.
 */
export function setupForzaLiveGateway(
  server: Server,
  options: ForzaLiveGatewayOptions,
): () => void {
  const model = (options.model || process.env.FORZA_LIVE_MODEL || 'gemini-3.8-live').trim();
  const voice = (options.voice || process.env.FORZA_LIVE_VOICE || 'Charon').trim();
  // Public live calls are opt-in. A missing environment variable must fail closed.
  const enabled = options.enabled ?? process.env.FORZA_LIVE_ENABLED === 'true';
  const maxConnections = boundedInteger(
    options.maxConnections ?? process.env.FORZA_LIVE_MAX_CONNECTIONS, 20, 1, 100,
  );
  const maxConnectionsPerIp = boundedInteger(
    options.maxConnectionsPerIp ?? process.env.FORZA_LIVE_MAX_CONNECTIONS_PER_IP, 2, 1, 10,
  );
  const maxSessionsPerHourPerIp = boundedInteger(
    options.maxSessionsPerHourPerIp ?? process.env.FORZA_LIVE_MAX_SESSIONS_PER_HOUR_PER_IP, 60, 1, 600,
  );
  const maxSessionsPerHour = boundedInteger(
    options.maxSessionsPerHour ?? process.env.FORZA_LIVE_MAX_SESSIONS_PER_HOUR, 100, 1, 10_000,
  );
  const maxSessionMs = boundedInteger(
    options.maxSessionMs ?? process.env.FORZA_LIVE_MAX_SESSION_MS, 240_000, 30_000, 600_000,
  );
  const connectTimeoutMs = boundedInteger(
    options.connectTimeoutMs ?? process.env.FORZA_LIVE_CONNECT_TIMEOUT_MS, 15_000, 3_000, 60_000,
  );
  const createClient = options.createClient || ((apiKey: string) =>
    new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'SanatPish-Forza-Live/1.0' } },
    }) as unknown as LiveApiClient);

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 96 * 1024,
    perMessageDeflate: false,
  });
  const activeSockets = new Set<WebSocket>();
  const activeByIp = new Map<string, number>();
  const startsByIp = new Map<string, { windowStartedAt: number; count: number }>();
  const reservedIp = new WeakMap<WebSocket, string>();
  let activeTotal = 0;
  let globalWindowStartedAt = Date.now();
  let globalSessionStarts = 0;

  const releaseReservation = (ip: string, client?: WebSocket) => {
    if (client) activeSockets.delete(client);
    activeTotal = Math.max(0, activeTotal - 1);
    const count = activeByIp.get(ip) || 0;
    if (count <= 1) activeByIp.delete(ip);
    else activeByIp.set(ip, count - 1);
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
    } catch {
      return;
    }
    if (pathname !== '/api/live') return;

    if (!isSameOrigin(request)) {
      rejectUpgrade(socket, 403);
      return;
    }

    const ip = clientIp(request);
    if (activeTotal >= maxConnections || (activeByIp.get(ip) || 0) >= maxConnectionsPerIp) {
      rejectUpgrade(socket, 429);
      return;
    }
    const now = Date.now();
    if (now - globalWindowStartedAt >= 3_600_000) {
      globalWindowStartedAt = now;
      globalSessionStarts = 0;
    }
    if (globalSessionStarts >= maxSessionsPerHour) {
      rejectUpgrade(socket, 429);
      return;
    }
    const previousWindow = startsByIp.get(ip);
    const startWindow = !previousWindow || now - previousWindow.windowStartedAt >= 3_600_000
      ? { windowStartedAt: now, count: 0 }
      : previousWindow;
    if (startWindow.count >= maxSessionsPerHourPerIp) {
      rejectUpgrade(socket, 429);
      return;
    }
    startWindow.count += 1;
    globalSessionStarts += 1;
    startsByIp.set(ip, startWindow);
    if (startsByIp.size > 2_000) {
      for (const [key, value] of startsByIp) {
        if (now - value.windowStartedAt >= 3_600_000) startsByIp.delete(key);
      }
    }

    activeTotal += 1;
    activeByIp.set(ip, (activeByIp.get(ip) || 0) + 1);
    try {
      wss.handleUpgrade(request, socket, head, client => {
        reservedIp.set(client, ip);
        wss.emit('connection', client, request);
      });
    } catch {
      releaseReservation(ip);
      rejectUpgrade(socket, 503);
    }
  };

  server.on('upgrade', onUpgrade);

  wss.on('connection', (client: WebSocket) => {
    const callId = randomUUID();
    const ip = reservedIp.get(client) || 'unknown';
    activeSockets.add(client);

    let isClosed = false;
    let released = false;
    let liveSession: LiveSession | null = null;
    let responseId = '';
    let responseCounter = 0;
    let lastClientActivityAt = Date.now();
    let frameWindowStartedAt = Date.now();
    let framesInWindow = 0;
    let messageWindowStartedAt = Date.now();
    let messagesInWindow = 0;
    let textWindowStartedAt = Date.now();
    let textMessagesInWindow = 0;
    let sessionTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const release = () => {
      if (released) return;
      released = true;
      releaseReservation(ip, client);
    };

    const cleanup = (code = 1000, reason = 'Call ended') => {
      if (isClosed) return;
      isClosed = true;
      if (sessionTimer) clearTimeout(sessionTimer);
      if (connectTimer) clearTimeout(connectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try { liveSession?.close(); } catch {}
      release();
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        try { client.close(code, reason.slice(0, 100)); } catch { client.terminate(); }
      }
    };

    const send = (message: Record<string, unknown>): boolean => {
      if (isClosed || client.readyState !== WebSocket.OPEN) return false;
      if (client.bufferedAmount > MAX_CLIENT_BUFFERED_BYTES) {
        cleanup(1013, 'Slow client');
        return false;
      }
      try {
        client.send(JSON.stringify(message));
        return true;
      } catch {
        cleanup(1011, 'Send failed');
        return false;
      }
    };

    const fail = (reasonCode: string, reason: string) => {
      if (isClosed) return;
      send({ type: 'fallback_required', reasonCode, reason });
      cleanup(1011, 'Live provider unavailable');
    };

    const finishSession = (reason: string) => {
      if (isClosed) return;
      send({ type: 'session_closed', reasonCode: 'session_limit', reason });
      cleanup(1000, 'Session limit reached');
    };

    const beginResponse = (): string => {
      if (!responseId) responseId = `${callId}-${++responseCounter}`;
      return responseId;
    };

    client.on('message', (raw, isBinary) => {
      if (isClosed) return;
      const messageNow = Date.now();
      lastClientActivityAt = messageNow;
      if (messageNow - messageWindowStartedAt >= 1_000) {
        messageWindowStartedAt = messageNow;
        messagesInWindow = 0;
      }
      messagesInWindow += 1;
      if (messagesInWindow > MAX_CLIENT_MESSAGES_PER_SECOND) {
        fail('rate_limited', 'تعداد پیام‌های ارسالی بیش از حد مجاز است.');
        return;
      }
      if (isBinary) {
        fail('invalid_protocol', 'قالب داده ارسالی معتبر نیست.');
        return;
      }
      let message: any;
      try {
        message = JSON.parse(rawMessageText(raw as Buffer | ArrayBuffer | Buffer[]));
      } catch {
        fail('invalid_protocol', 'پیام ارسالی قابل خواندن نیست.');
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;

      if (message.type === 'ping') {
        send({ type: 'pong' });
        return;
      }

      if (message.type === 'realtime_audio') {
        const audio = message.audio;
        if (typeof audio !== 'string' || audio.length > MAX_AUDIO_BASE64_CHARS ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(audio) || audio.length === 0) {
          fail('invalid_audio', 'داده صوتی معتبر نیست.');
          return;
        }
        const pcmBytes = Buffer.from(audio, 'base64');
        if (pcmBytes.length === 0 || pcmBytes.length % 2 !== 0 || pcmBytes.length > 48_000) {
          fail('invalid_audio', 'قالب صدای ارسالی معتبر نیست.');
          return;
        }
        const now = Date.now();
        if (now - frameWindowStartedAt >= 1_000) {
          frameWindowStartedAt = now;
          framesInWindow = 0;
        }
        framesInWindow += 1;
        if (framesInWindow > MAX_AUDIO_FRAMES_PER_SECOND) {
          fail('rate_limited', 'سرعت ارسال داده صوتی بیش از حد مجاز است.');
          return;
        }
        if (!liveSession) return;
        try {
          liveSession.sendRealtimeInput({
            audio: { data: audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch {
          fail('provider_send_failed', 'ارسال صدا به سرویس مکالمه با مشکل روبه‌رو شد.');
        }
        return;
      }

      if (message.type === 'audio_stream_end') {
        if (!liveSession) return;
        try { liveSession.sendRealtimeInput({ audioStreamEnd: true }); }
        catch { fail('provider_send_failed', 'پایان جریان صدا ثبت نشد.'); }
        return;
      }

      if (message.type === 'text') {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        if (!text || text.length > MAX_TEXT_CHARS) {
          fail('invalid_text', 'متن ارسالی خالی یا بیش از اندازه طولانی است.');
          return;
        }
        const textNow = Date.now();
        if (textNow - textWindowStartedAt >= 60_000) {
          textWindowStartedAt = textNow;
          textMessagesInWindow = 0;
        }
        textMessagesInWindow += 1;
        if (textMessagesInWindow > MAX_TEXT_MESSAGES_PER_MINUTE) {
          fail('rate_limited', 'تعداد پیام‌های متنی در این مکالمه به سقف مجاز رسیده است.');
          return;
        }
        if (!liveSession) return;
        try {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          });
        } catch {
          fail('provider_send_failed', 'ارسال پیام به هوش مصنوعی با مشکل روبه‌رو شد.');
        }
      }
    });

    client.on('close', () => cleanup(1000, 'Client disconnected'));
    client.on('error', () => cleanup(1011, 'Client socket error'));

    heartbeatTimer = setInterval(() => {
      if (isClosed) return;
      if (Date.now() - lastClientActivityAt > 50_000) {
        cleanup(1001, 'Client heartbeat timeout');
      }
    }, 15_000);

    if (!enabled) {
      fail('disabled', 'تماس زنده فورزا موقتاً غیرفعال است.');
      return;
    }

    let apiKey: string | undefined;
    try { apiKey = options.getApiKey()?.trim(); } catch {}
    if (!apiKey) {
      fail('missing_key', 'سرویس مکالمه زنده هنوز پیکربندی نشده است.');
      return;
    }

    let ai: LiveApiClient;
    try { ai = createClient(apiKey); }
    catch {
      fail('provider_unavailable', 'موتور مکالمه زنده در دسترس نیست.');
      return;
    }
    connectTimer = setTimeout(() => {
      fail('connect_timeout', 'اتصال به هوش مصنوعی بیش از حد طول کشید. دوباره تلاش کنید.');
    }, connectTimeoutMs);

    void Promise.resolve().then(() => ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 120,
            silenceDurationMs: 600,
          },
          activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onmessage: (providerMessage: any) => {
          if (isClosed || client.readyState !== WebSocket.OPEN) return;
          const content = providerMessage?.serverContent || {};
          const parts = content?.modelTurn?.parts || [];
          const inputFinal = providerMessage?.inputTranscription?.text ??
            content?.inputTranscription?.text;
          const inputInterim = providerMessage?.interimInputTranscription?.text ??
            content?.interimInputTranscription?.text;
          const userText = typeof inputFinal === 'string' && inputFinal.length > 0 ? inputFinal : inputInterim;

          if (typeof userText === 'string' && userText) {
            send({
              type: 'user_transcript',
              text: userText,
              final: typeof inputFinal === 'string' && inputFinal.length > 0,
            });
          }

          const outputText = providerMessage?.outputTranscription?.text ??
            content?.outputTranscription?.text ??
            content?.outputAudioTranscription?.text;
          const hasAudioOrText = parts.some((part: any) =>
            Boolean(part?.inlineData?.data || part?.text),
          ) || (typeof outputText === 'string' && outputText.length > 0);

          if (hasAudioOrText) {
            const id = beginResponse();
            let sentTextPart = false;
            for (const part of parts) {
              if (typeof part?.inlineData?.data === 'string' && part.inlineData.data) {
                send({
                  type: 'audio_chunk',
                  responseId: id,
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                });
              }
              if (typeof part?.text === 'string' && part.text) {
                sentTextPart = true;
                send({ type: 'ai_text_chunk', responseId: id, text: part.text });
              }
            }
            // Native audio transcription may arrive as a separate top-level event.
            // Prefer text parts when present to avoid duplicating the same words.
            if (!sentTextPart && typeof outputText === 'string' && outputText) {
              send({ type: 'ai_transcript', responseId: id, text: outputText });
            }
          }

          if (content?.interrupted) {
            send({ type: 'interrupted', responseId: responseId || callId });
            responseId = '';
          }
          if (content?.turnComplete) {
            send({ type: 'turn_complete', responseId: responseId || callId });
            responseId = '';
          }
        },
        onerror: () => {
          fail('provider_error', 'ارتباط با موتور مکالمه هوش مصنوعی قطع شد. لطفاً دوباره تلاش کنید.');
        },
        onclose: () => {
          if (!isClosed) {
            send({ type: 'session_closed', reasonCode: 'provider_closed', reason: 'نشست مکالمه از سمت سرویس پایان یافت.' });
            cleanup(1011, 'Provider session closed');
          }
        },
      },
    })).then(session => {
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = null;
      if (isClosed) {
        try { session.close(); } catch {}
        return;
      }
      liveSession = session;
      sessionTimer = setTimeout(() => {
        finishSession('زمان مجاز این گفت‌وگوی آزمایشی به پایان رسید. برای ادامه، مکالمه تازه‌ای شروع کنید.');
      }, maxSessionMs);
      const connected = send({
        type: 'connected',
        model,
        sampleRate: 24000,
        inputSampleRate: 16000,
        maxSessionMs,
      });
      if (!connected || isClosed) return;
      try {
        session.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{
              text: 'مکالمه تازه آغاز شده است. به فارسی یک خوش‌آمدگویی کوتاه بگو، خودت را فورزا معرفی کن و مشتری را دعوت کن سؤالش را مطرح کند. سپس منتظر صحبت او بمان.',
            }],
          }],
          turnComplete: true,
        });
      } catch {
        fail('provider_send_failed', 'شروع مکالمه زنده با مشکل روبه‌رو شد.');
        return;
      }
      console.info(`[FORZA_LIVE] connected call=${callId.slice(0, 8)} model=${model} active=${activeTotal}`);
    }).catch(() => {
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = null;
      if (!isClosed) fail('provider_unavailable', 'در حال حاضر امکان اتصال به هوش مصنوعی زنده وجود ندارد.');
    });

    // No transcript, audio, API key, or customer content is logged.
    client.once('close', () => {
      console.info(`[FORZA_LIVE] closed call=${callId.slice(0, 8)} active=${Math.max(0, activeTotal)}`);
    });
  });

  return () => {
    server.off('upgrade', onUpgrade);
    for (const client of activeSockets) {
      try { client.close(1001, 'Gateway shutdown'); } catch { client.terminate(); }
    }
    try { wss.close(); } catch {}
  };
}
