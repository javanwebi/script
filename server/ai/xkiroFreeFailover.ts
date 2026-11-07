/**
 * Dynamic free-only model routing for FORZA's xKiro text responses.
 * The public catalog is the source of truth. Fail closed when it is unavailable:
 * no unverified or paid model is ever submitted.
 */
import { BaiConsultError, completeXkiroConsult, streamXkiroConsult, type BaiConsultOptions } from './baiConsult';

const CATALOG_URL = 'https://api.xkiro.com/v1/models';
const USAGE_URL = 'https://api.xkiro.com/v1/usage';
const CACHE_MS = 5 * 60_000;
const MODEL_COOLDOWN_MS = 2 * 60_000;
const VERIFIED_DEFAULT_MODEL='qwen/qwen3.5-flash:free';
const STREAM_FIRST_TOKEN_MS=4500;
const STREAM_IDLE_AFTER_DELTA_MS=1100;
const NONSTREAM_VERIFY_MS=4500;

type CatalogRecord = {
  id?: unknown;
  modality?: unknown;
  access_tier?: unknown;
  pricing?: {input?: unknown; output?: unknown};
};

type PoolCache = { models: string[]; expires: number };
const catalogs = new WeakMap<typeof fetch, PoolCache>();
const pending = new WeakMap<typeof fetch, Promise<string[]>>();
// Timing metadata only. Keep successful fast fallbacks instead of rotating
// every customer back through unknown/slow models. No speculative extra calls.
const cooldowns = new Map<string, number>();
let accountRateLimitUntil = 0;

function freeChatModel(entry: CatalogRecord): entry is CatalogRecord & { id: string } {
  if (typeof entry.id !== 'string' || !/^[a-z0-9_.-]+\/[a-z0-9_.:-]+$/i.test(entry.id)) return false;
  if (entry.access_tier !== 'free') return false;
  if (entry.modality !== undefined && entry.modality !== 'chat') return false;
  // A model with a contradictory nonzero price must never enter the free pool.
  for (const price of [entry.pricing?.input, entry.pricing?.output]) {
    if (price !== undefined && (typeof price !== 'number' || price !== 0)) return false;
  }
  return true;
}

