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
    // First words matter: begin TTS when the first natural, completed
    // Persian word group is available, not after an 80-character clause.
    // The following phrases are intentionally longer, giving the CPU Piper
    // worker time to synthesize ahead of the uninterrupted audio timeline.
    const first = this.emitted === 0;
    const minSentence = first ? 10 : 18;
    const minComma = first ? 22 : 42;
    const limit = first ? 38 : 76;
    const minWordCut = first ? 22 : 48;

    // Require trailing whitespace so decimals (3.25) or a model identifier
    // ending in a dot are not pronounced before that token is complete.
    for (const match of text.matchAll(/[.!؟؛]+\s+/g)) {
      const stop = (match.index ?? 0) + match[0].length;
      if (stop >= minSentence) return stop;
    }
    for (const match of text.matchAll(/[،,]+\s+/g)) {
      const stop = (match.index ?? 0) + match[0].length;
      if (stop >= minComma) return stop;
    }

    // Waiting for punctuation can cause several seconds of silence when
    // LLM output is unpunctuated. Stop only at an already received whitespace
    // boundary; retain the unfinished next word in the buffer.
    if (text.length >= limit) {
      const end = Math.max(text.lastIndexOf(' ', limit), text.lastIndexOf('\n', limit));
      if (end >= minWordCut) return end + 1;
    }
    return 0;
  }
}
