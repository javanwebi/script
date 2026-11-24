# FORZA Live gateway rebuild — 2026-11-24

## What this provides

The customer browser connects to the same-origin `/api/live` WebSocket. The Express server authenticates to Gemini Live with a server-only key and bridges a continuous, bidirectional audio session. The browser never receives the provider key. Both the main `/ai-forza` page and the face-to-face modal now use the new `AiForzaLiveExperience` controller; the old request/response call page is no longer the customer entry point.

- Microphone input: mono PCM16 at 16 kHz.
- Model output: native audio chunks at 24 kHz plus available text transcription.
- Turn-taking: provider VAD plus a short local near-field speech detector; queued browser audio is stopped immediately on barge-in, including the case where the model has already finished generating.
- Text input remains supported over the same socket.
- Session state is in memory only. No audio or transcript is written to disk or logged.
- WebSocket upgrades require a matching same-origin `Origin` header.
- Default limits: 20 concurrent sessions, 2 per source IP, 60 session starts per source IP per hour, 4 minutes per session, 15 seconds to establish the provider session.
- Slow consumers, invalid payloads, excessive audio frame rates, provider failures and missing credentials fail closed. There is no silent switch to the old request/response voice path.

## Required server configuration

Set `GEMINI_API_KEY` in the server's private environment. Do not use a `VITE_` variable and do not commit the key.

Optional settings:

| Variable | Default | Purpose |
|---|---:|---|
| `FORZA_LIVE_ENABLED` | `true` | Emergency on/off switch |
| `FORZA_LIVE_MODEL` | `gemini-3.8-live` | Gemini Live model |
| `FORZA_LIVE_VOICE` | `Charon` | Native output voice |
| `FORZA_LIVE_MAX_CONNECTIONS` | `20` | Global concurrent session cap |
| `FORZA_LIVE_MAX_CONNECTIONS_PER_IP` | `2` | Concurrent sessions per IP |
| `FORZA_LIVE_MAX_SESSIONS_PER_HOUR_PER_IP` | `60` | Session starts per IP per hour |
| `FORZA_LIVE_MAX_SESSION_MS` | `240000` | Maximum session duration |
| `FORZA_LIVE_CONNECT_TIMEOUT_MS` | `15000` | Provider connection timeout |

The read-only `GET /api/ai/forza-live-status` endpoint reports whether the gateway is enabled and whether a server-side key is configured. It never returns the key.

## Validation

Run:

```bash
npm run test:forza-engine
npm run lint
npm run build
```

The gateway tests use a fake provider and verify the WebSocket protocol, PCM forwarding, text forwarding, session greeting, transcription events, audio output chunks, interruption, origin rejection, missing-key behavior, per-IP rate limiting and provider-session cleanup. The browser simulation test covers microphone capture, mute, playback teardown and local barge-in.

A green mocked test is not proof of a live provider session. Before opening the feature to customers, run a real browser smoke test against the deployed server with a valid private key:

1. `GET /api/ai/forza-live-status` must return `enabled: true` and `configured: true`.
2. Start a call in Chrome over HTTPS and grant microphone permission.
3. Confirm the socket receives `connected` only after the provider session is established.
4. Speak a Persian sentence; confirm `user_transcript` updates while speaking.
5. Confirm `audio_chunk` and `ai_transcript` arrive and the browser plays the voice.
6. Speak over the answer; confirm the model emits `interrupted` and playback stops immediately.
7. Ask a second question in the same session and confirm context continues.
8. End the call and confirm the browser microphone track and provider session close.

Do not call the feature production-ready until this real-provider test passes on desktop and a real mobile device. Provider usage is subject to the billing and rate limits of the configured Google project.
