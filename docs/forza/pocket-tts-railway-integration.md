# FORZA Persian TTS — private Railway service

## Runtime architecture
- Browser `/ai-forza` requests microphone permission upon entry, prefetches the greeting, and starts transcription only after the greeting audio ends.
- Existing microphone/STT components are preserved.
- Server `POST /api/ai/consult-stream` with `mode: "forza"` emits incremental Gemini text (SSE).
- Browser sends first speakable phrase straight to `POST /api/ai/tts`; the next phrase is synthesized while the previous plays. Ordered playback prevents overlapping voices.
- Express chooses a private self-hosted Persian engine first, and may fall back to Gemini TTS if configured. All provider credentials remain server-only.

## Supported private TTS protocols
1. `FORZA_TTS_PROTOCOL=parsigo`: [nimaone/persian_tts](https://github.com/nimaone/persian_tts) FastAPI:
   `POST /api/tts` with `{text, voice, mode: 'pack'}`; its response gives an `id`, which is fetched using `GET /api/audio/{id}` (WAV).
2. `FORZA_TTS_PROTOCOL=openai` (or unset): `POST /v1/audio/speech` with model, voice and input, expecting a WAV.

## Railway configuration
Configure on the Node service using server secrets:
```dotenv
GEMINI_API_KEY=<set-with-railway-secrets>
FORZA_TTS_BASE_URL=http://<PRIVATE_TTS_SERVICE>.railway.internal:8000
FORZA_TTS_PROTOCOL=parsigo
FORZA_TTS_VOICE=male_hello.wav
FORZA_TTS_TOKEN=
```
Do not add `FORZA_TTS_BASE_URL` until the TTS service is actually healthy. Keep the service on Railway private networking. The ParSiGo demo server does not implement a TTS authorization layer by default, so never expose it on a public unauthenticated domain.

The published ONNX engine supports running on CPU; however P50/P95 time-to-first-audio and concurrent-turn capacity **must be measured on the actual allocated Railway CPU**. This integration retrieves complete short WAV phrases, so it does not claim true PCM frame streaming.

## Model license — production blocker
The specific requested model `mehdi-hf/pocket-tts-farsi-v2` is under **CC-BY-NC-4.0**. The ParSiGo project explicitly warns commercial usage of the model's output is prohibited without a separate license. Sanat Pish is a commercial business site; do not download/deploy the weights to the public production workload until an appropriate commercial license is obtained. The code integration is ready to accept a commercially licensed engine as soon as one is installed.

## Browser restrictions
A web page cannot force sound autoplay or microphone access in a browser that denies permissions. No retry/unlock button is included, but existing stage interaction can resume playback where allowed. On direct entry with autoplay blocked, require a user interaction without silently claiming the greeting was heard.

## Acceptance tests before switching production audio
- Build + TypeScript + `tests/forza-tts-client.test.ts` and `tests/forza-streaming-speech.test.ts`.
- Verify greeting matches the text displayed on screen and actually reaches `ended`.
- Verify microphone permission requested on entry, audio never transcribed during greeting, and STT is sent to Express after the customer finishes.
- Verify zero overlapping phrases, old-turn cancellation, network reconnect, noise scenarios, and audio playback on Android/iOS/desktop.
- Measure first text token, first speakable phrase, TTS WAV generation, first audible frame, latency P50/P95, 10 concurrent clients.
- Deployment and production test must only occur with the correct license and sufficient server RAM/CPU.
