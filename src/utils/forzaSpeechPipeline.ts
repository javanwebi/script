import { analyzePersianSentenceCompletion } from './silenceDetector';

export interface BrowserSpeechAlternative {
  transcript?: string;
}
export interface BrowserSpeechResult {
  isFinal: boolean;
  [index: number]: BrowserSpeechAlternative | boolean;
}

/**
 * Web Speech results are cumulative. Reading only resultIndex drops already
 * confirmed Persian words when Chrome delivers the next interim hypothesis.
 * Reconstruct the whole utterance on every event, preserving technical codes.
 */
export function extractPersianSpeechRecognition(
  results: ArrayLike<BrowserSpeechResult>,
): { text: string; finalText: string; hasInterim: boolean } {
  const finalized: string[] = [];
  const provisional: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const raw = result?.[0];
    const transcript = raw && typeof raw !== 'boolean'
      ? normalizePersianTranscript(raw.transcript || '')
      : '';
    if (!transcript) continue;
    if (result.isFinal) finalized.push(transcript);
    else provisional.push(transcript);
  }
  const finalText = finalized.join(' ').replace(/\s+/g, ' ').trim();
  return {
    finalText,
    hasInterim: provisional.length > 0,
    text: [...finalized, ...provisional].join(' ').replace(/\s+/g, ' ').trim(),
  };
}

export function normalizePersianTranscript(value: string): string {
  return String(value || '')
    .replace(/[\u064A]/g, 'ی')
    .replace(/[\u0643]/g, 'ک')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Finish complete questions quickly, but preserve natural mid-thought pauses.
 * No fixed 2.3s delay after every recognition event.
 */
export function forzaEndOfTurnPauseMs(text: string, hasInterim: boolean): number {
  const analysis = analyzePersianSentenceCompletion(text);
  if (analysis.isMidThought) return hasInterim ? 1900 : 1750;
  if (hasInterim) return 1100;
  return Math.min(950, Math.max(700, analysis.recommendedPauseMs - 100));
}

/**
 * Spoken phonemes, NOT product identifiers: only call when synthesizing audio.
 * Never replace a technical code in the actual message, catalog or quotation.
 */
const spokenTechnicalCodes: Readonly<Record<string, string>> = {
  '2RS': 'دو آر اِس',
  'RS': 'آر اِس',
  'ZZ': 'زِد زِد',
  'C3': 'سی سه',
  'C4': 'سی چهار',
  'DIN': 'دین',
  'ISO': 'آی اِس اُ',
  'SWR': 'اِس دابلیو آر',
  'PK': 'پی کا',
  'PJ': 'پی جِی',
  'PL': 'پی اِل',
  'GT': 'جی تی',
  'XPA': 'ایکس پی اِی',
  'XPB': 'ایکس پی بی',
  'XPC': 'ایکس پی سی',
};
export function verbalizeForzaTechnicalTerms(text: string): string {
  return String(text || '').replace(
    /\b(?:2RS|RS|ZZ|C3|C4|DIN|ISO|SWR|PK|PJ|PL|GT|XPA|XPB|XPC)\b/gi,
    code => spokenTechnicalCodes[code.toUpperCase()] || code,
  );
}
