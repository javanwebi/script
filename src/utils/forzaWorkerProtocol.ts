/**
 * Normalizes FORZA conversational history before sending a Google Live/REST
 * request through the configured Cloudflare Worker.
 *
 * Gemini expects the user turn before model messages, and adjacent turns of
 * the same role are folded together. The initial automated FORZA greeting is
 * presentation, not a model response to a user request.
 */
export interface ForzaWorkerMessage { role: string; content: unknown }

export function normalizeForzaWorkerMessages(messages: ForzaWorkerMessage[]): ForzaWorkerMessage[] {
  const system = messages.filter(x => x?.role === 'system' && typeof x.content === 'string')
    .map(x => ({ role: 'system', content: String(x.content).slice(0, 5000) }));
  const normalized: ForzaWorkerMessage[] = [];
  for (const message of messages) {
    if (!message || !['user', 'assistant', 'model'].includes(message.role)) continue;
    // Only normalize text history here. Image-specific structured parts are
    // left untouched because the visual recognition endpoint owns them.
    if (typeof message.content !== 'string' || !message.content.trim()) continue;
    const role = message.role === 'user' ? 'user' : 'assistant';
    if (!normalized.length && role !== 'user') continue;
    const content = message.content.slice(0, 6000);
    const previous = normalized[normalized.length - 1];
    if (previous?.role === role && typeof previous.content === 'string') {
      previous.content += '\n' + content;
    } else {
      normalized.push({ role, content });
    }
  }
  while (normalized.length && normalized[normalized.length - 1].role !== 'user') normalized.pop();
  return [...system, ...normalized];
}

/** Strip any MIME parameters before the comma, including codecs=opus. */
export function stripForzaAudioDataUrl(value: string): string {
  return String(value || '').replace(/^data:[^,]+,/i, '');
}