export async function listVerifiedXkiroFreeChatModels(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<string[]> {
  const cached = catalogs.get(fetchImpl);
  if (cached && cached.expires > now) return cached.models;
  const inflight = pending.get(fetchImpl);
  if (inflight) return inflight;
  const task = (async () => {
    let response: Response;
    try {
      response = await fetchImpl(CATALOG_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new BaiConsultError('xkiro_catalog_unreachable');
    }
    if (!response.ok) throw new BaiConsultError('xkiro_catalog_http_' + response.status);
    const result = await response.json().catch(() => null) as
      {data?: unknown} | null;
    if (!Array.isArray(result?.data)) throw new BaiConsultError('xkiro_catalog_invalid');
    const models = [...new Set(result.data
      .filter((entry: unknown) => entry && typeof entry === 'object' && freeChatModel(entry as CatalogRecord))
      .map((entry: {id: string}) => entry.id))];
    if (!models.length) throw new BaiConsultError('xkiro_no_verified_free_models');
    catalogs.set(fetchImpl, {models, expires: Date.now() + CACHE_MS});
    return models;
  })();
  pending.set(fetchImpl, task);
  try { return await task; }
  finally { pending.delete(fetchImpl); }
}

async function exhaustedFreeAllowance(apiKey: string, fetchImpl: typeof fetch): Promise<boolean> {
  // Checking the current account allowance prevents wasteful retry loops when
  // a 429 is shared across every free model in the account.
  try {
    const response = await fetchImpl(USAGE_URL, {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const body = await response.json() as {free_tokens?:{remaining?:unknown}};
    return typeof body?.free_tokens?.remaining === 'number' && body.free_tokens.remaining <= 0;
  } catch { return false; }
}

export type FreeXkiroResult = {
  text: string;
  model: string;
  firstTokenMs: number;
  completionMode: 'stream'|'nonstream_verified';
  fallbackMs?: number;
};

/**
 * Use exactly one catalog-verified configured free model. The old rotating
 * pool could spend 2-4 long timeouts per customer turn and switch to models
 * that had never been tested for Persian industrial speech.
 *
 * If SSE stops after emitting text, one bounded non-stream request verifies
 * the final answer. Only a suffix is emitted, and only if the verified answer
 * begins with the exact text already delivered to the caller.
 */
export async function streamXkiroFreePool(
  options: BaiConsultOptions,
): Promise<FreeXkiroResult> {
  const fetchImpl=options.fetchImpl??fetch;
  if(accountRateLimitUntil>Date.now())
    throw new BaiConsultError('xkiro_rate_limited_retry_later');

  const verified=await listVerifiedXkiroFreeChatModels(fetchImpl);
  const model=verified.includes(options.model)
    ?options.model
    :verified.includes(VERIFIED_DEFAULT_MODEL)?VERIFIED_DEFAULT_MODEL:null;
  if(!model)throw new BaiConsultError('xkiro_configured_model_not_verified_free');

  const cooldownUntil=cooldowns.get(model)||0;
  if(cooldownUntil>Date.now())throw new BaiConsultError('xkiro_model_temporarily_unavailable');

  let deliveredText='';
  let firstTokenMs=-1;
  const streamStarted=Date.now();
  const onDelta=(delta:string,fullText:string)=>{
    if(firstTokenMs<0)firstTokenMs=Date.now()-streamStarted;
    deliveredText=fullText;
    options.onDelta(delta,fullText);
  };

  try{
    const result=await streamXkiroConsult({
      ...options,
      model,
      fetchImpl,
      firstTokenTimeoutMs:STREAM_FIRST_TOKEN_MS,
      idleAfterDeltaTimeoutMs:STREAM_IDLE_AFTER_DELTA_MS,
      onDelta,
    });
    cooldowns.delete(model);
    return {...result,completionMode:'stream'};
  }catch(error){
    if(options.signal?.aborted)throw new BaiConsultError('client_aborted');
    const code=error instanceof BaiConsultError?error.code:'upstream_network_error';

    // A shared account 429 is not fixed by retrying or changing models.
    if(/^http_429/.test(code)){
      if(await exhaustedFreeAllowance(options.apiKey,fetchImpl))
        throw new BaiConsultError('xkiro_account_free_quota_exhausted');
      if(error instanceof BaiConsultError&&error.retryAfterMs&&error.retryAfterMs>0){
        accountRateLimitUntil=Date.now()+Math.min(error.retryAfterMs,5*60_000);
        throw new BaiConsultError('xkiro_rate_limited_retry_later');
      }
      throw error instanceof BaiConsultError?error:new BaiConsultError(code);
    }

    const recoverable=
      code==='provider_stream_idle_after_delta'||
      code==='provider_stream_incomplete'||
      code==='upstream_timeout'||
      code==='upstream_network_error'||
      /^http_50[023]($|_)/.test(code);

    if(!recoverable){
      if(/^http_503/.test(code))cooldowns.set(model,Date.now()+15_000);
      throw error instanceof BaiConsultError?error:new BaiConsultError(code);
    }

    try{
      const completed=await completeXkiroConsult({
        ...options,
        model,
        fetchImpl,
      },NONSTREAM_VERIFY_MS);

      if(deliveredText&&!completed.text.startsWith(deliveredText)){
        throw new BaiConsultError('xkiro_stream_verification_mismatch');
      }

      const suffix=completed.text.slice(deliveredText.length);
      if(suffix)options.onDelta(suffix,completed.text);
      cooldowns.delete(model);

      console.info('[FORZA XKIRO FREE] verified_nonstream model='+model+
        ' stream_partial_chars='+deliveredText.length+
        ' suffix_chars='+suffix.length+
        ' verify_ms='+completed.elapsedMs);

      return {
        text:completed.text,
        model,
        firstTokenMs,
        completionMode:'nonstream_verified',
        fallbackMs:completed.elapsedMs,
      };
    }catch(verifyError){
      if(options.signal?.aborted)throw new BaiConsultError('client_aborted');
      const verifyCode=verifyError instanceof BaiConsultError
        ?verifyError.code:'xkiro_nonstream_verification_failed';
      cooldowns.set(model,Date.now()+5000);
      console.warn('[FORZA XKIRO FREE] verified_completion_failed model='+model+
        ' stream_code='+code+' verify_code='+verifyCode+
        ' partial_chars='+deliveredText.length);
      throw verifyError instanceof BaiConsultError
        ?verifyError:new BaiConsultError(verifyCode);
    }
  }
}
