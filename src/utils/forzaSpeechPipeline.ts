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

/** Drop Chrome results already dispatched as the previous customer turn.
 * WebSpeech results are cumulative while recognition stays alive for barge-in.
 * Without a per-turn cursor, a previous final sentence is repeated as a
 * fresh correction during the next AI reply.
 */
export function extractPersianSpeechSince(
  results:ArrayLike<BrowserSpeechResult>,
  consumedResultCount:number,
  interimCheckpoint:Readonly<Record<number,string>> = {},
):ReturnType<typeof extractPersianSpeechRecognition>{
  const start=Number.isFinite(consumedResultCount)
    ?Math.max(0,Math.min(results.length,Math.floor(consumedResultCount))):0;
  const remaining:BrowserSpeechResult[]=[];
  for(let i=start;i<results.length;i++){
    const result=results[i];
    const previous=interimCheckpoint[i];
    const raw=result?.[0];
    if(previous && raw && typeof raw!=='boolean'){
      const current=normalizePersianTranscript(raw.transcript||'');
      // An interim slot is mutable. Consume its dispatched prefix, not the
      // entire slot: Chrome can append the next sentence at the same index.
      const text=current===previous ? '' : current.startsWith(previous+' ')
        ? current.slice(previous.length).trim() : current;
      remaining.push({0:{transcript:text},isFinal:result.isFinal});
    }else remaining.push(result);
  }
  return extractPersianSpeechRecognition(remaining);
}

export function checkpointForzaRecognition(results:ArrayLike<BrowserSpeechResult>){
  let count=0;
  while(count<results.length && results[count]?.isFinal)count++;
  const interim:Record<number,string>={};
  for(let i=count;i<results.length;i++){
    const raw=results[i]?.[0];
    if(raw && typeof raw!=='boolean')interim[i]=normalizePersianTranscript(raw.transcript||'');
  }
  return {count,interim};
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
  // A provisional browser hypothesis can still gain another word or SKU.
  if (analysis.isMidThought) return hasInterim ? 2400 : Math.max(1900, analysis.recommendedPauseMs);
  if (analysis.isComplete && analysis.confidence >= 0.9) {
    return hasInterim ? 1100 : Math.max(550, Math.min(850, analysis.recommendedPauseMs - 150));
  }
  if (analysis.isComplete) return hasInterim ? 1450 : Math.max(1000, analysis.recommendedPauseMs);
  return hasInterim ? 1950 : Math.max(1450, analysis.recommendedPauseMs);
}

/**
 * The browser and microphone VAD must agree on an acoustic pause AND the
 * recognized words must have stopped changing. This makes interim revisions
 * ("6202 ... no, 6203") postpone dispatch without an additional model/API.
 * A null VAD silence means the analyser is unavailable; use text stability.
 */
export function forzaTurnRemainingWaitMs(
  text: string,
  hasInterim: boolean,
  transcriptStableMs: number,
  vadSilenceMs: number | null,
): number {
  if (!text.trim()) return 0;
  const requiredMs = forzaEndOfTurnPauseMs(text, hasInterim);
  // Late final ASR hypotheses must not restart the entire acoustic endpoint
  // window. Preserve the full pause for unfinished thoughts and when no VAD
  // is available; allow a short revision guard only for completed final text.
  const analysis=analyzePersianSentenceCompletion(text);
  const stableRequiredMs=vadSilenceMs!==null&&!hasInterim&&analysis.isComplete
    ? Math.min(requiredMs,250) : requiredMs;
  const textRemaining = stableRequiredMs - Math.max(0, transcriptStableMs);
  const vadRemaining = vadSilenceMs === null ? 0 : requiredMs - Math.max(0, vadSilenceMs);
  return Math.max(0, Math.ceil(textRemaining), Math.ceil(vadRemaining));
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

/** MediaRecorder produces data:audio/webm;codecs=opus;base64,... on Chrome.
 * Strip all MIME parameters before sending raw Base64 to the Gemini Worker.
 */
export function extractForzaAudioBase64(input: string): string {
  const value = String(input || '').trim();
  if (!value.startsWith('data:')) return value;
  const comma = value.indexOf(',');
  if (comma < 0 || !/;base64$/i.test(value.slice(0, comma))) {
    throw new Error('Invalid encoded audio header');
  }
  return value.slice(comma + 1);
}
