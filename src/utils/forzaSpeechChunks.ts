/** Bounded speech chunks preserve word order and technical identifiers. */
export function forzaSpeechChunks(text: string, limit = 240): string[] {
  if (!Number.isInteger(limit) || limit < 32) throw new Error('Invalid speech chunk limit');
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > limit) {
      chunks.push(current); current = '';
    }
    // A pathological token must still respect the server's request bound.
    if (word.length > limit) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < word.length; i += limit) chunks.push(word.slice(i, i + limit));
      continue;
    }
    current += (current ? ' ' : '') + word;
    if (current.length >= 80 && /[.!؟?؛]$/.test(word)) { chunks.push(current); current = ''; }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Start with a short speakable phrase; larger subsequent phrases keep requests economical. */
export function forzaFastStartSpeechChunks(text: string): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];
  // The first chunk must be short enough to play promptly and later requests
  // must stay within the bounded local TTS server payload.
  const first = forzaSpeechChunks(normalized, 88)[0];
  if (!first) return [];
  return [first, ...forzaSpeechChunks(normalized.slice(first.length).trim(), 240)];
}
