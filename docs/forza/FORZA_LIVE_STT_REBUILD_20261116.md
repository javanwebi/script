# FORZA live Persian speech and turn-continuity rebuild — 2026-11-16

## Scope and compatibility

This change improves the existing FORZA call without replacing the approved particle avatar, greeting WAV, Persian Web Speech path, Diba/Vosk fallback, consult SSE, private Piper Nima voice, or interruption controls. It deliberately does not activate the separate Gemini Live WebSocket: that path uses a different provider/voice and can create a different cost profile.

## Changes

- Browser interim/final hypotheses remain the immediate fallback and continue to render in the existing customer subtitle surface while the local model warms.
- On devices with at least four logical CPUs and 4 GB of device memory (or eight CPUs when memory reporting is unavailable) (and without Save-Data enabled), the pinned Persian Diba/Vosk WASM model is loaded in the background from the same Sanat Pish origin. Once ready, it becomes the streaming partial-result recognizer; low-power devices stay on browser STT.
- The Diba browser archive is retained in the private STT runtime image and served with immutable caching from `/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz`. No third-party model host or paid speech API is used by the browser path.
- The current customer utterance is now carried across browser SpeechRecognition restarts. A new recognition session appends only its new suffix instead of replacing the already visible words; overlapping words and split technical-code tokens are merged.
- Ordinary speech requires a 2.6–3.1 second acoustic quiet window before dispatch. If VAD is unavailable, text-only fallback waits at least 4.5 seconds so a temporary browser interim stall cannot prematurely submit a long sentence. A two-second breath therefore does not split the same thought into a second AI turn. Only explicit stop/continue control phrases retain a faster endpoint; greetings and acknowledgements use the same continuation window as ordinary speech.
- Near-field acoustic floor is latched after an utterance is admitted, so the customer's own speech cannot be relearned as ambient noise during natural gaps between words. Strict final-result freshness remains bounded; late finals preserve already admitted interim words rather than admitting stale background speech.
- If acoustic speech is detected before browser text arrives, the recorder waits through the same continuation window instead of stopping after one second with an empty hypothesis.
- MediaRecorder rotates at a bounded chunk count instead of slicing or splicing the beginning off a WebM container. Each rotated segment keeps its own header; the Diba fallback transcribes complete segments and merges overlapping words.
- Server Diba is used as a final fallback only when no live browser/local transcript is usable. A successful live transcript no longer waits for a second full-audio ASR request before the LLM request.
- Transient browser network errors now retry for the life of the call with a capped backoff; a third temporary error no longer permanently disables STT. A start watchdog also recovers recognizers that accept `start()` but never emit `onstart`.
- The particle avatar's crown/hair keeps a subtle audio-reactive motion during greeting and TTS even when browser echo cancellation suppresses the speaker loopback.

## Validation

The smart-turn tests cover the two-second pause, final/interim endpointing, SKU corrections, and transcript merging across recognizer restarts. The recorder-container test checks that capped recordings rotate without slicing WebM data. The browser smoke test checks that interim words are visible before upload, a two-second pause does not submit the turn, and words from a restarted recognizer append to the same transcript.

## Operational note

Web Speech interim delivery is controlled by the browser/OS speech service; the application can render each partial result immediately but cannot force the browser to emit one event per spoken word. On capable devices the same-origin local Diba/Vosk recognizer supplies streaming partials instead. The server Diba worker remains the final full-audio fallback.
