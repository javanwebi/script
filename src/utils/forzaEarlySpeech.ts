/**
 * Experimental FORZA first-clause prefetch. Never speak an SSE token or a
 * comma-separated fragment: only a completed, length-bounded sentence with
 * a trailing space (so the model is continuing into another clause).
 * The response's explicit final "done" is authoritative.
 *
 * The chosen original Pocket model/voice is unchanged. This can reduce the
 * LLM-completion wait, but it CANNOT make slow Pocket inference subsecond,
 * nor ensure gapless playback when real-time factor exceeds 1.
 */
export function forzaEarlyStableClause(text: string): string | null {
  if (typeof text !== 'string' || text.length > 65536) return null;
  // Avoid interpreting decimal points as sentence boundaries.
  // Require a whitespace character AFTER punctuation, proving the token
  // stream has already moved on to a subsequent word/sentence.
  const boundary = /[.!؟!?](?=\s)/g;
  let found: RegExpExecArray | null;
  while ((found = boundary.exec(text)) !== null) {
    const prefix = text.slice(0, found.index + found[0].length).trim();
    if (prefix.length < 18 || prefix.length > 160) continue;
    if (!/[\u0600-\u06ff]/.test(prefix)) continue;
    // Avoid passing control characters to the private TTS API.
    if (/[\u0000-\u001f]/.test(prefix)) continue;
    return prefix;
  }
  return null;
}

export function forzaEarlySpeechRemainder(
  finalAnswer: string,
  firstClause: string,
): string {
  // Never replay a partial if the final LLM response amended the beginning.
  // A mismatch can only be reported/cancelled; it cannot retract sound
  // that the customer might already have heard.
  if (!firstClause || !finalAnswer.startsWith(firstClause))
    throw new Error('forza_early_tts_final_prefix_changed');
  return finalAnswer.slice(firstClause.length).trim();
}
