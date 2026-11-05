# FORZA live speech 2026-11-05 — verified source review and controlled pilot

Status: **Draft PR / NOT production-deployed.** Original FORZA particle layout, CSS,
voice Nima and unrelated Sanat Pish code are retained. No STT payment, model
upgrade, resource limit, database migration, transcript or audio persistence.

## Evidence versus uncertainty

- Main at branch creation: `8e9a3c0070a5a7bdd5147a9061bac09e95942d64`.
  Newer main commits may land independently; always compare fresh heads.
- Visible website tab exposed original particle HUD and Piper Nima label.
  A browser tab is **not** proof of release SHA, server provider, TTS
  audio output, microphone capture correctness or spoken latency.
- WebSpeech recognition via `SpeechRecognition` (fa-IR, interim/final) is the
  browser-first STT. The optional Gemini/Worker `/api/ai/forza-live` path
  transcribes a final recorder segment, not audio streamed to the server.
- An unused Vosk/Diba local recognizer scaffold is present in `forzaLocalSpeech.ts`,
  but `loadDibaSttModel()` is not called from the live page and the expected
  `/forza-runtime/stt/vosk.js` source asset is missing from this branch.
  The external ~53 MB browser model is **not** automatically downloaded or a
  verified live fallback. Avoid introducing this dependency without device,
  memory and network validation. Cloud STT also requires explicit opt-in.
  `/api/ai/forza-stt-info` separately reports configured Gemini and an
  unverified Worker STT candidate; it advertises `serverStreamingStt:false`.
- Model in `/api/ai/consult-stream` selected from the actual VPS environment:
  `FORZA_VOICE_PROVIDER`, `XKIRO_MODEL_VOICE`, `BAI_MODEL_VOICE`,
  Gemini/Worker credentials. Do not infer a provider from a source file.
- For Nima, `/api/ai/forza-speech` produces a complete WAV for each *text
  phrase*. It is not within-phrase audio-streaming. Each phrase waits on CPU.
- Prior examples from the operator: approx 3.23s to speech-end decision
  and 2.22s additional until player start (approx 5.46s total) on one
  turn, and 9.34s on another. These are **historical, not this revision's
  verified baseline or new success statistics**.

## Changes in this PR

| Issue | Files / mechanism | Test | Remaining limitation |
| --- | --- | --- | --- |
| Phrase 1 reaches single CPU ahead of phrase 0 | `server/ai/forzaTtsTurnOrder.ts`, `server.ts`, `forzaNimaBufferedSpeech.ts`, `AiForzaCallExperience.tsx`: ordered indexed turn gate, bounded cancellation | `forzaTtsTurnOrder.test.ts`, `forzaNimaBufferedSpeech.test.ts` | Sequential per-turn synthesis may increase gaps; worker FIFO still arbitrates multiple turns |
| Two slow model failures in one live turn | `xkiroFreeFailover.ts`: fail fast on long failed attempt, total free-only budget; `AiForzaCallExperience.tsx`: only 404/405 gets legacy non-streaming fallback | `xkiro-free-failover.test.ts`, `forzaVoiceRecoveryUi.test.ts` | Shorter timeout is not faster *successful* model TTFT |
| Invalid negative/absent/stale or muted-audio timings and cross-clock assumptions | `server.ts`, `baiConsult.ts`, client VAD: monotonic clock per process, NA reason, code-only stage markers | `test_forza_latency_aggregate.py`, UI tests | Browser AudioContext start is not proof of acoustic audibility |
| Browser STT false-negative fallback status | `server.ts` exposes Worker candidate separately, client attempts it when configured | `forzaVoiceRecoveryUi.test.ts` | Worker candidate is not proof endpoint works, not independent streaming STT |
| STT guesses unintelligible words | `server.ts /api/ai/stt` rejects blank/unknown transcription rather than guessing | Existing STT config tests, API/typecheck | Gemini recognition accuracy not measured on an actual Persian speaker |
| Interrupted phrase stored as if heard | `AiForzaCallExperience.tsx` stores only full WAV completions and elapsed metadata, not partial phrase words | UI history checks | Exact word offset requires alignment not available |
| Fragmented Markdown image link | `forzaCallPlainText.ts` and tests | `forzaCallPlainText.test.ts` | Not a substitute for broad model-output quality evaluation |

## Privacy-safe production comparison (only after server operator approval)

The original deployment script remains exactly `sudo sanatpish-deploy-main`.
**Do not execute it on the draft branch.** First run the existing read-only
audit. From SSH on the production VPS:

```bash
cd /opt/sanatpish
git fetch origin fix/forza-live-turn-order-and-stt-20261105
git show origin/fix/forza-live-turn-order-and-stt-20261105:ops/forza-live-voice-audit-readonly.sh > /tmp/forza-readonly-audit.sh
bash -n /tmp/forza-readonly-audit.sh
sudo bash /tmp/forza-readonly-audit.sh
```

This prints available memory, disk, active container revision, source hashes,
health, public STT/voice metadata, and bounded CPU stats; no credentials.

For **aggregated numeric-only** latency from Node/voice logs after a
controlled test (old logs are optional and never used as the new baseline):

```bash
git show origin/fix/forza-live-turn-order-and-stt-20261105:ops/forza-voice-latency-aggregate.py > /tmp/forza-latency-aggregate.py
( for c in $(sudo docker ps --format '{{.Names}}' | grep -E '^sanatpish-unified-live-|^forza-voice$'); do
    sudo docker logs --since 30m "$c"
  done ) 2>&1 | python3 /tmp/forza-latency-aggregate.py
```

Browser timing events require exporting **only the scrubbed FORZA stage
lines** from an authorized tester's console into stdin of the same script.
Do not collect raw speech/transcripts. Correlate by opaque call/turn/phrase,
never subtract Node clock from browser clock.

Pilot tests: Persian hello, `SPA 1250`, `6202ZZ`, `C3`, mid-sentence
hesitation and correction `۶۲۰۲ نه ۶۲۰۳`, repeated stop, headset versus
phone speaker, noise, weak mobile network, SSE EOF without done, STT disabled,
private voice slow/busy, multiple sequential turns and actual on-exit cleanup.
Use low concurrency and no stress traffic against the public website.

## Acceptance gates

1. Verify current production SHA and actual providers from **VPS**.
2. Pass clean CI (unit/static/isolated browser) on exact PR SHA.
3. Conduct real microphone/speaker tests on candidate deployment with
   cancellation and zero private-data persistence.
4. Report `n`, p50, p95, failures and cancellations **per comparable stage**
   with monotonic per-process timings, excluding muted/stale sample data; show missing-sample reasons.
5. Compare before/after on equivalent device, network and provider.
6. Reject any claim of sub-2s success / sub-300ms audible interruption
   until real measurements support it. No change of provider spend without
   approval. No merge to `main` or VPS deployment until accepted.

No separate paid STT provider was activated. To obtain true streaming STT,
choose a provider that exposes a verified Persian realtime API, verify its
contract and terms, provision *new* credentials after explicit approval,
implement session/audio frame transport and speaker-echo-aware VAD; this PR
does not falsely describe the current post-recording Gemini path as live STT.
