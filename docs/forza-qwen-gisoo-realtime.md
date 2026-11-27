# FORZA temporary Gisoo Qwen Realtime provider

## Purpose

The `/ai-forza` and `/face-to-face` routes now mount the native `ForzaQwenCallExperience` browser controller. Microphone PCM and streamed speech use `/api/live` directly; the legacy AvalAI/Piper chain is not mounted by those routes. The existing legacy component and Gemini server implementation remain in source.

## Runtime configuration

These values belong only in the private VPS `.env.forza-voice` file (which is ignored by Git):

```dotenv
FORZA_REALTIME_PROVIDER=qwen
FORZA_QWEN_API_KEY=<Gisoo API key>
FORZA_QWEN_VOICE=Andre
FORZA_QWEN_MAX_SESSIONS=8
FORZA_QWEN_SILENCE_MS=1100
```

The key is read only by the server. Never put it in Vite variables, browser code, GitHub Actions, source files, or commits.

The existing `applyPrivateForzaConfig` loader accepts `FORZA_*` values from this private file. The VPS deployment preserves the current container environment and its private mounts; verify the existing `.env.forza-voice` mount before deploying.

## Provider behavior

- `FORZA_REALTIME_PROVIDER=qwen`: explicitly routes new `/api/live` sessions to `qwen3.8-omni-flash-realtime` through `wss://ir.gisoo.pro/api/v1/realtime`.
- Missing provider value defaults to Qwen. Explicit `gemini` selects the server's old Gemini path; the Qwen-only page rejects that provider rather than silently falling back.
- The Qwen bridge maps audio, assistant transcript, interruption, and turn-complete events to the existing FORZA browser protocol.
- The realtime session exposes a read-only `search_sanatpish_catalog` function. It uses the same database-hydrated product catalogue and current admin overrides as FORZA consultation, returns public family/SKU metadata only, and never returns prices or stock.
- A catalogue tool result is returned to the model through `function_call_output` and is also rendered as product cards in the live call panel. Family cards link to the real product detail route.
- The voice-first Persian prompt prioritizes natural turn-taking, a single opening greeting, short conversational replies, and staged engineering consultation (normally 1–2 sentences for ordinary turns and 2–4 for technical advice). It never repeats a greeting or forces a follow-up question on every turn.
- Input is PCM 16 kHz mono; output is PCM 24 kHz mono.
- Gisoo server VAD currently ends turns and interrupts generated audio when the customer starts speaking. A semantic noise-aware VAD mode is being validated separately before activation; do not assume it is live yet. The bridge reports whether the browser actually enabled echo cancellation, noise suppression, and automatic gain control.
- Text input from the existing client remains supported.
- Provider usage metadata and actual browser capture-processing flags are logged without logging customer audio, transcripts, device identifiers, or API credentials.

## Revert after the exhibition

For full rollback, restore `AiForzaPage.tsx` to import the legacy `AiForzaCallExperience`, set `FORZA_REALTIME_PROVIDER=gemini` if the old Gemini websocket is needed, and deploy. No database migration is required.

## Known constraints

- The account currently reports a concurrency limit of 8; the bridge caps active Qwen sessions at 8 by default.
- Gisoo documents a maximum of 60 seconds per user speech turn and a maximum one-hour session (with automatic close after 120 seconds without a message).
- The bridge requests `Andre` in `session.audio.output.voice` by default. Alibaba lists Andre as a natural, steady male voice in Qwen3.8-Omni and Persian is included in the model's supported non-Chinese languages. The bridge verifies the voice reported by `session.updated`; an actual Persian browser call is still required to confirm the audible result.
- User-transcription events are forwarded if Gisoo emits them. The current Gisoo Realtime documentation guarantees assistant transcript events but does not specify live user-transcription events.
- The browser permits up to 90 seconds of scheduled audio before cancelling an unusually long response; this no longer tears down the live WebSocket. The normal answer target is shorter and governed by the engineering instructions and token cap.

## Validation

Run:

```bash
npm run lint
node --import tsx --test tests/forza-gisoo-qwen-realtime.test.ts
```

Do not merge or deploy until CI and a real browser microphone test pass. Do not change the current Gemini code while validating Qwen.
