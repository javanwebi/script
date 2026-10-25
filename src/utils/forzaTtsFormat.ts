/**
 * Gemini TTS can return either an already-encoded RIFF/WAVE file or raw
 * 16-bit PCM. Wrapping a WAVE payload inside a second WAVE container causes
 * browser playback to fail even though /api/ai/tts returned HTTP 200.
 */
export function isRiffWaveAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 44) return false;
  const matches = (offset: number, word: string) =>
    [...word].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  return matches(0, 'RIFF') && matches(8, 'WAVE');
}

export function classifyForzaAudio(
  bytes: Uint8Array,
  mimeType: string | undefined,
): 'wav' | 'pcm16' | 'unsupported' {
  if (isRiffWaveAudio(bytes)) return 'wav';
  const type = String(mimeType || '').split(';')[0].toLowerCase().trim();
  if ((type === 'audio/l16' || type === 'audio/pcm' || type === 'audio/raw'
    || type === 'application/octet-stream' || !type) && bytes.length > 0 && bytes.length % 2 === 0) {
    return 'pcm16';
  }
  return 'unsupported';
}
