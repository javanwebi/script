# FORZA Persian Voice API — isolated Railway service

This experimental service runs **Diba STT Small** and **Piper Persian Amir TTS** on CPU and forwards chat to the project's existing Gemini API key. It does not modify the main Sanat Pish application.

## Railway configuration

Build root directory: `/services/forza-voice` (from branch `feat/forza-voice-railway`).
Dockerfile: `Dockerfile`. Set healthcheck path: `/health`.

Required variables:
- `FORZA_VOICE_TOKEN` — a strong secret for the `X-Voice-Token` header.
- `GEMINI_API_KEY` — Railway variable reference to the existing `sanatpish` service.
- `GEMINI_MODEL` — Gemini model available to the API key.
- `PORT` — Railway-supplied automatically.

Example calls (token from Railway variables; do NOT expose it in frontend JS):
```bash
curl https://YOUR-VOICE-SERVICE.up.railway.app/health
curl -X POST https://YOUR-VOICE-SERVICE.up.railway.app/v1/tts \
  -H "X-Voice-Token: $FORZA_VOICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"سلام، به صنعت پیش خوش آمدید."}' --output greeting.wav
curl -X POST https://YOUR-VOICE-SERVICE.up.railway.app/v1/stt \
  -H "X-Voice-Token: $FORZA_VOICE_TOKEN" -F 'audio=@speech.wav'
```

STT accepts common audio uploads with ffmpeg conversion to 16kHz mono. Limits: 20-second input, 2 MB audio upload, 750-character TTS. This is a **REST prototype**, not production-quality bidirectional realtime streaming; barge-in, streaming audio, noise tests and concurrent-user benchmarks remain outstanding.

Build-time Piper voice: `fa_IR-amir-medium`, published under rhasspy/piper-voices. Runtime Diba small model auto-downloads on first STT request. Running models on a small CPU may add latency and consume RAM. Check licenses of the runtime packages and model cards before commercial launch.
