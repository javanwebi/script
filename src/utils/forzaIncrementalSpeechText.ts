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
  // Hold one not-yet-submitted middle phrase so the final 1–3 words can be
  // merged with it at explicit SSE done. Without this, complete() creates a
  // separate tiny Piper inference job after the prior WAV has played.
  // The very first short phrase is still dispatched immediately.
  private started = false;
  private heldPhrase = '';

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
      if (speech) {
        if (!this.started) {
          // Preserve first-audio latency: the first complete word group is
          // sent while the LLM is still producing the remaining answer.
          output.push(speech);
          this.started = true;
        } else if (this.heldPhrase) {
          // A newer complete group allows the previous reserved group to
          // enter the audio queue. Always keep the newest group in reserve.
          output.push(this.heldPhrase);
          this.heldPhrase = speech;
        } else {
          this.heldPhrase = speech;
        }
      }
      this.emitted += cut;
    }
    return output;
  }

  /**
   * An upstream provider may stream the last visible words and leave SSE open
   * several seconds before sending its authoritative `done` event. If the
   * currently visible answer already ends with an explicit terminal mark,
   * a short idle timeout may dispatch the *combined* pending final phrase now.
   * Never flush half-written words, partial decimals, or unpunctuated text.
   * Future monotonic SSE updates continue normally; already spoken words
   * cannot be emitted twice when `complete()` eventually arrives.
   */
  /**
   * Release one already completed and reserved word group when streaming
   * pauses briefly. The old planner kept an ENTIRE 66-character group until
   * another group or SSE done arrived, making Nima run out of playable audio.
   * Never synthesize the unfinished tail; final text still joins on done.
   */
  flushBufferedOnIdle(): string[] {
    if (!this.heldPhrase) return [];
    const ready=this.heldPhrase;
    this.heldPhrase='';
    return [ready];
  }

  flushTerminalIdle(): string[] {
    if (!/[.!؟؛]\s*$/.test(this.seen)) return [];
    const remaining = this.seen.slice(this.emitted).trim();
    const ready = [this.heldPhrase, remaining].filter(Boolean).join(' ');
    if (!ready) return [];
    this.heldPhrase = '';
    this.emitted = this.seen.length;
    return [ready];
  }

  complete(finalText: string): string[] {
    const output = this.push(finalText);
    const remaining = this.seen.slice(this.emitted).trim();
    // Crucial for real CPU inference: send the reserved final phrase and any
    // one/two-word suffix to Piper in *one* WAV request. Never create a
    // separate TTS task just for the last words at the SSE done event.
    const finalPhrase = [this.heldPhrase, remaining].filter(Boolean).join(' ');
    this.heldPhrase = '';
    if (finalPhrase) output.push(finalPhrase);
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
