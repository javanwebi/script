# Diba streaming recognition

The call page probes `/api/ai/forza-stt-stream-info`, then opens the existing
same-origin `/api/live?stt=diba` WebSocket. With Diba selected and its model
installed, this is the primary recognizer. The existing microphone AudioWorklet
feeds mono 16 kHz PCM16 little endian; the browser displays Diba partial results.
A partial is not submitted as a completed user turn: end-of-turn requests a
`flush`, waits for Diba's final result, then uses the existing conversation,
barge-in, echo guard, AvalAI and Piper Nima pipeline. Explicit stop commands can
interrupt without the loudness gate; non-command speech retains the echo guard.

There is no HTTP upload/FFmpeg/file boundary on the streaming path. Python keeps
one Vosk recognizer per socket in RAM. It shares the model across recognizers;
closing a connection releases its recognizer after bounded pending chunks.
The existing HTTP batch path and local/browser fallbacks remain available.
No new paid provider or visual changes are introduced.

## Operations

Deploy with the existing `sudo sanatpish-deploy-main` command. The main application
image copies the worker script with the repository. It uses the existing
`FORZA_STT_PYTHON` and `FORZA_STT_DIBA_MODEL_PATH` settings. No migration is needed.
The quick capability endpoint reports selection/model presence, **not successful
inference**. The socket only reports ready after Python loads the model and
creates the session recognizer. Existing `/api/live` WebSocket proxying must work.

Bounds: two worker processes, twenty recognizers per process, 8192-byte frames,
64 KB/s per client, bounded stdin/output buffers, 20-second model startup timeout,
45-second idle cleanup and browser heartbeat. Congestion fails explicitly and
triggers recovery rather than silently discarding PCM. Forty is an admission
ceiling, **not a validated concurrency/latency guarantee**. These models are in
addition to any batch-STT processes; monitor memory and CPU on the actual VPS.

If capability discovery fails, the browser uses Web Speech when available. Two
stream failures also select that fallback for this recognition instance; existing
local recovery follows repeated network errors. Startup/failure can lose the
current spoken fragment, so the UI exposes reconnection rather than claiming it
was understood. This is not speaker diarization or an acoustic accuracy upgrade
to the installed Diba model. It does not infer/correct industrial codes by guess.

## Validation

`node --import tsx --test tests/forzaDibaRecognition.test.ts` checks PCM encoding,
partial replacement, final boundaries, flush coalescing, teardown, capability
fallback and late callbacks. `python3 -m unittest discover -s tests -p
 'test_forza_diba_stream.py'` checks the recognizer protocol and session isolation.
These use fakes and do not prove real speech recognition accuracy.

Before calling production quality verified, test actual Persian speech with the
installed model on desktop and mobile, quiet speech, loudspeaker echo, industrial
noise, codes/numbers, mid-answer interruptions, reconnects and concurrent calls.
Measure word/code errors and p50/p95 first-partial/final latency. Preserve the
previous deployment for rollback if the streaming model cannot keep up.
