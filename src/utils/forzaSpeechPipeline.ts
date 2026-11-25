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

/**
 * Join a new browser-recognition session to the same customer turn.
 * Web Speech may end/restart its recognition session during a natural pause;
 * the next session then starts its result list from zero. Keep the previous
 * session's words and merge only the new suffix, including split SKU tokens.
 */
export function appendForzaSpeechSegment(previousValue:string, incomingValue:string):string {
  const previous=normalizePersianTranscript(previousValue);
  const incoming=normalizePersianTranscript(incomingValue);
  if(!previous)return incoming;
  if(!incoming)return previous;
  if(incoming===previous||previous.endsWith(incoming))return previous;
  if(incoming.startsWith(previous))return incoming;
  if(/^[،؛؟.!?,:]/.test(incoming))return previous+incoming;

  const maximum=Math.min(previous.length,incoming.length);
  // Avoid collapsing common two-letter Persian words; only allow that short
  // overlap for the frequent "می" prefix split by recognition restarts.
  const minimumOverlap=previous.endsWith('می')&&incoming.startsWith('می')?2:3;
  for(let length=maximum;length>=minimumOverlap;length--){
    if(previous.slice(-length)===incoming.slice(0,length)){
      // Preserve the incoming boundary exactly: no space means the browser
      // completed a partial word (e.g. "تایم" + "تایمینگ").
      return previous+incoming.slice(length);
    }
  }
  return previous+' '+incoming;
}

/**
 * Keep finalized customer turns in one session transcript without applying
 * overlap de-duplication across turn boundaries. Repeating a phrase in a later
 * turn is still new speech and must remain visible.
 */
export function appendForzaSessionTurn(previousValue:string,nextTurnValue:string):string{
  const previous=String(previousValue||'').trimEnd();
  const next=normalizePersianTranscript(nextTurnValue);
  if(!next)return previous;
  return previous?previous+'\n'+next:next;
}

/** Replace only the last committed turn when the final Diba hypothesis corrects
 * the live browser hypothesis. Earlier turns and repeated phrases stay intact.
 */
export function replaceForzaLastSessionTurn(
  sessionValue:string,
  previousTurnValue:string,
  correctedTurnValue:string,
):string{
  const session=String(sessionValue||'').trimEnd();
  const previousTurn=normalizePersianTranscript(previousTurnValue);
  const corrected=normalizePersianTranscript(correctedTurnValue);
  if(!corrected)return session;
  if(!previousTurn)return appendForzaSessionTurn(session,corrected);
  if(session===previousTurn)return corrected;
  const suffix='\n'+previousTurn;
  if(session.endsWith(suffix))
    return session.slice(0,-previousTurn.length)+corrected;
  return appendForzaSessionTurn(session,corrected);
}

/** Compose the immutable session transcript with the current live draft. */
export function composeForzaSessionTranscript(sessionValue:string,activeTurnValue:string):string{
  const session=String(sessionValue||'').trimEnd();
  const active=normalizePersianTranscript(activeTurnValue);
  if(!active)return session;
  return session?session+'\n'+active:active;
}

/**
 * Run a long recording's independent WebM containers through a small bounded
 * worker pool. Results are always returned in recording order, regardless of
 * which request finishes first; no segment is silently dropped.
 */
export async function mapForzaSegmentsInOrder<T,R>(
  items:readonly T[],
  concurrency:number,
  mapper:(item:T,index:number)=>Promise<R>,
):Promise<PromiseSettledResult<R>[]>{
  const results=new Array<PromiseSettledResult<R>>(items.length);
  if(!items.length)return results;
  const workerCount=Math.max(1,Math.min(items.length,Math.floor(concurrency)||1));
  let cursor=0;
  await Promise.all(Array.from({length:workerCount},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      try{
        results[index]={status:'fulfilled',value:await mapper(items[index],index)};
      }catch(reason){
        results[index]={status:'rejected',reason};
      }
    }
  }));
  return results;
}

/** Combine live browser interim/final text with the server's final Diba result.
 * Keep browser-recognized industrial part codes when the acoustic model drops
 * them, but otherwise prefer the server transcript as the final authority.
 */
