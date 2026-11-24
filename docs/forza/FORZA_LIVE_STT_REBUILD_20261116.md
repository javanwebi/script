# FORZA live Persian speech and turn-continuity rebuild — 2026-11-16

## Scope and compatibility

This change improves the existing FORZA call without replacing the approved particle avatar, greeting WAV, Persian Web Speech path, Diba/Vosk fallback, consult SSE, private Piper Nima voice, or interruption controls. It deliberately does not activate the separate Gemini Live WebSocket: that path uses a different provider/voice and can create a different cost profile.

## Changes

- Browser interim/final hypotheses remain the immediate fallback and continue to render in the existing customer subtitle surface while the local model warms.
- On devices with at least four logical CPUs and 4 GB of device memory (or eight CPUs when memory reporting is unavailable), and without Save-Data enabled, the pinned Persian Diba/Vosk WASM model is loaded in the background from the same Sanat Pish origin. Once ready, it becomes the streaming partial-result recognizer; low-power devices stay on browser STT.
- The Diba browser archive is retained in the private STT runtime image and served with immutable caching from `/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz`. No third-party model host or paid speech API is used by the browser path.
- Browser audio is explicitly low-pass resampled from the device's actual 44.1/48 kHz capture rate to the Diba model's required 16 kHz mono PCM before each Vosk frame. This avoids configuring the 16 kHz Persian model with the browser's often-48 kHz output rate and keeps each audio frame around 42–46 ms.
- The current customer utterance is now carried across browser SpeechRecognition restarts. A new recognition session appends only its new suffix instead of replacing the already visible words; overlapping words and split technical-code tokens are merged.
- Turn endpointing is adaptive and requires both stable transcript text and real acoustic silence. A high-confidence final question/request or standalone greeting/acknowledgement uses a 1.35-second quiet window (2.1 seconds for provisional interim text); unfinished clauses, corrections and ambiguous technical codes retain 2.8–3.4 seconds. Empty live hypotheses still wait 5.2 seconds for delayed ASR, and if VAD is unavailable the text-only fallback waits at least 6 seconds. Explicit stop/continue commands retain a 650ms endpoint. This shortens the common complete-turn path without treating a grammatical-looking fragment or a partial SKU as a finished request.
- Near-field acoustic floor is latched only after recognized customer words pass admission, so loudspeaker echo cannot become a customer utterance. The accepted utterance survives short word gaps, but the latch expires after 300 ms of quiet. Fresh near-field PCM resets a pending endpoint immediately, even before the full 160 ms admission window is reached. Strict final-result freshness remains bounded; late finals preserve already admitted interim words rather than admitting stale background speech.
- If acoustic speech is detected before browser text arrives, the recorder waits through the same continuation window instead of stopping after one second with an empty hypothesis.
- MediaRecorder rotates at a bounded chunk count instead of slicing or splicing the beginning off a WebM container. Each rotated segment keeps its own header; the Diba fallback transcribes complete segments and merges overlapping words.
- Server Diba is used when no live transcript is usable, and as a bounded final verifier when Chrome is the active live recognizer. Devices already using local Diba avoid a duplicate pass through the same model. Recorder segments are submitted in parallel to the bounded server worker pool and merged in original recording order; verifier failure never erases a usable browser transcript.
- Transient browser network errors now retry for the life of the call with a capped backoff; a third temporary error no longer permanently disables STT. A start watchdog also recovers recognizers that accept `start()` but never emit `onstart`.
- The particle avatar's crown/hair keeps a subtle audio-reactive motion during greeting and TTS even when browser echo cancellation suppresses the speaker loopback.

## Validation

The smart-turn tests cover the two-second pause, final/interim endpointing, SKU corrections, and transcript merging across recognizer restarts. The recorder-container test checks that capped recordings rotate without slicing WebM data. The browser smoke test checks that interim words are visible before upload, a two-second pause does not submit the turn, and words from a restarted recognizer append to the same transcript.

## Operational note

Web Speech interim delivery is controlled by the browser/OS speech service; the application can render each partial result immediately but cannot force the browser to emit one event per spoken word. On capable devices the same-origin local Diba/Vosk recognizer supplies streaming partials instead. The server Diba worker remains the final full-audio fallback.
