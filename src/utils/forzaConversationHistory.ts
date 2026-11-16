/** Bounded, ordered conversation history for one live FORZA call.
 * Snapshot the previous turns before appending the current customer utterance:
 * providers receive history + query as separate messages, so including the
 * current utterance in both would duplicate it and distort turn-taking.
 */
export type ForzaConversationMessage = {
  role: 'user' | 'model';
  text: string;
};

export const FORZA_CONVERSATION_HISTORY_LIMIT = 12;

export function prepareForzaConversationTurn(
  history: readonly ForzaConversationMessage[],
  query: string,
  limit = FORZA_CONVERSATION_HISTORY_LIMIT,
): {
  previousHistory: ForzaConversationMessage[];
  nextHistory: ForzaConversationMessage[];
} {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.min(40, Math.floor(limit)))
    : FORZA_CONVERSATION_HISTORY_LIMIT;
  const previousHistory = history
    .filter((item) => item && (item.role === 'user' || item.role === 'model') &&
      typeof item.text === 'string' && item.text.trim().length > 0)
    .slice(-safeLimit)
    .map((item) => ({ role: item.role, text: item.text }));
  const currentText = String(query || '').trim();
  const nextHistory = currentText
    ? [...previousHistory, { role: 'user' as const, text: currentText }]
    : [...previousHistory];
  return { previousHistory, nextHistory };
}
