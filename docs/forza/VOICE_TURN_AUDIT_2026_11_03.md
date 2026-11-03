# FORZA voice-turn audit — 2026-11-03

Candidate: `fix/forza-interruption-observability-20261103`, PR #250 (draft).
**Not production verified.** A GitHub checkout SHA is not proof of which image/JS is running behind Nginx.
The private Piper Nima service is a distinct Docker container and must be checked independently.

## Read-only VPS reconciliation (NO secrets or destructive commands)

Run on the actual Ubuntu VPS, not your local PC:

```bash
set -euo pipefail
cd /opt/sanatpish
echo "=== REPOSITORY ==="
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short
echo "=== EXTERNAL HTTP ==="
curl --noproxy '*' -kfsS --max-time 15 https://127.0.0.1/api/health
echo
curl --noproxy '*' -kfsS --max-time 15 https://127.0.0.1/api/ai/forza-voice-info
echo
echo "=== NGINX / RUNNING CONTAINERS ==="
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
sudo nginx -T 2>/dev/null | grep -E 'proxy_pass|listen |server_name' | head -90
for c in $(docker ps --format '{{.Names}}' | grep -E 'sanatpish|forza'); do
 echo "=== $c ==="
 docker inspect "$c" --format 'IMAGE_ID={{.Image}} STARTED={{.State.StartedAt}} OOM={{.State.OOMKilled}} LABEL_REVISION={{index .Config.Labels "org.opencontainers.image.revision"}}'
 docker image inspect "$(docker inspect -f '{{.Image}}' "$c")" --format 'IMAGE_CREATED={{.Created}} IMAGE_ID={{.Id}}'
done
echo "=== CAPACITY ==="
nproc
free -h
df -h /
docker stats --no-stream --format 'NAME={{.Name}} CPU={{.CPUPerc}} RAM={{.MemUsage}}'
```

If image revision label is blank, report `deployed source SHA: unknown`; use image ID, creation
timestamp, immutable build manifest and live JS hashes to trace it. **Do not assume**
`/opt/sanatpish` HEAD equals the currently running blue/green image. Resolve Nginx
active upstream to the container using the published container port.

## Validate the candidate safely

```bash
# GitHub Actions on PR #250: first require green TypeScript + Nima tests.
# Read-only inspection before any deployment:
cd /opt/sanatpish
git fetch origin main
git status --short
git log -1 --oneline origin/main
# DO NOT run the production deploy until PR is reviewed, merged, and the
# independently deployed Piper image update is planned.
# Official, guarded main-only deploy after merge/review:
# sudo sanatpish-deploy-main
```

The production command is sourced from `ops/sanatpish-deploy-main.sh`; check the
current contents and current release SHA before invoking it. **Do not use**
`git reset --hard`, `docker system prune`, or any blanket DB reset. This
candidate modifies `scripts/forza_nima_voice_http.py` and therefore also
requires a controlled Nima image rebuild/canary followed by explicit promotion.
A frontend-only deployment will leave the old queue implementation running.

## Timed phases and observable limits

- Browser: `vad_end_detected`, `browser_stt_turn_end`, `request_preparation_end_to_turn_ms`,
  `sse_headers`, `first-text`, `first-tts-phrase-queued`, `wave_received`,
  `decode_ready`, `audio_scheduled`, `playback_started`, `playback_idle`,
  `customer-interrupt`.
- Server: `AI_GENERATION_START` with turn ID, provider TTFT, `FORZA_TTS_STAGE`
  with upstream/queue/inference time and WAV byte count.
- Nima private worker: queue time and synthesis time separate, headers
  `X-Forza-Queue-Ms`, `X-Forza-Inference-Ms`.
- Client and server clocks are NOT automatically synchronized: compare
  durations within the same process, or explicitly synchronize timestamps.
- WebAudio `AudioBufferSourceNode.start` + running AudioContext + scheduled
  clock only establishes playback initiation in the browser, **not** that a
  human actually heard sound. Device volume, mute, OS route and physical output
  still require a real-mic/speaker capture test. Partial words inside a
  cancelled WAV cannot be reconstructed reliably; history records only
  fully ended frames and marks the interruption.

## Test matrix for production/staging

At least 10 independent trials *per device/path* and report n, arithmetic mean,
median, and nearest-rank p95 (all in milliseconds) for:
1. acoustic speech end -> first actual audible sample;
2. acoustic VAD speech detection -> FORZA audio silenced;
3. inter-WAV audible gap;
4. STT finalization -> first text;
5. TTS queue -> inference -> WAV transfer -> decode -> scheduled/started playback.

Use Chrome + headset, Chrome + speakerphone, and one real mobile device.
Cover Persian short query, natural pause and continuation, `6202ZZ` corrected to
`6203`, `SPA 1250`, `C3`, units (bar, mm, rpm), `صبر کن`, `نه منظورم`,
`ادامه بده`, barge-in during speaking/thinking, concurrent calls, delayed
upstream TTS, SSE truncation, network interruption, suspended AudioContext,
autoplay denial and noise. Keep a separate result table for headsets vs speaker.

**Never** record audio/utterance content, transcript text, credentials, or customer
personal information in permanent logs. Collect only anonymous turn ID, stage
durations, byte counts, error codes, and device type.

This PR is NOT sufficient to claim p95 < 2s or barge-in < 300ms. Acoustic
speaker echo cannot be perfectly separated from a customer by RMS/VAD and
a text-match heuristic. Chrome WebSpeech network latency and one-core Nima
throughput impose additional uncertain limits; escalate to a verified
realtime streaming engine/provider only after collecting the above measurements.
