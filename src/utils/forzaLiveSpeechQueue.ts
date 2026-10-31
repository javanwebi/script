import { takeSpeakablePhrase } from './forzaStreamingSpeech.ts';

/**
 * Convert incoming cumulative SSE text into ordered, natural Pocket phrases.
 * Starts the first synthesis BEFORE the model sends its final SSE 'done'.
 *
 * No WAV/text persistence; no browser/system voice. The caller supplies the
 * same authenticated original Pocket Farsi v2 streaming transport.
 *
 * One Pocket inference at a time is required by the private voice server.
 * The caller may enqueue received PCM to Web Audio without waiting for it to
 * finish playing; successive network syntheses can overlap playback.
 */
export class ForzaLiveSpeechQueue {
  private observed = '';
  private pending = '';
  private readonly spoken: string[] = [];
  private tail: Promise<void> = Promise.resolve();
  private cancelled = false;
  private completed = false;
  private failed: unknown = null;

  constructor(
    private readonly speak: (phrase: string) => Promise<void>,
    private readonly onPhraseReady?: (phrase: string, index: number) => void,
  ) {}

  /**
   * Called synchronously for every real text_chunk SSE event.
   * Incomplete last word is left pending. Never send one token per request.
   */
  receive(textSoFar: string): void {
    if (this.cancelled || this.completed) return;
    if (!textSoFar.startsWith(this.observed))
      throw new Error('forza_sse_prefix_revised_before_speech');
    this.pending += textSoFar.slice(this.observed.length);
    this.observed = textSoFar;
    this.dispatchReady(false);
  }

  private queuePhrase(phrase: string): void {
    if (!phrase.trim()) return;
    if (this.spoken.length >= 128) throw new Error('forza_tts_too_many_phrases');
    this.spoken.push(phrase);
    this.onPhraseReady?.(phrase, this.spoken.length);
    // .then schedules this request as soon as the preceding inference has
    // yielded its WAV frames (not after all their browser playback).
    this.tail = this.tail.then(async () => {
      if (this.cancelled) return;
      await this.speak(phrase);
    }).catch(error => {
      this.failed = error;
      this.cancelled = true;
      throw error;
    });
    // No unhandled rejections while LLM SSE continues to stream.
    void this.tail.catch(() => {});
  }

  private dispatchReady(final: boolean): void {
    let iterations = 0;
    while (this.pending.trim()) {
      if (++iterations > 128) throw new Error('forza_tts_phrase_limit');
      const next = takeSpeakablePhrase(this.pending, this.spoken.length === 0);
      if (!next) break;
      this.queuePhrase(next.phrase);
      this.pending = next.rest;
    }
    if (final && this.pending.trim()) {
      // The final provider 'done' is authoritative. Flush its last words.
      this.queuePhrase(this.pending.trim());
      this.pending = '';
    }
  }

  /** Only call after the authoritative SSE 'done' was received. */
  async finish(finalText: string): Promise<void> {
    if (this.cancelled) {
      if (this.failed) throw this.failed;
      throw new Error('forza_tts_cancelled');
    }
    const confirmed = finalText.trim();
    if (!confirmed || !confirmed.startsWith(this.observed.trimEnd())) {
      this.cancelled = true;
      throw new Error('forza_sse_final_answer_changed');
    }
    if (confirmed.length > this.observed.length)
      this.receive(confirmed);
    this.dispatchReady(true);
    this.completed = true;
    await this.tail;
    if (this.failed) throw this.failed;
  }

  cancel(): void {
    this.cancelled = true;
    this.pending = '';
  }

  get phraseCount(): number { return this.spoken.length; }
  get hasStarted(): boolean { return this.spoken.length > 0; }
}
