/**
 * What the customer SEES is the complete, original Gemini answer.
 * What Pocket HEARS is the exact same ordered words with sentence/clause
 * punctuation converted to spaces so no intentional pause is inserted
 * at periods or commas. Protect dimensions (12.7) and product IDs (SPA-1250).
 *
 * This does not shorten or split words. The underlying acoustic model still
 * has its own internal memory-bounded chunks; only one WAV is sent to the
 * listener after complete synthesis.
 */
export function forzaUnbrokenSpokenText(answer: string): string {
  return answer
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/[،,؛;:!?؟…—–\[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
