import { Buffer } from 'node:buffer';

export type ForzaAvalaiSttOptions = {
  apiKey: string;
  audioMimeType?: string;
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class ForzaAvalaiSttError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, status?: number) {
    super(code);
    this.name = 'ForzaAvalaiSttError';
    this.code = code;
    this.status = status;
  }
}

const MAX_AUDIO_BASE64_CHARS = 8_000_000;
const MAX_AUDIO_BYTES = 6_000_000;
const DEFAULT_MODEL = 'gpt-transcribe';
const TRANSCRIPTION_PROMPT =
  'زبان گفتار فارسی است. فقط گفتار اصلی گوینده نزدیک به میکروفون را دقیق رونویسی کن؛ گفت‌وگوهای دور، صدای بلندگو و نویز پس‌زمینه را نادیده بگیر. اصطلاحات صنعتی را دقیق بنویس: صنعت پیش، فورزا، تسمه تایمینگ، تسمه وی‌بلت، تسمه شیاری، پولی، بلبرینگ، یاتاقان، رولیک، شفت، گیربکس، دور، فشار، دما، میلی‌متر، HTD، SPB، SKF، FAG. کد و عددی را که واضح شنیده نمی‌شود حدس نزن. فقط متن گفته‌شده را برگردان.';

function normalizeAudioMime(value?: string): string {
  const mime = String(value || 'audio/webm').split(';')[0].trim().toLowerCase();
  const allowed = new Set([
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
    'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac',
  ]);
  return allowed.has(mime) ? mime : 'audio/webm';
}

function audioExtension(mime: string): string {
  switch (mime) {
    case 'audio/ogg': return 'ogg';
    case 'audio/mp4': return 'm4a';
    case 'audio/mpeg': return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav': return 'wav';
    case 'audio/flac': return 'flac';
    case 'audio/aac': return 'aac';
    default: return 'webm';
  }
}

function readEventData(frame: string): string {
  return frame.split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n')
    .trim();
}

function transcriptFromPayload(payload: any): string {
  const candidates = [
    payload?.text,
    payload?.transcript?.text,
    payload?.result?.text,
    payload?.data?.text,
  ];
  return candidates.find(value => typeof value === 'string')?.trim() || '';
}

async function readStreamingTranscript(response: Response): Promise<string> {
  if (!response.body) throw new ForzaAvalaiSttError('avalai_stt_missing_stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let deltas = '';
  let finalText = '';
  let sawDone = false;

  const dispatch = (frame: string) => {
    const raw = readEventData(frame);
    if (!raw || raw === '[DONE]') return;
    let payload: any;
    try { payload = JSON.parse(raw); }
    catch { throw new ForzaAvalaiSttError('avalai_stt_invalid_event'); }

    const type = String(payload?.type || '');
    if (type === 'error' || payload?.error) {
      throw new ForzaAvalaiSttError('avalai_stt_provider_error');
    }
    if (type === 'transcript.text.delta') {
      const delta = typeof payload.delta === 'string'
        ? payload.delta
        : typeof payload.text === 'string' ? payload.text : '';
      deltas += delta;
    } else if (type === 'transcript.text.done') {
      finalText = transcriptFromPayload(payload) || deltas;
      sawDone = true;
    } else if (type === 'transcription.done' || type === 'done') {
      finalText = transcriptFromPayload(payload) || deltas;
      sawDone = true;
    } else if (typeof payload.text === 'string' && !type) {
      finalText = payload.text.trim();
      sawDone = true;
    }
  };

  try {
    while (!sawDone) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 64_000) throw new ForzaAvalaiSttError('avalai_stt_event_too_large');
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending)) !== null) {
        const frame = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        dispatch(frame);
        if (sawDone) break;
      }
    }
    if (!sawDone) {
      pending += decoder.decode();
      if (pending.trim()) dispatch(pending);
    }
    if (!sawDone) throw new ForzaAvalaiSttError('avalai_stt_incomplete_stream');
    const text = finalText.trim();
    if (!text) throw new ForzaAvalaiSttError('avalai_stt_empty_transcript');
    return text;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function transcribeForzaAvalaiAudio(
  audioBase64: string,
  options: ForzaAvalaiSttOptions,
): Promise<{ text: string; model: string; elapsedMs: number }> {
  const started = Date.now();
  const encoded = String(audioBase64 || '').replace(/^data:[^,]*;base64,/i, '').trim();
  if (!options.apiKey?.trim()) throw new ForzaAvalaiSttError('avalai_stt_key_missing');
  if (!encoded || encoded.length > MAX_AUDIO_BASE64_CHARS ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new ForzaAvalaiSttError('avalai_stt_invalid_audio');
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) {
    throw new ForzaAvalaiSttError('avalai_stt_invalid_audio');
  }

  const model = options.model || DEFAULT_MODEL;
  if (model !== DEFAULT_MODEL) throw new ForzaAvalaiSttError('avalai_stt_model_not_allowed');
  const mime = normalizeAudioMime(options.audioMimeType);
  const form = new FormData();
  const audioBlob = new Blob([new Uint8Array(bytes)], { type: mime });
  form.append('file', audioBlob, 'forza-turn.' + audioExtension(mime));
  form.append('model', model);
  form.append('response_format', 'json');
  form.append('stream', 'true');
  form.append('languages', 'fa');
  form.append('prompt', TRANSCRIPTION_PROMPT);
  form.append('temperature', '0');

  const timeout = AbortSignal.timeout(Math.max(4_000, Math.min(25_000, options.timeoutMs ?? 18_000)));
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const fetchImpl = options.fetchImpl || fetch;

  let response: Response;
  try {
    response = await fetchImpl('https://api.avalai.ir/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + options.apiKey.trim() },
      body: form,
      signal,
    });
  } catch (error: any) {
    if (options.signal?.aborted) throw new ForzaAvalaiSttError('avalai_stt_aborted');
    if (timeout.aborted) throw new ForzaAvalaiSttError('avalai_stt_timeout');
    throw new ForzaAvalaiSttError('avalai_stt_network_error');
  }

  if (!response.ok) {
    throw new ForzaAvalaiSttError('avalai_stt_http_' + response.status, response.status);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let text = '';
  if (contentType.includes('text/event-stream')) {
    text = await readStreamingTranscript(response);
  } else {
    let payload: any;
    try { payload = await response.json(); }
    catch { throw new ForzaAvalaiSttError('avalai_stt_invalid_response'); }
    text = transcriptFromPayload(payload);
    if (!text) throw new ForzaAvalaiSttError('avalai_stt_empty_transcript');
  }

  return { text, model, elapsedMs: Date.now() - started };
}
