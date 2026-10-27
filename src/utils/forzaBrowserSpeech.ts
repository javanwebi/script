/** Select only genuinely Persian speech voices for the emergency browser TTS
 * route. Never switch to an English voice for Persian technical terminology. */
export function findPersianSpeechVoice<T extends {lang?: string; name?: string}>(voices: T[]): T | null {
  return voices.find(v => /^fa(?:-|$)/i.test(String(v.lang || ''))) ??
    voices.find(v => /persian|farsi|فارسی/i.test(String(v.name || ''))) ??
    null;
}
