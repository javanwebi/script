# FORZA — MOSS-TTS-Realtime GPU service

**Status:** Integration implementation and contract tests. This is NOT an
assertion of a working paid GPU deployment. The app's production Railway
service remains on the current main commit until an end-to-end GPU test passes.

## Why a separate host?
Official MOSS-TTS-Realtime streaming FastAPI exits inference without CUDA.
Railway does not currently offer an appropriate GPU service. Deploy this image
on a CUDA-compatible host such as a Runpod GPU Pod, with HTTPS/TLS termination.
Railway continues to host frontend, Express, database connectivity and Gemini
text/STT. TTS weights and Python dependencies live only on the GPU host.
The official repo/model are OSS with Apache-2.0 license (preserve notices).

The Dockerfile installs OpenMOSS/MOSS-TTS at the pinned commit
`934d6826b084c46a0d033402174d5f8ac4ed2519`.
Both models are fetched at first boot:
`OpenMOSS-Team/MOSS-TTS-Realtime` and
`OpenMOSS-Team/MOSS-Audio-Tokenizer`.

## Runtime and secrets
- GPU host environment: `FORZA_TTS_TOKEN=<strong-random-secret>`;
  `MOSS_TTS_DEVICE=cuda:0`; `MOSS_TTS_ATTN_IMPL=sdpa`.
- Keep the model server behind HTTPS; never expose plaintext HTTP publicly.
- On the Railway **sanatpish** Node service: `FORZA_TTS_PROTOCOL=moss-realtime`,
  `FORZA_TTS_BASE_URL=https://your-private-gpu-endpoint.example`,
  `FORZA_TTS_TOKEN=<same-secret>`, `FORZA_TTS_MODEL=moss-tts-realtime`,
  `FORZA_TTS_VOICE=forza_male_fa`, and `FORZA_TTS_TIMEOUT_MS=20000`.
  Variables stay server-only; never prefix with `VITE_`.
- For voice cloning, obtain **consent and usage rights** to a male Persian
  reference recording, install it on the GPU host under
  `/app/voices/forza_male_fa.wav`, and set Railway's
  `MOSS_TTS_PROMPT_AUDIO=/app/voices/forza_male_fa.wav`.
  You may omit the reference, but then the model does not guarantee the desired
  male Persian voice.
- Health endpoint `GET /ready` checks the CUDA device and actually loads
  the model (the upstream `/health` endpoint does not verify inference).
  Session routes require the Bearer secret.

## Native session streaming contract
`POST /tts/session/start` with
`{"session_id":"UUID","new_turn":true,"prompt_audio":"/app/voices/forza_male_fa.wav"}`
opens a turn. Concurrent `GET /tts/session/{uuid}/audio` streams mono signed
PCM16 with the reported sample rate, while
`POST /tts/session/push` sends
`{"session_id":"UUID","text":"سلام","is_final":true}`.
Finally `POST /tts/session/close` releases the session.

`src/services/forzaMossRealtimeClient.ts` implements these native calls,
checks codec/sample rate and converts PCM16 into WAV for the site's existing
`/api/ai/tts` JSON contract. It includes optional per-chunk handling for a
future continuous browser-audio pipeline.

### Important limitations
- This first adapter buffers one spoken phrase into WAV; it does **not yet
  stream sample frames to the user's AudioContext in real time**, nor reuse
  MOSS KV cache across multiple turns. Those require further frontend
  integration. Do not describe this stage as a complete low-latency live voice.
- Model quality for Persian technical terms, real GPU first-audio latency,
  microphone noise, backpressure, cancellation, reconnects, and throughput
  must be measured on the deployed CUDA instance before production rollout.
- Missing GPU, access token, voice recording or reachable endpoint must result
  in a clear error, never fall back to Gemini or browser speech.

References:
- https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_tts_realtime_model_card.md
- https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Realtime
