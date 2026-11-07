# FORZA realtime path and upgraded-VPS rollout — 2026-11-07

## Findings and scope

The public voice-info route identified Nima with incremental speech enabled.
The private worker source nevertheless admitted only one inference and one
waiter. One browser requested two phrases ahead; that could fill admission for
other customers. Piper 1.8.0 uses a default ONNX session thread pool, which is not
bounded by the OMP environment variable alone.

A live public HTTPS text-only greeting probe selected xKiro. First text arrived
21,287 ms after the client request; subsequent read timed out at about 41 s.
These are WAN/public-route measurements, not isolated model-inference timings.
Faster local TTS cannot voice words before the text provider supplies them.
The live STT-info route reported serverSttConfigured:false/provider:none. No
independent local/server ASR model was provisioned or silently substituted.

## Changes

- Each private Nima process owns its own warmed Piper voice and explicit CPU
  ONNX session: one intra-op thread, one inter-op thread, sequential execution.
  Independent processes avoid sharing phonemizer/engine state across customers.
  Default is one worker; FORZA_NIMA_WORKERS permits 1–8. FIFO admission and a
  bounded pending pool retain a 2.5 s queue deadline, with fast overload errors.
- Every worker must signal warm readiness before health turns healthy. Health
  reports workers, active/waiting jobs, admission bound and thread count. Auth,
  pinned gyro voice, in-memory WAV transport and no customer audio files remain.
- Nonblocking disconnect detection first polls socket readability; Python's
  timeout handling otherwise waits even when recv uses MSG_DONTWAIT. Running
  native inference cannot be safely preempted mid-call; its capacity lease stays
  held until it completes. Unstarted jobs can be cancelled and results discarded.
- Browser lookahead is at most four unplayed phrases, two concurrent fetches.
  Playback releases capacity for subsequent work. A fast text stream cannot
  pre-synthesize an entire long answer and monopolize CPU or retain many WAVs.
- Cancellation/failure aborts sibling TTS requests and finish waits are abortable,
  including when a transport ignores abort. Playback order and heard-history
  semantics stay unchanged. No text is considered heard merely because it queued.
- During provider idle, a first group of at least three complete, whitespace-
  terminated words may start TTS before 38 characters arrive. Unfinished words
  and SKU suffixes remain held; explicit final text still determines completion.
- Verified free xKiro model discovery warms during voice setup instead of the
  customer's first turn. Successful free fallbacks with measured TTFT <=3 s are
  reused for voice for ten minutes, rather than blindly rotating to unknown slow
  models. No extra speculative generation requests, paid models or new keys.
- Incremental TTS rate defaults are 120 requests/network/min and 24 phrases/turn.
  Optional FORZA_TTS_REQUESTS_PER_NETWORK (30–600) and
  FORZA_TTS_PHRASES_PER_TURN (12–48) are bounded. Turn IDs never bypass the
  aggregate IP cap. Shared NAT networks may still hit the ceiling under load.
- Browser STT retries only transient network failures, at 400/1200/2800 ms.
  Permission, language and capture errors do not cause prompt loops. Valid text
  resets the retry allowance; closing/rebuilding microphone clears old timers
  and detaches the old recognizer. This is recovery, not a new ASR model or an
  accuracy guarantee when the browser speech provider is unavailable.

No particle, scene, layout, voice identity, catalogue records or schema changes.
No replacement of voice-provider/STT credentials or billing policy.

## Real model validation

Piper 1.8.0, the original 63,122,309-byte gyro ONNX file and the Dockerfile's
SHA-256 pin were used in an isolated CPU test with two warmed processes.
Two simultaneous short Persian synthesis requests completed in 184/186 ms;
reported inference was 182/184 ms and queue was zero. Both produced valid WAVs
under the original Nima identity. Generated audio stayed in memory.

This validates that implementation and workload in this workspace, not a VPS
latency SLA, Persian transcription quality, 40 concurrent conversations or a
voice/text/STT end-to-end capacity claim. Test broader real customer phrases on
VPS; text-provider rate limits/network, browser STT, acoustic echo, actual CPU and
available buffering can still cause delay or failure. Do not promise zero gaps
if text or audio production is slower than playback.

## Deploy with the owner's fixed command

```bash
cd /opt/sanatpish
sudo sanatpish-deploy-main
sudo bash ops/upgrade-forza-realtime-vps.sh --app sanatpish-app
```

The first command deploys app/client changes. The helper stages a private Nima
image from the existing verified running voice image: no apt/pip/model download,
no public port, no database/Nginx/app-environment changes. It selects up to four
workers using CPU affinity minus two reserved cores and available RAM minus
2 GiB, with a 512 MiB/worker budget and a memory margin. It verifies startup,
authenticated concurrent WAV requests, then switches the private voice container
under its existing name. The app's own speech endpoint must also return a valid
Nima WAV before success. A failed promotion attempts to restore the stopped old
container; no broad cleanup/reset/prune is performed. Active calls can be affected
by the existing app deployment and brief private-voice cutover.

Record FORZA_CONCURRENCY_CANARY and the helper's workers/CPU/memory output; these
are measured synthesis jobs, not a certified concurrent-call count. The stopped
old container name is printed as VOICE_ROLLBACK_CONTAINER and retained. An
operator can stop/remove only the new forza-voice container, rename that exact
backup to forza-voice and start it to restore the old private service.

The helper does not automatically add itself to the owner's custom
/usr/local/sbin/sanatpish-deploy-main; future worker-source changes require the
same explicit helper. Ordinary site deployments keep the private service.

## Reproduce tests

```bash
python3 -m unittest discover -s tests -p 'test_forza_nima*.py'
FORZA_NIMA_TEST_MODEL=/path/to/fa_IR-gyro-medium.onnx \
  /path/to/piper-venv/bin/python -m unittest discover -s tests -p 'test_forza_nima_pool.py'
node --import tsx --test tests/forzaNimaBufferedSpeech.test.ts tests/forzaNimaIncrementalSpeech.test.ts tests/forzaRecognitionRecovery.test.ts tests/forzaTtsBudget.test.ts tests/xkiro-free-failover.test.ts
```

Chromium UI regressions also passed locally: immediate Persian interim subtitles,
one bounded restart after a simulated recognizer network error, no restart after
permission rejection, and two consecutive incremental Nima turns with exact text
coverage and released turn locks. Those browser cases mock speech/SSE transport;
the separate two-process Piper test exercises the actual trained voice. They do
not establish live microphone/echo accuracy or an independent STT deployment.
