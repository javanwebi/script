/** Split the actually received SSE reply into ordered TTS-ready phrases.
 *
 * The UI may display every token, but neural TTS needs coherent Persian
 * phrases, never individual characters or words. This class preserves exactly
 * one copy of each emitted character; a provider revision or stream truncation
 * must fail closed before any additional voice can be generated.
 */
const MAX_HELD_PHRASE_MS = 180;

export class ForzaIncrementalSpeechText {
  private seen = '';
  private emitted = 0;
  // Hold one not-yet-submitted middle phrase so the final 1–3 words can be
  // merged with it at explicit SSE done. Without this, complete() creates a
  // separate tiny Piper inference job after the prior WAV has played.
  // The first phrase starts as soon as a useful complete word group is ready;
  // a short punctuation-ended sentence waits for its next words or final done.
  private started = false;
  private heldPhrase = '';
  private heldAt: number | null = null;

  push(fullText: string): string[] {
    if (!fullText.startsWith(this.seen)) {
      throw new Error('forza_stream_revised_after_speech');
    }
    this.seen = fullText;
    const output: string[] = [];
    // Release a complete middle phrase after a short age even while SSE
    // continues. Only the incomplete trailing word/code remains protected.
    if (this.heldPhrase && this.heldAt !== null &&
        Date.now() - this.heldAt >= MAX_HELD_PHRASE_MS) {
      output.push(this.heldPhrase);
      this.heldPhrase = '';
      this.heldAt = null;
    }
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
          this.heldAt = Date.now();
        } else {
          this.heldPhrase = speech;
          this.heldAt = Date.now();
        }
      }
      this.emitted += cut;
    }
    return output;
  }

  /** A fully bounded idle flush for an already complete word group.
   * Holding the middle group until another 66 characters arrive causes a
   * long silent gap whenever the model pauses. Never flush the unfinished
   * suffix: the next SSE chunk may still complete that last word or SKU.
   */
  flushStableIdle(): string[] {
    if(!this.started){
      const tail=this.seen.slice(this.emitted);
      const end=Math.max(tail.lastIndexOf(' '),tail.lastIndexOf('\n'));
      const stable=tail.slice(0,Math.max(0,end)).trim();
      // Only whitespace-terminated words are safe while SSE is unfinished.
      if(stable.length>=24 && stable.split(/\s+/).length>=4){
        this.emitted+=end+1;
        this.started=true;
        return [stable];
      }
    }
    if(!this.heldPhrase)return [];
    const phrase=this.heldPhrase;
    this.heldPhrase='';
    this.heldAt=null;
    return [phrase];
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
  flushTerminalIdle(): string[] {
    if (!/[.!؟؛]\s*$/.test(this.seen)) return [];
    const remaining = this.seen.slice(this.emitted).trim();
    const ready = [this.heldPhrase, remaining].filter(Boolean).join(' ');
    // A punctuation-only idle is not a reason to create a tiny WAV. Wait for
    // the next words or authoritative SSE done so punctuation cannot become
    // an audible inter-request pause.
    if (ready.length < 56) return [];
    this.heldPhrase = '';
    this.heldAt = null;
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
    this.heldAt = null;
    if (finalPhrase) output.push(finalPhrase);
    this.emitted = this.seen.length;
    return output;
  }

  private boundary(text: string): number {
    // Keep the first request short for fast voice onset, then use larger
    // middle groups to amortize Piper/ONNX startup and network overhead.
    // Neither boundary is allowed to land directly after punctuation: include
    // at least the next complete word so a full stop or comma cannot create a
    // tiny standalone WAV followed by an audible synthesis gap.
    const first = this.emitted === 0;
    const limit = first ? 42 : 88;
    const minWordCut = first ? 22 : 68;
    const maxBoundary = first ? 92 : 144;
    if (text.length < limit) return 0;

    let end = Math.max(text.lastIndexOf(' ', limit), text.lastIndexOf('\n', limit));
    if (end < minWordCut) return 0;

    const prefix = text.slice(0, end).trimEnd();
    const endsAtPunctuation = /[،,؛;:!?؟.…—–]$/u.test(prefix);
    if (endsAtPunctuation) {
      let nextBoundary = -1;
      for (let index = end + 1; index < Math.min(text.length, maxBoundary); index++) {
        if (/\s/u.test(text[index])) {
          nextBoundary = index;
          break;
        }
      }
      // Wait for the next complete word rather than ending a WAV on punctuation.
      if (nextBoundary < 0) return 0;
      end = nextBoundary;
    }
    return end + 1;
  }
}
