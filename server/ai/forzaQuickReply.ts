import {normalizePersianTranscript} from '../../src/utils/forzaSpeechPipeline';

/**
 * Small social greetings do not need a catalog lookup or a remote reasoning
 * round-trip. Answer them immediately through the same SSE/TTS path so the
 * customer can confirm the microphone and continue the actual consultation.
 */
export function resolveForzaQuickVoiceReply(query:string,history:unknown):string|null{
  const normalized=normalizePersianTranscript(query)
    .replace(/[،,.!؟؛:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!/^(سلام|درود|سلام علیکم|وقت بخیر|سلام وقت بخیر|صبح بخیر|عصر بخیر|شب بخیر|سلام خوبی|سلام چطوری)$/u.test(normalized))
    return null;

  const hasPriorUserTurn=Array.isArray(history)&&history.some((item:any)=>
    (item?.role==='user'||item?.sender==='user')&&String(item?.text||'').trim(),
  );
  return hasPriorUserTurn
    ? 'صدات رو دارم؛ بفرما، ادامه بده.'
    : 'سلام، صدات رو دارم. بفرما، چطور می‌تونم کمکت کنم؟';
}
