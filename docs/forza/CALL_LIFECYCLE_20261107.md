# FORZA call lifecycle follow-up

Based on main 8784413. Public health probe on 2026-11-07 still reported
6d60273 and serverSttConfigured=false. No production deployment or database
change was performed from this workspace.

## Changes

- A shared teardown runs on hangup and unmount even before particles form.
  It aborts the active turn, detaches recognizer/recorder restart handlers,
  stops microphone tracks, disconnects owned audio nodes, cancels playback,
  closes the owned AudioContext, and clears captured audio and history.
- A microphone acquisition generation rejects and stops streams returned after
  exit or superseded permission requests. Closed calls cannot reopen audio or
  restart listening. Teardown remains safe when called twice.
- Dispose particle geometries in addition to existing materials and renderer.
- Load image-search UI only when opened, rather than as a call entry dependency.
- Stream and JSON completion share the same consultation instructions, including
  explicit correction precedence, grounded catalog claims, and separate voice
  and desk response formats. This does not prove factual model quality.

## Validation

39 targeted tests pass (including actual teardown callback execution against
browser doubles, stale acquisition guard, stream/JSON request parity, SSE
completion, cancellation, speech endpointing and buffered Nima playback).
Database tests: 25 pass. Portal tests: 50 pass. TypeScript and production build
are checked separately. Existing large-chunk warnings remain.

## Deployment and remaining verification

Merge the change into main, then use the existing owner deployment command:

```sh
cd /opt/sanatpish
sudo sanatpish-deploy-main
curl --noproxy '*' -fsS --max-time 15 http://127.0.0.1:3013/api/health
```

This app deployment does not implicitly update the private Nima service or
provision an ASR model. Do not print env values or enable paid providers.
No promise of zero latency or acoustic echo elimination is made. On production,
verify hangup during permission acquisition, hangup before particle completion,
10 enter/exit cycles, browser microphone indicator, memory/GPU stability, actual
speakerphone echo, near-user interruption, xKiro time to first text, SSE terminal
signals, and audio transfer gaps. Missing server ASR remains an explicit blocker
when browser STT fails.

## Natural-turn follow-up (based on main 18ef41d)

- Remove the voice client's second `/forza-live` text-generation request after
  a `/consult-stream` error. Provider recovery belongs to the server bridge;
  a timeout must no longer become a generic welcome passed to Nima as an answer.
  Raw recorded-audio STT compatibility remains separately guarded.
- Warm the fixed Persian acknowledgement `بله، بفرما.` once after the welcome,
  using the existing private Nima endpoint. Cache only the returned WAV in RAM
  for this call. Final pure stop commands dispatch immediately, without waiting
  for endpointing or the LLM. A 180ms grace lets continued customer speech cancel
  the acknowledgement. Failed/unready warmup remains silent; no post-stop model
  or synthesis request is issued. Pending/playing acknowledgement cancels on new
  speech, interruption, exit, or disposal; speaker mute silences playback. New questions/corrections are not
  consumed as pure stop commands. Browser ASR finalization latency still applies.
- Completed final text uses a 250ms revision guard when acoustic silence is
  independently available. Keep the full acoustic pause, full guards on interim
  and unfinished thoughts, and the prior behavior when VAD is unavailable.
  Schedule from remaining evidence instead of restarting the full pause on a
  late final ASR event.
- Keep a bounded 2.5s/final-six-phrase echo history of actually audible phrases,
  not future queued text. This reduces delayed preceding-phrase text echo; it
  does NOT identify a nearby speaker or replace acoustic echo cancellation.
- Cancel SSE bodies on error as well as completion. Bound client Nima phrase fetches
  at 35 seconds, retaining explicit cancellation and the legacy Pocket
  full-answer timeout.

Validation: 55 targeted tests plus 40 additional voice regression tests pass;
25 database and 58 portal tests pass. TypeScript and production build pass.
Tests cover cached acknowledgement, cancellation/coalescing, failed/late warmup,
final/interim endpoint guards, recent echo expiration, and upstream body cleanup.
No real microphone acoustic test or sub-second end-to-end benchmark is claimed.

Production probe still reported revision 6d60273 and no configured server STT.
Deploy after this PR is merged using the existing owner command. Then test a
clear question, pure `وایسا`, `صبر کن، منظورم 6203ZZ بود`, immediate continuation
before acknowledgement, background conversation, speakerphone self-echo, API
failure (no fake greeting), and hangup/re-entry. Check actual first audio and
provider errors, not just HTTP headers. Streaming ASR provisioning and reliable
near-speaker discrimination remain separate work requiring hardware/runtime
measurements; no new paid provider or audio model is silently enabled here.
