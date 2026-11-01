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
    // DO NOT split at full stops, commas or Persian question marks. Earlier
    // versions treated every sentence as its own WAV, so the following phrase
    // could miss the AudioContext deadline and leave a multi-second silence.
    //
    // Piper receives coherent groups of *complete words* while the LLM is
    // still streaming; punctuation is kept in subtitles, and the private
    // Nima worker removes spoken punctuation without adding long pauses.
    const first = this.emitted === 0;
    const limit = first ? 38 : 66;
    const minWordCut = first ? 22 : 42;
    if (text.length < limit) return 0;
    // If the SSE ends mid-word, only the whitespace-delimited prefix is safe
    // to pronounce; finish() flushes the final short text at authoritative done.
    const end = Math.max(text.lastIndexOf(' ', limit), text.lastIndexOf('\n', limit));
    return end >= minWordCut ? end + 1 : 0;
  }
}
