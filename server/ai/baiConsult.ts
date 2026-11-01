/**
 * B.AI's OpenAI-compatible Chat Completions SSE bridge for FORZA.
 * This module is server-only. Never expose the API key to the browser.
 * No silent retry (which could double-bill an API call).
 */
export type BaiConsultOptions = {
  apiKey: string;
  model: string;
  query: string;
  history?: Array<{ role?: string; sender?: string; text?: string }>;
  catalogContext?: string;
  voice?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  firstTokenTimeoutMs?: number;
  onDelta: (delta: string, textSoFar: string) => void;
};

export class BaiConsultError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs?: number) {
    super(code);
    this.name = 'BaiConsultError';
  }
}

export function configuredBaiModel(env: NodeJS.ProcessEnv, voice: boolean): string | null {
  const provider = String(voice ? env.FORZA_VOICE_PROVIDER : env.FORZA_DESK_PROVIDER || '').trim().toLowerCase();
  if (provider !== 'bai' || !env.BAI_API_KEY?.trim()) return null;
  // Defaults are deliberately cheap, not assumed free. Check B.AI billing.
  return String((voice ? env.BAI_MODEL_VOICE : env.BAI_MODEL_DESK) || 'qwen3.7-flash').trim();
}


export function configuredXkiroModel(env: NodeJS.ProcessEnv, voice: boolean): string | null {
  const provider = String((voice ? env.FORZA_VOICE_PROVIDER : env.FORZA_DESK_PROVIDER) || '').trim().toLowerCase();
  if (provider !== 'xkiro' || !env.XKIRO_API_KEY?.trim()) return null;
  // The free Qwen model ID is vendor-qualified and carries the :free access tier suffix.
  return String((voice ? env.XKIRO_MODEL_VOICE : env.XKIRO_MODEL_DESK) || 'qwen/qwen3.5-flash:free').trim();
}

/**
 * xKiro's free gateway has exhibited >10s time-to-first-token on the VPS.
 * Keep B.AI budgets unchanged and allow xKiro enough time to deliver the
 * first chunk before falling back to a different provider.
 */
export function providerStreamTimeouts(provider: 'xkiro' | 'bai', voice: boolean) {
  return {
    firstTokenMs: provider === 'xkiro' ? (voice ? 22000 : 24000) : (voice ? 10000 : 15000),
    totalMs: provider === 'xkiro' && voice ? 38000 : (voice ? 30000 : 45000),
  };
}

