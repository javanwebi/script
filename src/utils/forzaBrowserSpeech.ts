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

/**
 * Only voices that the browser identifies as local may be used for the
 * visitor-CPU TTS route. Missing/remote voices must NEVER fall through to
 * speechSynthesis's default voice, which may call an external service or
 * pronounce Persian in English.
 */
export function findLocalPersianSpeechVoice<T extends {lang?:string;name?:string;localService?:boolean}>(voices:T[]):T|null{
  return findPersianSpeechVoice(voices.filter(v=>v.localService===true));
}

/** Wait briefly for mobile browsers to enumerate installed voices. */
export function waitForLocalPersianSpeechVoice<T extends {lang?:string;name?:string;localService?:boolean}>(
  synth: Pick<SpeechSynthesis,'getVoices'|'addEventListener'|'removeEventListener'>,
  timeoutMs=700,
):Promise<T|null>{
  const read=()=>findLocalPersianSpeechVoice(synth.getVoices() as unknown as T[]);
  if(read())return Promise.resolve(read());
  return new Promise(resolve=>{
    let done=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const finish=(voice:T|null)=>{
      if(done)return;
      done=true;
      if(timer!==undefined)clearTimeout(timer);
      synth.removeEventListener('voiceschanged',onChange);
      resolve(voice);
    };
    const onChange=()=>{const voice=read();if(voice)finish(voice);};
    synth.addEventListener('voiceschanged',onChange);
    timer=setTimeout(()=>finish(read()),Math.max(0,timeoutMs));
    onChange();
  });
}
