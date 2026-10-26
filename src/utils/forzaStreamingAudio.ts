/**
 * Progressive Farid MP3 playback for FORZA. Audio starts as soon as the first
 * decodable frames arrive, without waiting for the complete TTS response.
 * The caller aborts this stream when a turn or the component is cancelled.
 */
export async function playForzaStreamingAudio(
  audio: HTMLAudioElement,
  text: string,
  signal: AbortSignal,
  onPlaying: () => void,
): Promise<void> {
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported('audio/mpeg')) {
    throw new Error('stream_unsupported');
  }
  if (signal.aborted) throw new Error('stream_cancelled');

  return new Promise<void>((resolve, reject) => {
    const source = new MediaSource();
    const url = URL.createObjectURL(source);
    let settled = false;
    let requestedPlay = false;
    let startedPlayback = false;
    const startedAt = performance.now();
    const startTimeout = setTimeout(() => fail(new Error('stream_start_timeout')), 7000);

    function cleanup() {
      clearTimeout(startTimeout);
      signal.removeEventListener('abort', abort);
      source.removeEventListener('sourceopen', sourceOpen);
      audio.removeEventListener('playing', playing);
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', errored);
      URL.revokeObjectURL(url);
    }

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        if (startedPlayback && error.message !== 'stream_cancelled') {
          reject(new Error('stream_interrupted_after_start'));
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    }

    function fail(error: Error) { finish(error); }
    function abort() { fail(new Error('stream_cancelled')); }
    function ended() { finish(); }
    function errored() { fail(new Error('stream_audio_error')); }
    function playing() {
      if (settled || startedPlayback) return;
      startedPlayback = true;
      clearTimeout(startTimeout);
      onPlaying();
      // Timing only; never log customer text or synthesized audio.
      if (import.meta.env?.DEV) console.debug('[FORZA TTS] streamed audio playing after', Math.round(performance.now() - startedAt), 'ms');
    }

    async function sourceOpen() {
      if (settled) return;
      try {
        const buffer = source.addSourceBuffer('audio/mpeg');
        buffer.addEventListener('error', errored);
        const response = await fetch('/api/ai/tts-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal,
        });
        if (!response.ok || !response.body || response.headers.get('Content-Type')?.split(';')[0] !== 'audio/mpeg') {
          throw new Error('stream_unavailable');
        }
        const reader = response.body.getReader();
        let received = 0;
        while (!settled) {
          const part = await reader.read();
          if (part.done) break;
          if (!part.value?.byteLength) continue;
          received += part.value.byteLength;
          // SourceBuffer is asynchronous: never append while it is updating.
          await new Promise<void>((done, failed) => {
            const ready = () => { buffer.removeEventListener('error', error); done(); };
            const error = () => { buffer.removeEventListener('updateend', ready); failed(new Error('stream_decode_failed')); };
            buffer.addEventListener('updateend', ready, { once: true });
            buffer.addEventListener('error', error, { once: true });
            try {
              const payload = new Uint8Array(part.value.byteLength);
              payload.set(part.value);
              buffer.appendBuffer(payload.buffer);
            } catch (cause) {
              buffer.removeEventListener('updateend', ready);
              buffer.removeEventListener('error', error);
              failed(cause instanceof Error ? cause : new Error('stream_append_failed'));
            }
          });
          if (settled) break;
          if (!requestedPlay) {
            requestedPlay = true;
            // Do not await play(): decoding may need subsequent network chunks.
            void audio.play().catch(error => fail(
              new Error(error?.name === 'NotAllowedError' ? 'autoplay_permission_required' : 'stream_playback_failed'),
            ));
          }
        }
        if (settled) return;
        if (!received) throw new Error('stream_empty');
        if (source.readyState === 'open' && !buffer.updating) source.endOfStream();
      } catch (error) {
        if (settled) return;
        fail(error instanceof Error ? error : new Error('stream_unavailable'));
      }
    }

    signal.addEventListener('abort', abort, { once: true });
    audio.addEventListener('playing', playing);
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', errored);
    source.addEventListener('sourceopen', sourceOpen, { once: true });
    audio.src = url;
    audio.preload = 'auto';
    audio.load();
  });
}
