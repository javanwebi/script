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
      if(stable.length>=12 && stable.split(/\s+/).length>=3){
        this.emitted+=end+1;
        this.started=true;
        return [stable];
      }
    }
    if(!this.heldPhrase)return [];
    const phrase=this.heldPhrase;
    this.heldPhrase='';
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
    // A completed initial sentence can be dispatched before the next SSE
    // token. Do not hold "سلام." behind the 38-character word threshold.
    // A digit followed by "." may be the beginning of a decimal instead.
    if (first && text.length <= 38 &&
        /[.!؟؛]\s*$/u.test(text) &&
        !/[0-9۰-۹]\.\s*$/u.test(text))
      return text.length;
    // Start the first Nima phrase after a short, complete word group.
    // Later phrases stay larger to avoid excess CPU jobs and audio gaps.
    const limit = first ? 24 : 66;
    const minWordCut = first ? 16 : 42;
    if (text.length < limit) return 0;
    // If the SSE ends mid-word, only the whitespace-delimited prefix is safe
    // to pronounce; finish() flushes the final short text at authoritative done.
    let end = Math.max(text.lastIndexOf(' ', limit), text.lastIndexOf('\n', limit));
    if(end<minWordCut)return 0;
    // Never split industrial identifiers or profile/size pairs across two
    // spoken phrases (e.g. "6203 | ZZ C3", "SPA | 1250", "HTD | 5M").
    for(;;){
      const cut=end+1;
      if(!this.isUnsafeTechnicalBoundary(text,cut))return cut;
      const rest=text.slice(cut);
      const nextSpace=rest.search(/[ \n]/);
      if(nextSpace<0)return 0;
      end=cut+nextSpace;
    }
  }

  private isUnsafeTechnicalBoundary(text:string,cut:number):boolean{
    const left=text.slice(0,cut).trimEnd().split(/\s+/).pop()||'';
    const right=text.slice(cut).trimStart().split(/\s+/)[0]||'';
    if(!left||!right)return false;
    if(/^\d{3,5}[A-Z]{0,4}$/i.test(left)&&
       /^(?:ZZ|2Z|RS|2RS|C[234]|LLU|LLB|NR)$/i.test(right))return true;
    if(/^(?:ZZ|2Z|RS|2RS|LLU|LLB)$/i.test(left)&&/^C[234]$/i.test(right))return true;
    if(/^(?:SPZ|SPA|SPB|SPC|XPZ|XPA|XPB|XPC|HTD|STD|AT\d{1,2}|T\d{2}|RPP\d*)$/i.test(left)&&
       /^(?:\d{2,5}|\d{1,3}M)$/i.test(right))return true;
    if(/^\d{2,5}$/.test(left)&&/^(?:mm|cm|m|inch|in|میلی‌متر|سانتی‌متر)$/i.test(right))return true;
    return false;
  }
}
