import { forzaTurnIntent } from './forzaBargeIn';
import { forzaEndOfTurnPauseMs, normalizePersianTranscript } from './forzaSpeechPipeline';

/** Frozen prefix from a previous recognition connection. Interim hypotheses
 * from the current connection replace each other; they are never appended. */
export function joinForzaRecognitionSession(prefix: string, hypothesis: string): string {
  return [normalizePersianTranscript(prefix), normalizePersianTranscript(hypothesis)]
    .filter(Boolean).join(' ');
}

export const FORZA_LISTENING_ACK = 'بله، گوش می‌کنم.';

/** Listening feedback is not a claim that the server understood an unfinished
 * request. Only a stable mid-thought pause gets feedback, at most once per 9s. */
export function shouldAcknowledgeForzaPause(text: string, stableMs: number,
  silenceMs: number, sinceLastMs: number): boolean {
  const normalized = normalizePersianTranscript(text);
  return normalized.length >= 12 && normalized.split(/\s+/u).length >= 4 &&
    stableMs >= 320 && silenceMs >= 320 && silenceMs <= 900 &&
    sinceLastMs >= 9000 && forzaTurnIntent(normalized) === 'question' &&
    forzaEndOfTurnPauseMs(normalized, false) >= 1450;
}
