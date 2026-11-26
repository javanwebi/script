# FORZA temporary Gisoo Qwen Realtime provider

## Purpose

The `/ai-forza` and `/face-to-face` routes now mount the native `ForzaQwenCallExperience` browser controller. Microphone PCM and streamed speech use `/api/live` directly; the legacy AvalAI/Piper chain is not mounted by those routes. The existing legacy component and Gemini server implementation remain in source.

## Runtime configuration

These values belong only in the private VPS `.env.forza-voice` file (which is ignored by Git):

```dotenv
FORZA_REALTIME_PROVIDER=qwen
FORZA_QWEN_API_KEY=<Gisoo API key>
FORZA_QWEN_MAX_SESSIONS=8
FORZA_QWEN_SILENCE_MS=1100
```

The key is read only by the server. Never put it in Vite variables, browser code, GitHub Actions, source files, or commits.

The existing `applyPrivateForzaConfig` loader accepts `FORZA_*` values from this private file. The VPS deployment preserves the current container environment and its private mounts; verify the existing `.env.forza-voice` mount before deploying.

## Provider behavior

- `FORZA_REALTIME_PROVIDER=qwen`: explicitly routes new `/api/live` sessions to `qwen3.8-omni-flash-realtime` through `wss://ir.gisoo.pro/api/v1/realtime`.
- Missing provider value defaults to Qwen. Explicit `gemini` selects the server's old Gemini path; the Qwen-only page rejects that provider rather than silently falling back.
- The Qwen bridge maps audio, assistant transcript, interruption, and turn-complete events to the existing FORZA browser protocol.
- Input is PCM 16 kHz mono; output is PCM 24 kHz mono.
- Gisoo server VAD automatically ends turns and interrupts generated audio when the customer starts speaking.
- Text input from the existing client remains supported.
- Provider usage metadata is logged without logging customer audio, transcripts, or API credentials.

## Revert after the exhibition

For full rollback, restore `AiForzaPage.tsx` to import the legacy `AiForzaCallExperience`, set `FORZA_REALTIME_PROVIDER=gemini` if the old Gemini websocket is needed, and deploy. No database migration is required.

## Known constraints

- The account currently reports a concurrency limit of 8; the bridge caps active Qwen sessions at 8 by default.
- Gisoo documents a maximum of 60 seconds per user speech turn and a maximum one-hour session (with automatic close after 120 seconds without a message).
- The bridge explicitly requests `Ryan` in `session.audio.output.voice`, a high-energy Qwen voice with Persian support in Alibaba's official voice list. Gisoo documents Tina as the default and does not explicitly guarantee Ryan passthrough. If `session.updated` explicitly reports a different voice, the bridge rejects the session; if it reports no voice, actual voice remains unverified. Validate the returned audio with a real Persian call before deployment.
- User-transcription events are forwarded if Gisoo emits them. The current Gisoo Realtime documentation guarantees assistant transcript events but does not specify live user-transcription events.
- This temporary bridge does not implement catalogue function-calling tools. The existing FORZA system instruction is retained, but product/database lookup tools are not exposed to Qwen in this temporary mode.

## Validation

Run:

```bash
npm run lint
node --import tsx --test tests/forza-gisoo-qwen-realtime.test.ts
```

Do not merge or deploy until CI and a real browser microphone test pass. Do not change the current Gemini code while validating Qwen.
