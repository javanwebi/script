# FORZA live Persian speech and turn-continuity rebuild — 2026-11-16

## Scope and compatibility

This change improves the existing FORZA call without replacing the approved particle avatar, greeting WAV, Persian Web Speech path, Diba/Vosk fallback, consult SSE, private Piper Nima voice, or interruption controls. It deliberately does not activate the separate Gemini Live WebSocket: that path uses a different provider/voice and can create a different cost profile.

## Changes

- Browser interim/final hypotheses remain the primary low-latency transcript and continue to render in the existing customer subtitle surface.
- The current customer utterance is now carried across browser SpeechRecognition restarts. A new recognition session appends only its new suffix instead of replacing the already visible words; overlapping words and split technical-code tokens are merged.
- Ordinary speech requires a 2.6–3.1 second quiet/stability window before dispatch, even if the browser adds punctuation during a pause. A two-second breath therefore does not split the same thought into a second AI turn. Only explicit stop/continue control phrases retain a faster endpoint; greetings and acknowledgements use the same continuation window as ordinary speech.
- If acoustic speech is detected before browser text arrives, the recorder waits through the same continuation window instead of stopping after one second with an empty hypothesis.
- MediaRecorder rotates at a bounded chunk count instead of slicing or splicing the beginning off a WebM container. Each rotated segment keeps its own header; the Diba fallback transcribes complete segments and merges overlapping words.
- Server Diba is used as a final fallback only when the browser has no usable transcript. A successful live browser transcript no longer waits for a second full-audio ASR request before the LLM request.
- The particle avatar's crown/hair keeps a subtle audio-reactive motion during greeting and TTS even when browser echo cancellation suppresses the speaker loopback.

## Validation

The smart-turn tests cover the two-second pause, final/interim endpointing, SKU corrections, and transcript merging across recognizer restarts. The recorder-container test checks that capped recordings rotate without slicing WebM data. The browser smoke test checks that interim words are visible before upload, a two-second pause does not submit the turn, and words from a restarted recognizer append to the same transcript.

## Operational note

Web Speech interim delivery is controlled by the browser/OS speech service; the application can render each partial result immediately but cannot force the browser to emit one event per spoken word. Diba remains the server fallback after the utterance is captured; this change does not claim that the current Diba worker is a continuous streaming recognizer.
