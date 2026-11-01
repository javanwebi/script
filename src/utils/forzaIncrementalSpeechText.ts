/** Split the actually received SSE reply into ordered TTS-ready phrases.
 *
 * The UI may display every token, but neural TTS needs coherent Persian
 * phrases, never individual characters or words. This class preserves exactly
 * one copy of each emitted character; a provider revision or stream truncation
 * must fail closed before any additional voice can be generated.
 */
export class ForzaIncrementalSpeechText {
  private seen = '';
  private emitted = 0;

  push(fullText: string): string[] {
    if (!fullText.startsWith(this.seen)) {
      throw new Error('forza_stream_revised_after_speech');
    }
    this.seen = fullText;
    const output: string[] = [];
    for (;;) {
      const tail = this.seen.slice(this.emitted);
      if (!tail.trim()) break;
      const cut = this.boundary(tail);
      if (cut <= 0) break;
      const speech = tail.slice(0, cut).trim();
      if (speech) output.push(speech);
      this.emitted += cut;
    }
    return output;
  }

  complete(finalText: string): string[] {
    const output = this.push(finalText);
    const remaining = this.seen.slice(this.emitted).trim();
    if (remaining) output.push(remaining);
    this.emitted = this.seen.length;
    return output;
  }

  private boundary(text: string): number {
    // Sentence and clause delimiters; require a following whitespace/token,
    // preserving decimals such as 3.25 and industrial model names.
    const sentence = /[.!؟؛]+\s+/g;
    for (const match of text.matchAll(sentence)) {
      const stop = (match.index || 0) + match[0].length;
      if (stop >= 16) return stop;
    }
    const comma = /[،,]+\s+/g;
    for (const match of text.matchAll(comma)) {
      const stop = (match.index || 0) + match[0].length;
      if (stop >= 48) return stop;
    }
    // Long LLM runs without punctuation: split at a word boundary, leaving
    // the unfinished last token buffered for the next SSE message.
    if (text.length >= 115) {
      const end = text.lastIndexOf(' ', 100);
      if (end >= 65) return end + 1;
    }
    return 0;
  }
}
