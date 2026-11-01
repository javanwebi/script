# FORZA — Nima (gyro) low-latency private CPU canary and incremental speech

The user-selected **"💧 نیما"** at
https://huggingface.co/spaces/karim23657/Persian-TTS-sherpa maps to
`vits-piper-fa-gyro-medium`, the existing Persian Piper `fa_IR-gyro-medium`
model, NOT a speaker to be distilled from Pocket. Source model:
https://huggingface.co/rhasspy/piper-voices/tree/main/fa/fa_IR/gyro/medium
(license labelled MIT; verify upstream license and dependency terms).
An existing official Piper ONNX is pinned by SHA256 in Dockerfile.forza-nima.
**No 728-sample teacher work or GPU training is needed for Nima.**

The original Pocket service is untouched by the isolated Nima canary.
Generated customer WAV lives only in the Python `io.BytesIO` response and
browser audio context. No TTS output file is written.
`speak` returns one WAV per phrase; `speak-stream` returns a one-WAV framed
response for compatibility. The browser emits a phrase as soon as the LLM SSE
response has completed a clause; later phrases are synthesized while earlier
audio plays. The old Pocket full-answer path is retained as a fallback.

## Run the safe private canary on Ubuntu VPS

Do NOT start while `forza-pocket-teacher-eval` is still making the 728
recordings. The canary aborts before building if this job is running.

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
sudo bash ops/forza-nima-private-canary-vps.sh
```

On success, the command prints `FORZA_NIMA_PRIVATE_CANARY_PASS` and
the full-WAV generation speed (`rtf`). The script builds a separate image,
runs a private one-off container with max 2 CPUs and 1.25 GiB RAM, validates
its model ID, synthesizes a Persian sample, and removes the candidate.
It does NOT promote Nima, restart your site, or modify the database.

The full site switch (including the greeting) is intentionally separate from
the isolated canary. When performing a rollout, keep a stopped and verified
original Pocket container as backup, configure `FORZA_VOICE_ENGINE=nima`
on the main Node service and ensure `forza-voice:8080` is backed by the
same reviewed Nima image. Main API responds with
`X-Forza-Voice: piper-nima-gyro-medium`; the browser enables incremental
speech only when `GET /api/ai/forza-voice-info` advertises
`incrementalSpeech: true`. The welcome WAV is synthesized using the same
Nima backend and cached in application memory after boot; no stale Pocket
greeting is served when engine=Nima. Require real site checks for greeting,
Persian industrial pronunciations, text/audio alignment and multi-user load
before retiring Pocket.


## Real-time first words and uninterrupted scheduled Nima playback (November 2026)

To minimize the perceived gap between visible LLM tokens and audible speech:
* The browser renders **every SSE text delta immediately**, even if it is an
  unfinished word. Display is not gated by TTS generation.
* Nima begins synthesizing as soon as the *first coherent short group*
  (~38 characters maximum without punctuation, cut on a complete word boundary)
  has arrived; a short complete sentence may start earlier. It does **not**
  wait for the full answer or 80 characters before its very first request.
* Subsequent word groups target ~76 characters without punctuation, allowing
  the selected CPU voice to synthesize ahead with up to two in-flight requests.
* The optional first-audio buffer hold has been reduced from 500 ms to **120 ms**
  after the first valid WAV arrives, if less than two seconds of audio is ready.
  Any WAV with >=2 s available begins scheduling immediately.
* The existing `ForzaContinuousWav` component maintains a **single
  AudioContext sample-clock** for every clause: no separate HTML media player,
  no file writes, no speaker replacement, and no word duplication.
* Chrome Console now exposes `[FORZA_NIMA_LATENCY]
  phase=first-tts-phrase-queued`, per-phrase `nima-phrase-wav-ready`,
  and `[FORZA_AUDIO_UNDERRUN]` events to diagnose any observed pause.

Technical limit: Piper/VITS gyro needs several complete words to pronounce
natural Persian and creates a complete WAV per request. Literal sound at the
same millisecond as the first word is **not** supported. A gap-free speaking
experience also depends on the actual LLM delivering text fast enough to
prepare enough future audio; the browser cannot speak text that hasn't arrived.
Verify the first audible delay and P95 silence gaps in the live website.

## Nima low-latency phrase prefetch (no model replacement)

The browser now starts up to **two Nima TTS phrase requests in parallel**
while LLM SSE text continues to arrive. The already-loaded Piper model in
`forza-voice` is unchanged. The server's bounded single-model inference
semaphore still serializes actual inference to protect the 3-vCPU VPS.

The browser holds audio responses only in RAM, queues them by **original
SSE phrase sequence**, and feeds the existing `ForzaContinuousWav` player.
This player uses one `AudioContext` clock, so future PCM buffers may be
scheduled while earlier speech is playing, without opening/closing a media
element between sentences. It aims for ~2 seconds of ready audio before
starting; if the first short phrase has less audio, the hold is capped at
120 ms after the first complete WAV arrives. Text can appear immediately,
while speech uses complete phrases rather than individual letters.

The first no-punctuation phrase threshold is approximately 38 Persian characters, and subsequent phrases target 76 characters (previously 80), splitting only on finished word boundaries. The original exact LLM
display text stays unchanged. No synthesized WAV, PCM, transcript or browser
audio cache is written to disk.

**Limit:** The buffer cannot conceal a true 10-second LLM text stall if there
are less than 10 seconds of audio prepared. The Nima API remains
non-phoneme-streaming (each `/speak` request produces one WAV), so truly
zero-latency gap-free output is not guaranteed.

After CI succeeds and code is merged into main, deploy the source in place:

```bash
cd /opt/sanatpish
sudo /usr/local/sbin/sanatpish-deploy
```

**Do not run `git pull` first**: the deploy script fetches and promotes
the new revision itself. If the new revision was already checked out and
`Already current` appears without a rebuild, the reviewed explicit rebuild
mode is:

```bash
cd /opt/sanatpish
sudo env SANATPISH_DEPLOY_REBUILD_CURRENT=1 bash ops/sanatpish-deploy.sh
```

The existing Nima voice container, model, its internal token, Docker limits,
Nginx and PostgreSQL data are not changed by the front-end scheduler update.

For a real browser test, use Chrome DevTools Console, ask for a four-sentence
reply and observe `[FORZA_NIMA_BUFFER]`,
`[FORZA_AUDIO_UNDERRUN]` and `phase=nima-incremental-finished`.
Verify voice remains Nima:

```bash
curl -fsS http://127.0.0.1:3001/api/ai/forza-voice-info
```

## Real VPS canary result, 2026-11-01

The user ran the isolated Nima canary against commit `8b67db131aaf`
and reported a genuine **7.93-second WAV generated in 2,735 ms** on the
limited two-vCPU container, RTF=0.345, `frames=1`, `generated_files=0`,
`FORZA_NIMA_PRIVATE_CANARY_PASS`, and `live_changed=0`.
This is a successful real-time-factor performance check, **not** a
guarantee of under-one-second initial audible latency or of uninterrupted
streamed conversations.


### Recovery from `voice_info_route_missing` after `Already current`

If the operator ran `git pull` before the original
`/usr/local/sbin/sanatpish-deploy`, the old deploy helper used to exit
without rebuilding `dist` or restarting Node when HEAD already equalled
origin/main. The new `forza-nima-go-live-vps.sh` detects this *before the
voice cutover*, rebuilds the **current** commit using the source-controlled
`ops/sanatpish-deploy.sh` in isolated staging and then checks that the real
Express API returns JSON:

```bash
cd /opt/sanatpish
git fetch origin main && git pull --ff-only origin main
sudo bash ops/forza-nima-go-live-vps.sh
```

Expected recovery markers:
`FORZA_NIMA_STALE_APP_DETECTED`,
`Rebuilding already checked-out revision`,
`DEPLOY_OK`, `FORZA_NIMA_APP_READY`, then
`FORZA_NIMA_LIVE_OK`. If build or runtime validation fails, the script
aborts **before** touching the original voice container. An attempted
rollback without a Nima marker after this early abort correctly reports
`missing_nima_rollback_data`; do not run rollback before a Nima cutover.
The repair does not directly modify the database or Nginx.

## Activate Nima instead of Pocket, including the exact welcome text

**Before starting:** ensure the 728-clip teacher generator is no longer
running; do not interrupt it. This stage updates the main site code once,
builds a private Nima voice container and changes only the private voice
runtime and Node app configuration. Supabase / Nginx are not modified.
On any failure after the switch the script attempts to restore Pocket.

```bash
cd /opt/sanatpish
git fetch origin main
git pull --ff-only origin main
sudo bash ops/forza-nima-go-live-vps.sh
```

Expected `FORZA_NIMA_LIVE_OK` and
`FORZA_NIMA_LIVE_AUDIO_PASS greeting=1 wav=1 framed_wav=1 incremental=1`.
It validates the health of the Node app, new `/api/ai/forza-voice-info`
endpoint, Nima welcome WAV, full fallback WAV, and framed WAV. The script
retains the previous selected Pocket container in a stopped backup for
rollback. It never deletes the original voice model or the training data.

If there is an issue after activation, restore original Pocket with:

```bash
sudo bash /opt/sanatpish/ops/forza-nima-rollback-vps.sh
```

After successful activation, open the real `/ai-forza` page in a browser,
verify that the welcome has Nima's voice, then ask a 3–4 sentence question.
Check the live console for `phase=first-text`,
`phase=nima-incremental-finished` and any `FORZA_AUDIO_UNDERRUN` messages.
A `FORZA_NIMA_LIVE_OK` deployment alone does not establish that live
mic/STT, model text generation, browser autoplay, human pronunciation or
gap-free multi-clause playback meet the requested standard.


**Latency**: no guarantee of zero gaps. Measured p95 first phrase, model RTF
and AudioContext underruns on the actual VPS are the acceptance criteria.
The LLM still delivers its text over SSE; a streaming clause policy can only
speak a complete phrase once enough text has arrived. VITS itself produces
audio per TTS request and these are buffered/scheduled for contiguous playback.
