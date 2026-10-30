/** Select only genuinely Persian speech voices for the emergency browser TTS
 * route. Never switch to an English voice for Persian technical terminology. */
export function findPersianSpeechVoice<T extends {lang?: string; name?: string}>(voices: T[]): T | null {
  return voices.find(v => /^fa(?:-|$)/i.test(String(v.lang || ''))) ??
    voices.find(v => /persian|farsi|فارسی/i.test(String(v.name || ''))) ??
    null;
}

/** Browser voice lists are often empty during the first page-load tick.
 * Wait briefly for voiceschanged instead of failing the greeting immediately. */
export function waitForPersianSpeechVoice<T extends {lang?: string; name?: string}>(
  synth: Pick<SpeechSynthesis, 'getVoices' | 'addEventListener' | 'removeEventListener'>,
  timeoutMs = 900,
): Promise<T | null> {
  const read = () => findPersianSpeechVoice(synth.getVoices() as unknown as T[]);
  const current = read();
  if (current) return Promise.resolve(current);

  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (voice: T | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const voice = read();
      if (voice) finish(voice);
    };
    synth.addEventListener('voiceschanged', onVoicesChanged);
    timer = setTimeout(() => finish(read()), Math.max(0, timeoutMs));
    onVoicesChanged();
  });
}
