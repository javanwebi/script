/**
 * Tiny deterministic replies for Persian voice small-talk.
 * These turns need no catalog scan or remote LLM call; the browser still
 * speaks the returned text with the selected private Nima voice.
 */
export function getForzaVoiceFastReply(value:unknown):string|null{
  const text=String(value||'')
    .replace(/ي/g,'ی')
    .replace(/ك/g,'ک')
    .replace(/[،,؛;:!?؟.!]+/g,' ')
    .replace(/\\s+/g,' ')
    .trim();
  if(/^(?:سلام|درود)(?: (?:وقت بخیر|صبح بخیر|عصر بخیر))?$/.test(text))
    return 'سلام، خوش آمدید. بفرمایید چه قطعه‌ای نیاز دارید؟';
  if(/^(?:ممنون|ممنونم|متشکرم|سپاس|مرسی)$/.test(text))
    return 'خواهش می‌کنم. هر زمان آماده بودید، در خدمتم.';
  if(/^(?:خوبی|حالت چطوره)$/.test(text))
    return 'ممنون، آماده‌ام کمک کنم. بفرمایید چه قطعه‌ای را بررسی کنیم؟';
  if(/^(?:بله|باشه)$/.test(text))
    return 'بسیار خوب، بفرمایید؛ گوش می‌کنم.';
  return null;
}
