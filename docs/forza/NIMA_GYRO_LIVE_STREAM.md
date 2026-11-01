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

**Latency**: no guarantee of zero gaps. Measured p95 first phrase, model RTF
and AudioContext underruns on the actual VPS are the acceptance criteria.
The LLM still delivers its text over SSE; a streaming clause policy can only
speak a complete phrase once enough text has arrived. VITS itself produces
audio per TTS request and these are buffered/scheduled for contiguous playback.
