/** Extract only whole-word, ready-to-speak phrases from live Persian text. */
export function takeSpeakablePhrase(buffer: string, first: boolean): { phrase: string; rest: string } | null {
  if (!buffer.trim()) return null;
  const min = first ? 16 : 36;
  const target = first ? 40 : 135;
  // Natural pause marks avoid chopping a Persian technical term in half.
  const boundary = /[.!?؟،؛:\n]/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(buffer))) {
    if (match.index + 1 >= min) {
      return {phrase: buffer.slice(0, match.index + 1).trim(), rest: buffer.slice(match.index + 1).trimStart()};
    }
  }
  if (buffer.length < target) return null;
  const max = Math.min(buffer.length, first ? 92 : 185);
  let index = buffer.lastIndexOf(' ', max);
  if (index < min) return null;
  return {phrase:buffer.slice(0,index).trim(),rest:buffer.slice(index).trimStart()};
}