async function streamOpenAiCompatible(options: BaiConsultOptions, endpoint: string): Promise<{ text: string; model: string; firstTokenMs: number }> {
  const {
    apiKey, model, query, history = [], catalogContext = '',
    voice = false, signal, fetchImpl = fetch, onDelta, firstTokenTimeoutMs,
  } = options;
  const started = Date.now();
  const isXkiro = endpoint === 'https://api.xkiro.com/v1/chat/completions';
  const budgets = providerStreamTimeouts(isXkiro ? 'xkiro' : 'bai', voice);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budgets.totalMs);
  let firstTokenTimer: ReturnType<typeof setTimeout> | undefined =
    setTimeout(() => controller.abort(), firstTokenTimeoutMs ?? budgets.firstTokenMs);
  const upstreamSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let response: Response | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let textSoFar = '';
  let firstTokenMs = -1;
  let finished = false;
  let finishReason: string | null = null;
  const historyMessages = history.slice(-6)
    .filter(item => typeof item?.text === 'string' && !!item.text.trim())
    .map(item => ({
      role: item.role === 'user' || item.sender === 'user' ? 'user' : 'assistant',
      content: String(item.text).slice(0, 3000),
    }));
  const systemMessage = voice
    ? 'شما FORZA مشاور صوتی قطعات صنعتی صنعت پیش هستید. در ۲ تا ۳ جمله کامل، حداکثر ۶۰۰ نویسه و بدون جدول یا Markdown پاسخ دهید. جمله و واژه آخر را نیمه‌تمام نگذارید. درباره کاتالوگ فقط اطلاعات تأییدشده را بیان کنید.'
    : 'شما مشاور فنی صنعت پیش هستید. به فارسی دقیق و کاربردی پاسخ دهید. درباره مشخصات، موجودی و قیمت بدون مستندات قطعی ادعای ساختگی نکنید.';

  const parseData = (raw: string) => {
    if (raw === '[DONE]') { finished = true; return; }
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new BaiConsultError('invalid_sse_json'); }
    if (parsed?.error) throw new BaiConsultError('provider_stream_error');
    // Some OpenAI-compatible gateways return HTTP 200 and [DONE] even when
    // the model stopped because max_tokens was exhausted. This MUST NOT be
    // advertised as a complete answer or sent to Nima.
    const reason = parsed?.choices?.[0]?.finish_reason;
    if(typeof reason==='string'&&reason){
      finishReason=reason;
      if(reason!=='stop')throw new BaiConsultError(
        reason==='length'?'provider_output_truncated':'provider_finish_'+
          reason.replace(/[^a-z0-9_-]/gi,'').slice(0,32));
    }
    const delta = parsed?.choices?.[0]?.delta?.content;
    const str = typeof delta === 'string'
      ? delta
      : Array.isArray(delta)
        ? delta.filter((p: any) => p?.type === 'text' || typeof p?.text === 'string')
          .map((p: any) => String(p.text || '')).join('')
        : '';
    if (!str) return;
    if (firstTokenMs < 0) {
      firstTokenMs = Date.now() - started;
      if (firstTokenTimer) clearTimeout(firstTokenTimer);
      firstTokenTimer = undefined;
    }
    textSoFar += str;
    onDelta(str, textSoFar);
  };

  const consumeEvent = (event: string) => {
    const data = event.split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n').trim();
    if (data) parseData(data);
  };

  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        stream: true,
        // Confirmed effective for xKiro's Qwen 3.5 Flash: avoid long reasoning
        // before speaking. Do not send provider-specific options to B.AI.
        ...(isXkiro && model === 'qwen/qwen3.5-flash:free' ? { reasoning_effort: 'none' } : {}),
        // A 256-token voice budget cut Persian answers mid-word. Keep the
        // prompt concise but allow enough output for a finished explanation.
        max_tokens: 768,
        messages: [
          { role: 'system', content: systemMessage + String(catalogContext).slice(0, 5000) },
          ...historyMessages,
          { role: 'user', content: String(query || '').slice(0, 6000) },
        ],
      }),
      signal: upstreamSignal,
    });
    if (!response.ok) {
      let providerCode = '';
      try {
        const payload = await response.clone().json();
        providerCode = String(payload?.error?.code || payload?.error?.type || '')
          .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
      } catch {}
      const retryAfter = response.headers.get('retry-after');
      const retrySeconds = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) : null;
      const retryDate = retryAfter && retrySeconds === null ? Date.parse(retryAfter) : NaN;
      const retryAfterMs = retrySeconds !== null
        ? Math.max(0, retrySeconds * 1000)
        : Number.isFinite(retryDate) ? Math.max(0, retryDate - Date.now()) : undefined;
      throw new BaiConsultError(
        'http_' + response.status + (providerCode ? '_' + providerCode : ''),
        retryAfterMs,
      );
    }
    if (!(response.headers.get('content-type') || '').includes('text/event-stream')) {
      throw new BaiConsultError('unexpected_content_type');
    }
    if (!response.body) throw new BaiConsultError('missing_stream_body');

    const decoder = new TextDecoder();
    reader = response.body.getReader();
    let buffer = '';
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      if (buffer.length > 128_000) throw new BaiConsultError('oversized_sse_frame');
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        consumeEvent(event);
        if (finished) break;
      }
    }
    if (!finished && buffer.trim()) consumeEvent(buffer);
    // Treat stream EOF as an incomplete response unless the provider sent
    // [DONE] or an explicit normal stop. Otherwise a dropped connection
    // could silently turn "تسمه، نواری از جنس لاست..." into a final answer.
    if (!finished && finishReason!=='stop')
      throw new BaiConsultError('provider_stream_incomplete');
    if (!textSoFar.trim()) throw new BaiConsultError('empty_completion');
    return { text: textSoFar, model, firstTokenMs };
  } catch (error) {
    // CRITICAL: Never treat a half-delivered answer as successful. The HTTP
    // handler knows whether chunks were already emitted; it must send an
    // SSE error rather than a final done when this rejects.
    if (error instanceof BaiConsultError) throw error;
    if (signal?.aborted) throw new BaiConsultError('client_aborted');
    if (controller.signal.aborted) throw new BaiConsultError('upstream_timeout');
    throw new BaiConsultError('upstream_network_error');
  } finally {
    clearTimeout(timeout);
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}

export function streamBaiConsult(options: BaiConsultOptions) {
  return streamOpenAiCompatible(options, 'https://api.b.ai/v1/chat/completions');
}

export function streamXkiroConsult(options: BaiConsultOptions) {
  return streamOpenAiCompatible(options, 'https://api.xkiro.com/v1/chat/completions');
}
