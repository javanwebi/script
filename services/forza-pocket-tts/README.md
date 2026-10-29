# FORZA — Pocket TTS Farsi v2 (male reference)
Only the FORZA TTS backend changes. Existing STT, Gemini, database, mic and turn taking stay unchanged.

Model: `mehdi-hf/pocket-tts-farsi-v2`.
Voice identity: user-supplied male WAV (the chosen `News sentence, male voice` sample).
The user states they hold commercial permission; the operator must retain proof covering model and reference recording.

**IMPORTANT:** Do not merge/deploy before audio QA. This integration has not yet synthesized or benchmarked speech on the production host. Sokhanvar API compatibility must be validated on the actual Docker image.

## Voice reference
The user-supplied `hello.wav` was 5.46 s at 24 kHz. Training recommends at most 5 seconds.
Download the prepared `forza-male-reference.wav` from this ChatGPT conversation and place it privately on the inference host at `/opt/forza-pocket/voices/forza-male-reference.wav`. Do not commit the voice reference to a public repository.
Using a generated clip as a cloning prompt may differ from the original voice prompt; test speaker consistency against the target sample.

## Docker
Build context: repository root. Dockerfile: `services/forza-pocket-tts/Dockerfile`.
Mount persistent HF cache to `/models/hf` and voice WAV to `/voices/forza-male-reference.wav:ro`.
Set `FORZA_POCKET_TOKEN` (required), `FORZA_POCKET_VOICE=/voices/forza-male-reference.wav`, `PORT=8080`.
Do not expose the sidecar port publicly. First boot downloads Pocket and Persian G2P models.

In main web service configure:
- `FORZA_POCKET_URL=http://<private-inference-host>:8080`
- `FORZA_POCKET_TOKEN=<same-secret>`

The browser still calls `POST /api/ai/forza-speech`. Web backend proxies to private `POST /synthesize`.
Keep old production TTS until a real male-voice sample, latency test and microphone regression tests pass.
