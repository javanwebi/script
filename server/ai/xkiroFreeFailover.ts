/**
 * Dynamic free-only model routing for FORZA's xKiro text responses.
 * The public catalog is the source of truth. Fail closed when it is unavailable:
 * no unverified or paid model is ever submitted.
 */
import { BaiConsultError, streamXkiroConsult, type BaiConsultOptions } from './baiConsult';

const CATALOG_URL = 'https://api.xkiro.com/v1/models';
const USAGE_URL = 'https://api.xkiro.com/v1/usage';
const CACHE_MS = 5 * 60_000;
const MODEL_COOLDOWN_MS = 2 * 60_000;
const MAX_ATTEMPTS_VOICE = 2;
const MAX_ATTEMPTS_DESK = 4;

type CatalogRecord = {
  id?: unknown;
  modality?: unknown;
  access_tier?: unknown;
  pricing?: {input?: unknown; output?: unknown};
};

type PoolCache = { models: string[]; expires: number };
const catalogs = new WeakMap<typeof fetch, PoolCache>();
const pending = new WeakMap<typeof fetch, Promise<string[]>>();
const cooldowns = new Map<string, number>();
let roundRobin = 0;
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

export type FreeXkiroResult = {text: string; model: string; firstTokenMs: number};

export async function streamXkiroFreePool(
  options: BaiConsultOptions,
): Promise<FreeXkiroResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (accountRateLimitUntil > Date.now()) throw new BaiConsultError('xkiro_rate_limited_retry_later');
  const verified = await listVerifiedXkiroFreeChatModels(fetchImpl);
  const preferred = verified.includes(options.model) ? options.model : null;
  const rotated = verified.slice(roundRobin % verified.length).concat(verified.slice(0, roundRobin % verified.length));
  roundRobin += 1;
  const ranked = [...new Set([...(preferred ? [preferred] : []), ...rotated])];
  let attempted = 0;
  const cap = options.voice ? MAX_ATTEMPTS_VOICE : MAX_ATTEMPTS_DESK;
  let lastCode = 'xkiro_free_models_unavailable';
  for (const model of ranked) {
    if (attempted >= cap) break;
    if ((cooldowns.get(model) || 0) > Date.now()) continue;
    attempted++;
    let delivered = false;
    try {
      const result = await streamXkiroConsult({
        ...options,
        model,
        fetchImpl,
        // Two reasonably fast attempts fit the current browser's 25s
        // first-text timeout; don't silently wait 22s per failed model.
        firstTokenTimeoutMs: options.voice ? 9500 : 11000,
        onDelta: (delta, fullText) => {
          delivered = true;
          options.onDelta(delta, fullText);
        },
      });
      cooldowns.delete(model);
      return result;
    } catch (error: unknown) {
      if (delivered) throw error; // Never replay a partial response.
      const code = error instanceof BaiConsultError ? error.code : 'upstream_network_error';
      lastCode = code;
      // Invalid account credentials, depleted wallet, malformed inputs and
      // general 400 errors are not fixed by moving to another model.
      if (/^http_(400|401|402)(_|$)/.test(code)) throw error;
      cooldowns.set(model, Date.now() + (/^http_403/.test(code) ? 15 * 60_000 : MODEL_COOLDOWN_MS));
      if (/^http_429/.test(code)) {
        if (await exhaustedFreeAllowance(options.apiKey, fetchImpl)) {
          throw new BaiConsultError('xkiro_account_free_quota_exhausted');
        }
        // A Retry-After response may reflect an account-wide RPM restriction.
        // Respect it instead of hammering the other 44 free models.
        if (error instanceof BaiConsultError && error.retryAfterMs && error.retryAfterMs > 0) {
          accountRateLimitUntil = Date.now() + Math.min(error.retryAfterMs, 5 * 60_000);
          throw new BaiConsultError('xkiro_rate_limited_retry_later');
        }
      }
      console.warn('[FORZA XKIRO FREE] model=' + model + ' unavailable code=' + code + ' tried=' + attempted);
    }
  }
  throw new BaiConsultError(attempted === 0 ? 'xkiro_free_pool_cooldown' : 'xkiro_free_pool_exhausted_' + lastCode);
}
