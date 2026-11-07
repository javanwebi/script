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
