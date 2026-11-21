/**
 * What the customer SEES is the complete, original Gemini answer.
 * What Nima HEARS is the same ordered text with Unicode punctuation converted
 * to spaces, avoiding sentence/clause pauses. Preserve engineering decimals
 * and identifiers such as SPA-1250, 12.7 and SWR/A19.
 */
export function forzaUnbrokenSpokenText(answer: string): string {
  const characters = [...answer];
  return characters.map((character, index) => {
    if (!/\p{P}/u.test(character)) return character;
    const previous = characters[index - 1] || '';
    const next = characters[index + 1] || '';
    const numericSeparator = /\p{N}/u.test(previous) && /\p{N}/u.test(next);
    const identifierSeparator = /[\p{L}\p{N}]/u.test(previous) &&
      /[\p{L}\p{N}]/u.test(next);
    if (numericSeparator && ['.', ',', '٫'].includes(character)) return character;
    if (identifierSeparator && ['-', '_', '/'].includes(character)) return character;
    return ' ';
  }).join('').replace(/\s+/gu, ' ').trim();
}