export function chooseForzaFinalTranscript(browserValue:string,serverValue:string,preferServer=false):string{
  const browser=normalizePersianTranscript(browserValue);
  const server=normalizePersianTranscript(serverValue);
  if(!server)return browser;
  if(!browser)return server;
  // AvalAI GPT-Transcribe is the high-accuracy final verifier. Prefer its
  // complete transcript over a plausible-looking but incorrect browser code;
  // only keep browser text when the server clearly returned a tiny fragment.
  if(preferServer){
    // AvalAI returns a completed server transcript, not a live browser interim.
    // Keep browser text only when the server produced an implausibly tiny
    // fragment relative to a substantial utterance; a shorter but complete
    // correction must beat a browser transcript polluted by background words.
    const serverWords=server.split(/\s+/).filter(Boolean);
    if(browser.length>=24&&server.length<12&&serverWords.length===1)return browser;
    return server;
  }
  const toAsciiDigits=(value:string)=>value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const technicalTokens=(value:string)=>{
    const normalized=toAsciiDigits(value).toUpperCase();
    const codes=[...normalized.matchAll(/\b\d{3,6}(?:\s*(?:ZZ|2RS|RS|C3|C4))?\b/g)]
      .map(match=>String(match[0]).replace(/\s+/g,''));
    const suffixes=[...normalized.matchAll(/\b(?:ZZ|2RS|RS|C3|C4|2Z|LLU|LLB|SKF|FAG)\b/g)]
      .map(match=>String(match[0]));
    return [...new Set([...codes,...suffixes])];
  };
  const browserTokens=technicalTokens(browser);
  const serverTokens=new Set(technicalTokens(server));
  if(browserTokens.some(token=>!serverTokens.has(token)))return browser;
  if(browser.length>=10&&server.length<browser.length*0.5)return browser;
  return server;
}

/** Verify every captured voice turn when a server recognizer is configured.
 * Browser SpeechRecognition is a fast live hypothesis, not a trusted final:
 * it can return plausible but incorrect Persian words or industrial codes.
 */
export function shouldRunForzaServerFinalTranscript(audioCaptured: boolean, serverSttConfigured: boolean): boolean {
  return audioCaptured && serverSttConfigured;
}

/** Give short live turns a fast verification window, while allowing longer
 * recordings proportionally more decode time without a fixed duration cap.
 * WebM/Opus byte size is used only as a conservative duration estimate.
 */
export function forzaLiveSttVerificationBudgetMs(audioBytes: number): number {
  const bytes=Number.isFinite(audioBytes)?Math.max(0,audioBytes):0;
  return Math.max(1_000,Math.ceil(900+(bytes/4_000)*150));
}

/** Use a server final transcript only when every recording segment completed.
 * A partial AvalAI/Diba result must never overwrite a complete browser utterance.
 */
export function canUseForzaServerFinalTranscript(serverValue: string, failedSegments: number): boolean {
  return normalizePersianTranscript(serverValue).length > 0 &&
    Number.isInteger(failedSegments) && failedSegments === 0;
}

/** Adaptive acoustic endpointing for natural Persian voice turns.
 * Clear, final utterances should not wait four seconds before the LLM starts.
 * Incomplete clauses and technical-code corrections keep a longer continuation
 * window; the text-only fallback remains conservative when VAD is unavailable.
 */
export function forzaEndOfTurnPauseMs(text: string, hasInterim: boolean): number {
  const normalized=normalizePersianTranscript(text);
  // No transcript is not proof of silence; keep a bounded fallback for delayed ASR.
  if(!normalized)return 3200;
  // Explicit stop/continue commands should interrupt without a long endpoint.
  if(/^(?:وایسا|وایستا|وایست|صبر کن|صبر کنید|صبر کنین|بس کن|بس کنید|بس کنین|توقف|بسه|ساکت|ساکت شو|ادامه بده|ادامه بدید|ادامه)$/.test(normalized))
    return 450;
  const analysis = analyzePersianSentenceCompletion(normalized);
  // Complete natural phrases dispatch after a short acoustic confirmation.
  // Interim text gets a small correction window, not a multi-second STT wait.
  if(analysis.isComplete&&analysis.confidence>=0.9)
    return hasInterim?850:Math.max(600,analysis.recommendedPauseMs);
  // Keep a real continuation window for unfinished clauses and industrial codes,
  // while avoiding the old 4.3-5.2s delay on ordinary speech.
  if(analysis.isMidThought){
    // Preserve the analyzer's explicit continuation signal. In particular,
    // clauses ending in "چون/برای/تا" must not be shortened to 1.6s or
    // dispatched during a natural two-second pause. Technical-code hypotheses
    // retain their existing 2.2s correction window.
    return Math.max(analysis.recommendedPauseMs,hasInterim?2200:1600);
  }
  // Ambiguous fragments (for example a request ending in "را") stay open
  // long enough for the next clause without freezing a completed sentence.
  return hasInterim?2400:1500;
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
  const baseRequiredMs = forzaEndOfTurnPauseMs(text, hasInterim);
  // If microphone VAD is unavailable, browser ASR can temporarily stop
  // emitting interim hypotheses while the customer is still speaking. A
  // longer text-only guard is safer than treating that transport stall as
  // acoustic silence. When VAD is available, retain the normal fast endpoint.
  const requiredMs = baseRequiredMs <= 650
    ? baseRequiredMs
    : vadSilenceMs === null ? Math.max(baseRequiredMs, 2200) : baseRequiredMs;
  // Late final ASR hypotheses need only a short revision guard once a complete
  // final transcript and real acoustic silence agree.
  const analysis=analyzePersianSentenceCompletion(text);
  const stableRequiredMs=vadSilenceMs!==null&&!hasInterim&&analysis.isComplete
    ? Math.min(requiredMs,180) : requiredMs;
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
